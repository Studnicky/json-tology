import type { SchemaGraphRelationInterface } from './SchemaGraphRelationInterface.js';
import type { StringArrayEntity } from '../entities/StringArrayEntity.js';

export interface RelationIndexInterface {
  'all': SchemaGraphRelationInterface[];
  'byPredicate': Map<string, SchemaGraphRelationInterface[]>;
  'types': StringArrayEntity.Type;
}
