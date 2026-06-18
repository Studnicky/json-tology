import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { RelationIndexType } from './RelationIndexType.js';

/** Arguments for emitPropertyShapeTypeConstraints / emitPropertyShapeValueConstraints. */
export type EmitPropertyShapeConstraintsArgsType = {
  readonly 'bnodeId': string;
  readonly 'entry': RelationIndexType;
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'quads': QuadInterface[];
};
