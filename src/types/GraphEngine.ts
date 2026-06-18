import type { FormatRegistryInterface } from '../interfaces/FormatRegistryInterface.js';
import type { LoggerInterface } from '../interfaces/LoggerInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { ValidationErrorType } from '../types/Validation.js';

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
 * const keyword: KeywordDefinitionType = {
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
 * @see {@link KeywordDefinitionType}
 * @group GraphEngine
 */
export type KeywordContextType = {
  'parentData': unknown;
  'parentKey': number | string;
  'path': string;
  'rootData': unknown;
};

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
 * under test, and a {@link KeywordContextType} describing the evaluation
 * location. It returns `true` for a passing check or a non-empty array of
 * {@link ValidationErrorType} objects for failures.
 *
 * @example
 * ```ts
 * const positiveKeyword: KeywordDefinitionType = {
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
 * @see {@link KeywordContextType}
 * @group GraphEngine
 */
export type KeywordDefinitionType = {
  'keyword': string;
  'type'?: string | string[];
  'validate': (schema: unknown, data: unknown, context: KeywordContextType) => boolean | ValidationErrorType[];
};

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
 * const opts: GraphEngineOptionsType = {
 *   castTypes: true,
 *   applyDefaults: true,
 *   collectErrors: true,
 *   maxSchemaDepth: 20,
 * };
 * ```
 *
 * @category GraphEngine
 * @since 0.1.0
 * @group GraphEngine
 */
export type GraphEngineOptionsType = {
  'allowAdditionalProperties'?: boolean;
  'applyDefaults'?: boolean;
  'castTypes'?: boolean;
  'collectErrors'?: boolean;
  'enforceSchemaProperties'?: boolean;
  'formatRegistry'?: FormatRegistryInterface;
  'keywords'?: KeywordDefinitionType[];
  'logger'?: LoggerInterface;
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
};

