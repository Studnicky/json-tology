import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { LiftContextType } from './LiftContext.js';

/** Arguments for lifting a single quad object value to a typed JS value. */
export type LiftSingleValueArgsType = {
  readonly 'ctx': LiftContextType;
  readonly 'obj': QuadObjectType;
  readonly 'parentGraph': SchemaGraphInterface;
  readonly 'targetNode': SchemaGraphNodeType;
};
