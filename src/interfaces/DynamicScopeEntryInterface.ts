import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** One frame of the `$dynamicRef`/`$dynamicAnchor` resolution scope stack. */
export interface DynamicScopeEntryInterface {
  'anchor': StringValueEntity.Type;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}
