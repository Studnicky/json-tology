import type { CurieInterface } from './CurieInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { RelationIndexInterface } from './RelationIndexInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for emitPropertyShapeTypeConstraints / emitPropertyShapeValueConstraints. */
export interface EmitPropertyShapeConstraintsArgumentListInterface {
  'bnodeId': StringValueEntity.Type;
  'entry': RelationIndexInterface;
  'options': { 'curie': CurieInterface | undefined };
  'quads': QuadInterface[];
}
