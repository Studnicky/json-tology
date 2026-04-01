import type { SchemaGraphRelationInterface } from './SchemaGraph.js';

export interface RelationIndexInterface {
  'all': SchemaGraphRelationInterface[];
  'byPredicate': Map<string, SchemaGraphRelationInterface[]>;
  'types': string[];
}
