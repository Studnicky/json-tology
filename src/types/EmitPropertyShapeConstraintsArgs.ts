import type { CurieInterface } from '../interfaces/Curie.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { RelationIndexType } from './RelationIndex.js';

/** Arguments for emitPropertyShapeTypeConstraints / emitPropertyShapeValueConstraints. */
export type EmitPropertyShapeConstraintsArgsType = {
  readonly 'bnodeId': string;
  readonly 'entry': RelationIndexType;
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'quads': QuadInterface[];
};
