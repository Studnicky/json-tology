import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { ValidationErrorType } from '../types/Validation.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';

/**
 * Execution context passed to custom keyword validators during schema traversal.
 *
 * @remarks
 * Provides the validator function with the structural location of the current
 * value being validated: the root input, the direct parent container, the key
 * used to reach this value from the parent, and the JSON Pointer path
 * accumulated so far. These are read-only within a validation pass.
 *
 * @example
 * ```ts
 * const keyword: KeywordDefinitionInterface = {
 *   keyword: 'x-positive',
 *   validate: (_schema, data, ctx) => {
 *     return typeof data === 'number' && data > 0
 *       ? true
 *       : [{ message: 'must be positive', path: ctx.path }];
 *   }
 * };
 * ```
 *
 * @category GraphEngine
 * @since 0.1.0
 * @see {@link KeywordDefinitionInterface}
 * @group GraphEngine
 */
export interface KeywordContextInterface {
  'parentData': unknown;
  'parentKey': number | string;
  'path': string;
  'rootData': unknown;
}

/**
 * Registration descriptor for a custom JSON Schema keyword.
 *
 * @remarks
 * Custom keywords extend the validation engine with application-specific
 * constraints beyond the standard JSON Schema vocabulary. A descriptor names
 * the keyword, optionally restricts the data types it applies to, and supplies
 * the validator function invoked during schema execution.
 *
 * The `validate` function receives the keyword's schema value, the data value
 * under test, and a {@link KeywordContextInterface} describing the evaluation
 * location. It returns `true` for a passing check or a non-empty array of
 * {@link ValidationErrorType} objects for failures.
 *
 * @example
 * ```ts
 * const positiveKeyword: KeywordDefinitionInterface = {
 *   keyword: 'x-positive',
 *   type: 'number',
 *   validate: (_schema, data) =>
 *     typeof data === 'number' && data > 0
 *       ? true
 *       : [{ message: 'must be positive', path: '' }]
 * };
 * ```
 *
 * @category GraphEngine
 * @since 0.1.0
 * @see {@link KeywordContextInterface}
 * @group GraphEngine
 */
export interface KeywordDefinitionInterface {
  'keyword': string;
  'type'?: string | string[];
  'validate': (schema: unknown, data: unknown, context: KeywordContextInterface) => boolean | ValidationErrorType[];
}

/**
 * Runtime options controlling how a `GraphEngine` validates and transforms data.
 *
 * @remarks
 * All fields are optional. Unset options fall back to the engine's compiled
 * defaults, which are derived from the registered schema. Options passed to
 * `GraphEngine.execute` take precedence over the instance-level options
 * supplied at construction time.
 *
 * Notable options:
 * - `castTypes` — coerce string/number inputs to the declared schema type.
 * - `applyDefaults` / `synthesizeDefaults` — populate missing fields from schema defaults.
 * - `collectErrors` — accumulate all validation errors rather than stopping at the first.
 * - `allowAdditionalProperties` / `removeAdditionalProperties` — relax or strip
 *   properties not declared in the schema.
 * - `maxSchemaDepth` — guard against deeply nested or recursive schemas.
 *
 * @example
 * ```ts
 * const opts: GraphEngineOptionsInterface = {
 *   castTypes: true,
 *   applyDefaults: true,
 *   collectErrors: true,
 *   maxSchemaDepth: 20,
 * };
 * ```
 *
 * @category GraphEngine
 * @since 0.1.0
 * @see {@link GraphExecutionResultInterface}
 * @group GraphEngine
 */
export interface GraphEngineOptionsInterface {
  'allowAdditionalProperties'?: boolean;
  'applyDefaults'?: boolean;
  'castTypes'?: boolean;
  'collectErrors'?: boolean;
  'enforceSchemaProperties'?: boolean;
  'formatRegistry'?: FormatRegistryInterface;
  'keywords'?: KeywordDefinitionInterface[];
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers'?: boolean;
  /**
   * Maximum recursion depth for schema traversal during validation.
   * Limits how deeply nested `$ref`, `allOf`, `oneOf`, and other composition
   * keywords can recurse. When exceeded, a `GraphError('RECURSION_LIMIT')` is thrown.
   *
   * Defaults to no limit (`Infinity`). Set a finite value to protect against
   * stack overflow from deeply nested or recursive schemas on deep data.
   */
  'maxSchemaDepth'?: number;
  'removeAdditionalProperties'?: boolean;
  'synthesizeDefaults'?: boolean;
}

/**
 * Full result of a `GraphEngine.execute` call, including the transformed value,
 * validation errors, evaluated tracking sets, and graph access.
 *
 * @remarks
 * The `valid` flag is `true` only when `errors` is empty. `value` holds the
 * (possibly coerced, defaults-applied, additional-properties-stripped) output
 * value. `evaluatedItems` and `evaluatedProperties` track which array indices
 * and object keys were reached by at least one schema branch — required for
 * correct `unevaluatedItems` / `unevaluatedProperties` enforcement.
 *
 * `entryNode` and `graph` expose the graph representation used during this
 * execution pass for post-validation inspection or ABox projection.
 *
 * @example
 * ```ts
 * const result = engine.execute({ id: '1', name: 'Alice' });
 * if (result.valid) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 *
 * @category GraphEngine
 * @since 0.1.0
 * @see {@link GraphEngineOptionsInterface}
 * @group GraphEngine
 */
export interface GraphExecutionResultInterface {
  'entryNode': SchemaGraphNodeInterface;
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number>;
  'evaluatedProperties': Set<string>;
  'graph': SchemaGraphInterface;
  'valid': boolean;
  'value': unknown;
}
