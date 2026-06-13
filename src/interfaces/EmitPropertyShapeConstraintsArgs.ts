import type { CurieInterface } from './Curie.js';
import type { QuadInterface } from './Quad.js';
import type { RelationIndexInterface } from './RelationIndex.js';

/** Arguments for emitPropertyShapeTypeConstraints / emitPropertyShapeValueConstraints. */
export interface EmitPropertyShapeConstraintsArgsInterface {
  readonly 'bnodeId': string;
  readonly 'entry': RelationIndexInterface;
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'quads': QuadInterface[];
}
