import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { RelationIndexType } from './RelationIndexType.js';

/** Arguments for emitPropertyShapeTypeConstraints / emitPropertyShapeValueConstraints. */
export type EmitPropertyShapeConstraintsArgumentListType = {
  'bnodeId': string;
  'entry': RelationIndexType;
  'options': { 'curie': CurieInterface | undefined };
  'quads': QuadInterface[];
};
