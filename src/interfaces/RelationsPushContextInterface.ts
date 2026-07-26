import type { SchemaGraphRelationInterface } from './SchemaGraphRelationInterface.js';
import type { RelationsContextInterface } from './RelationsContextInterface.js';

/**
 * Extended context that also carries the mutable accumulator.
 *
 * @internal
 */
export interface RelationsPushContextInterface extends RelationsContextInterface {
  'relations': SchemaGraphRelationInterface[];
}
