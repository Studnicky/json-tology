import type { CurieInterface } from './Curie.js';
import type { QuadInterface } from './Quad.js';
import type { RelationIndexInterface } from './RelationIndex.js';

/** Arguments for emitContainsQualifiedCardinality. */
export interface EmitContainsQualifiedCardinalityArgsInterface {
  readonly 'curie': CurieInterface | undefined;
  readonly 'entry': RelationIndexInterface;
  readonly 'psBnode': string;
  readonly 'quads': QuadInterface[];
}
