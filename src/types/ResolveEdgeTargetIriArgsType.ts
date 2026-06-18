import type { IriMinterInterface } from '../interfaces/IriMinterInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';

/** Arguments for resolveEdgeTargetIri. */
export type ResolveEdgeTargetIriArgsType = {
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructureType;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'target': unknown;
};
