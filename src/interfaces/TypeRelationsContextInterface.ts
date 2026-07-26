import type { RelationsPushContextInterface } from './RelationsPushContextInterface.js';
import type { StringArrayEntity } from '../entities/StringArrayEntity.js';

/**
 * Extended context for union/type relations, which also needs the pre-filtered non-null types.
 *
 * @internal
 */
export interface TypeRelationsContextInterface extends RelationsPushContextInterface {
  'nonNullTypes': StringArrayEntity.Type;
}
