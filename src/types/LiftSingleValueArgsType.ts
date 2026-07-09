import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { LiftContextType } from './LiftContextType.js';

/** Arguments for lifting a single quad object value to a typed JS value. */
export type LiftSingleValueArgsType = {
  'ctx': LiftContextType;
  'obj': QuadObjectType;
  'parentGraph': SchemaGraphInterface;
  'targetNode': SchemaGraphNodeType;
};
