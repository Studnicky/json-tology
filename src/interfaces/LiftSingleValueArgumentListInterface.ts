import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { LiftContextInterface } from './LiftContextInterface.js';

/** Arguments for lifting a single quad object value to a typed JS value. */
export interface LiftSingleValueArgumentListInterface {
  'context': LiftContextInterface;
  'object': QuadObjectType;
  'parentGraph': SchemaGraphInterface;
  'targetNode': SchemaGraphNodeInterface;
}
