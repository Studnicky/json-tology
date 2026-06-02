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

import type { JsonSchemaDocumentType } from './types/Schema.js';

import type { OwlImportResult } from './interfaces/OwlImport.js';
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
  InferSchemaType, LooseInputType, MaterializedSchemaType, SchemaPointerPathsType
} from './types/Infer.js';
import type {
  ParseOutputType, TransformedType
} from './types/Transform.js';
import type {
  SchemaEntryType, SchemaMapFromTupleType, SchemaReferencesMapType, UniqueSchemaIdsType
} from './types/Registry.js';
import type { PredicateForType } from './types/PredicateFor.js';
import type { PredicateResolverFnType } from './types/PredicateResolverFn.js';
import type { SchemaRefType } from './types/SchemaRef.js';
import type { SkolemizeFnType } from './types/Skolemize.js';
import type { NormalizedToQuadsOptionsType } from './types/NormalizedToQuadsOptions.js';
import type { ToQuadsOptionsType } from './types/ToQuadsOptions.js';

import { RefResolutionLoader } from './modules/registry/RefResolutionLoader.js';
import { AboxGraph } from './modules/graph/AboxGraph.js';
import type { AboxGraphInterface } from './interfaces/AboxGraphInterface.js';
import type { AboxIdentityDescriptorType } from './types/AboxGraph.js';
import { isRecord } from './modules/data/DataTypes.js';
import type { CurieInterface } from './interfaces/Curie.js';
import { Curie } from './modules/rdf/Curie.js';
import { OwlImporter } from './modules/ontology/OwlImporter.js';
import { Skolemize } from './modules/rdf/Skolemize.js';
import { Terms } from './modules/rdf/Terms.js';
import { Dumper } from './modules/data/Dumper.js';
import { FormatRegistry } from './modules/format/FormatRegistry.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphSchemaSerializer } from './modules/ontology/GraphSchemaSerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { Lift } from './modules/rdf/Lift.js';
import { Materializer } from './modules/materialization/Materializer.js';
import { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
import { EncodeError } from './errors/EncodeError.js';
import { TransformError } from './errors/TransformError.js';
import { GraphError } from './errors/GraphError.js';
import { PredicateResolver } from './modules/graph/PredicateResolver.js';
import { SchemaError } from './errors/SchemaError.js';
import type { DuplicateReportEntryType } from './interfaces/SchemaEntryStore.js';
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import { Transform } from './modules/transform/Transform.js';
import { Value } from './modules/data/Value.js';

import { STANDARD_PREFIXES } from './constants/STANDARD_PREFIXES.js';

const STATIC_BASE_IRI = 'http://json-tology.dev/_/static';

/**
 * The literal string `'blank-node'` requests anonymous-node subjects
 * for every object in the projection. Exposed as a separate constant
 * so consumers can spell the magic value without importing it inline.
 *
 * @remarks
 * Pass as the `iriFor` option to `toQuads()` or the constructor to enable blank-node
 * subjects for every projected object, rather than minting well-known genid IRIs.
 *
 * @example
 * ```ts
 * const quads = jt.toQuads(UserSchema, user, { iriFor: BLANK_NODE_IRI_FOR });
 * ```
 *
 * @defaultValue `'blank-node'`
 * @category Skolemization
 * @since 0.1.0
 * @see {@link SkolemizeFnType}
 * @group Constants
 */
export const BLANK_NODE_IRI_FOR = 'blank-node';

function rootIriOnly(iri: string): SkolemizeFnType {
  return (ctx: { 'depth': number;
    'path': string;
    'value': unknown }): string | undefined => {
    return ctx.depth === 0 ? iri : undefined;
  };
}

function blankNodeStrategy(): SkolemizeFnType {
  let counter = 0;

  return (_ctx: { 'depth': number;
    'path': string;
    'value': unknown }): string => {
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
 * Rewrite a single quad's subject and/or object from well-known genid IRIs
 * to blank nodes. Returns the original quad when no deskolemization is needed.
 * Named function so the complexity is separate from `deskolemizeQuads`.
 */
function deskolemizeQuad(quad: QuadInterface): QuadInterface {
  // Narrow rdf/js Quad_Subject (`NamedNode | BlankNode | Quad | Variable`)
  // to the project pipeline subjects (`NamedNode | BlankNode`). RDF*
  // (`Quad`) and `Variable` subjects pass through untouched.
  if (quad.subject.termType !== 'NamedNode' && quad.subject.termType !== 'BlankNode') {
    return quad;
  }
  if (quad.predicate.termType !== 'NamedNode') {
    return quad;
  }
  if (quad.graph.termType !== 'NamedNode' && quad.graph.termType !== 'BlankNode' && quad.graph.termType !== 'DefaultGraph') {
    return quad;
  }

  const subjectGenid = Skolemize.isWellKnownGenid(quad.subject.value);
  const objectGenid = quad.object.termType === 'NamedNode'
    && Skolemize.isWellKnownGenid(quad.object.value);

  if (!subjectGenid && !objectGenid) {
    return quad;
  }

  const subject = subjectGenid
    ? Terms.blank(blankNodeNameFor(quad.subject.value))
    : quad.subject;
  const object = objectGenid && quad.object.termType === 'NamedNode'
    ? Terms.blank(blankNodeNameFor(quad.object.value))
    : quad.object;

  // Object may still be a Variable or embedded Quad after the above narrow.
  // In that case, fall back to the original quad rather than fabricating a
  // shape the pipeline does not handle.
  if (object.termType !== 'NamedNode' && object.termType !== 'BlankNode' && object.termType !== 'Literal') {
    return quad;
  }

  return Terms.quad(subject, quad.predicate, object, quad.graph);
}

/**
 * Reconstructs blank-node-style references from well-known genid IRIs.
 * Quads whose subject or object is a NamedNode matching the well-known
 * genid pattern are rewritten to BlankNode terms so downstream lifting
 * sees them as anonymous nodes.
 */
function deskolemizeQuads(quads: readonly QuadInterface[]): QuadInterface[] {
  return quads.map((quad: QuadInterface): QuadInterface => {
    return deskolemizeQuad(quad);
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
 * Declare your schemas once and get types, runtime validation, materialization,
 * and a data ontology for free — all from a single registry.
 *
 * @remarks
 * The facade centralises schema registration, validation (`validate`, `is`, `instantiate`),
 * RDF projection (`toQuads`, `fromQuads`, `toTbox`, `toShacl`), and ontology export
 * (`ontology()`). All operations share the same canonical schema graph so the
 * TBox, validation, and ABox projection are always consistent.
 *
 * @example
 * ```ts
 * const jt = JsonTology.create({ baseIRI: 'https://myapp.io', schemas: [UserSchema] as const });
 * type User = InferType<typeof UserSchema>;
 * const user = jt.instantiate(UserSchema.$id, data);
 * ```
 *
 * @typeParam TMap — accumulated schema type map. Built automatically via
 * `create()` or chained `set()` calls.
 *
 * @category Core
 * @since 0.1.0
 * @see {@link SchemaRegistryInterface}
 * @group Core
 */
export class JsonTology<TMap = Record<never, never>, TRefs = Record<never, never>> {
  /**
   * Narrows a JsonSchemaDocumentType to a named-schema object.
   * Throws SchemaError if the value is a boolean schema or lacks `$id`.
   */
  private static asNamedSchema(schema: JsonSchemaDocumentType): Record<string, unknown> & { '$id': string } {
    if (typeof schema === 'boolean' || typeof (schema as Record<string, unknown>).$id !== 'string') {
      throw new SchemaError('SCHEMA_MISSING_ID', 'Schema must be an object with a string $id');
    }

    return schema as Record<string, unknown> & { '$id': string };
  }

  /**
   * Assign non-boolean fields that are defined in the options onto an existing partial.
   */
  private static assignDefinedRegistryFields(
    partial: Partial<RegistryOptionsInterface>,
    options: JsonTologyOptionsInterface
  ): void {
    if (options.prefixes !== undefined) {
      partial.prefixes = options.prefixes;
    }
    if (options.logger !== undefined) {
      partial.logger = options.logger;
    }
    if (options.keywords !== undefined) {
      partial.keywords = options.keywords;
    }
    if (options.vocabularies !== undefined) {
      partial.vocabularies = options.vocabularies;
    }
    if (options.maxSchemaDepth !== undefined) {
      partial.maxSchemaDepth = options.maxSchemaDepth;
    }
    if (options.invariants !== undefined) {
      partial.invariants = options.invariants;
    }
  }

  /**
   * Build a `FormatRegistry` with the built-in formats plus any user-supplied validators.
   */
  private static buildFormatRegistry(formats: JsonTologyOptionsInterface['formats']): FormatRegistry {
    const registry = FormatRegistry.builtin();

    if (formats !== undefined) {
      for (const [
        name,
        validator
      ] of Object.entries(formats)) {
        registry.set(name, validator);
      }
    }

    return registry;
  }

  // ---------------------------------------------------------------------------
  // Static counterparts — ephemeral registry, one-shot execution
  // ---------------------------------------------------------------------------

  /**
   * Build the `RegistryOptionsInterface` object from the public `JsonTologyOptionsInterface`.
   * Only defined options are forwarded; undefined values are omitted so `SchemaRegistry`
   * defaults are applied naturally.
   */
  private static buildRegistryOptions(
    options: JsonTologyOptionsInterface,
    formatRegistry: FormatRegistry
  ): RegistryOptionsInterface {
    const base: RegistryOptionsInterface = { 'formatRegistry': formatRegistry };
    const partial = JsonTology.pickDefinedRegistryFlags(options);

    JsonTology.assignDefinedRegistryFields(partial, options);

    return Object.assign(base, partial);
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
  public static create<const TSchemas extends ReadonlyArray<{ readonly '$id': string; }>>(options: JsonTologyOptionsInterface<TSchemas> & { 'schemas'?: UniqueSchemaIdsType<TSchemas> }): JsonTology<SchemaMapFromTupleType<TSchemas>, SchemaReferencesMapType<TSchemas>> {
    const jt = new JsonTology(options);

    if (options.schemas) {
      for (const schema of options.schemas) {
        jt.registry.set(schema);
      }
    }

    if (options.prefetched !== undefined) {
      for (const [
        iri,
        schema
      ] of options.prefetched.schemas) {
        if (typeof schema !== 'boolean' && !jt.registry.has(iri)) {
          jt.registry.set(schema, iri);
        }
      }
    }

    // The instance carries TWO type maps: TMap (the registered schemas' inferred
    // OUTPUT types, for instantiate/set/dump) and TRefs (the registered schemas'
    // RAW shapes keyed by $id, for $ref resolution inside addTransform's decode
    // input). SchemaMapFromTupleType already pre-inferred TMap; SchemaReferences-
    // MapType keeps the raw schemas so InferSchemaType can resolve a wire schema's
    // cross-$ref leaves to readable types with no caller-supplied references.
    return jt as unknown as JsonTology<SchemaMapFromTupleType<TSchemas>, SchemaReferencesMapType<TSchemas>>;
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

    return jt.dump(schema as JsonSchemaDocumentType & { readonly '$id': string }, value, options);
  }

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

    return jt.dumpJson(schema as JsonSchemaDocumentType & { readonly '$id': string }, value, options);
  }

  private static ephemeral(schema: Record<string, unknown> & { readonly '$id': string }): JsonTology {
    // enableStrictGraph: false — ephemeral registries are single-use helpers
    // for the static convenience methods (materialize, encode, etc.). They accept
    // whatever schema is passed without imposing graph-integrity constraints; the
    // caller is responsible for schema quality in production code.
    return JsonTology.create({
      'baseIRI': STATIC_BASE_IRI,
      'enableStrictGraph': false,
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
   * FromTbox — static variant. Constructs a transient OwlImporter and returns
   * the import result without retaining state.
   *
   * @param jsonLd - The OWL 2 TBox input as a QuadInterface array, a JSON-LD
   *   object, or a JSON-LD string.
   * @param options - Optional baseIRI and prefix overrides for the import session.
   * @returns OwlImportResult with reconstructed schemas, invariants,
   *   characteristics, sameAs pairs, individuals, and unsupported axiom log.
   */
  public static fromTbox(
    jsonLd: object | QuadInterface[] | string,
    options?: { 'baseIRI'?: string;
      'prefixes'?: Record<string, string> }
  ): OwlImportResult {
    const importer = new OwlImporter({
      'baseIRI': options?.baseIRI ?? STATIC_BASE_IRI,
      ...(options?.prefixes === undefined ? {} : { 'prefixes': options.prefixes })
    });

    return importer.import(jsonLd);
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

    return jt.instantiate(schema as JsonSchemaDocumentType & { readonly '$id': string }, data, options) as InferSchemaType<TSchema>;
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

    return jt.materialize(schema as JsonSchemaDocumentType & { readonly '$id': string }, data as Record<string, unknown>, options) as MaterializedSchemaType<TSchema>;
  }

  /**
   * Ontology — ephemeral registry variant. No instance required.
   *
   * @param schemas - Array of schema objects with `$id`.
   * @returns An {@link OntologyBuilder} containing OWL + SHACL output.
   */
  public static ontology(schemas: ReadonlyArray<Record<string, unknown> & { readonly '$id': string }>): OntologyBuilder {
    const jt = JsonTology.create({ 'baseIRI': STATIC_BASE_IRI });

    for (const schema of schemas) {
      jt.registry.set(schema);
    }

    return jt.ontology();
  }

  /**
   * Pick defined boolean flags from the options into a `Partial<RegistryOptionsInterface>`.
   */
  private static pickDefinedRegistryFlags(options: JsonTologyOptionsInterface): Partial<RegistryOptionsInterface> {
    const partial: Partial<RegistryOptionsInterface> = {};

    if (options.enableTypeCast !== undefined) {
      partial.enableTypeCast = options.enableTypeCast;
    }
    if (options.enableStrictTypes !== undefined) {
      partial.enableStrictTypes = options.enableStrictTypes;
    }
    if (options.enableDefaults !== undefined) {
      partial.enableDefaults = options.enableDefaults;
    }
    if (options.enableInlineWarnings !== undefined) {
      partial.enableInlineWarnings = options.enableInlineWarnings;
    }
    if (options.enableDuplicateDetection !== undefined) {
      partial.enableDuplicateDetection = options.enableDuplicateDetection;
    }
    if (options.enableStrictGraph !== undefined) {
      partial.enableStrictGraph = options.enableStrictGraph;
    }

    return partial;
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

    if (options.schemas) {
      for (const schema of options.schemas) {
        tmp.registry.set(schema);
      }
    }

    if (options.rootIds) {
      await tmp.refLoader.loadRootIds(options.rootIds, options.loader);
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
    // enableStrictGraph: false — static convenience method accepts any schema without
    // imposing graph-integrity constraints; the caller manages schema quality.
    const jt = JsonTology.create({
      'baseIRI': STATIC_BASE_IRI,
      'enableStrictGraph': false
    });

    for (const schema of schemas) {
      jt.registry.set(schema);
    }

    return jt.toShacl();
  }
  /**
   * ToTbox — ephemeral registry variant. No instance required.
   *
   * @param schemas - Array of schema objects with `$id`.
   * @returns An {@link OntologyBuilder} containing OWL TBox quads.
   */
  public static toTbox(schemas: ReadonlyArray<Record<string, unknown> & { readonly '$id': string }>): OntologyBuilder {
    // enableStrictGraph: false — static convenience method accepts any schema without
    // imposing graph-integrity constraints; the caller manages schema quality.
    const jt = JsonTology.create({
      'baseIRI': STATIC_BASE_IRI,
      'enableStrictGraph': false
    });

    for (const schema of schemas) {
      jt.registry.set(schema);
    }

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
  /**
   * Wire pre-registered computed field functions from the options into the registry's
   * computed store. Expands CURIE schema IDs using the provided `curie` instance.
   */
  private static wireComputedFields(
    registry: SchemaRegistryInterface,
    curie: CurieInterface,
    computeds: JsonTologyOptionsInterface['computeds']
  ): void {
    if (computeds === undefined) {
      return;
    }

    for (const [
      schemaId,
      propMap
    ] of Object.entries(computeds)) {
      for (const [
        propName,
        fn
      ] of Object.entries(propMap)) {
        registry.computedStore.add(curie.expand(schemaId), propName, fn);
      }
    }
  }
  private readonly baseIRI: string;
  private readonly curie: CurieInterface;
  private readonly defaultDeskolemize: boolean;

  private readonly defaultGraphIRI: string | undefined;
  private readonly defaultIriForRaw: SkolemizeFnType | string | undefined;
  private readonly enableCanonicalPredicates: boolean | undefined;
  private readonly graphSchemaSerializer: GraphSchemaSerializer;
  /**
   * Direct access to the underlying materializer for advanced use cases.
   *
   * `projectAbox` emits the same quads as `toQuads()` — including symmetric
   * `owl:sameAs` assertions read from the registry's SameAsStore. Direct and
   * facade access are equivalent; choose direct access when you need the
   * materializer for engine-execution composition without going through the
   * `JsonTology` facade.
   */
  public readonly materializer: MaterializerInterface;
  private ontologyCache: null | {
    'builder': OntologyBuilder;
    'revision': number;
  } = null;
  private readonly ontologySerializer: GraphOntologySerializer;

  private readonly predicateFor: PredicateForType | undefined;

  private readonly predicateResolver: PredicateResolverFnType;

  private readonly prefixes: Record<string, string>;

  private readonly refLoader: RefResolutionLoader;

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
    this.enableCanonicalPredicates = options.enableCanonicalPredicates;
    this.predicateFor = options.predicateFor;
    this.predicateResolver = PredicateResolver.forConfig({
      'baseIRI': this.baseIRI,
      'enableCanonicalPredicates': this.enableCanonicalPredicates,
      'predicateFor': this.predicateFor
    });

    this.prefixes = {
      ...STANDARD_PREFIXES,
      ...options.prefixes
    };

    const formatRegistry = JsonTology.buildFormatRegistry(options.formats);
    const registryOptions = JsonTology.buildRegistryOptions(options, formatRegistry);

    this.registry = new SchemaRegistry(registryOptions);
    this.refLoader = new RefResolutionLoader(this.registry);

    // Curie with merged prefixes from registry. Assigned before any CURIE
    // expansion below (computed-field wiring) so every site uses this.curie.
    this.curie = this.registry.curie ?? new Curie(this.prefixes);

    JsonTology.wireComputedFields(this.registry, this.curie, options.computeds);

    // Cast needed: Value is unparameterized at runtime; aligns with compile-time generic TMap
    this.value = new Value(this.registry) as unknown as ValueInterface<TMap>;
    this.materializer = new Materializer(this.registry, options.materializer);

    this.graphSchemaSerializer = new GraphSchemaSerializer();
    this.ontologySerializer = this.buildOntologySerializer(options.vocabularies);
    this.shaclSerializer = this.buildShaclSerializer(options.vocabularies);
  }

  /**
   * Build a typed, lazy graph view over ABox instance data.
   *
   * The supplied quads (from {@link toQuads}, a reasoner, or any rdf/js source)
   * are unioned with the registry's TBox quads ({@link toTbox}) and indexed once.
   * The returned {@link AboxGraphInterface} exposes fluent navigation cursors:
   * `resource(iri)` / `instances(classIri)` seed a selection; `.objects` /
   * `.subjects` walk associations (inverse-functional foreign keys resolved to
   * the owning entity); `.where` / `.filter` / `.having` refine; `.one` /
   * `.all` / `.iris` / `.count` materialize typed instances.
   *
   * @param quads - ABox instance-data quads (also accepts external rdf/js quads).
   * @returns A graph view over the ABox + TBox quad union.
   */
  public aboxGraph(quads: QuadInterface[]): AboxGraphInterface {
    const tboxQuads = this.toTbox().quads();

    // Identity associations are derived from the registry schemas, not the flat
    // TBox: a property declared `inverseFunctional` is the identity of the class
    // that declares it (the flat predicate's union domain cannot say which one).
    const {
      identities, schemaById
    } = this.buildAboxIdentities();

    return new AboxGraph(
      quads,
      tboxQuads,
      identities,
      (classId: string, subjectQuads: QuadInterface[]): unknown[] => {
        return this.fromQuads(classId as keyof TMap & string, subjectQuads);
      },
      this.predicateResolver,
      (classIri: string): unknown => {
        return schemaById.get(classIri) ?? null;
      }
    );
  }

  /**
   * Registers a compute function for a property marked `jt:computed: true`.
   *
   * @param schemaId - The `$id` of the schema owning the computed property.
   * @param name - The property name.
   * @param fn - Function receiving the instantiated/materialized object and returning the computed value.
   */
  public addComputed<
    K extends keyof TMap & string,
    const TName extends string,
    TValue
  >(
    schemaId: K,
    name: TName,
    fn: (data: TMap[K]) => TValue
  ): JsonTology<Readonly<Record<K, Readonly<Record<TName, TValue>> & TMap[K]>> & TMap, TRefs>;
  public addComputed(
    schemaId: keyof TMap & string,
    name: string,
    fn: (data: never) => unknown
  ): JsonTology<TMap, TRefs> {
    // interop: the public overload types `fn` over the schema's inferred type, but
    // the runtime computed store is type-erased over `Record<string, unknown>`
    // (it invokes `fn` with the materialized object). Bridging the typed public
    // surface to the erased store is the one boundary that needs an assertion.
    this.registry.computedStore.add(this.curie.expand(schemaId), name, fn as ComputedFnType);

    // The typed overload augments `TMap[K]` with the computed field so a
    // subsequent `instantiate(schemaId, …)` returns it. The runtime instance is
    // unchanged (computed values are produced at instantiate time), so the impl
    // returns `this` typed as the base map — same pattern as `set()`.
    return this;
  }

  /**
   * Registers a cross-field invariant for a schema.
   *
   * @param schemaId - The `$id` of the target schema. Must be a registered key
   *   of the typed schema map; unregistered IRIs are rejected at compile time.
   * @param invariant - The invariant to add. Runs after structural validation succeeds.
   */
  public addInvariant<T extends object>(schemaId: keyof TMap & string, invariant: InvariantInterface<T>): void {
    this.registry.addInvariant(schemaId, invariant as InvariantInterface);
  }
  /**
   * Attach a decode/encode pair to a registered schema. Registry-aware
   * variant of {@link Transform.create}: the lambda parameter types
   * resolve cross-registry `$ref`s through this instance's schema map,
   * so a schema like `{ $ref: 'urn:bookstore:Customer' }` infers as the
   * Customer entity rather than as `unknown`.
   *
   * @param schema - A registered schema with `$id`. Any `$ref` in the
   *   schema or its sub-properties is resolved against `TMap`.
   * @param fns - `decode` runs after validation succeeds; `encode`
   *   round-trips the decoded value back to the wire shape.
   */
  public addTransform<
    TSchema extends JsonSchemaDocumentType & { readonly '$id': string; },
    TOut extends NonNullable<unknown>
  >(
    schema: TSchema,
    fns: {
      'decode': (input: InferSchemaType<TSchema, TSchema, TRefs>) => TOut;
      'encode': (output: TOut) => InferSchemaType<TSchema, TSchema, TRefs>;
    }
  ): TransformedType<TSchema, TOut> {
    Transform.create<TSchema, TOut>(
      schema,
      fns as unknown as {
        'decode': (input: InferSchemaType<TSchema>) => TOut;
        'encode': (output: TOut) => LooseInputType<InferSchemaType<TSchema>>;
      }
    );

    return schema as unknown as TransformedType<TSchema, TOut>;
  }
  /**
   * Build the ABox identity descriptor list and schema-by-IRI index for `aboxGraph`.
   * Walks the registry to locate `inverseFunctional` property declarations
   * and collects them as identity predicates.
   */
  private buildAboxIdentities(): {
    'identities': AboxIdentityDescriptorType[];
    'schemaById': Map<string, unknown>;
  } {
    const identities: AboxIdentityDescriptorType[] = [];
    const schemaById = new Map<string, unknown>();

    for (const schema of this.registry.list() as Array<Record<string, unknown> & { '$id': string }>) {
      schemaById.set(schema.$id, schema);

      const properties = schema.properties;

      if (!isRecord(properties)) {
        continue;
      }

      for (const [
        propertyName,
        rawPropertySchema
      ] of Object.entries(properties)) {
        if (!isRecord(rawPropertySchema) || rawPropertySchema.inverseFunctional !== true) {
          continue;
        }

        const range = typeof rawPropertySchema.$ref === 'string' ? rawPropertySchema.$ref : propertyName;

        identities.push({
          'owningClass': schema.$id,
          'predicate': this.predicateResolver({
            'classId': schema.$id,
            propertyName,
            'propertySchema': rawPropertySchema
          }),
          range
        });
      }
    }

    return {
      identities,
      schemaById
    };
  }

  // ---------------------------------------------------------------------------
  // Loader resolution (private)
  // ---------------------------------------------------------------------------

  /**
   * Build the OWL TBox serializer with the current curie and predicateResolver.
   */
  private buildOntologySerializer(vocabularies: JsonTologyOptionsInterface['vocabularies']): GraphOntologySerializer {
    return new GraphOntologySerializer({
      'curie': this.curie,
      'predicateResolver': this.predicateResolver,
      'vocabularies': vocabularies ?? []
    });
  }
  /**
   * Build the SHACL serializer with the current curie and predicateResolver.
   */
  private buildShaclSerializer(vocabularies: JsonTologyOptionsInterface['vocabularies']): GraphShaclSerializer {
    return new GraphShaclSerializer({
      'curie': this.curie,
      'predicateResolver': this.predicateResolver,
      'vocabularies': vocabularies ?? []
    });
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
  public dump<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }>(
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
      this.registry.set(schema);
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
  public dumpJson<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }>(
    schema: TSchema,
    value: InferSchemaType<TSchema>,
    options?: Omit<DumpOptionsInterface, 'mode'>
  ): string;
  public dumpJson(
    schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }),
    value: unknown,
    options?: Omit<DumpOptionsInterface, 'mode'>
  ): string {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : schema.$id;

    if (typeof schema !== 'string') {
      this.registry.set(schema);
    }

    return Dumper.dumpJson(this.registry, schemaId, value, options);
  }
  /**
   * Encodes a decoded value back to its wire representation using the schema's registered {@link Transform}.
   *
   * @param schema - The schema with an associated transform decoder.
   * @param value - The decoded value to encode.
   * @returns The wire-format representation inferred from the schema.
   * @throws {@link EncodeError} when the registered transform encoder throws an unexpected error.
   */
  public encode<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }, TOut extends unknown>(
    schema: TransformedType<TSchema, TOut>,
    value: TOut
  ): InferSchemaType<TSchema> {
    // JsonSchemaDocumentType includes boolean, but the { '$id': string } constraint on TSchema
    // excludes boolean at runtime. TypeScript cannot reduce this intersection structurally,
    // so a double cast is required to bridge TransformedType to Record<string, unknown>.
    const decoder = Transform.getDecoder(schema as unknown as Record<string, unknown>);

    if (decoder === undefined) {
      return value as InferSchemaType<TSchema>;
    }

    try {
      return decoder.encode(value) as InferSchemaType<TSchema>;
    } catch (error) {
      if (error instanceof TransformError) {
        throw error;
      }

      const causeError = error instanceof Error ? error : new Error(String(error));
      const schemaId = (schema as unknown as Record<string, unknown>).$id as string;

      throw new EncodeError(
        `transform encoder failed at root: ${causeError.message}`,
        {
          'cause': causeError,
          'path': '',
          'schemaId': schemaId
        }
      );
    }
  }
  /**
   * Report registered schemas (or inline subschemas) whose canonical shape
   * matches another registered schema.
   *
   * The return type narrows `equivalentTo` to the literal union of registered
   * `$id` values when the instance was constructed via `JsonTology.create({
   * schemas: [...] })` or extended through `set()`. Consumers can
   * destructure the IRI as a literal without `as const` casts.
   */
  public findDuplicates<TKey extends string = keyof TMap & string>(): ReadonlyArray<DuplicateReportEntryType<TKey>> {
    return this.registry.findDuplicates() as ReadonlyArray<DuplicateReportEntryType<TKey>>;
  }
  /**
   * Expand a CURIE to its full IRI using the registry's merged prefix map.
   *
   * @param value - A CURIE such as `rdf:type` (or any value; non-CURIE strings pass through).
   * @returns The expanded full IRI when the prefix is known; otherwise the input unchanged.
   */
  public fromCurie(value: string): string {
    return this.curie.expand(value);
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
   * @param schemaId - The registered schema `$id` (or a schema object / ref) identifying the target schema.
   * @param quads - RDF quads in the module's internal format.
   * @returns Array of validated, typed objects.
   * @throws {SchemaError} code SCHEMA_NOT_REGISTERED when the schema is not registered.
   * @throws {InstantiationError} code INSTANTIATION_FAILED when a lifted object fails validation.
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
      this.registry.set(schemaRef);
    }

    if (this.registry.get(schemaId) === undefined) {
      throw new SchemaError(
        'SCHEMA_NOT_REGISTERED',
        `Schema not registered: ${schemaId}. Register it first.`,
        { schemaId }
      );
    }

    const deskolemize = options?.deskolemize ?? this.defaultDeskolemize;
    const inputQuads = deskolemize ? deskolemizeQuads(quads) : quads;
    const raw = Lift.instances(schemaId, inputQuads, this.registry, {
      'curie': this.curie,
      'predicateResolver': this.predicateResolver
    });

    return raw.map((instance: unknown): unknown => {
      return this.registry.instantiate(schemaId, instance);
    });
  }
  /**
   * FromTbox — instance variant. Imports an OWL 2 TBox document and optionally
   * registers the produced schemas and derived artefacts into this instance's
   * registry.
   *
   * When `register` is true (the default), the produced schemas are passed to
   * `registry.set()` and invariants / characteristics / sameAs pairs are
   * applied to the registry so subsequent `validate()` / `instantiate()` calls
   * reflect the imported ontology.
   *
   * @param jsonLd - The OWL 2 TBox input as a QuadInterface array, a JSON-LD
   *   object, or a JSON-LD string.
   * @param options - Optional per-call overrides.
   * @returns OwlImportResult (same shape as the static variant).
   * @throws {OwlImportError} code OWL_IMPORT_NOT_IMPLEMENTED when an axiom group has no dispatcher.
   * @throws {GraphError} code DIALECT_UNSUPPORTED when the input contains an unsupported JSON Schema dialect.
   */
  public fromTbox(
    jsonLd: object | QuadInterface[] | string,
    options?: { 'register'?: boolean }
  ): OwlImportResult {
    const register = options?.register !== false;
    const importer = new OwlImporter({
      'baseIRI': this.baseIRI,
      'prefixes': this.prefixes
    });
    const result = importer.import(jsonLd);

    if (register) {
      for (const schema of result.schemas) {
        if (typeof schema.$id === 'string') {
          this.registry.set(schema as Record<string, unknown>);
        }
      }
      for (const {
        invariant, 'schemaId': schemaId
      } of result.invariants) {
        this.registry.addInvariant(schemaId, invariant);
      }
      for (const [
        a,
        b
      ] of result.sameAs) {
        this.registry.sameAsStore.add(a, b);
      }
      for (const {
        characteristic, 'propertyIri': propertyIri
      } of result.characteristics) {
        this.registry.addCharacteristic(propertyIri, characteristic);
      }
    }

    return result;
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
   * @throws {InstantiationError} code INSTANTIATION_FAILED when the data fails validation.
   * @throws {@link DecodeError} when a registered transform decoder throws during instantiation.
   * @throws {SchemaError} code SCHEMA_NOT_REGISTERED when no schema is registered for the given ID.
   * @throws {SchemaError} code SCHEMA_INVALID_INPUT when schema is null or undefined.
   */
  public instantiate<K extends keyof TMap & string>(schemaId: K, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): TMap[K];
  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------
  public instantiate<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }>(
    schema: TSchema, data: unknown, callOptions?: { 'enableDefaults'?: boolean }
  ): ParseOutputType<TSchema>;
  public instantiate(schema: SchemaRefType<TMap>, data: unknown, callOptions?: { 'enableDefaults'?: boolean }): unknown {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : (schema as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schema !== 'string') {
      this.registry.set(schema);
    }

    return this.registry.instantiate(schemaId, data, callOptions);
  }
  /**
   * Type guard that returns `true` if data satisfies the schema.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to check.
   * @returns Whether the data conforms to the schema.
   * @throws {SchemaError} code SCHEMA_NOT_REGISTERED when no schema is registered for the given ID.
   * @throws {SchemaError} code SCHEMA_INVALID_INPUT when schema is null or undefined.
   */
  public is<K extends keyof TMap & string>(schemaId: K, data: unknown): data is TMap[K];
  public is(schema: Record<string, unknown> & { '$id': string; }, data: unknown): boolean;
  public is(schema: SchemaRefType<TMap>, data: unknown): boolean {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : (schema as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schema !== 'string') {
      this.registry.set(schema);
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
  public materialize<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }>(
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
    schema: (JsonSchemaDocumentType & { readonly '$id': string }) | (Record<string, unknown> & { '$id': string }),
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

    const tboxQuads = this.ontologySerializer.serializeQuads(this.registry.listGraphs());
    const shaclQuads = this.shaclSerializer.serializeQuads(this.registry.listGraphs());

    const builder = new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'prefixes': this.prefixes
    })
      .addFromQuads(tboxQuads)
      .addShaclFromQuads(shaclQuads);

    this.ontologyCache = {
      builder,
      revision
    };

    return builder;
  }

  /**
   * Adds a schema that may lack a `$id`, assigning a content-hash-based synthetic ID
   * when one is not present.
   *
   * @param schema - The schema object; if it already has a `$id`, delegates to {@link set}.
   * @returns The `$id` used for registration (original or synthetic).
   */
  public registerAnonymous(schema: Record<string, unknown>): string {
    return this.registry.registerAnonymous(schema);
  }

  // ---------------------------------------------------------------------------
  // Materialization
  // ---------------------------------------------------------------------------
  /**
   * Removes a previously registered compute function.
   *
   * @param schemaId - The `$id` of the schema owning the computed property.
   * @param name - The property name to deregister.
   */
  public removeComputed(schemaId: string, name: string): void {
    this.registry.computedStore.remove(this.curie.expand(schemaId), name);
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
  private resolveAllRefs(loader: LoaderType): Promise<void> {
    return this.refLoader.resolveAll(loader);
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
    // ABox individual IRIs may be authored as CURIEs; expand to canonical so the
    // emitted owl:sameAs quads carry absolute IRI terms and self-pair dedup
    // compares canonical forms.
    this.registry.sameAsStore.add(this.curie.expand(instanceIriA), this.curie.expand(instanceIriB));
  }

  /**
   * Add or replace one or more schemas. Schema is always the first argument:
   * - `set(schema)` — key derived from `schema.$id`; widens `TMap`.
   * - `set(schema, iri)` — explicit key; rare, for non-canonical aliasing.
   * - `set([s1, s2])` — bulk; each entry is either a schema or `[schema, iri]`.
   *
   * Replaces silently on `$id` collision per `Map.set` semantics.
   *
   * @returns This instance with the new schema types merged into `TMap`.
   */
  public set<const T extends { readonly '$id': string; }>(
    schema: T,
    iri?: string
  ): JsonTology<SchemaEntryType<T> & TMap, SchemaReferencesMapType<readonly [T]> & TRefs>;
  public set<const T extends ReadonlyArray<{ readonly '$id': string; }>>(
    entries: T & UniqueSchemaIdsType<T>
  ): JsonTology<SchemaMapFromTupleType<T> & TMap, SchemaReferencesMapType<T> & TRefs>;
  public set(
    first:
      | ReadonlyArray<readonly [{ readonly '$id': string; }, string] | { readonly '$id': string; }>
      | { readonly '$id': string; },
    second?: string
  ): JsonTology<TMap, TRefs> {
    if (Array.isArray(first)) {
      this.registry.set(first as ReadonlyArray<Record<string, unknown>>);
    } else if (second === undefined) {
      this.registry.set(first as Record<string, unknown>);
    } else {
      this.registry.set(first as Record<string, unknown>, second);
    }

    // Cast needed: TypeScript cannot track that set() accumulates into the TMap type parameter
    return this;
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
   * @throws {SchemaError} code SCHEMA_NOT_REGISTERED when no schema is registered for the given ID.
   * @throws {SchemaError} code SCHEMA_INVALID_INPUT when schema is null or undefined.
   * @throws {GraphError} code POINTER_NOT_FOUND when the pointer cannot be resolved.
   */
  public subschemaAt<K extends keyof TMap & string>(
    schemaId: K,
    pointer: (Record<never, never> & string) | SchemaPointerPathsType<TMap[K]>
  ): Record<string, unknown> & { '$id': string };
  public subschemaAt<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }>(
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
      this.registry.set(schemaRef);
    }

    return this.registry.subschemaAt(parentId, pointer);
  }
  /**
   * Compact a full IRI to its CURIE form using the registry's merged prefix map.
   *
   * @param iri - A full IRI such as `http://www.w3.org/1999/02/22-rdf-syntax-ns#type`.
   * @returns The CURIE form when a prefix matches (e.g. `rdf:type`); otherwise the input unchanged.
   */
  public toCurie(iri: string): string {
    return this.curie.compact(iri);
  }

  /**
   * Projects instance data to RDF quads and returns an {@link OntologyBuilder} for serialization.
   *
   * Inverse of {@link fromQuads}: `toQuads` lowers typed objects into ABox quads,
   * `fromQuads` lifts quads back into typed objects. Symmetric `owl:sameAs`
   * assertions registered via {@link sameAs} are appended automatically.
   *
   * @param schema - The schema describing the data shape.
   * @param data - The instance data to project into quads.
   * @param options - Per-call overrides typed as {@link ToQuadsOptionsType}:
   *   - `graphIRI` — when set, every emitted quad's `graph` field is stamped
   *     with this IRI. Falls back to the instance-level `defaultGraphIRI`.
   *   - `iriFor` — overrides root subject IRI minting. If a string, sets the
   *     depth-0 subject IRI. If the literal `'blank-node'`
   *     ({@link BLANK_NODE_IRI_FOR}), every object subject is emitted as an
   *     anonymous blank node. If a function `(ctx) => string | undefined`,
   *     called once per object with `{ path, value, depth }`. Falls back to
   *     the instance-level default.
   * @returns The projected RDF quads.
   *
   * If you want a richer wrapper (JSON-LD context, SHACL composition,
   * raw vs prefixed projection), call {@link ontology} on the registry
   * and pass the quads through. `toQuads` returns the data, not a
   * builder, so the name matches the contract.
   *
   * @throws {SchemaError} code SCHEMA_NOT_REGISTERED when no schema is registered for the given ID.
   * @throws {MaterializationError} code MATERIALIZATION_FAILED when the data cannot be projected.
   */
  public toQuads<TSchema extends JsonSchemaDocumentType & { readonly '$id': string; }>(
    schema: TSchema,
    data: InferSchemaType<TSchema>,
    options?: ToQuadsOptionsType
  ): QuadInterface[] {
    const normalized = normalizeToQuadsOptions(options);
    const effective = {
      'curie': this.curie,
      'graphIRI': normalized.graphIRI ?? this.defaultGraphIRI,
      'iriFor': normalized.iriFor ?? liftIriForOption(this.defaultIriForRaw),
      'predicateResolver': this.predicateResolver
    };

    return this.materializer.projectAbox(
      JsonTology.asNamedSchema(schema),
      data,
      this.baseIRI,
      effective
    );
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
      this.registry.set(schemaRef);
    }

    const graph = this.registry.graph(schemaId);

    if (graph === undefined) {
      return undefined;
    }

    return this.graphSchemaSerializer.serialize(graph);
  }

  /**
   * Generates SHACL shapes — node shapes and property shapes encoding
   * structural constraints — derived from all registered schemas.
   *
   * **Asymmetry note:** `toShacl()` produces SHACL shape quads for export or
   * reasoning, but there is no built-in inverse yet. To validate instance data
   * against SHACL shapes, retrieve the quads via `toShacl().shaclQuads()` and
   * pass them to an external SHACL processor (e.g. `rdf-validate-shacl`).
   * See {@link JsonTology.validateWithShacl} for the planned inverse.
   *
   * @returns A fresh {@link OntologyBuilder} containing only SHACL shape quads (no OWL classes/properties).
   */
  public toShacl(): OntologyBuilder {
    const shaclQuads = this.shaclSerializer.serializeQuads(this.registry.listGraphs());

    return new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'prefixes': this.prefixes
    }).addShaclFromQuads(shaclQuads);
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
    const tboxQuads = this.ontologySerializer.serializeQuads(this.registry.listGraphs());

    return new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'prefixes': this.prefixes
    }).addFromQuads(tboxQuads);
  }

  /**
   * Validates data against a registered schema and returns structured {@link ValidationErrors}.
   *
   * Returns an empty collection (`.ok === true`) when the data is valid.
   * Does not mutate input. Does not throw on validation failure.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to validate.
   * @returns A {@link ValidationErrors} instance (empty when data is valid).
   * @throws {SchemaError} code SCHEMA_NOT_REGISTERED when no schema is registered for the given ID.
   * @throws {SchemaError} code SCHEMA_INVALID_INPUT when schema is null or undefined.
   */
  public validate<K extends keyof TMap & string>(schemaId: K, data: unknown): ValidationErrors;
  public validate(schema: Record<string, unknown> & { '$id': string; }, data: unknown): ValidationErrors;
  public validate(schema: SchemaRefType<TMap>, data: unknown): ValidationErrors {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : (schema as Record<string, unknown> & { '$id': string }).$id;

    if (typeof schema !== 'string') {
      this.registry.set(schema);
    }

    return this.registry.validate(schemaId, data);
  }

  /**
   * Validates instance data quads against SHACL shapes produced from registered schemas.
   *
   * Intended as the symmetric inverse of {@link JsonTology.toShacl}: `toShacl()`
   * emits SHACL shape quads; `validateWithShacl()` will consume those shapes plus
   * ABox data quads and return a structured validation report.
   *
   * @experimental This method is not yet implemented. As a workaround, retrieve
   * shapes via `toShacl().shaclQuads()` and pass them to an external SHACL
   * processor (e.g. `rdf-validate-shacl`).
   *
   * @param _shapes - SHACL shape quads or an {@link OntologyBuilder} produced by `toShacl()`.
   * @param _data - ABox instance data quads to validate against the shapes.
   * @returns Never returns — always throws while the method is unimplemented.
   * @throws {GraphError} `NOT_IMPLEMENTED` — always throws until this method is implemented.
   */
  public validateWithShacl(
    _shapes: OntologyBuilder | readonly QuadInterface[],
    _data: readonly QuadInterface[]
  ): never {
    throw new GraphError(
      'NOT_IMPLEMENTED',
      'validateWithShacl is not yet available. Retrieve shapes via toShacl().shaclQuads() and validate with an external SHACL processor.'
    );
  }
}
