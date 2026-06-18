import type { SchemaGraphRelationType } from './SchemaGraph.js';

export type RelationIndexType = {
  'all': SchemaGraphRelationType[];
  'byPredicate': Map<string, SchemaGraphRelationType[]>;
  'types': string[];
};
