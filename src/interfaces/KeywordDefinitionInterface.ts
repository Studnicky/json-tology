import type { ValidationErrorEntity } from '../entities/ValidationErrorEntity.js';
import type { SchemaTypeNameOrArrayEntity } from '../entities/SchemaTypeNameOrArrayEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { KeywordContextInterface } from './KeywordContextInterface.js';

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
 * {@link ValidationErrorEntity.Type} objects for failures.
 *
 * Authored as an interface rather than a schema-derived entity: `validate` is
 * a callable, not JSON-representable data.
 *
 * @example
 * ```ts
 * const positiveKeyword: KeywordDefinitionInterface = {
 *   keyword: 'x-positive',
 *   type: 'number',
 *   validate: (_schema, data) =>
 *     typeof data === 'number' && data > 0
 *       ? true
 *       : [{ keyword: 'x-positive', message: 'must be positive', params: {}, path: '' }]
 * };
 * ```
 *
 * @category GraphEngine
 * @since 0.1.0
 * @see {@link KeywordContextInterface}
 * @group GraphEngine
 */
export interface KeywordDefinitionInterface {
  'keyword': StringValueEntity.Type;
  'type'?: SchemaTypeNameOrArrayEntity.Type;
  'validate': (schema: unknown, data: unknown, context: KeywordContextInterface) => boolean | ValidationErrorEntity.Type[];
}
