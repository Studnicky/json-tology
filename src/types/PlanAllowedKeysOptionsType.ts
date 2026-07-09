import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/** Options for `buildPlanAllowedKeys`. */
export type PlanAllowedKeysOptionsType = {
  'graph': SchemaGraphInterface;
  'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
  'sem': SchemaGraphSemanticsType;
};
