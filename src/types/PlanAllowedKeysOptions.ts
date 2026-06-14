import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

/** Options for `buildPlanAllowedKeys`. */
export type PlanAllowedKeysOptionsType = {
  readonly 'graph': SchemaGraphInterface;
  readonly 'lookupGraph': ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
  readonly 'propertyEntries': ReadonlyMap<string, SchemaGraphNodeType>;
  readonly 'sem': SchemaGraphSemanticsType;
};
