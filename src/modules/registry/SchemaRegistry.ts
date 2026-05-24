/**
 * Schema Registry
 *
 * Single in-repo graph engine shared by validation, parsing, materialization, and
 * pointer-based sub-schema execution.
 */

import type { CompiledValidatorInterface } from '../../interfaces/Compiler.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type {
  GraphEngineOptionsInterface, KeywordDefinitionInterface
} from '../../interfaces/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type { InvariantInterface } from '../../interfaces/Invariant.js';
import type { LoggerInterface } from '../../interfaces/Logger.js';
import type { RegistryOptionsInterface } from '../../interfaces/Registry.js';
import type { SchemaCompilerInterface } from '../../interfaces/SchemaCompilerImpl.js';
import type {
  DuplicateReportEntryType, SchemaEntryStoreInterface
} from '../../interfaces/SchemaEntryStore.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaRefWalkerInterface } from '../../interfaces/SchemaRefWalker.js';
import type { SchemaRegistryEntryInterface } from '../../interfaces/SchemaRegistryEntry.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type { ValidationErrorType } from '../../types/Validation.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import type { SchemaRegistryForEachCallback } from '../../types/SchemaRegistryForEachCallback.js';

import { InstantiationError } from '../../errors/InstantiationError.js';
import { ComputedStore } from './ComputedStore.js';
import { SchemaEntryStore } from './SchemaEntryStore.js';
import { SchemaRefWalker } from './SchemaRefWalker.js';
import { SameAsStore } from './SameAsStore.js';
import { Curie } from '../rdf/Curie.js';
import {
  deepFreeze, isRecord
} from '../data/DataTypes.js';
import { Frozen } from '../data/Frozen.js';
import { GraphEngine } from '../graph/GraphEngine.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
import { Hash } from '../hash/Hash.js';
import { InvariantStore } from './InvariantStore.js';
import { Materializer } from '../materialization/Materializer.js';
import { RefDecoder } from '../graph/RefDecoder.js';
import { Resolver } from '../data/Resolver.js';
import { SchemaCompiler } from '../validation/SchemaCompiler.js';
import { SchemaError } from '../../errors/SchemaError.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { Transform } from '../transform/Transform.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';

import {
  CAST_OPTIONS, CLEAN_OPTIONS, COLLECT_ERRORS_OPTIONS,
  CONVERT_OPTIONS
} from '../../constants/EXECUTION_OPTIONS.js';
import {
  CURRENT_DIALECT_PREFIX, DRAFT_NAME
} from '../../constants/DIALECT.js';
import { DEFAULT_PREFIXES } from '../../constants/PREFIXES.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';

const EMPTY_VALIDATION_ERRORS = new ValidationErrors([]);
const EMPTY_EMBEDDED_MAP_MUTABLE = new Map<string, Record<string, unknown>>();
const EMPTY_EMBEDDED_MAP: ReadonlyMap<string, Record<string, unknown>> = Object.freeze(EMPTY_EMBEDDED_MAP_MUTABLE);

// Hoisted from addCharacteristic() — allocated once per module, not per call.
const CHARACTERISTIC_TO_KEY: Readonly<Partial<Record<string, string>>> = Object.freeze({
  'Asymmetric': 'asymmetric',
  'Functional': 'functional',
  'InverseFunctional': 'inverseFunctional',
  'Irreflexive': 'irreflexive',
  'Reflexive': 'reflexive',
  'Symmetric': 'symmetric',
  'Transitive': 'transitive'
});

function detectEmbeddedIds(node: unknown, isRoot: boolean): boolean {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (detectEmbeddedIds(item, false)) {
        return true;
      }
    }

    return false;
  }

  if (!isRecord(node)) {
    return false;
  }

  if (!isRoot && typeof node.$id === 'string' && node.$id !== '') {
    return true;
  }

  for (const value of Object.values(node)) {
    if (detectEmbeddedIds(value, false)) {
      return true;
    }
  }

  return false;
}

// Re-exported so existing consumers of SchemaRegistry keep their import paths.
export type { DuplicateReportEntryType } from '../../interfaces/SchemaEntryStore.js';


export class SchemaRegistry implements SchemaRegistryInterface {
  public readonly castTypes: boolean;
  private readonly compiler: SchemaCompilerInterface;
  public readonly computedStore: ComputedStore;
  public readonly curie: CurieInterface | undefined;

  private readonly enableDuplicateDetection: boolean;
  private readonly enableInlineWarnings: boolean;
  private readonly enableStrictGraph: boolean;
  private readonly enableStrictTypes: boolean;
  private readonly formatRegistry: FormatRegistryInterface | undefined;
  private readonly instantiateOptions: Readonly<Record<string, boolean>>;
  private readonly invariants: InvariantStore;
  private readonly keywords: KeywordDefinitionInterface[] | undefined;
  private readonly logger: LoggerInterface;
  private readonly lookupGraphFn: (id: string) => SchemaGraphInterface | undefined;
  private readonly maxSchemaDepth: number | undefined;
  private readonly refs: SchemaRefWalkerInterface;
  public readonly sameAsStore: SameAsStore;
  private readonly store: SchemaEntryStoreInterface;
  private readonly vocabularies: readonly VocabularyPluginInterface[];

  public constructor(options?: RegistryOptionsInterface) {
    this.logger = options?.logger ?? SILENT_LOGGER;
    this.castTypes = options?.enableTypeCast ?? false;
    this.instantiateOptions = Object.freeze({
      'applyDefaults': options?.enableDefaults ?? true,
      'castTypes': this.castTypes,
      'collectErrors': true,
      'removeAdditionalProperties': true
    });
    this.maxSchemaDepth = options?.maxSchemaDepth;
    this.enableStrictTypes = options?.enableStrictTypes ?? false;
    // Strict-by-default: every graph-integrity gate is on unless the consumer
    // explicitly opts out. Inline primitive constraints and structural
    // duplicates of an existing registered schema are both registration
    // errors. A schema that legitimately needs the historical permissive
    // behaviour passes the relevant flag as `false`.
    this.enableStrictGraph = options?.enableStrictGraph ?? true;
    this.enableInlineWarnings = this.enableStrictGraph || (options?.enableInlineWarnings ?? true);
    this.enableDuplicateDetection = this.enableStrictGraph || (options?.enableDuplicateDetection ?? true);
    this.vocabularies = options?.vocabularies ?? [];

    const mergedPrefixes = { ...DEFAULT_PREFIXES };

    for (const plugin of this.vocabularies) {
      Object.assign(mergedPrefixes, plugin.prefixes);
    }
    if (options?.prefixes) {
      Object.assign(mergedPrefixes, options.prefixes);
    }

    this.curie = Object.keys(mergedPrefixes).length > 0 ? new Curie(mergedPrefixes) : undefined;
    this.computedStore = new ComputedStore();
    this.refs = new SchemaRefWalker();
    this.store = new SchemaEntryStore();
    this.sameAsStore = new SameAsStore();
    this.formatRegistry = options?.formatRegistry;
    this.keywords = options?.keywords;
    this.invariants = new InvariantStore(options?.invariants);
    this.lookupGraphFn = (id: string): SchemaGraphInterface | undefined => {
      return this.graph(id);
    };
    this.compiler = new SchemaCompiler({
      'logger': this.logger,
      'lookupCompiled': (schemaId) => {
        return this.store.has(schemaId)
          ? this.compiled(schemaId)
          : undefined;
      }
    });
  }

  /**
   * Apply an OWL 2 property characteristic to an already-registered class schema.
   *
   * Called by the fromTbox() registration path for each entry in
   * OwlImportResult.characteristics. Parses the property IRI to locate the
   * owning class and property name, then re-registers the class schema with
   * the characteristic boolean flag added to the relevant property entry.
   *
   * No-ops when:
   *   - The property IRI has no `#` fragment (cannot derive class + property name).
   *   - The owning class is not registered.
   *   - The characteristic name is not one of the seven OWL 2 property characteristics.
   *
   * The characteristic name must match one of the values emitted by the
   * Characteristics dispatcher: 'Functional' | 'InverseFunctional' |
   * 'Transitive' | 'Symmetric' | 'Asymmetric' | 'Reflexive' | 'Irreflexive'.
   *
   * @param propertyIri - Full property IRI, e.g. `urn:bookstore:Review#customerId`.
   * @param characteristic - OWL 2 characteristic name string from the dispatcher.
   */
  public addCharacteristic(propertyIri: string, characteristic: string): void {
    const schemaKey = CHARACTERISTIC_TO_KEY[characteristic];

    if (schemaKey === undefined) {
      return;
    }

    const parts = SchemaIri.splitSubject(propertyIri);

    if (parts.fragment === null) {
      return;
    }

    const classIri = parts.base;
    const propertyName = parts.fragment;

    const existing = this.get(classIri);

    if (existing === undefined) {
      return;
    }

    const existingProperties = isRecord(existing.properties) ? existing.properties : {};
    const existingProp = isRecord(existingProperties[propertyName]) ? existingProperties[propertyName] : {};

    // Skip if the characteristic is already set (idempotent)
    if (existingProp[schemaKey] === true) {
      return;
    }

    const patchedProp = {
      ...existingProp,
      [schemaKey]: true
    };

    const patchedProperties = {
      ...existingProperties,
      [propertyName]: patchedProp
    };

    const patchedSchema: Record<string, unknown> = {
      ...existing,
      'properties': patchedProperties
    };

    // Delete first so the re-registration doesn't trigger SCHEMA_DUPLICATE_ID.
    this.delete(classIri);
    this.set(patchedSchema);
  }

  public addInvariant(schemaId: string, invariant: InvariantInterface): void {
    this.invariants.add(schemaId, invariant);
  }

  /**
   * Walk the top-level `properties` of a schema and throw if any property
   * carries a hard OWL 2 characteristic conflict.
   *
   * Hard conflicts (forbidden by OWL 2 semantics):
   *   - symmetric  + asymmetric  (mutually exclusive)
   *   - reflexive  + irreflexive (mutually exclusive)
   *   - asymmetric + reflexive   (asymmetric implies irreflexive in OWL 2;
   *                               explicit reflexive contradicts that)
   */
  private assertNoPropertyCharacteristicConflicts(
    schema: Record<string, unknown>,
    schemaId: string
  ): void {
    if (!isRecord(schema.properties)) {
      return;
    }

    for (const [
      propName,
      propSchema
    ] of Object.entries(schema.properties)) {
      if (!isRecord(propSchema)) {
        continue;
      }

      const sym = propSchema.symmetric === true;
      const asym = propSchema.asymmetric === true;
      const refl = propSchema.reflexive === true;
      const irr = propSchema.irreflexive === true;

      if (sym && asym) {
        throw new SchemaError(
          'PROPERTY_CHARACTERISTIC_CONFLICT',
          `Property "${propName}" in schema "${schemaId}" sets both symmetric:true and asymmetric:true, which are mutually exclusive OWL 2 characteristics`,
          { schemaId }
        );
      }

      if (refl && irr) {
        throw new SchemaError(
          'PROPERTY_CHARACTERISTIC_CONFLICT',
          `Property "${propName}" in schema "${schemaId}" sets both reflexive:true and irreflexive:true, which are mutually exclusive OWL 2 characteristics`,
          { schemaId }
        );
      }

      if (asym && refl) {
        throw new SchemaError(
          'PROPERTY_CHARACTERISTIC_CONFLICT',
          `Property "${propName}" in schema "${schemaId}" sets both asymmetric:true and reflexive:true; asymmetric implies irreflexive in OWL 2, so reflexive directly contradicts it`,
          { schemaId }
        );
      }
    }
  }

  /**
   * Lazy cross-schema $ref check. On first use of a registered schema
   * (validate / instantiate / materialize / cast / clean / convert / is),
   * walk the schema for any cross-schema $ref strings whose target IRI is
   * not registered. Throws GraphError REF_UNRESOLVED if found.
   *
   * Local fragment refs (#, #/..., #anchor) are never reported here —
   * they are resolved against the schema's own graph. Embedded schemas
   * with their own $id are recognised so a $ref to that nested $id passes.
   *
   * Result is cached on the entry so we only walk once per entry.
   */
  private assertRefsResolvable(entry: SchemaRegistryEntryInterface): void {
    if (entry.refsChecked === true) {
      return;
    }

    const schemaId = (entry.schema.$id as string | undefined) ?? '<anonymous>';
    const embeddedIds = new Set<string>();

    this.refs.collectEmbeddedIds(entry.schema, embeddedIds);
    this.refs.assertResolvable(
      entry.schema,
      schemaId,
      embeddedIds,
      (id) => {
        return this.store.has(id);
      },
      (id) => {
        return this.resolve(id);
      }
    );
    entry.refsChecked = true;
  }

  public cast(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown, options?: { 'clone'?: boolean }): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, { schemaId });
    }

    const input = options?.clone === false ? data : structuredClone(data);

    return compiled.validate(input, CAST_OPTIONS).value;
  }

  /**
   * Enforce `owl:disjointWith` annotations at validation time.
   *
   * If schema A declares `disjointWith: B` (via `Compose.disjointWith` or a
   * raw annotation), no value may successfully validate against both A and B.
   * After A's structural validation passes, run B's validator silently — if
   * it also passes, the value violates the disjointness assertion and we
   * surface a DISJOINT_VIOLATION error so callers see a real failure rather
   * than an apparent OK.
   */
  private checkDisjointWith(schemaId: string, data: unknown): ValidationErrorType[] {
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      return [];
    }
    const raw = entry.schema.disjointWith;
    let disjointTargets: string[] = [];

    if (typeof raw === 'string') {
      disjointTargets = [raw];
    } else if (Array.isArray(raw)) {
      disjointTargets = raw.filter((target): target is string => {
        return typeof target === 'string';
      });
    }

    if (disjointTargets.length === 0) {
      return [];
    }
    const errors: ValidationErrorType[] = [];

    for (const targetId of disjointTargets) {
      const resolved = this.resolve(targetId);
      const targetCompiled = this.compiled(resolved);

      if (targetCompiled === undefined) {
        // Disjoint target not registered — surface as a structural violation
        // rather than silently passing; the annotation references an unknown
        // class and the contract can't be checked.
        errors.push({
          'keyword': 'disjointWith',
          'message': `disjointWith target '${targetId}' is not registered; cannot enforce disjointness`,
          'params': {
            'disjointTarget': targetId,
            'schemaId': schemaId
          },
          'path': ''
        });
        continue;
      }

      const targetResult = targetCompiled.validate(data, COLLECT_ERRORS_OPTIONS);

      if (targetResult.errors.length === 0) {
        errors.push({
          'keyword': 'disjointWith',
          'message': `value satisfies '${schemaId}' and '${targetId}', but they are declared disjoint`,
          'params': {
            'disjointTarget': targetId,
            'schemaId': schemaId
          },
          'path': ''
        });
      }
    }

    return errors;
  }

  public clean(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, { schemaId });
    }

    return compiled.validate(structuredClone(data), CLEAN_OPTIONS).value;
  }

  public clear(): void {
    this.store.clear();
  }

  private collectAnchors(schema: Record<string, unknown>, seen: Set<string>, schemaId: string): void {
    if (typeof schema.$anchor === 'string') {
      if (seen.has(schema.$anchor)) {
        throw new SchemaError(
          'SCHEMA_DUPLICATE_ANCHOR',
          `Duplicate $anchor "${schema.$anchor}" in schema "${schemaId}"`,
          { schemaId }
        );
      }
      seen.add(schema.$anchor);
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      if (seen.has(schema.$dynamicAnchor)) {
        throw new SchemaError(
          'SCHEMA_DUPLICATE_ANCHOR',
          `Duplicate $dynamicAnchor "${schema.$dynamicAnchor}" in schema "${schemaId}"`,
          { schemaId }
        );
      }
      seen.add(schema.$dynamicAnchor);
    }

    for (const value of Object.values(schema)) {
      if (isRecord(value)) {
        this.collectAnchors(value, seen, schemaId);
      }
    }
  }

  /**
   * Collect all non-fragment cross-schema $ref IRIs reachable from the given schema
   * that are not yet registered. Used by the loader walker in JsonTology._resolveAllRefs.
   */
  public collectUnresolvedRefIris(schema: Record<string, unknown>): ReadonlySet<string> {
    return this.refs.collectUnresolved(
      schema,
      (id) => {
        return this.store.has(id);
      },
      (id) => {
        return this.resolve(id);
      }
    );
  }

  private compiled(schemaId: string): CompiledValidatorInterface | undefined {
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      return undefined;
    }

    return this.compiledFromEntry(entry);
  }

  private compiledFromEntry(entry: SchemaRegistryEntryInterface): CompiledValidatorInterface {
    this.assertRefsResolvable(entry);

    if (entry.compiled === undefined) {
      const engine = this.engine(entry.schema);

      entry.compiled = this.compiler.compile(engine, this.graphOf(entry));
    }

    return entry.compiled;
  }

  public convert(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown, options?: { 'clone'?: boolean }): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, { schemaId });
    }

    const input = options?.clone === false ? data : structuredClone(data);

    return compiled.validate(input, CONVERT_OPTIONS).value;
  }

  public create(schemaId: string): unknown {
    const entry = this.store.get(this.resolve(schemaId));

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No schema registered for: ${schemaId}`, { schemaId });
    }

    this.assertRefsResolvable(entry);

    const materializer = new Materializer(this);

    return materializer.createDefault(entry.schema as Record<string, unknown> & { '$id': string });
  }

  public delete(schemaId: string): boolean {
    return this.store.delete(this.resolve(schemaId));
  }

  public engine(schema: Record<string, unknown>): GraphEngineInterface {
    const schemaId = schema.$id as string;
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_VALIDATOR_MISSING', `No validator registered for schema: ${schemaId}`, { schemaId });
    }

    if (entry.engine === undefined) {
      const embeddedSchemas = entry.hasEmbeddedIds
        ? GraphEngineSupport.buildEmbeddedSchemaMap(entry.schema)
        : EMPTY_EMBEDDED_MAP;

      const engineOptions: GraphEngineOptionsInterface = {
        'lookupGraph': this.lookupGraphFn,
        'lookupSchema': (lookupSchemaId: string): Record<string, unknown> | undefined => {
          return this.store.get(lookupSchemaId)?.schema ?? embeddedSchemas.get(lookupSchemaId);
        }
      };

      if (this.formatRegistry !== undefined) {
        engineOptions.formatRegistry = this.formatRegistry;
      }
      if (this.keywords !== undefined && this.keywords.length > 0) {
        engineOptions.keywords = this.keywords;
      }
      if (this.maxSchemaDepth !== undefined) {
        engineOptions.maxSchemaDepth = this.maxSchemaDepth;
      }

      entry.engine = new GraphEngine(entry.schema, engineOptions);
    }

    return entry.engine;
  }


  public *entries(): IterableIterator<[string, Record<string, unknown>]> {
    for (const [
      iri,
      entry
    ] of this.store.entries()) {
      yield [
        iri,
        entry.schema
      ];
    }
  }

  public findDuplicates(): readonly DuplicateReportEntryType[] {
    return this.store.findDuplicates();
  }

  public forEach(callback: SchemaRegistryForEachCallback): void {
    for (const [
      iri,
      entry
    ] of this.store.entries()) {
      callback(entry.schema, iri, this);
    }
  }

  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.store.get(this.resolve(schemaId))?.schema;
  }

  public graph(schemaId: string): SchemaGraphInterface | undefined {
    const entry = this.store.get(this.resolve(schemaId));

    if (entry === undefined) {
      return undefined;
    }

    return this.graphOf(entry);
  }

  public graphEntry(schemaId: string): undefined | {
    'graph': SchemaGraphInterface;
    'schema': Record<string, unknown>;
  } {
    const entry = this.store.get(this.resolve(schemaId));

    if (entry === undefined) {
      return undefined;
    }

    return {
      'graph': this.graphOf(entry),
      'schema': entry.schema
    };
  }

  private graphOf(entry: SchemaRegistryEntryInterface): SchemaGraphInterface {
    entry.graph ??= new SchemaGraph(entry.schema, { 'vocabularies': this.vocabularies });

    return entry.graph;
  }

  public has(schemaId: string): boolean {
    return this.store.has(this.resolve(schemaId));
  }

  private hashSchema(schema: Record<string, unknown>): string {
    const {
      '$id': _, ...rest
    } = schema;

    return Hash.value(rest);
  }

  public instantiate(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown,
    callOptions?: {
      'clone'?: boolean;
      'enableDefaults'?: boolean;
    }
  ): unknown {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`);
    }

    if (!entry.hasComputedFields && this.computedStore.has(schemaId)) {
      entry.hasComputedFields = true;
    }

    const computedMap = entry.hasComputedFields ? this.computedStore.getMap(schemaId) : {};
    const computedNames = Object.keys(computedMap);

    if (computedNames.length > 0 && isRecord(data)) {
      const forbidden = computedNames.filter((name) => {
        return name in (data);
      });

      if (forbidden.length > 0) {
        const errors = forbidden.map((name) => {
          return {
            'keyword': 'COMPUTED_INPUT_FORBIDDEN',
            'message': `"${name}" is a computed field and must not be supplied in input`,
            'params': {},
            'path': `/${name}`
          };
        });

        throw new InstantiationError(new ValidationErrors(errors));
      }
    }

    const compiled = this.compiledFromEntry(entry);
    const resolvedOptions = callOptions?.enableDefaults === undefined
      ? this.instantiateOptions
      : Resolver.merge(
        this.instantiateOptions,
        { 'applyDefaults': callOptions.enableDefaults }
      );
    const input = callOptions?.clone === false ? data : structuredClone(data);
    const result = compiled.validate(input, resolvedOptions);

    if (!result.valid) {
      throw new InstantiationError(new ValidationErrors(result.errors));
    }

    const invariantErrors = this.invariants.runAll(schemaId, result.value);

    if (invariantErrors.length > 0) {
      throw new InstantiationError(new ValidationErrors([
        ...result.errors,
        ...invariantErrors
      ]));
    }

    const coerced = result.value;

    if (computedNames.length > 0 && isRecord(coerced)) {
      for (const [
        name,
        fn
      ] of Object.entries(computedMap)) {
        try {
          coerced[name] = fn(coerced);
        } catch (error) {
          const causeError = error instanceof Error ? error : new Error(String(error));

          throw new InstantiationError(
            new ValidationErrors([{
              'keyword': 'COMPUTED_FN_MISSING',
              'message': `Compute function for "${name}" threw: ${causeError.message}`,
              'params': {},
              'path': `/${name}`
            }]),
            { 'cause': causeError }
          );
        }
      }
    }

    const schemaObj = typeof schema === 'string' ? entry.schema : schema;
    const refDecoded = RefDecoder.run(this.graphOf(entry), coerced, {
      'getGraph': (target) => {
        const found = this.store.get(target.$id as string);

        return found === undefined ? undefined : this.graphOf(found);
      },
      'getSchema': (targetId) => {
        return this.store.get(targetId)?.schema;
      },
      'resolveSchemaId': (rawId) => {
        return this.resolve(rawId);
      }
    });
    const decoder = Transform.getDecoder(schemaObj);
    let decoded: unknown;

    if (decoder === undefined) {
      decoded = refDecoded;
    } else {
      try {
        decoded = decoder.decode(refDecoded);
      } catch (error) {
        const causeError = error instanceof Error ? error : new Error(String(error));

        throw new InstantiationError(
          new ValidationErrors([{
            'keyword': 'TRANSFORM_DECODE_FAILED',
            'message': `transform decoder failed at root: ${causeError.message}`,
            'params': {},
            'path': ''
          }]),
          {
            'cause': causeError,
            'code': 'TRANSFORM_DECODE_FAILED',
            'message': `transform decoder failed at root: ${causeError.message}`
          }
        );
      }
    }
    const isFrozen = isRecord(schemaObj)
      && (schemaObj['jt:frozen'] === true
        || (isRecord(schemaObj['jt:config']) && schemaObj['jt:config'].frozen === true));

    return isFrozen ? Frozen.deepFreeze(decoded) : decoded;
  }

  public is(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): boolean {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, { schemaId });
    }

    if (!compiled.check(data)) {
      return false;
    }

    return this.invariants.runAll(schemaId, data).length === 0;
  }

  public keys(): IterableIterator<string> {
    return this.store.keys();
  }

  public list(): ReadonlyArray<Record<string, unknown>> {
    return Array.from(this.store.values(), (entry) => {
      return entry.schema;
    });
  }

  public listGraphs(): readonly SchemaGraphInterface[] {
    return Array.from(this.store.values(), (entry) => {
      return this.graphOf(entry);
    });
  }

  public registerAnonymous(schema: Record<string, unknown>): string {
    if (typeof schema.$id === 'string' && schema.$id !== '') {
      this.setOne(schema);

      return schema.$id;
    }

    const hash = this.hashSchema(schema);
    const syntheticId = `urn:json-tology:hash:${hash}`;
    const withId = {
      ...schema,
      '$id': syntheticId
    };

    this.setOne(withId);

    return syntheticId;
  }

  private registerSingle(schema: Record<string, unknown>): void {
    const schemaId = schema.$id as string | undefined;

    if (schemaId === undefined || schemaId === '') {
      throw new SchemaError('SCHEMA_MISSING_ID', 'Schema must have a $id property');
    }

    if (this.enableStrictTypes && typeof schema.$schema === 'string' && !schema.$schema.startsWith(CURRENT_DIALECT_PREFIX)) {
      throw new SchemaError(
        'SCHEMA_DIALECT_UNSUPPORTED',
        `Strict mode requires draft ${DRAFT_NAME} but schema "${schemaId}" declares "${schema.$schema}"`,
        { schemaId }
      );
    }

    this.assertNoPropertyCharacteristicConflicts(schema, schemaId);

    if (typeof schema === 'object') {
      const anchors = new Set<string>();

      this.collectAnchors(schema, anchors, schemaId);
    }

    const hash = this.hashSchema(schema);

    if (this.store.has(schemaId)) {
      const existing = this.store.get(schemaId);

      if (existing === undefined) {
        return;
      }

      if (existing.hash === hash) {
        const hasNewDecoder = Transform.getDecoder(schema) !== undefined;
        const lacksExistingDecoder = Transform.getDecoder(existing.schema) === undefined;

        if (existing.schema !== schema && hasNewDecoder && lacksExistingDecoder) {
          existing.schema = schema;
        }
        this.logger.trace(`Schema already registered (identical): ${schemaId}`);

        return;
      }
      throw new SchemaError(
        'SCHEMA_DUPLICATE_ID',
        `Schema "${schemaId}" is already registered with different content. Unregister first or use the same schema object.`,
        { schemaId }
      );
    }

    const existingId = this.store.getByHash(hash);

    if (existingId !== undefined && existingId !== schemaId) {
      this.logger.warn(`Schema content already registered under different ID: existing="${existingId}" new="${schemaId}"`);
    }

    if (!Object.isFrozen(schema)) {
      deepFreeze(schema);
    }

    const entry: SchemaRegistryEntryInterface = {
      'hasComputedFields': false,
      'hasEmbeddedIds': detectEmbeddedIds(schema, true),
      hash,
      schema
    };
    const graph = this.graphOf(entry);

    if (this.enableInlineWarnings) {
      const warnings = graph.validateStructure();

      if (warnings.length > 0) {
        const message = `Schema "${schemaId}" contains inline shapes: ${warnings.map((warning) => {
          return warning.message;
        }).join('; ')}`;

        if (this.enableStrictGraph) {
          throw new SchemaError('SCHEMA_STRUCTURE_INVALID', message, { schemaId });
        }
        this.logger.warn(message);
      }
    }

    this.store.add(schemaId, entry);
    this.computedStore.validateAgainstGraph(graph);

    if (this.enableDuplicateDetection) {
      const duplicates = this.findDuplicates();

      if (duplicates.length > 0) {
        const dupMsg = duplicates.map((dup) => {
          return `"${dup.schemaId}#${dup.pointer}" duplicates "${dup.equivalentTo}"`;
        }).join('; ');
        const message = `Duplicate schema shapes detected: ${dupMsg}`;

        if (this.enableStrictGraph) {
          throw new SchemaError('SCHEMA_DUPLICATE_SHAPE', message, { schemaId });
        }
        this.logger.warn(message);
      }
    }

    this.logger.trace(`Schema registered: ${schemaId}`);
  }

  public removeInvariant(schemaId: string, name: string): void {
    this.invariants.remove(schemaId, name);
  }

  private resolve(schemaId: string): string {
    if (this.curie === undefined) {
      return schemaId;
    }

    return this.curie.expand(schemaId);
  }

  private resolveSchemaId(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string): string {
    const raw = typeof schemaOrId === 'string' ? schemaOrId : schemaOrId.$id;

    return this.resolve(raw);
  }

  public get revision(): number {
    return this.store.revision;
  }

  public set(schema: Record<string, unknown>, iri?: string): this;
  public set(
    entries: ReadonlyArray<readonly [Record<string, unknown>, string] | Record<string, unknown>>
  ): this;
  public set(
    first:
      | ReadonlyArray<readonly [Record<string, unknown>, string] | Record<string, unknown>>
      | Record<string, unknown>,
    second?: string
  ): this {
    type SetEntry = readonly [Record<string, unknown>, string] | Record<string, unknown>;

    if (Array.isArray(first)) {
      for (const entry of first as readonly SetEntry[]) {
        if (Array.isArray(entry)) {
          const [
            schema,
            iri
          ] = entry as readonly [Record<string, unknown>, string];

          this.setKeyed(iri, schema);
        } else {
          this.setOne(entry as Record<string, unknown>);
        }
      }

      return this;
    }

    if (second !== undefined) {
      this.setKeyed(second, first as Record<string, unknown>);

      return this;
    }
    this.setOne(first as Record<string, unknown>);

    return this;
  }

  private setKeyed(iri: string, schema: Record<string, unknown>): void {
    const schemaIdOnObject = schema.$id;

    if (typeof schemaIdOnObject !== 'string' || schemaIdOnObject === '') {
      throw new SchemaError('SCHEMA_MISSING_ID', 'Schema must have a $id property');
    }

    if (schemaIdOnObject !== iri) {
      throw new SchemaError(
        'SCHEMA_INVALID_INPUT',
        `set() key "${iri}" does not match schema.$id "${schemaIdOnObject}"`,
        { 'schemaId': iri }
      );
    }
    this.delete(iri);
    this.registerSingle(schema);
  }

  private setOne(schema: Record<string, unknown>): void {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new SchemaError(
        'SCHEMA_INVALID_INPUT',
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- error message reflects actual runtime value
        `set() requires plain objects, received ${schema === null ? 'null' : typeof schema}`
      );
    }

    const iri = schema.$id;

    if (typeof iri !== 'string' || iri === '') {
      throw new SchemaError('SCHEMA_MISSING_ID', 'Schema must have a $id property');
    }
    this.delete(iri);
    this.registerSingle(schema);
  }

  public get size(): number {
    return this.store.size;
  }

  public subschemaAt(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    pointer: string
  ): Record<string, unknown> & { '$id': string } {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const entry = this.store.get(schemaId);

    if (!entry) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, { schemaId });
    }

    const graph = this.graphOf(entry);
    const node = graph.resolvePointer(pointer);
    const subSchema = node.schema;
    const synthesizedId = `${schemaId}#${pointer}`;
    const subSchemaRecord = typeof subSchema === 'boolean' ? {} : subSchema;
    const result: Record<string, unknown> & { '$id': string } = {
      ...subSchemaRecord,
      '$id': synthesizedId
    };

    // Register so the result can be passed to validate/instantiate/is directly
    if (!this.store.has(synthesizedId)) {
      this.set(result);
    }

    return result;
  }

  public [Symbol.iterator](): IterableIterator<[string, Record<string, unknown>]> {
    return this.entries();
  }

  public validate(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): ValidationErrors {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No validator registered for schema: ${schemaId}`, { schemaId });
    }

    const result = compiled.validate(data, COLLECT_ERRORS_OPTIONS);

    if (result.errors.length > 0) {
      return new ValidationErrors(result.errors);
    }

    const disjointErrors = this.checkDisjointWith(schemaId, data);

    if (disjointErrors.length > 0) {
      return new ValidationErrors(disjointErrors);
    }

    const invariantErrors = this.invariants.runAll(schemaId, data);

    if (invariantErrors.length === 0) {
      return EMPTY_VALIDATION_ERRORS;
    }

    return new ValidationErrors(invariantErrors);
  }

  public validator(schemaId: string): CompiledValidatorInterface {
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No schema registered for: ${schemaId}`, { schemaId });
    }

    return compiled;
  }

  public *values(): IterableIterator<Record<string, unknown>> {
    for (const entry of this.store.values()) {
      yield entry.schema;
    }
  }
}
