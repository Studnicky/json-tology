/**
 * Schema Registry
 *
 * Single in-repo graph engine shared by validation, parsing, materialization, and
 * pointer-based sub-schema execution.
 */

import type { CompiledValidatorType } from '../../types/Compiler.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type {
  GraphEngineOptionsType, KeywordDefinitionType
} from '../../types/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type { InvariantType } from '../../types/Invariant.js';
import type { LoggerInterface } from '../../interfaces/Logger.js';
import type { RegistryOptionsType } from '../../types/Registry.js';
import type { SchemaCompilerInterface } from '../../interfaces/SchemaCompilerImpl.js';
import type { DuplicateReportEntryType } from '../../types/DuplicateReportEntryType.js';
import type { SchemaEntryStoreInterface } from '../../interfaces/SchemaEntryStore.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { StructureWarningType } from '../../types/SchemaGraph.js';
import type { SchemaRefWalkerInterface } from '../../interfaces/SchemaRefWalker.js';
import type { SchemaRegistryEntryType } from '../../types/SchemaRegistryEntry.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type { ValidationErrorType } from '../../types/Validation.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import type { SchemaRegistryForEachCallback } from '../../types/SchemaRegistryForEachCallback.js';
import type { SetEntryType } from '../../types/SetEntryType.js';

import { BaseError } from '../../errors/BaseError.js';
import { CoercionError } from '../../errors/CoercionError.js';
import { DecodeError } from '../../errors/DecodeError.js';
import { InstantiationError } from '../../errors/InstantiationError.js';
import { TransformError } from '../../errors/TransformError.js';
import { ComputedStore } from './ComputedStore.js';
import { SchemaEntryStore } from './SchemaEntryStore.js';
import { SchemaRefWalker } from './SchemaRefWalker.js';
import { DifferentFromStore } from './DifferentFromStore.js';
import { SameAsStore } from './SameAsStore.js';
import { Curie } from '../rdf/Curie.js';
import {
  isRecord
} from '../data/DataTypes.js';
import { Frozen } from '../data/Frozen.js';
import { logScope } from '../data/LogScope.js';
import { GraphEngine } from '../graph/GraphEngine.js';
import { Hash } from '../hash/Hash.js';
import { InvariantStore } from './InvariantStore.js';
import { Materializer } from '../materialization/Materializer.js';
import { RefDecoder } from '../graph/RefDecoder.js';
import { Resolver } from '../data/Resolver.js';
import { SchemaCompiler } from '../validation/SchemaCompiler.js';
import { SchemaError } from '../../errors/SchemaError.js';
import {
  CoercionErrorCode,
  InstantiationErrorCode,
  SchemaErrorCode,
  TransformErrorCode
} from '../../constants/ERROR_CODES.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';
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
import { STANDARD_PREFIXES } from '../../constants/STANDARD_PREFIXES.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';

const EMPTY_VALIDATION_ERRORS = new ValidationErrors([]);

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

function isStringItem(value: unknown): boolean {
  return typeof value === 'string';
}


/**
 * Central registry for JSON Schemas used by validation, instantiation, materialization,
 * and ontology generation.
 *
 * Schemas are registered by their canonical `$id` IRI. Registration normalizes CURIEs
 * to absolute IRIs and validates structural integrity (duplicate detection, anchor uniqueness,
 * property characteristic conflicts). Compiled validators are cached per entry and invalidated
 * on re-registration.
 *
 * @remarks
 * The registry is the single source of truth for the canonical schema graph. All read paths
 * (validate, instantiate, materialize, graph) resolve through the same store, ensuring
 * consistent behavior across the lifecycle.
 *
 * @example
 * ```ts
 * const registry = new SchemaRegistry({ enableStrictGraph: true });
 * registry.set(UserSchema);
 * const errors = registry.validate(UserSchema.$id, data);
 * ```
 *
 * @category Registry
 * @since 0.1.0
 * @see {@link SchemaRegistryInterface}
 * @group Core
 */
export class SchemaRegistry implements SchemaRegistryInterface {
  /**
   * Resolve registry option booleans to their effective values.
   * Centralises the defaults so the constructor complexity is reduced.
   */
  private static resolveOptions(options: RegistryOptionsType | undefined): {
    'castTypes': boolean;
    'enableDuplicateDetection': boolean;
    'enableInlineWarnings': boolean;
    'enableStrictGraph': boolean;
    'enableStrictTypes': boolean;
    'instantiateOptions': Readonly<Record<string, boolean>>;
    'maxSchemaDepth': number | undefined;
    'vocabularies': readonly VocabularyPluginInterface[];
  } {
    const castTypes = options?.enableTypeCast ?? false;
    const enableStrictGraph = options?.enableStrictGraph ?? true;
    const vocabularies = options?.vocabularies ?? [];
    const enableInlineWarnings = enableStrictGraph || (options?.enableInlineWarnings ?? true);
    const enableDuplicateDetection = enableStrictGraph || (options?.enableDuplicateDetection ?? true);

    return {
      castTypes,
      enableDuplicateDetection,
      enableInlineWarnings,
      enableStrictGraph,
      'enableStrictTypes': options?.enableStrictTypes ?? false,
      'instantiateOptions': Object.freeze({
        'applyDefaults': options?.enableDefaults ?? true,
        castTypes,
        'collectErrors': true,
        'removeAdditionalProperties': true
      }),
      'maxSchemaDepth': options?.maxSchemaDepth,
      vocabularies
    };
  }
  public readonly castTypes: boolean;
  private readonly compiler: SchemaCompilerInterface;
  public readonly computedStore: ComputedStore;

  public readonly curie: CurieInterface | undefined;
  public readonly differentFromStore: DifferentFromStore;
  private readonly enableDuplicateDetection: boolean;
  private readonly enableInlineWarnings: boolean;
  private readonly enableStrictGraph: boolean;
  private readonly enableStrictTypes: boolean;
  private readonly formatRegistry: FormatRegistryInterface | undefined;
  private readonly instantiateOptions: Readonly<Record<string, boolean>>;
  private readonly invariants: InvariantStore;
  private readonly keywords: KeywordDefinitionType[] | undefined;
  private readonly logger: LoggerInterface;
  private readonly lookupGraphFn: (id: string) => SchemaGraphInterface | undefined;
  private readonly maxSchemaDepth: number | undefined;
  private readonly refDecoderRegistry: {
    'getGraph': (target: Record<string, unknown>) => SchemaGraphInterface | undefined;
    'getSchema': (targetId: string) => Record<string, unknown> | undefined;
    'resolveSchemaId': (rawId: string) => string;
  };
  private readonly refs: SchemaRefWalkerInterface;
  public readonly sameAsStore: SameAsStore;
  private readonly store: SchemaEntryStoreInterface;

  private readonly vocabularies: readonly VocabularyPluginInterface[];

  public constructor(options?: RegistryOptionsType) {
    this.logger = options?.logger ?? SILENT_LOGGER;

    const config = SchemaRegistry.resolveOptions(options);

    this.castTypes = config.castTypes;
    this.enableStrictTypes = config.enableStrictTypes;
    this.enableStrictGraph = config.enableStrictGraph;
    this.enableInlineWarnings = config.enableInlineWarnings;
    this.enableDuplicateDetection = config.enableDuplicateDetection;
    this.vocabularies = config.vocabularies;
    this.maxSchemaDepth = config.maxSchemaDepth;
    this.instantiateOptions = config.instantiateOptions;

    const mergedPrefixes = this.buildMergedPrefixes(this.vocabularies, options?.prefixes);

    this.curie = Object.keys(mergedPrefixes).length > 0 ? new Curie(mergedPrefixes) : undefined;
    this.computedStore = new ComputedStore();
    this.refs = new SchemaRefWalker();
    this.store = new SchemaEntryStore();
    this.sameAsStore = new SameAsStore();
    this.differentFromStore = new DifferentFromStore();
    this.formatRegistry = options?.formatRegistry;
    this.keywords = options?.keywords;
    this.invariants = new InvariantStore(options?.invariants);
    this.lookupGraphFn = (id: string): SchemaGraphInterface | undefined => {
      return this.graph(id);
    };
    this.refDecoderRegistry = {
      'getGraph': (target: Record<string, unknown>): SchemaGraphInterface | undefined => {
        const found = this.store.get(target.$id as string);

        return found === undefined ? undefined : this.graphOf(found);
      },
      'getSchema': (targetId: string): Record<string, unknown> | undefined => {
        return this.store.get(targetId)?.schema;
      },
      'resolveSchemaId': (rawId: string): string => {
        return this.resolve(rawId);
      }
    };
    this.compiler = new SchemaCompiler({
      'logger': this.logger,
      'lookupCompiled': (schemaId: string): CompiledValidatorType | undefined => {
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
   * OwlImportResultType.characteristics. Parses the property IRI to locate the
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

  public addDifferentFrom(iriA: string, iriB: string): void {
    this.differentFromStore.add(iriA, iriB);
  }

  public addInvariant(schemaId: string, invariant: InvariantType): void {
    this.invariants.add(this.resolve(schemaId), invariant);
  }

  /**
   * Apply registered compute functions to a validated and coerced record.
   * Throws `InstantiationError` if any compute function throws.
   */
  private applyComputedFields(
    computedNames: string[],
    computedMap: Record<string, (data: Record<string, unknown>) => unknown>,
    coerced: unknown
  ): void {
    if (computedNames.length === 0 || !isRecord(coerced)) {
      return;
    }

    for (const [
      name,
      fn
    ] of Object.entries(computedMap)) {
      try {
        coerced[name] = fn(coerced);
      } catch (error) {
        const causeError = BaseError.toCause(error);

        throw new InstantiationError(
          new ValidationErrors([{
            'keyword': 'COMPUTED_FN_MISSING',
            'message': `Compute function for "${name}" threw: ${causeError.message}`,
            'params': {},
            'path': `/${name}`
          }]),
          {
            'cause': causeError,
            'code': InstantiationErrorCode.INSTANTIATION_FAILED
          }
        );
      }
    }
  }

  /**
   * Deep-freeze the decoded value when the schema declares `jt:frozen: true`
   * or `jt:config.frozen: true`. Returns the value unchanged otherwise.
   */
  private applyFrozenSeal(schemaObj: Record<string, unknown>, decoded: unknown): unknown {
    const isFrozen = schemaObj['jt:frozen'] === true
      || (isRecord(schemaObj['jt:config']) && schemaObj['jt:config'].frozen === true);

    return isFrozen ? Frozen.deepFreeze(decoded) : decoded;
  }

  /**
   * Assert that no differentFrom pair has both members in the same transitive
   * sameAs component. Throws SchemaError(IDENTITY_CONTRADICTION) on contradiction.
   *
   * Builds the transitive closure of sameAs pairs (BFS) and checks
   * each differentFrom pair against it.
   */
  public assertIdentityConsistency(): void {
    const sameAsPairs = this.sameAsStore.all();

    if (sameAsPairs.length === 0) {
      return;
    }

    const adjacency = new Map<string, Set<string>>();

    for (const [
      a,
      b
    ] of sameAsPairs) {
      let setA = adjacency.get(a);

      if (setA === undefined) {
        setA = new Set<string>();
        adjacency.set(a, setA);
      }
      let setB = adjacency.get(b);

      if (setB === undefined) {
        setB = new Set<string>();
        adjacency.set(b, setB);
      }
      setA.add(b);
      setB.add(a);
    }

    const inSameComponent = (startA: string, startB: string): boolean => {
      const visited = new Set<string>();
      const queue: string[] = [startA];

      while (queue.length > 0) {
        const node = queue.pop();

        if (node === undefined) {
          break;
        }
        if (node === startB) {
          return true;
        }
        if (visited.has(node)) {
          continue;
        }
        visited.add(node);
        const neighbors = adjacency.get(node);

        if (neighbors !== undefined) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              queue.push(neighbor);
            }
          }
        }
      }

      return false;
    };

    for (const [
      iriA,
      iriB
    ] of this.differentFromStore.all()) {
      if (!adjacency.has(iriA) && !adjacency.has(iriB)) {
        continue;
      }
      if (inSameComponent(iriA, iriB)) {
        throw new SchemaError(
          `owl:differentFrom contradiction: <${iriA}> and <${iriB}> are declared differentFrom but are in the same owl:sameAs identity component`,
          {
            'code': SchemaErrorCode.IDENTITY_CONTRADICTION,
            'schemaId': iriA
          }
        );
      }
    }
  }

  /**
   * Assert that all registered invariants pass for a validated value.
   * Throws `InstantiationError` when any invariant fails.
   */
  private assertInvariantsPass(schemaId: string, result: { 'errors': ValidationErrorType[];
    'value': unknown }): void {
    const invariantErrors = this.invariants.runAll(schemaId, result.value);

    if (invariantErrors.length > 0) {
      throw new InstantiationError(new ValidationErrors([
        ...result.errors,
        ...invariantErrors
      ]), { 'code': InstantiationErrorCode.INSTANTIATION_FAILED });
    }
  }

  /**
   * Run duplicate shape detection after a schema has been added to the store.
   * Throws `SchemaError('SCHEMA_DUPLICATE_SHAPE')` in strict mode; logs a warning otherwise.
   */
  private assertNoDuplicateShapes(schemaId: string): void {
    if (!this.enableDuplicateDetection) {
      return;
    }

    const duplicates = this.findDuplicates();

    if (duplicates.length === 0) {
      return;
    }

    const dupMsg = duplicates.map((dup: DuplicateReportEntryType): string => {
      return `"${dup.schemaId}#${dup.pointer}" duplicates "${dup.equivalentTo}"`;
    }).join('; ');
    const message = `Duplicate schema shapes detected: ${dupMsg}`;

    if (this.enableStrictGraph) {
      throw new SchemaError(message, {
        'code': SchemaErrorCode.DUPLICATE_SHAPE,
        schemaId
      });
    }
    this.logger.warn(logScope('SchemaRegistry', 'assertNoDuplicateShapes', message));
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
          `Property "${propName}" in schema "${schemaId}" sets both symmetric:true and asymmetric:true, which are mutually exclusive OWL 2 characteristics`,
          {
            'code': SchemaErrorCode.PROPERTY_CHARACTERISTIC_CONFLICT,
            schemaId
          }
        );
      }

      if (refl && irr) {
        throw new SchemaError(
          `Property "${propName}" in schema "${schemaId}" sets both reflexive:true and irreflexive:true, which are mutually exclusive OWL 2 characteristics`,
          {
            'code': SchemaErrorCode.PROPERTY_CHARACTERISTIC_CONFLICT,
            schemaId
          }
        );
      }

      if (asym && refl) {
        throw new SchemaError(
          `Property "${propName}" in schema "${schemaId}" sets both asymmetric:true and reflexive:true; asymmetric implies irreflexive in OWL 2, so reflexive directly contradicts it`,
          {
            'code': SchemaErrorCode.PROPERTY_CHARACTERISTIC_CONFLICT,
            schemaId
          }
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
  private assertRefsResolvable(entry: SchemaRegistryEntryType): void {
    if (entry.refsChecked === true) {
      return;
    }

    const schemaId = (entry.schema.$id as string | undefined) ?? '<anonymous>';
    // Embedded-$id knowledge comes solely from the canonical graph index.
    // graphOf is memoised, so this reuses the entry's already-built graph.
    const embeddedIds = new Set(this.graphOf(entry).embeddedSchemaIds());

    this.refs.assertResolvable(
      entry.schema,
      schemaId,
      embeddedIds,
      (id: string): boolean => {
        return this.store.has(id);
      },
      (id: string): string => {
        return this.resolve(id);
      }
    );
    entry.refsChecked = true;
  }

  /**
   * Check whether a schema with `schemaId` is already registered and handle
   * the identity / conflict rules.
   *
   * Returns `true` when the schema is already registered with an identical hash
   * (caller should return early). Throws `SchemaError('SCHEMA_DUPLICATE_ID')` when
   * a schema with the same `$id` but different content is already registered.
   */
  private assertSchemaNotDuplicate(
    schemaId: string,
    canonicalSchema: Record<string, unknown>,
    hash: string
  ): boolean {
    if (!this.store.has(schemaId)) {
      return false;
    }

    const existing = this.store.get(schemaId);

    if (existing === undefined) {
      return true;
    }

    if (existing.hash !== hash) {
      throw new SchemaError(
        `Schema "${schemaId}" is already registered with different content. Unregister first or use the same schema object.`,
        {
          'code': SchemaErrorCode.DUPLICATE_ID,
          schemaId
        }
      );
    }

    const hasNewDecoder = Transform.getDecoder(canonicalSchema) !== undefined;
    const lacksExistingDecoder = Transform.getDecoder(existing.schema) === undefined;

    if (existing.schema !== canonicalSchema && hasNewDecoder && lacksExistingDecoder) {
      existing.schema = canonicalSchema;
      existing.hasTransform = true;
    }
    this.logger.trace(logScope('SchemaRegistry', 'assertSchemaNotDuplicate', `Schema already registered (identical): ${schemaId}`));

    return true;
  }

  /**
   * Validate the graph structure for inline shape warnings.
   * Throws `SchemaError('SCHEMA_STRUCTURE_INVALID')` in strict mode; logs a warning otherwise.
   */
  private assertStructureValid(graph: SchemaGraphInterface, schemaId: string): void {
    if (!this.enableInlineWarnings) {
      return;
    }

    const warnings = graph.validateStructure();

    if (warnings.length === 0) {
      return;
    }

    const message = `Schema "${schemaId}" contains inline shapes: ${warnings.map((warning: StructureWarningType): string => {
      return warning.message;
    }).join('; ')}`;

    if (this.enableStrictGraph) {
      throw new SchemaError(message, {
        'code': SchemaErrorCode.STRUCTURE_INVALID,
        schemaId
      });
    }
    this.logger.warn(logScope('SchemaRegistry', 'assertStructureValid', message));
  }

  /**
   * Build the merged prefix map from standard prefixes, vocabulary plugins, and user overrides.
   * Standard prefixes are the base; vocabulary plugins extend them; explicit `prefixes` option wins last.
   */
  private buildMergedPrefixes(
    vocabularies: readonly VocabularyPluginInterface[],
    extraPrefixes: Record<string, string> | undefined
  ): Record<string, string> {
    const merged: Record<string, string> = { ...STANDARD_PREFIXES };

    for (const plugin of vocabularies) {
      Object.assign(merged, plugin.prefixes);
    }

    if (extraPrefixes !== undefined) {
      Object.assign(merged, extraPrefixes);
    }

    return merged;
  }

  /**
   * Expand the raw `$id` to its canonical absolute IRI (CURIE → absolute).
   * Returns both the canonical schema (with the expanded `$id`) and the expanded schemaId.
   * Throws `SchemaError('SCHEMA_DIALECT_UNSUPPORTED')` in strict-types mode when the declared
   * `$schema` dialect does not match the required draft.
   */
  private canonicalizeSchema(
    schema: Record<string, unknown>,
    rawId: string
  ): { 'canonicalSchema': Record<string, unknown>;
    'schemaId': string } {
    // CURIEs are authoring shorthand; the canonical graph is keyed by absolute
    // IRIs. Expand the $id once at the registration boundary so the store key,
    // the stored schema's $id, and every CURIE-expanding read path
    // (get/has/instantiate/$ref via lookupGraph) all agree on one canonical key.
    const schemaId = this.resolve(rawId);
    const canonicalSchema = schemaId === rawId
      ? schema
      : {
        ...schema,
        '$id': schemaId
      };

    if (this.enableStrictTypes && typeof canonicalSchema.$schema === 'string' && !canonicalSchema.$schema.startsWith(CURRENT_DIALECT_PREFIX)) {
      throw new SchemaError(
        `Strict mode requires draft ${DRAFT_NAME} but schema "${schemaId}" declares "${canonicalSchema.$schema}"`,
        {
          'code': SchemaErrorCode.DIALECT_UNSUPPORTED,
          schemaId
        }
      );
    }

    return {
      canonicalSchema,
      schemaId
    };
  }

  public cast(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown, options?: { 'clone'?: boolean }): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError(`Schema not registered: ${schemaId}. Register it first.`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
    }

    const input = options?.clone === false ? data : structuredClone(data);
    const result = compiled.validate(input, CAST_OPTIONS);

    if (!result.valid) {
      const diagnostic = compiled.validate(structuredClone(data), {
        ...CAST_OPTIONS,
        'collectErrors': true
      });

      throw new CoercionError(new ValidationErrors(diagnostic.errors), { 'code': CoercionErrorCode.COERCION_FAILED });
    }

    return result.value;
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

    const disjointTargets = this.resolveDisjointTargets(entry.schema.disjointWith);

    if (disjointTargets.length === 0) {
      return [];
    }

    const errors: ValidationErrorType[] = [];

    for (const targetId of disjointTargets) {
      const disjointError = this.checkSingleDisjointTarget(schemaId, targetId, data);

      if (disjointError !== null) {
        errors.push(disjointError);
      }
    }

    return errors;
  }

  /**
   * Check whether `data` also satisfies a single disjoint target schema.
   * Returns a `ValidationErrorType` if the disjointness constraint is violated
   * (or if the target is not registered), or `null` when the check passes.
   */
  private checkSingleDisjointTarget(schemaId: string, targetId: string, data: unknown): null | ValidationErrorType {
    const resolved = this.resolve(targetId);
    const targetCompiled = this.compiled(resolved);

    if (targetCompiled === undefined) {
      // Disjoint target not registered — surface as a structural violation
      // rather than silently passing; the annotation references an unknown
      // class and the contract can't be checked.
      return {
        'keyword': 'disjointWith',
        'message': `disjointWith target '${targetId}' is not registered; cannot enforce disjointness`,
        'params': {
          'disjointTarget': targetId,
          'schemaId': schemaId
        },
        'path': ''
      };
    }

    const targetResult = targetCompiled.validate(data, COLLECT_ERRORS_OPTIONS);

    if (targetResult.errors.length === 0) {
      return {
        'keyword': 'disjointWith',
        'message': `value satisfies '${schemaId}' and '${targetId}', but they are declared disjoint`,
        'params': {
          'disjointTarget': targetId,
          'schemaId': schemaId
        },
        'path': ''
      };
    }

    return null;
  }

  public clean(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError(`Schema not registered: ${schemaId}. Register it first.`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
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
          `Duplicate $anchor "${schema.$anchor}" in schema "${schemaId}"`,
          {
            'code': SchemaErrorCode.DUPLICATE_ANCHOR,
            schemaId
          }
        );
      }
      seen.add(schema.$anchor);
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      if (seen.has(schema.$dynamicAnchor)) {
        throw new SchemaError(
          `Duplicate $dynamicAnchor "${schema.$dynamicAnchor}" in schema "${schemaId}"`,
          {
            'code': SchemaErrorCode.DUPLICATE_ANCHOR,
            schemaId
          }
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
   * that are not yet registered. Used by the loader walker in JsonTology.resolveAllRefs.
   */
  public collectUnresolvedRefIris(schema: Record<string, unknown>): ReadonlySet<string> {
    // Embedded-$id knowledge comes solely from the canonical graph. The schema
    // walked here is not yet registered (loader-driven resolution), so build a
    // graph over it to enumerate its embedded sub-schema ids.
    const embeddedIds = new Set(new SchemaGraph(schema).embeddedSchemaIds());

    return this.refs.collectUnresolved(
      schema,
      embeddedIds,
      (id: string): boolean => {
        return this.store.has(id);
      },
      (id: string): string => {
        return this.resolve(id);
      }
    );
  }

  private compiled(schemaId: string): CompiledValidatorType | undefined {
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      return undefined;
    }

    return this.compiledFromEntry(entry);
  }

  private compiledFromEntry(entry: SchemaRegistryEntryType): CompiledValidatorType {
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
      throw new SchemaError(`Schema not registered: ${schemaId}. Register it first.`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
    }

    const input = options?.clone === false ? data : structuredClone(data);
    const result = compiled.validate(input, CONVERT_OPTIONS);

    if (!result.valid) {
      const diagnostic = compiled.validate(structuredClone(data), {
        ...CONVERT_OPTIONS,
        'collectErrors': true
      });

      throw new CoercionError(new ValidationErrors(diagnostic.errors), { 'code': CoercionErrorCode.COERCION_FAILED });
    }

    return result.value;
  }

  public create(schemaId: string): unknown {
    const entry = this.store.get(this.resolve(schemaId));

    if (entry === undefined) {
      throw new SchemaError(`No schema registered for: ${schemaId}`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
    }

    this.assertRefsResolvable(entry);

    const materializer = new Materializer(this, { 'logger': this.logger });

    return materializer.createDefault(entry.schema as Record<string, unknown> & { '$id': string });
  }

  /**
   * Run the optional schema transform decoder on a ref-decoded value.
   * Throws `DecodeError` when the decoder throws an unexpected error,
   * or re-throws `TransformError` when the decoder surfaces a known failure.
   */
  private decodeWithTransform(schemaObj: Record<string, unknown>, value: unknown, schemaId: string): unknown {
    const decoder = Transform.getDecoder(schemaObj);

    if (decoder === undefined) {
      return value;
    }

    try {
      return decoder.decode(value);
    } catch (error) {
      if (error instanceof TransformError) {
        throw error;
      }
      const causeError = BaseError.toCause(error);

      throw new DecodeError(
        `transform decoder failed at root: ${causeError.message}`,
        {
          'cause': causeError,
          'code': TransformErrorCode.TRANSFORM_DECODE_FAILED,
          'direction': 'decode',
          'path': '',
          schemaId
        }
      );
    }
  }

  public delete(schemaId: string): boolean {
    return this.store.delete(this.resolve(schemaId));
  }

  public engine(schema: Record<string, unknown>): GraphEngineInterface {
    const schemaId = this.resolve(schema.$id as string);
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      throw new SchemaError(`No validator registered for schema: ${schemaId}`, {
        'code': SchemaErrorCode.VALIDATOR_MISSING,
        schemaId
      });
    }

    if (entry.engine === undefined) {
      // Build the entry graph once so both the lookupSchema closure and the
      // engine share the same graph instance (graphOf is memoised).
      const entryGraph = this.graphOf(entry);

      const engineOptions: GraphEngineOptionsType = {
        'lookupGraph': this.lookupGraphFn,
        'lookupSchema': (lookupSchemaId: string): Record<string, unknown> | undefined => {
          // 1. Cross-registry lookup: other top-level registered schemas.
          //    Resolve CURIE refs against the canonical store key first.
          const resolvedId = this.resolve(lookupSchemaId);
          const storeSchema = this.store.get(resolvedId)?.schema;

          if (storeSchema !== undefined) {
            return storeSchema;
          }

          // 2. Embedded $id lookup via the canonical graph index.
          //    GraphEngine.resolveRefGraph resolves embedded $ids through the
          //    root graph's embeddedNode() at runtime, but SchemaCompiler also
          //    calls lookupSchema at compile time to build compiled validators
          //    for $ref targets. Both callers therefore get the schema through
          //    the same graph-owned index — one source, two access points.
          const embeddedNode = entryGraph.embeddedNode(lookupSchemaId)
            ?? entryGraph.embeddedNode(resolvedId);

          if (embeddedNode !== undefined && isRecord(embeddedNode.schema)) {
            return embeddedNode.schema;
          }

          return undefined;
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

  public graphEntry(schemaId: string): undefined | { readonly 'graph': SchemaGraphInterface;
    readonly 'schema': Record<string, unknown> } {
    const entry = this.store.get(this.resolve(schemaId));

    if (entry === undefined) {
      return undefined;
    }

    return {
      'graph': this.graphOf(entry),
      'schema': entry.schema
    };
  }

  private graphOf(entry: SchemaRegistryEntryType): SchemaGraphInterface {
    entry.graph ??= new SchemaGraph(entry.schema, {
      'logger': this.logger,
      'vocabularies': this.vocabularies
    });

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
    const schemaId = this.resolve(typeof schema === 'string' ? schema : schema.$id);
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      throw new SchemaError(`Schema not registered: ${schemaId}. Register it first.`, { 'code': SchemaErrorCode.NOT_REGISTERED });
    }

    if (!entry.hasComputedFields && this.computedStore.has(schemaId)) {
      entry.hasComputedFields = true;
    }

    const computedMap = entry.hasComputedFields ? this.computedStore.getMap(schemaId) : {};
    const computedNames = Object.keys(computedMap);

    this.validateComputedInput(computedNames, data);

    const compiled = this.compiledFromEntry(entry);
    const resolvedOptions = this.resolveInstantiateOptions(callOptions?.enableDefaults);
    const input = callOptions?.clone === false ? data : structuredClone(data);
    const schemaObj = typeof schema === 'string' ? entry.schema : schema;

    // Normalize first: decode the raw wire payload into the schema's canonical
    // form — the root transform reshapes the whole payload, then nested $ref
    // decoders run over the canonical structure. Validation + strip then run on
    // the decoded result, because the schema describes the transform's OUTPUT.
    const rootDecoded = this.decodeWithTransform(schemaObj, input, schemaId);
    const decoded = RefDecoder.run(this.graphOf(entry), rootDecoded, this.refDecoderRegistry, this.logger);

    const result = compiled.validate(decoded, resolvedOptions);

    if (!result.valid) {
      throw new InstantiationError(new ValidationErrors(result.errors), { 'code': InstantiationErrorCode.INSTANTIATION_FAILED });
    }

    this.assertInvariantsPass(schemaId, result);

    const coerced = result.value;

    this.applyComputedFields(computedNames, computedMap, coerced);

    return this.applyFrozenSeal(schemaObj, coerced);
  }

  public is(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): boolean {
    const schemaId = this.resolve(typeof schema === 'string' ? schema : schema.$id);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError(`Schema not registered: ${schemaId}. Register it first.`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
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
    return Array.from(this.store.values(), (entry: SchemaRegistryEntryType): Record<string, unknown> => {
      return entry.schema;
    });
  }

  public listGraphs(): readonly SchemaGraphInterface[] {
    return Array.from(this.store.values(), (entry: SchemaRegistryEntryType): SchemaGraphInterface => {
      return this.graphOf(entry);
    });
  }

  public registerAnonymous(schema: Record<string, unknown>): string {
    if (typeof schema.$id === 'string' && schema.$id !== '') {
      this.setOne(schema);

      // Return the canonical key the schema is actually stored under, so the
      // caller can use the returned id for any subsequent lookup.
      return this.resolve(schema.$id);
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
    const rawId = schema.$id as string | undefined;

    if (rawId === undefined || rawId === '') {
      throw new SchemaError('Schema must have a $id property', { 'code': SchemaErrorCode.MISSING_ID });
    }

    // Reject schemas with unsupported dialects or required vocabularies eagerly at
    // registration time — the compiled path never reaches execution for such schemas.
    GraphEngineSupport.buildRootDialectPlan(schema);

    const {
      canonicalSchema, schemaId
    } = this.canonicalizeSchema(schema, rawId);

    this.assertNoPropertyCharacteristicConflicts(canonicalSchema, schemaId);

    const anchors = new Set<string>();

    this.collectAnchors(canonicalSchema, anchors, schemaId);

    const hash = this.hashSchema(canonicalSchema);
    const isAlreadyRegistered = this.assertSchemaNotDuplicate(schemaId, canonicalSchema, hash);

    if (isAlreadyRegistered) {
      return;
    }

    this.warnOnHashConflict(hash, schemaId);

    if (!Object.isFrozen(canonicalSchema)) {
      Frozen.deepFreeze(canonicalSchema);
    }

    const entry: SchemaRegistryEntryType = {
      'hasComputedFields': false,
      hash,
      'hasTransform': Transform.getDecoder(canonicalSchema) !== undefined,
      'schema': canonicalSchema
    };
    const graph = this.graphOf(entry);

    this.assertStructureValid(graph, schemaId);
    this.store.add(schemaId, entry);
    this.computedStore.validateAgainstGraph(graph);
    this.assertNoDuplicateShapes(schemaId);
    this.logger.trace(logScope('SchemaRegistry', 'registerSingle', `Schema registered: ${schemaId}`));
  }

  public removeInvariant(schemaId: string, name: string): void {
    this.invariants.remove(this.resolve(schemaId), name);
  }

  private resolve(schemaId: string): string {
    if (this.curie === undefined) {
      return schemaId;
    }

    return this.curie.expand(schemaId);
  }

  /**
   * Resolve the `disjointWith` annotation value to a flat array of target IRI strings.
   */
  private resolveDisjointTargets(raw: unknown): string[] {
    if (typeof raw === 'string') {
      return [raw];
    }

    if (Array.isArray(raw)) {
      return (raw as unknown[]).filter((item): item is string => {
        return isStringItem(item);
      });
    }

    return [];
  }

  /**
   * Resolve the instantiate call options into execution options.
   * When `enableDefaults` is undefined, returns the pre-built `instantiateOptions` directly.
   */
  private resolveInstantiateOptions(enableDefaults: boolean | undefined): Readonly<Record<string, boolean>> {
    if (enableDefaults === undefined) {
      return this.instantiateOptions;
    }

    return Resolver.merge(this.instantiateOptions, { 'applyDefaults': enableDefaults });
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
    if (Array.isArray(first)) {
      for (const entry of first as readonly SetEntryType[]) {
        if (Array.isArray(entry)) {
          const [
            schema,
            iri
          ] = entry as unknown as readonly [Record<string, unknown>, string];

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
      throw new SchemaError('Schema must have a $id property', { 'code': SchemaErrorCode.MISSING_ID });
    }

    // Compare canonical forms so a CURIE key and an absolute-IRI $id (or vice
    // versa) that denote the same schema are accepted as a match.
    if (this.resolve(schemaIdOnObject) !== this.resolve(iri)) {
      throw new SchemaError(
        `set() key "${iri}" does not match schema.$id "${schemaIdOnObject}"`,
        {
          'code': SchemaErrorCode.INVALID_INPUT,
          'schemaId': iri
        }
      );
    }
    this.delete(iri);
    this.registerSingle(schema);
  }
  private setOne(schema: Record<string, unknown>): void {
    // Defensive guard for untyped (JS) callers that bypass the typed `set()`
    // surface. `isRecord` is a type predicate, so no suppression is needed and
    // the parameter keeps its honest `Record<string, unknown>` type.
    if (!isRecord(schema)) {
      throw new SchemaError(
        `set() requires a plain object schema, received ${Array.isArray(schema) ? 'array' : typeof schema}`,
        { 'code': SchemaErrorCode.INVALID_INPUT }
      );
    }

    const iri = schema.$id;

    if (typeof iri !== 'string' || iri === '') {
      throw new SchemaError('Schema must have a $id property', { 'code': SchemaErrorCode.MISSING_ID });
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
    const schemaId = this.resolve(typeof schema === 'string' ? schema : schema.$id);
    const entry = this.store.get(schemaId);

    if (!entry) {
      throw new SchemaError(`Schema not registered: ${schemaId}. Register it first.`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
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
    const schemaId = this.resolve(typeof schema === 'string' ? schema : schema.$id);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError(`No validator registered for schema: ${schemaId}`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
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

  /**
   * Guard computed field names against user-supplied input data.
   * Throws `InstantiationError` if any computed property name is present in `data`.
   */
  private validateComputedInput(computedNames: string[], data: unknown): void {
    if (computedNames.length === 0 || !isRecord(data)) {
      return;
    }

    const forbidden = computedNames.filter((name: string): boolean => {
      return name in (data);
    });

    if (forbidden.length > 0) {
      const errors = forbidden.map((name: string): ValidationErrorType => {
        return {
          'keyword': 'COMPUTED_INPUT_FORBIDDEN',
          'message': `"${name}" is a computed field and must not be supplied in input`,
          'params': {},
          'path': `/${name}`
        };
      });

      throw new InstantiationError(new ValidationErrors(errors), { 'code': InstantiationErrorCode.INSTANTIATION_FAILED });
    }
  }

  public validator(schemaId: string): CompiledValidatorType {
    const compiled = this.compiled(this.resolve(schemaId));

    if (compiled === undefined) {
      throw new SchemaError(`No schema registered for: ${schemaId}`, {
        'code': SchemaErrorCode.NOT_REGISTERED,
        schemaId
      });
    }

    return compiled;
  }

  public *values(): IterableIterator<Record<string, unknown>> {
    for (const entry of this.store.values()) {
      yield entry.schema;
    }
  }

  /**
   * Warn when a schema's content hash is already registered under a different IRI.
   * This is a non-strict duplicate detection that logs rather than throws.
   */
  private warnOnHashConflict(hash: string, schemaId: string): void {
    const existingId = this.store.getByHash(hash);

    if (existingId !== undefined && existingId !== schemaId) {
      this.logger.warn(logScope('SchemaRegistry', 'warnOnHashConflict', `Schema content already registered under different ID: existing="${existingId}" new="${schemaId}"`));
    }
  }
}
