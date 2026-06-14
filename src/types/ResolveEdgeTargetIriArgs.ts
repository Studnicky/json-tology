import type { IriMinterInterface } from '../interfaces/Projection.js';
import type { AnnotatedEdgeStructure } from '../types/AnnotatedEdgeStructure.js';

/** Arguments for resolveEdgeTargetIri. */
export type ResolveEdgeTargetIriArgsType = {
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'target': unknown;
};
