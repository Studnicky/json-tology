import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { LiftContextInterface } from './LiftContext.js';

/** Arguments for lifting a single quad object value to a typed JS value. */
export interface LiftSingleValueArgsInterface {
  readonly 'ctx': LiftContextInterface;
  readonly 'obj': QuadObjectType;
  readonly 'parentGraph': SchemaGraphInterface;
  readonly 'targetNode': SchemaGraphNodeInterface;
}
