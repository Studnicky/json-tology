/**
 * Schema Registry
 *
 * Single in-repo graph engine shared by validation, parsing, materialization, and
 * pointer-based sub-schema execution.
 */

import type { CompiledValidatorInterface } from '../../interfaces/Compiler.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { KeywordDefinitionInterface } from '../../interfaces/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type { InvariantInterface } from '../../interfaces/Invariant.js';
import type { LoggerInterface } from '../../interfaces/Logger.js';
import type { RegistryOptionsInterface } from '../../interfaces/Registry.js';
import type { SchemaCompilerInterface } from '../../interfaces/SchemaCompilerImpl.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaRegistryEntryInterface } from '../../interfaces/SchemaRegistryEntry.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';

import { InstantiationError } from '../../errors/InstantiationError.js';
import { ComputedStore } from './ComputedStore.js';
import { Curie } from '../rdf/Curie.js';
import {
  deepFreeze, isRecord
} from '../data/DataTypes.js';
import { Frozen } from '../data/Frozen.js';
import { GraphEngine } from '../graph/GraphEngine.js';
import { Hash } from '../hash/Hash.js';
import { InvariantStore } from './InvariantStore.js';
import { Materializer } from '../materialization/Materializer.js';
import { SchemaCompiler } from '../validation/SchemaCompiler.js';
import { SchemaError } from '../../errors/SchemaError.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { StructuralHash } from '../data/StructuralHash.js';
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

export interface DuplicateReportEntryType {
  readonly 'equivalentTo': string;
  readonly 'pointer': string;
  readonly 'schemaId': string;
  readonly 'shape': Record<string, unknown>;
}

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
  private readonly maxDepth: number | undefined;
  private readonly schemaHashes = new Map<string, string>();
  private readonly schemas = new Map<string, SchemaRegistryEntryInterface>();
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
    this.maxDepth = options?.maxDepth;
    this.enableStrictTypes = options?.enableStrictTypes ?? false;
    this.enableStrictGraph = options?.enableStrictGraph ?? false;
    this.enableInlineWarnings = this.enableStrictGraph || (options?.enableInlineWarnings ?? false);
    this.enableDuplicateDetection = this.enableStrictGraph || (options?.enableDuplicateDetection ?? false);
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
    this.formatRegistry = options?.formatRegistry;
    this.keywords = options?.keywords;
    this.invariants = new InvariantStore(options?.invariants);
    this.compiler = new SchemaCompiler({
      'logger': this.logger,
      'lookupCompiled': (schemaId) => {
        return this.schemas.has(schemaId)
          ? this.compiled(schemaId)
          : undefined;
      }
    });
  }

  public addInvariant(schemaId: string, invariant: InvariantInterface): void {
    this.invariants.add(schemaId, invariant);
  }

  public cast(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    return compiled.validate(structuredClone(data), CAST_OPTIONS).value;
  }

  public clean(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    return compiled.validate(structuredClone(data), CLEAN_OPTIONS).value;
  }

  private collectAnchors(schema: Record<string, unknown>, seen: Set<string>, schemaId: string): void {
    if (typeof schema.$anchor === 'string') {
      if (seen.has(schema.$anchor)) {
        throw new SchemaError(
          'SCHEMA_DUPLICATE_ANCHOR',
          `Duplicate $anchor "${schema.$anchor}" in schema "${schemaId}"`,
          schemaId
        );
      }
      seen.add(schema.$anchor);
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      if (seen.has(schema.$dynamicAnchor)) {
        throw new SchemaError(
          'SCHEMA_DUPLICATE_ANCHOR',
          `Duplicate $dynamicAnchor "${schema.$dynamicAnchor}" in schema "${schemaId}"`,
          schemaId
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

  private compiled(schemaId: string): CompiledValidatorInterface | undefined {
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      return undefined;
    }

    return this.compiledFromEntry(entry);
  }

  private compiledFromEntry(entry: SchemaRegistryEntryInterface): CompiledValidatorInterface {
    if (entry.compiled === undefined) {
      const engine = this.engine(entry.schema);

      entry.compiled = this.compiler.compile(engine);
    }

    return entry.compiled;
  }

  public convert(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    return compiled.validate(structuredClone(data), CONVERT_OPTIONS).value;
  }

  public create(schemaId: string): unknown {
    const entry = this.schemas.get(this.resolve(schemaId));

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No schema registered for: ${schemaId}`, schemaId);
    }

    const materializer = new Materializer(this);

    return materializer.createDefault(entry.schema as Record<string, unknown> & { '$id': string });
  }

  public engine(schema: Record<string, unknown>): GraphEngineInterface {
    const schemaId = schema.$id as string;
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_VALIDATOR_MISSING', `No validator registered for schema: ${schemaId}`, schemaId);
    }
    const engineOptions: Record<string, unknown> = {
      ...(this.formatRegistry ? { 'formatRegistry': this.formatRegistry } : {}),
      ...(this.keywords && this.keywords.length > 0 ? { 'keywords': this.keywords } : {}),
      'lookupSchema': (lookupSchemaId: string) => {
        return this.schemas.get(lookupSchemaId)?.schema;
      }
    };

    if (this.maxDepth !== undefined) {
      engineOptions.maxDepth = this.maxDepth;
    }
    entry.engine ??= new GraphEngine(entry.schema, engineOptions);

    return entry.engine;
  }


  public findDuplicates(): readonly DuplicateReportEntryType[] {
    const topLevelHashes = new Map<string, string>();

    for (const [
      schemaId,
      entry
    ] of this.schemas) {
      const topHash = StructuralHash.of(entry.schema);

      topLevelHashes.set(topHash, schemaId);
    }

    const results: DuplicateReportEntryType[] = [];

    for (const [
      schemaId,
      entry
    ] of this.schemas) {
      this.walkForDuplicates(schemaId, entry.schema, '', topLevelHashes, results);
    }

    return results;
  }

  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.schemas.get(this.resolve(schemaId))?.schema;
  }

  public graph(schemaId: string): SchemaGraphInterface | undefined {
    const entry = this.schemas.get(this.resolve(schemaId));

    if (entry === undefined) {
      return undefined;
    }

    return this.graphOf(entry);
  }

  private graphOf(entry: SchemaRegistryEntryInterface): SchemaGraphInterface {
    entry.graph ??= new SchemaGraph(entry.schema, { 'vocabularies': this.vocabularies });

    return entry.graph;
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
    callOptions?: { 'enableDefaults'?: boolean }
  ): unknown {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`);
    }

    const computedMap = this.computedStore.getMap(schemaId);
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
      : {
        ...this.instantiateOptions,
        'applyDefaults': callOptions.enableDefaults
      };
    const result = compiled.validate(structuredClone(data), resolvedOptions);

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
    const decoder = Transform.getDecoder(schemaObj);
    const decoded = decoder === undefined ? coerced : decoder.decode(coerced);
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
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    if (!compiled.check(data)) {
      return false;
    }

    return this.invariants.runAll(schemaId, data).length === 0;
  }

  public list(): ReadonlyArray<Record<string, unknown>> {
    return [...this.schemas.values()].map((entry) => {
      return entry.schema;
    });
  }

  public listGraphs(): readonly SchemaGraphInterface[] {
    return [...this.schemas.values()].map((entry) => {
      return this.graphOf(entry);
    });
  }

  public register(schemas: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>): void {
    if ((schemas as unknown) === null || (schemas as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'register() requires a non-null schema object or array');
    }

    const list: ReadonlyArray<Record<string, unknown>> = Array.isArray(schemas) ? schemas : [schemas];

    for (const element of list) {
      if ((element as unknown) === null || typeof element !== 'object' || Array.isArray(element)) {
        throw new SchemaError(
          'SCHEMA_INVALID_INPUT',
          `register() requires plain objects, received ${(element as unknown) === null ? 'null' : typeof element}`
        );
      }
      this.registerSingle(element);
    }
  }

  public registerAnonymous(schema: Record<string, unknown>): string {
    if (typeof schema.$id === 'string' && schema.$id !== '') {
      this.register(schema);

      return schema.$id;
    }

    const hash = this.hashSchema(schema);
    const syntheticId = `urn:json-tology:hash:${hash}`;
    const withId = {
      ...schema,
      '$id': syntheticId
    };

    this.register(withId);

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
        schemaId
      );
    }

    if (typeof schema === 'object') {
      const anchors = new Set<string>();

      this.collectAnchors(schema, anchors, schemaId);
    }

    const hash = this.hashSchema(schema);

    if (this.schemas.has(schemaId)) {
      const existing = this.schemas.get(schemaId);

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
        schemaId
      );
    }

    const existingId = this.schemaHashes.get(hash);

    if (existingId !== undefined && existingId !== schemaId) {
      this.logger.warn(`Schema content already registered under different ID: existing="${existingId}" new="${schemaId}"`);
    }

    if (!Object.isFrozen(schema)) {
      deepFreeze(schema);
    }

    const entry: SchemaRegistryEntryInterface = {
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
          throw new SchemaError('SCHEMA_STRUCTURE_INVALID', message, schemaId);
        }
        this.logger.warn(message);
      }
    }

    this.schemas.set(schemaId, entry);
    this.schemaHashes.set(hash, schemaId);
    this.computedStore.validateAgainstGraph(graph);

    if (this.enableDuplicateDetection) {
      const duplicates = this.findDuplicates();

      if (duplicates.length > 0) {
        const dupMsg = duplicates.map((dup) => {
          return `"${dup.schemaId}#${dup.pointer}" duplicates "${dup.equivalentTo}"`;
        }).join('; ');
        const message = `Duplicate schema shapes detected: ${dupMsg}`;

        if (this.enableStrictGraph) {
          throw new SchemaError('SCHEMA_DUPLICATE_SHAPE', message, schemaId);
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

  public subschemaAt(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    pointer: string
  ): Record<string, unknown> & { '$id': string } {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const entry = this.schemas.get(schemaId);

    if (!entry) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    const graph = new SchemaGraph(entry.schema);
    const node = graph.resolvePointer(pointer);
    const subSchema = node.schema;
    const synthesizedId = `${schemaId}#${pointer}`;
    const subSchemaRecord = typeof subSchema === 'boolean' ? {} : subSchema;
    const result: Record<string, unknown> & { '$id': string } = {
      ...subSchemaRecord,
      '$id': synthesizedId
    };

    // Register so the result can be passed to validate/instantiate/is directly
    if (!this.schemas.has(synthesizedId)) {
      this.register(result);
    }

    return result;
  }

  public validate(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): ValidationErrors {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No validator registered for schema: ${schemaId}`, schemaId);
    }

    const result = compiled.validate(data, COLLECT_ERRORS_OPTIONS);

    if (result.errors.length > 0) {
      return new ValidationErrors(result.errors);
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
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No schema registered for: ${schemaId}`, schemaId);
    }

    return compiled;
  }

  private walkForDuplicates(
    schemaId: string,
    schema: Record<string, unknown>,
    pointer: string,
    topLevelHashes: Map<string, string>,
    results: DuplicateReportEntryType[]
  ): void {
    if (isRecord(schema.properties)) {
      for (const [
        propName,
        propSchema
      ] of Object.entries(schema.properties)) {
        if (!isRecord(propSchema)) {
          continue;
        }
        const propPointer = `${pointer}/properties/${propName}`;

        if (typeof propSchema.$id !== 'string' && !('$ref' in propSchema)) {
          const leafHash = StructuralHash.of(propSchema);
          const matchId = topLevelHashes.get(leafHash);

          if (matchId !== undefined && matchId !== schemaId) {
            results.push({
              'equivalentTo': matchId,
              'pointer': propPointer,
              'schemaId': schemaId,
              'shape': propSchema
            });
          }
        }

        this.walkForDuplicates(schemaId, propSchema, propPointer, topLevelHashes, results);
      }
    }

    for (const compositionKey of [
      'allOf',
      'anyOf',
      'oneOf'
    ]) {
      const compositionArr = schema[compositionKey];

      if (Array.isArray(compositionArr)) {
        for (const [
          idx,
          subSchema
        ] of compositionArr.entries()) {
          if (!isRecord(subSchema)) {
            continue;
          }
          this.walkForDuplicates(schemaId, subSchema, `${pointer}/${compositionKey}/${idx}`, topLevelHashes, results);
        }
      }
    }

    if (isRecord(schema.$defs)) {
      for (const [
        defName,
        defSchema
      ] of Object.entries(schema.$defs)) {
        if (!isRecord(defSchema)) {
          continue;
        }
        this.walkForDuplicates(schemaId, defSchema, `${pointer}/$defs/${defName}`, topLevelHashes, results);
      }
    }
  }
}
