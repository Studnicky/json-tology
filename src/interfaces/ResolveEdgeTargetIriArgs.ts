import type { IriMinterInterface } from './Projection.js';
import type { AnnotatedEdgeStructure } from '../types/AnnotatedEdgeStructure.js';

/** Arguments for resolveEdgeTargetIri. */
export interface ResolveEdgeTargetIriArgsInterface {
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'target': unknown;
}
