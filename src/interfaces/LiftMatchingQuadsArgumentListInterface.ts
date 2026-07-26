import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { LiftContextInterface } from './LiftContextInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';

/** Arguments for lifting an array of matching quads for one property. */
export interface LiftMatchingQuadsArgumentListInterface {
  'context': LiftContextInterface;
  'isArray': BooleanValueEntity.Type;
  'matching': QuadInterface[];
  'nestedNode': SchemaGraphNodeInterface;
  'propGraph': SchemaGraphInterface;
  'resolvedNode': SchemaGraphNodeInterface;
}
