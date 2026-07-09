import type { IriMinterInterface } from '../interfaces/IriMinterInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';

/** Arguments for resolveEdgeTargetIri. */
export type ResolveEdgeTargetIriArgsType = {
  'depth': number;
  'edge': AnnotatedEdgeStructureType;
  'minter': IriMinterInterface;
  'path': string;
  'target': unknown;
};
