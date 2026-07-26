import type { PropertyKeyEntity } from '../entities/PropertyKeyEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Execution context passed to custom keyword validators during schema traversal.
 *
 * @remarks
 * Provides the validator function with the structural location of the current
 * value being validated: the root input, the direct parent container, the key
 * used to reach this value from the parent, and the JSON Pointer path
 * accumulated so far. These are read-only within a validation pass.
 *
 * Authored as an interface rather than a schema-derived entity: `parentData`
 * and `rootData` are `unknown` — arbitrary JS values under validation, not
 * JSON-representable schema data.
 *
 * @category GraphEngine
 * @since 0.1.0
 * @see {@link KeywordDefinitionInterface}
 * @group GraphEngine
 */
export interface KeywordContextInterface {
  'parentData': unknown;
  'parentKey': PropertyKeyEntity.Type;
  'path': StringValueEntity.Type;
  'rootData': unknown;
}
