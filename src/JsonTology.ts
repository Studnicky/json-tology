/**
 * JsonTology
 *
 * Declare your schemas once and get types, runtime validation, materialization,
 * and a data ontology for free — all from a single object.
 *
 * @example
 * const jt = JsonTology.create({
 *   baseIRI: 'https://myapp.io',
 *   schemas: [UserSchema, OrderSchema] as const,
 * });
 *
 * type User = InferType<typeof UserSchema>;
 *
 * const user = jt.instantiate(UserSchema.$id, data); // typed as User
 * jt.validate(UserSchema.$id, data);
 * jt.ontology().jsonLd();
 */

import type { JSONSchema7Definition } from 'json-schema';

import type { DumpOptionsInterface } from './interfaces/Dump.js';
import type { InvariantInterface } from './interfaces/Invariant.js';
import type { ComputedFnType } from './types/Computed.js';
import type { JsonTologyOptionsInterface } from './interfaces/Config.js';
import type { JsonSchemaType } from './types/Schema.js';
import type { LoaderType } from './types/Loader.js';
import type { MaterializerInterface } from './interfaces/MaterializerImpl.js';
import type { PrefetchOptionsInterface } from './interfaces/Prefetch.js';
import type { QuadInterface } from './interfaces/Quad.js';
import type { RegistryOptionsInterface } from './interfaces/Registry.js';
import type { SchemaRegistryInterface } from './interfaces/SchemaRegistry.js';
import type { SnapshotInterface } from './interfaces/Snapshot.js';
import type { ValueInterface } from './interfaces/ValueImpl.js';
import type { ValidationErrors } from './errors/ValidationErrors.js';
import type {
  InferSchemaType, MaterializedSchemaType, SchemaPointerPathsType
} from './types/Infer.js';
import type {
  ParseOutputType, TransformedType
} from './types/Transform.js';
import type {
  SchemaEntryType, SchemaMapFromTupleType, UniqueSchemaIdsType
} from './types/Registry.js';
import type { SchemaRefType } from './types/SchemaRef.js';
import type { SkolemizeFnType } from './types/Skolemize.js';

import { GraphError } from './errors/GraphError.js';
import { Curie } from './modules/rdf/Curie.js';
import { Skolemize } from './modules/rdf/Skolemize.js';
import { Dumper } from './modules/data/Dumper.js';
import { FormatRegistry } from './modules/format/FormatRegistry.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphSchemaSerializer } from './modules/ontology/GraphSchemaSerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { Lift } from './modules/rdf/Lift.js';
import { Materializer } from './modules/materialization/Materializer.js';
import { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
import { SchemaError } from './errors/SchemaError.js';
import type { DuplicateReportEntryType } from './modules/registry/SchemaRegistry.js';
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import { Transform } from './modules/transform/Transform.js';
import { Value } from './modules/data/Value.js';

import { DEFAULT_PREFIXES } from './constants/PREFIXES.js';

const STATIC_BASE_IRI = 'http://json-tology.dev/_/static';

/**
 * The literal string `'blank-node'` requests anonymous-node subjects
 * for every object in the projection. Exposed as a separate constant
 * so consumers can spell the magic value without importing it inline.
 */
export const BLANK_NODE_IRI_FOR = 'blank-node';

/**
 * Per-call options accepted by `toQuads`.
 *
 * `iriFor` — if a string IRI, overrides the root subject IRI (depth 0);
 * nested objects fall through to the default minter. If the literal
 * `'blank-node'`, every object subject is emitted as an anonymous blank
 * node `_:b<n>` (counter scoped to the projectAbox call). If a function,
 * called once per object subject with `{ path, value, depth }` and returns
 * either an IRI or `undefined` to fall through.
 *
 * `graphIRI` — when set, every emitted quad has its `graph` field stamped
 * with this IRI.
 */
export interface ToQuadsOptionsType {
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | string | undefined;
}

interface NormalizedToQuadsOptionsType {
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
}

function rootIriOnly(iri: string): SkolemizeFnType {
  return (ctx) => {
    return ctx.depth === 0 ? iri : undefined;
  };
}

function blankNodeStrategy(): SkolemizeFnType {
  let counter = 0;

  return () => {
    const name = `_:b${counter}`;

    counter++;

    return name;
  };
}

function blankNodeNameFor(iri: string): string {
  const slash = iri.lastIndexOf('/');

  return slash === -1 ? iri : iri.slice(slash + 1);
}

/**
 * Reconstructs blank-node-style references from well-known genid IRIs.
 * Quads whose subject or object is a NamedNode matching the well-known
 * genid pattern are rewritten to BlankNode terms so downstream lifting
 * sees them as anonymous nodes.
 */
function deskolemizeQuads(quads: readonly QuadInterface[]): QuadInterface[] {
  return quads.map((quad) => {
    const subjectGenid = Skolemize.isWellKnownGenid(quad.subject);
    const objectGenid = quad.object.termType === 'NamedNode'
      && Skolemize.isWellKnownGenid(quad.object.value);

    if (!subjectGenid && !objectGenid) {
      return quad;
    }

    const subject = subjectGenid ? `_:${blankNodeNameFor(quad.subject)}` : quad.subject;
    const object = objectGenid && quad.object.termType === 'NamedNode'
      ? {
        'termType': 'BlankNode' as const,
        'value': blankNodeNameFor(quad.object.value)
      }
      : quad.object;

    const rewritten: QuadInterface = {
      object,
      'predicate': quad.predicate,
      subject
    };

    if (quad.graph !== undefined) {
      rewritten.graph = quad.graph;
    }

    return rewritten;
  });
}

function liftIriForOption(raw: SkolemizeFnType | string | undefined): SkolemizeFnType | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw !== 'string') {
    return raw;
  }

  return raw === BLANK_NODE_IRI_FOR ? blankNodeStrategy() : rootIriOnly(raw);
}

function appendSameAsQuads(
  quads: QuadInterface[],
  pairs: ReadonlyArray<readonly [string, string]>,
  graphIRI: string | undefined
): void {
  if (pairs.length === 0) {
    return;
  }
  const expandedSameAs = 'http://www.w3.org/2002/07/owl#sameAs';

  for (const [
    a,
    b
  ] of pairs) {
    const forward: QuadInterface = {
      'object': {
        'termType': 'NamedNode',
        'value': b
      },
      'predicate': expandedSameAs,
      'subject': a
    };
    const reverse: QuadInterface = {
      'object': {
        'termType': 'NamedNode',
        'value': a
      },
      'predicate': expandedSameAs,
      'subject': b
    };

    if (graphIRI !== undefined) {
      forward.graph = graphIRI;
      reverse.graph = graphIRI;
    }
    quads.push(forward);
    quads.push(reverse);
  }
}

function normalizeToQuadsOptions(options: ToQuadsOptionsType | undefined): NormalizedToQuadsOptionsType {
  if (options === undefined) {
    return {};
  }

  const graphIRI = options.graphIRI;
  const iriFor = liftIriForOption(options.iriFor);

  if (iriFor === undefined) {
    return graphIRI === undefined ? {} : { graphIRI };
  }

  return graphIRI === undefined
    ? { iriFor }
    : {
      graphIRI,
      iriFor
    };
}


/**
 * JsonTology — unified type system, validation, materialization, and ontology.
 *
 * @typeParam TMap — accumulated schema type map. Built automatically via
 * `create()` or chained `register()` calls.
 */
export class JsonTology<TMap = Record<never, never>> {
  /**
   * Narrows a JSONSchema7Definition to a named-schema object.
   * Throws SchemaError if the value is a boolean schema or lacks `$id`.
   */
  private static asNamedSchema(schema: JSONSchema7Definition): Record<string, unknown> & { '$id': string } {
    if (typeof schema === 'boolean' || typeof (schema as Record<string, unknown>).$id !== 'string') {
      throw new SchemaError('SCHEMA_MISSING_ID', 'Schema must be an object with a string $id');
    }

    return schema as Record<string, unknown> & { '$id': string };
  }

  /**
   * Creates a {@link JsonTology} instance with constructor-time schemas and full
   * type inference.
   *
   * Schemas passed via `schemas` are registered first. Schemas from `prefetched`
   * fill in any IRIs not already in the registry; IRIs already registered are
   * skipped, so `schemas` wins on collision.
   *
   * @param options - `baseIRI`, optional `schemas`, optional `prefetched`, prefixes, dialect.
   */
  public static create<const TSchemas extends ReadonlyArray<{ readonly '$id': string; }>>(options: JsonTologyOptionsInterface<TSchemas> & { 'schemas'?: UniqueSchemaIdsType<TSchemas> }): JsonTology<SchemaMapFromTupleType<TSchemas>> {
    const jt = new JsonTology(options);

    if (options.schemas && options.schemas.length > 0) {
      // Cast needed: const generic TSchemas preserves literal types that don't widen to Record<string, unknown>
      jt.registry.register(options.schemas);
    }

    if (options.prefetched !== undefined) {
      for (const [
        iri,
        schema
      ] of options.prefetched.schemas) {
        if (typeof schema !== 'boolean' && !jt.registry.has(iri)) {
          jt.registry.register(schema);
        }
      }
    }

    return jt as unknown as JsonTology<SchemaMapFromTupleType<TSchemas>>;
  }

  /**
   * Dump — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param value - The value to serialize.
   * @param options - Filtering and mode options.
   * @returns Wire-form representation.
   */
  public static dump<TSchema extends Record<string, unknown> & { readonly '$id': string }>(
    schema: TSchema,
    value: InferSchemaType<TSchema>,
    options?: DumpOptionsInterface
  ): unknown {
    const jt = JsonTology.ephemeral(schema);

    return jt.dump(schema as JSONSchema7Definition & { readonly '$id': string }, value, options);
  }

  // ---------------------------------------------------------------------------
  // Static counterparts — ephemeral registry, one-shot execution
  // ---------------------------------------------------------------------------

  /**
   * DumpJson — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param value - The value to serialize.
   * @param options - Filtering and mode options.
   * @returns JSON string.
   */
  public static dumpJson(
    schema: Record<string, unknown> & { readonly '$id': string },
    value: unknown,
    options?: Omit<DumpOptionsInterface, 'mode'>
  ): string {
    const jt = JsonTology.ephemeral(schema);

    return jt.dumpJson(schema as JSONSchema7Definition & { readonly '$id': string }, value, options);
  }

  private static ephemeral(schema: Record<string, unknown> & { readonly '$id': string }): JsonTology {
    return JsonTology.create({
      'baseIRI': STATIC_BASE_IRI,
      'schemas': [schema] as const
    });
  }

  /**
   * FromQuads — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param quads - RDF quads to lift.
   * @returns Array of validated, typed objects.
   */
  public static fromQuads<TSchema extends Record<string, unknown> & { readonly '$id': string }>(
    schema: TSchema,
    quads: QuadInterface[],
    options?: { 'deskolemize'?: boolean }
  ): Array<InferSchemaType<TSchema>> {
    const jt = JsonTology.ephemeral(schema);

    return jt.fromQuads(schema, quads, options) as Array<InferSchemaType<TSchema>>;
  }

  /**
   * Instantiate — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param data - The data to instantiate.
   * @param options - Per-call options.
   * @returns The validated and normalized value.
   */
  public static instantiate<TSchema extends Record<string, unknown> & { readonly '$id': string }>(
    schema: TSchema,
    data: unknown,
    options?: { 'enableDefaults'?: boolean }
  ): InferSchemaType<TSchema> {
    const jt = JsonTology.ephemeral(schema);

    return jt.instantiate(schema as JSONSchema7Definition & { readonly '$id': string }, data, options) as InferSchemaType<TSchema>;
  }

  /**
   * Type guard — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param data - The data to check.
   * @returns Whether the data conforms to the schema.
   */
  public static is(schema: Record<string, unknown> & { readonly '$id': string }, data: unknown): boolean {
    const jt = JsonTology.ephemeral(schema);

    return jt.is(schema, data);
  }

  /**
   * Materialize — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param data - Optional partial data.
   * @param options - Materialization options.
   * @returns A fully materialized instance.
   */
  public static materialize<TSchema extends Record<string, unknown> & { readonly '$id': string }>(
    schema: TSchema,
    data?: Partial<InferSchemaType<TSchema>>,
    options?: { 'enablePartial'?: boolean }
  ): MaterializedSchemaType<TSchema> {
    const jt = JsonTology.ephemeral(schema);

    return jt.materialize(schema as JSONSchema7Definition & { readonly '$id': string }, data as Record<string, unknown>, options) as MaterializedSchemaType<TSchema>;
  }

  /**
   * Ontology — ephemeral registry variant. No instance required.
   *
   * @param schemas - Array of schema objects with `$id`.
   * @returns An {@link OntologyBuilder} containing OWL + SHACL output.
   */
  public static ontology(schemas: ReadonlyArray<Record<string, unknown> & { readonly '$id': string }>): OntologyBuilder {
    const jt = JsonTology.create({ 'baseIRI': STATIC_BASE_IRI });

    jt.registry.register(schemas);

    return jt.ontology();
  }

  /**
   * Walks transitive `$ref` IRIs via the loader and returns a {@link SnapshotInterface}.
   *
   * Seeds the walk from `rootIds` (loaded directly) and `schemas` (followed for their
   * refs). Recurses until every cross-schema `$ref` resolves. Throws
   * `GraphError('REF_UNRESOLVED')` if the loader returns `null` for a required IRI;
   * loader-thrown errors propagate.
   *
   * Pass the result to {@link JsonTology.create} via `prefetched` for sync consumption.
   *
   * @param options - `loader`, optional `rootIds`, optional `schemas`, optional `baseIRI`.
   */
  public static async prefetch(options: PrefetchOptionsInterface): Promise<SnapshotInterface> {
    const baseIRI = options.baseIRI ?? STATIC_BASE_IRI;
    const tmp = new JsonTology({ 'baseIRI': baseIRI });

    if (options.schemas && options.schemas.length > 0) {
      tmp.registry.register(options.schemas);
    }

    if (options.rootIds) {
      for (const iri of options.rootIds) {
        if (tmp.registry.has(iri)) {
          continue;
        }

        const loaded = await options.loader(iri);

        if (loaded === null) {
          throw new GraphError('REF_UNRESOLVED', `loader returned null for IRI: ${iri}`, iri);
        }

        if (typeof loaded !== 'boolean') {
          tmp.registry.register(loaded);
        }
      }
    }

    await tmp.resolveAllRefs(options.loader);

    const schemas = new Map<string, JsonSchemaType>();

    for (const schema of tmp.registry.list()) {
      const id = schema.$id;

      if (typeof id === 'string') {
        schemas.set(id, schema);
      }
    }

    return {
      'schemas': schemas,
      'version': 1
    };
  }

  /**
   * SubschemaAt — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param pointer - JSON Pointer into the schema.
   * @returns The resolved sub-schema object.
   */
  public static subschemaAt(
    schema: Record<string, unknown> & { readonly '$id': string },
    pointer: string
  ): Record<string, unknown> & { '$id': string } {
    const jt = JsonTology.ephemeral(schema);

    return jt.subschemaAt(schema, pointer);
  }

  /**
   * ToQuads — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param data - Instance data to project.
   * @param options - Optional overrides: see {@link ToQuadsOptionsType}.
   * @returns The projected RDF quads.
   */
  public static toQuads(
    schema: Record<string, unknown> & { readonly '$id': string },
    data: unknown,
    options?: ToQuadsOptionsType
  ): QuadInterface[] {
    const jt = JsonTology.ephemeral(schema);

    return jt.toQuads(schema, data, options);
  }

  /**
   * ToSchema — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @returns The reconstructed schema object.
   */
  public static toSchema(schema: Record<string, unknown> & { readonly '$id': string }): Record<string, unknown> | undefined {
    const jt = JsonTology.ephemeral(schema);

    return jt.toSchema(schema);
  }

  /**
   * ToShacl — ephemeral registry variant. No instance required.
   *
   * @param schemas - Array of schema objects with `$id`.
   * @returns An {@link OntologyBuilder} containing SHACL shape quads.
   */
  public static toShacl(schemas: ReadonlyArray<Record<string, unknown> & { readonly '$id': string }>): OntologyBuilder {
    const jt = JsonTology.create({ 'baseIRI': STATIC_BASE_IRI });

    jt.registry.register(schemas);

    return jt.toShacl();
  }

  /**
   * ToTbox — ephemeral registry variant. No instance required.
   *
   * @param schemas - Array of schema objects with `$id`.
   * @returns An {@link OntologyBuilder} containing OWL TBox quads.
   */
  public static toTbox(schemas: ReadonlyArray<Record<string, unknown> & { readonly '$id': string }>): OntologyBuilder {
    const jt = JsonTology.create({ 'baseIRI': STATIC_BASE_IRI });

    jt.registry.register(schemas);

    return jt.toTbox();
  }

  /**
   * Validate — ephemeral registry variant. No instance required.
   *
   * @param schema - A schema object with `$id`.
   * @param data - The data to validate.
   * @returns A {@link ValidationErrors} instance.
   */
  public static validate(schema: Record<string, unknown> & { readonly '$id': string }, data: unknown): ValidationErrors {
    const jt = JsonTology.ephemeral(schema);

    return jt.validate(schema, data);
  }

  private readonly baseIRI: string;
  private readonly defaultDeskolemize: boolean;
  private readonly defaultGraphIRI: string | undefined;
  private readonly defaultIriForRaw: SkolemizeFnType | string | undefined;

  public readonly materializer: MaterializerInterface;
  private ontologyCache: null | {
    'builder': OntologyBuilder;
    'revision': number;
  } = null;
  private readonly ontologySerializer: GraphOntologySerializer;
  private readonly prefixes: Record<string, string>;
  /**
   * Direct access to the underlying schema registry for advanced use cases.
   *
   * Provides access to `engine()` for direct GraphEngine execution with custom
   * options, `graph()` for schema graph introspection, `validator()` for embedding
   * compiled validators in middleware, and `listGraphs()` for custom ontology tooling.
   *
   * Most consumers should use the facade methods (validate, instantiate, errors, etc.)
   * instead of accessing the registry directly.
   */
  public readonly registry: SchemaRegistryInterface;

  private readonly shaclSerializer: GraphShaclSerializer;

  /**
   * Value operations — schema-aware (instance: cast, clean, convert, create)
   * and pure (static: clone, diff, hash, applyOp).
   */
  public readonly value: ValueInterface<TMap>;

  /**
   * Constructs a new {@link JsonTology} instance (use {@link JsonTology.create} for the public API).
   *
   * @param options - Configuration including `baseIRI`, prefixes, format validators, `enableTypeCast`, `enableStrictTypes`, and logger.
   */
  private constructor(options: JsonTologyOptionsInterface) {
    let baseIRI = options.baseIRI;

    while (baseIRI.endsWith('/')) {
      baseIRI = baseIRI.slice(0, -1);
    }
    this.baseIRI = baseIRI;

    this.defaultGraphIRI = options.defaultGraphIRI;
    this.defaultDeskolemize = options.defaultDeskolemize === true;
    this.defaultIriForRaw = options.iriFor;

    this.prefixes = {
      ...DEFAULT_PREFIXES,
      ...options.prefixes
    };

    const formatRegistry = FormatRegistry.builtin();

    if (options.formats) {
      for (const [
        name,
        validator
      ] of Object.entries(options.formats)) {
        formatRegistry.register(name, validator);
      }
    }

    const registryOptions: RegistryOptionsInterface = {
      'formatRegistry': formatRegistry,
      'prefixes': this.prefixes,
      ...(options.logger === undefined ? {} : { 'logger': options.logger }),
      ...(options.enableTypeCast === undefined ? {} : { 'enableTypeCast': options.enableTypeCast }),
      ...(options.keywords === undefined ? {} : { 'keywords': options.keywords }),
      ...(options.enableStrictTypes === undefined ? {} : { 'enableStrictTypes': options.enableStrictTypes }),
      ...(options.enableDefaults === undefined ? {} : { 'enableDefaults': options.enableDefaults }),
      ...(options.enableInlineWarnings === undefined ? {} : { 'enableInlineWarnings': options.enableInlineWarnings }),
      ...(options.enableDuplicateDetection === undefined ? {} : { 'enableDuplicateDetection': options.enableDuplicateDetection }),
      ...(options.enableStrictGraph === undefined ? {} : { 'enableStrictGraph': options.enableStrictGraph }),
      ...(options.vocabularies === undefined ? {} : { 'vocabularies': options.vocabularies }),
      ...(options.maxSchemaDepth === undefined ? {} : { 'maxSchemaDepth': options.maxSchemaDepth }),
      ...(options.invariants === undefined ? {} : { 'invariants': options.invariants })
    };

    this.registry = new SchemaRegistry(registryOptions);

    // Wire pre-registered compute functions
    if (options.computeds) {
      for (const [
        schemaId,
        propMap
      ] of Object.entries(options.computeds)) {
        for (const [
          propName,
          fn
        ] of Object.entries(propMap)) {
          this.registry.computedStore.add(schemaId, propName, fn);
        }
      }
    }

    // Cast needed: Value is unparameterized at runtime; aligns with compile-time generic TMap
    this.value = new Value(this.registry) as unknown as ValueInterface<TMap>;
    this.materializer = new Materializer(this.registry, options.materializer);

    // Create Curie with merged prefixes from registry
    const curie = this.registry.curie ?? new Curie(this.prefixes);
    const vocabularies = options.vocabularies ?? [];

    this.ontologySerializer = new GraphOntologySerializer({
      curie,
      vocabularies
    });
    this.shaclSerializer = new GraphShaclSerializer({
      curie,
      vocabularies
    });
  }

  // ---------------------------------------------------------------------------
  // Loader resolution (private)
  // ---------------------------------------------------------------------------

  /**
   * Registers a compute function for a property marked `jt:computed: true`.
   *
   * @param schemaId - The `$id` of the schema owning the computed property.
   * @param name - The property name.
   * @param fn - Function receiving the instantiated/materialized object and returning the computed value.
   */
  public addComputed<T>(
    schemaId: keyof TMap & string, name: keyof T & string, fn: (data: T) => unknown
  ): void;
  // ---------------------------------------------------------------------------
  // Invariants
  // ---------------------------------------------------------------------------
  public addComputed(schemaId: keyof TMap & string, name: string, fn: ComputedFnType): void {
    this.registry.computedStore.add(schemaId, name, fn);
  }
  /**
   * Registers a cross-field invariant for a schema.
   *
   * @param schemaId - The `$id` of the target schema. Must be a registered key
   *   of the typed schema map; unregistered IRIs are rejected at compile time.
   * @param invariant - The invariant to add. Runs after structural validation succeeds.
   */
  public addInvariant<T>(schemaId: keyof TMap & string, invariant: InvariantInterface<T>): void {
    this.registry.addInvariant(schemaId, invariant as InvariantInterface);
  }
  /**
   * Serialize a value to its wire representation.
   *
   * Walks the canonical graph for the schema and projects each property back to
   * wire form — applying any registered {@link Transform} encoder along the way.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param value - The value to serialize (typically the output of `instantiate()`).
   * @param options - Filtering and mode options.
   * @returns Wire-form representation of the value.
   */
  public dump<K extends keyof TMap & string>(schemaId: K, value: TMap[K], options?: DumpOptionsInterface): unknown;
  public dump<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    value: InferSchemaType<TSchema>,
    options?: DumpOptionsInterface
  ): unknown;
  public dump(
    schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }),
    value: unknown,
    options?: DumpOptionsInterface
  ): unknown {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : schema.$id;

    if (typeof schema !== 'string') {
      this.registry.register(schema);
    }

    return Dumper.dump(this.registry, schemaId, value, options);
  }
  /**
   * Serialize a value to a JSON string.
   *
   * Convenience wrapper: `JSON.stringify(jt.dump(..., { mode: 'json', ...options }))`.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param value - The value to serialize.
   * @param options - Filtering and mode options (mode is forced to `'json'`).
   * @returns JSON string.
   */
  public dumpJson<K extends keyof TMap & string>(schemaId: K, value: TMap[K], options?: Omit<DumpOptionsInterface, 'mode'>): string;
  public dumpJson<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    value: InferSchemaType<TSchema>,
    options?: Omit<DumpOptionsInterface, 'mode'>
  ): string;
  public dumpJson(
    schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }),
    value: unknown,
    options?: Omit<DumpOptionsInterface, 'mode'>
  ): string {
    return JSON.stringify(this.dump(schema as (keyof TMap & string), value as TMap[keyof TMap & string], {
      ...options,
      'mode': 'json'
    }));
  }
  /**
   * Encodes a decoded value back to its wire representation using the schema's registered {@link Transform}.
   *
   * @param schema - The schema with an associated transform decoder.
   * @param value - The decoded value to encode.
   * @returns The wire-format representation inferred from the schema.
   */
  public encode<TSchema extends JSONSchema7Definition & { readonly '$id': string; }, TOut extends unknown>(
    schema: TransformedType<TSchema, TOut>,
    value: TOut
  ): InferSchemaType<TSchema> {
    // JSONSchema7Definition includes boolean, but the { '$id': string } constraint on TSchema
    // excludes boolean at runtime. TypeScript cannot reduce this intersection structurally,
    // so a double cast is required to bridge TransformedType to Record<string, unknown>.
    const decoder = Transform.getDecoder(schema as unknown as Record<string, unknown>);

    return (decoder?.encode(value) ?? value) as InferSchemaType<TSchema>;
  }
  /**
   * Report registered schemas (or inline subschemas) whose canonical shape
   * matches another registered schema.
   *
   * The return type narrows `equivalentTo` to the literal union of registered
   * `$id` values when the instance was constructed via `JsonTology.create({
   * schemas: [...] })` or extended through `register()`. Consumers can
   * destructure the IRI as a literal without `as const` casts.
   */
  public findDuplicates<TKey extends string = keyof TMap & string>(): ReadonlyArray<DuplicateReportEntryType<TKey>> {
    return this.registry.findDuplicates() as ReadonlyArray<DuplicateReportEntryType<TKey>>;
  }
  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  /**
   * Lifts RDF quads back into typed JS objects.
   *
   * Inverse of {@link toQuads}: given quads produced by projection, a reasoning
   * engine, or any RDF source, recovers plain JS objects matching the target schema.
   * Each returned object is validated through {@link instantiate} to apply defaults,
   * transforms, and type safety.
   *
   * @param schemaRef - The `$id` of a registered schema, or a schema object with `$id`.
   * @param quads - RDF quads in the module's internal format.
   * @returns Array of validated, typed objects.
   */
  public fromQuads<K extends keyof TMap & string>(
    schemaId: K,
    quads: QuadInterface[],
    options?: { 'deskolemize'?: boolean }
  ): Array<TMap[K]>;
  public fromQuads(
    schemaRef: SchemaRefType<TMap>,
    quads: QuadInterface[],
    options?: { 'deskolemize'?: boolean }
  ): unknown[];
  public fromQuads(
    schemaRef: SchemaRefType<TMap>,
    quads: QuadInterface[],
    options?: { 'deskolemize'?: boolean }
  ): unknown[] {
    const schemaId = typeof schemaRef === 'string' ? schemaRef : (schemaRef as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schemaRef !== 'string') {
      this.registry.register(schemaRef);
    }

    if (this.registry.get(schemaId) === undefined) {
      throw new SchemaError(
        'SCHEMA_NOT_REGISTERED',
        `Schema not registered: ${schemaId}. Call register() first.`,
        schemaId
      );
    }

    const deskolemize = options?.deskolemize ?? this.defaultDeskolemize;
    const inputQuads = deskolemize ? deskolemizeQuads(quads) : quads;
    const raw = Lift.instances(schemaId, inputQuads, this.registry);

    return raw.map((instance) => {
      return this.registry.instantiate(schemaId, instance);
    });
  }
  /**
   * Validates data against a registered schema, applying defaults and stripping unknown properties.
   *
   * Use `instantiate` when data crosses a trust boundary — HTTP request bodies, queue messages,
   * file imports, IPC payloads. Trust boundary: failure is the caller's contract violation.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to instantiate (deep-cloned before mutation).
   * @returns The validated and normalized value.
   * @throws {@link InstantiationError} when the data fails validation.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   */
  public instantiate<K extends keyof TMap & string>(schemaId: K, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): TMap[K];
  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------
  public instantiate<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema, data: unknown, callOptions?: { 'enableDefaults'?: boolean }
  ): ParseOutputType<TSchema>;
  public instantiate(schema: SchemaRefType<TMap>, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): unknown {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : (schema as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schema !== 'string') {
      this.registry.register(schema);
    }

    return this.registry.instantiate(schemaId, data, callOptions);
  }
  /**
   * Type guard that returns `true` if data satisfies the schema.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to check.
   * @returns Whether the data conforms to the schema.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   */
  public is<K extends keyof TMap & string>(schemaId: K, data: unknown): data is TMap[K];
  public is(schema: Record<string, unknown> & { '$id': string; }, data: unknown): boolean;
  public is(schema: SchemaRefType<TMap>, data: unknown): boolean {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : (schema as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schema !== 'string') {
      this.registry.register(schema);
    }

    return this.registry.is(schemaId, data);
  }
  /**
   * Materializes an entity instance with schema defaults applied, optionally merging partial input.
   *
   * Use `materialize` when you produce the data yourself — test fixtures, form scaffolding,
   * default-filled instances. Construction helper: failure is your own bug.
   *
   * By default, validates the result and throws {@link MaterializationError} on failure.
   * Pass `{ enablePartial: true }` to allow missing required-without-default properties
   * (lenient construction for partial objects).
   *
   * @param schema - The schema describing the target shape.
   * @param partial - Optional partial data to merge with schema defaults.
   * @param options - Options; `enablePartial: true` disables validation throw on missing required fields.
   * @returns A fully materialized instance with all defaults populated.
   */
  public materialize<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    partial?: Partial<InferSchemaType<TSchema>>,
    options?: { 'enablePartial'?: boolean }
  ): MaterializedSchemaType<TSchema>;
  public materialize(
    schema: Record<string, unknown> & { '$id': string; },
    partial?: Record<string, unknown>,
    options?: { 'enablePartial'?: boolean }
  ): unknown;
  public materialize(
    schema: (JSONSchema7Definition & { readonly '$id': string }) | (Record<string, unknown> & { '$id': string }),
    partial?: Record<string, unknown>,
    options?: { 'enablePartial'?: boolean }
  ): unknown {
    if (options?.enablePartial === true) {
      const result = this.materializer.execute(
        schema as Record<string, unknown> & { '$id': string },
        partial,
        { 'synthesizeDefaults': true }
      );

      return result.value;
    }

    return (this.materializer.materialize)(
      schema,
      partial
    );
  }
  /**
   * Generates ontology output (OWL + SHACL) derived from all registered schemas.
   *
   * @returns An {@link OntologyBuilder} for further serialization (JSON-LD, Turtle, etc.).
   */
  public ontology(): OntologyBuilder {
    const revision = this.registry.revision;

    if (this.ontologyCache !== null && this.ontologyCache.revision === revision) {
      return this.ontologyCache.builder;
    }

    const graph = this.ontologySerializer.serialize(this.registry.listGraphs());
    const shaclShapes = this.shaclSerializer.serialize(this.registry.listGraphs());

    const builder = new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'graphSources': [graph],
      'prefixes': this.prefixes
    });

    builder.addShacl(shaclShapes);
    this.ontologyCache = {
      builder,
      revision
    };

    return builder;
  }

  /**
   * Registers one or more schemas and returns `this` with the schema types accumulated.
   *
   * @param schema - A single schema or array of schemas, each with a `$id`.
   * @returns This instance with the new schema types merged into `TMap`.
   * @throws {@link SchemaError} when a schema lacks `$id`, has duplicate anchors, or fails structure validation.
   */
  public register<const T extends { readonly '$id': string; }>(
    schema: T
  ): JsonTology<SchemaEntryType<T> & TMap>;
  public register<const T extends ReadonlyArray<{ readonly '$id': string; }>>(
    schemas: T & UniqueSchemaIdsType<T>
  ): JsonTology<SchemaMapFromTupleType<T> & TMap>;
  // ---------------------------------------------------------------------------
  // Materialization
  // ---------------------------------------------------------------------------
  public register(schemaOrSchemas: ReadonlyArray<{ readonly '$id': string; }> | { readonly '$id': string; }): JsonTology<TMap> {
    const list = Array.isArray(schemaOrSchemas) ? schemaOrSchemas : [schemaOrSchemas];

    // Cast needed: const generic preserves literal types that don't widen to Record<string, unknown>
    this.registry.register(list);

    // Cast needed: TypeScript cannot track that register() accumulates into the TMap type parameter
    return this;
  }
  /**
   * Registers a schema that may lack a `$id`, assigning a content-hash-based synthetic ID if needed.
   *
   * @param schema - The schema object; if it already has a `$id`, delegates to {@link register}.
   * @returns The `$id` used for registration (original or synthetic).
   */
  public registerAnonymous(schema: Record<string, unknown>): string {
    return this.registry.registerAnonymous(schema);
  }
  /**
   * Removes a previously registered compute function.
   *
   * @param schemaId - The `$id` of the schema owning the computed property.
   * @param name - The property name to deregister.
   */
  public removeComputed(schemaId: string, name: string): void {
    this.registry.computedStore.remove(schemaId, name);
  }
  /**
   * Removes a previously registered invariant by name.
   *
   * @param schemaId - The `$id` of the target schema.
   * @param name - The invariant name to remove.
   */
  public removeInvariant(schemaId: string, name: string): void {
    this.registry.removeInvariant(schemaId, name);
  }
  /**
   * Eagerly walks all transitive `$ref` IRIs currently registered, calling the loader
   * for each unregistered IRI. Registers returned schemas and recurses until the graph
   * is fully resolved. Uses a visited Set to avoid redundant loader calls.
   *
   * If the loader returns `null` for a required IRI, throws `GraphError('REF_UNRESOLVED')`.
   */
  private async resolveAllRefs(loader: LoaderType): Promise<void> {
    const visited = new Set<string>();

    const resolveSchema = async (schema: Record<string, unknown>): Promise<void> => {
      const unresolved = this.registry.collectUnresolvedRefIris(schema);
      const toFetch: string[] = [];

      for (const iri of unresolved) {
        if (!visited.has(iri)) {
          visited.add(iri);
          toFetch.push(iri);
        }
      }

      for (const iri of toFetch) {
        const loaded = await loader(iri);

        if (loaded === null) {
          throw new GraphError(
            'REF_UNRESOLVED',
            `loader returned null for IRI: ${iri}`,
            iri
          );
        }

        if (typeof loaded !== 'boolean') {
          this.registry.register(loaded);

          // Recurse into the newly registered schema
          await resolveSchema(loaded);
        }
      }
    };

    // Walk all currently registered schemas
    for (const schema of this.registry.list()) {
      await resolveSchema(schema);
    }
  }

  /**
   * Record an `owl:sameAs` assertion between two individuals.
   *
   * `sameAs` is ABox-level identity: both IRIs denote the same individual.
   * Emitted symmetrically at `toQuads()` time.
   *
   * @param instanceIriA - First individual IRI
   * @param instanceIriB - Second individual IRI
   */
  public sameAs(instanceIriA: string, instanceIriB: string): void {
    this.registry.sameAsStore.add(instanceIriA, instanceIriB);
  }
  /**
   * Resolves a sub-schema at a JSON Pointer path within a registered schema.
   *
   * Returns the sub-schema as a registerable schema object with a synthesized `$id`
   * of the form `<parent.$id>#<pointer>`. The result can be passed directly to
   * `is`, `validate`, `instantiate`, or `materialize`.
   *
   * @example
   * const itemSchema = entities.subschemaAt(OrderSchema.$id, '/properties/items/items');
   * entities.validate(itemSchema, orderLineData);
   * entities.instantiate(itemSchema, orderLineData);
   *
   * @param schemaRef - The `$id` of a registered schema, or a schema object with `$id`.
   * @param pointer - JSON Pointer path (e.g. `/properties/name`) into the schema.
   * @returns The resolved sub-schema with a synthesized `$id`.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   * @throws {@link GraphError} when the pointer cannot be resolved.
   */
  public subschemaAt<K extends keyof TMap & string>(
    schemaId: K,
    pointer: (Record<never, never> & string) | SchemaPointerPathsType<TMap[K]>
  ): Record<string, unknown> & { '$id': string };
  public subschemaAt<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    pointer: (Record<never, never> & string) | SchemaPointerPathsType<TSchema>
  ): Record<string, unknown> & { '$id': string };
  public subschemaAt(
    schemaRef: SchemaRefType<TMap>,
    pointer: string
  ): Record<string, unknown> & { '$id': string } {
    if ((schemaRef as unknown) === null || (schemaRef as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const parentId = typeof schemaRef === 'string' ? schemaRef : (schemaRef as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schemaRef !== 'string') {
      this.registry.register(schemaRef);
    }

    return this.registry.subschemaAt(parentId, pointer);
  }

  /**
   * Projects instance data to RDF quads and returns an {@link OntologyBuilder} for serialization.
   *
   * Inverse of {@link fromQuads}: `toQuads` lowers typed objects into ABox quads,
   * `fromQuads` lifts quads back into typed objects.
   *
   * @param schema - The schema describing the data shape.
   * @param data - The instance data to project into quads.
   * @returns The projected RDF quads.
   *
   * If you want a richer wrapper (JSON-LD context, SHACL composition,
   * raw vs prefixed projection), call {@link ontology} on the registry
   * and pass the quads through. `toQuads` returns the data, not a
   * builder, so the name matches the contract.
   */
  public toQuads<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    data: InferSchemaType<TSchema>,
    options?: ToQuadsOptionsType
  ): QuadInterface[] {
    const normalized = normalizeToQuadsOptions(options);
    const effective = {
      'graphIRI': normalized.graphIRI ?? this.defaultGraphIRI,
      'iriFor': normalized.iriFor ?? liftIriForOption(this.defaultIriForRaw)
    };

    const quads = this.materializer.projectAbox(
      JsonTology.asNamedSchema(schema),
      data,
      this.baseIRI,
      effective
    );

    appendSameAsQuads(quads, this.registry.sameAsStore.all(), effective.graphIRI);

    return quads;
  }
  /**
   * Reconstructs a JSON Schema document from the canonical graph for a registered schema.
   *
   * @param schemaRef - The `$id` of the schema, or a schema object with `$id`.
   * @returns The reconstructed schema object, or `undefined` if not registered.
   */
  public toSchema(schemaRef: SchemaRefType<TMap>): Record<string, unknown> | undefined {
    const schemaId = typeof schemaRef === 'string' ? schemaRef : (schemaRef as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schemaRef !== 'string') {
      this.registry.register(schemaRef);
    }

    const graph = this.registry.graph(schemaId);

    if (graph === undefined) {
      return undefined;
    }

    return new GraphSchemaSerializer().serialize(graph);
  }

  /**
   * Generates SHACL shapes — node shapes and property shapes encoding
   * structural constraints — derived from all registered schemas.
   *
   * @returns A fresh {@link OntologyBuilder} containing only SHACL shape quads (no OWL classes/properties).
   */
  public toShacl(): OntologyBuilder {
    const shaclShapes = this.shaclSerializer.serialize(this.registry.listGraphs());

    return new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'graphSources': [],
      'prefixes': this.prefixes
    }).addShacl(shaclShapes);
  }

  // ---------------------------------------------------------------------------
  // Ontology
  // ---------------------------------------------------------------------------

  /**
   * Generates the OWL TBox (terminology box) — class declarations, property
   * declarations, domains, ranges, and cardinality — derived from all registered
   * schemas. Symmetric with toQuads (which produces ABox from instance data).
   *
   * @returns A fresh {@link OntologyBuilder} containing only OWL TBox quads (no SHACL shapes).
   */
  public toTbox(): OntologyBuilder {
    const graph = this.ontologySerializer.serialize(this.registry.listGraphs());

    return new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'graphSources': [graph],
      'prefixes': this.prefixes
    });
  }

  /**
   * Validates data against a registered schema and returns structured {@link ValidationErrors}.
   *
   * Returns an empty collection (`.ok === true`) when the data is valid.
   * Does not mutate input. Does not throw on validation failure.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to validate.
   * @param callOptions - Per-call option overrides.
   * @returns A {@link ValidationErrors} instance (empty when data is valid).
   */
  public validate<K extends keyof TMap & string>(schemaId: K, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): ValidationErrors;
  public validate(schema: Record<string, unknown> & { '$id': string; }, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): ValidationErrors;
  public validate(schema: SchemaRefType<TMap>, data: unknown): ValidationErrors {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : (schema as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schema !== 'string') {
      this.registry.register(schema);
    }

    return this.registry.validate(schemaId, data);
  }
}
