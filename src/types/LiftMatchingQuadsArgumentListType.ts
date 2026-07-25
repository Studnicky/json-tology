import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { LiftContextType } from './LiftContextType.js';

/** Arguments for lifting an array of matching quads for one property. */
export type LiftMatchingQuadsArgumentListType = {
  'context': LiftContextType;
  'isArray': boolean;
  'matching': QuadInterface[];
  'nestedNode': SchemaGraphNodeType;
  'propGraph': SchemaGraphInterface;
  'resolvedNode': SchemaGraphNodeType;
};
