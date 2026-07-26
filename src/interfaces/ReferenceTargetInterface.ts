import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

export interface ReferenceTargetInterface {
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}
