import type { SchemaGraphSemanticsInterface } from './SchemaGraphSemanticsInterface.js';
import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/** Options for `buildPlanAllowedKeys`. */
export interface PlanAllowedKeysOptionsInterface {
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'propertyEntries': ReadonlyMap<string, SchemaGraphNodeInterface>;
  'sem': SchemaGraphSemanticsInterface;
}
