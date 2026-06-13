import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

/** Options for `buildPlanAllowedKeys`. */
export interface PlanAllowedKeysOptionsInterface {
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeInterface>;
  readonly 'sem': SchemaGraphSemanticsInterface;
}
