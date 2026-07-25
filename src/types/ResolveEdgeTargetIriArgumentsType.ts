import type { IriMinterInterface } from '../interfaces/IriMinterInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type { InferType } from './Schema.js';

export const RESOLVE_EDGE_TARGET_IRI_ARGUMENTS_DATA_SCHEMA = {
  'properties': {
    'depth': { 'type': 'number' },
    'path': { 'type': 'string' }
  },
  'required': [
    'depth',
    'path'
  ],
  'type': 'object'
} as const;

/** Arguments for resolveEdgeTargetIri. */
export type ResolveEdgeTargetIriArgumentsType = InferType<typeof RESOLVE_EDGE_TARGET_IRI_ARGUMENTS_DATA_SCHEMA> & {
  'edge': AnnotatedEdgeStructureType;
  'minter': IriMinterInterface;
  'target': unknown;
};
