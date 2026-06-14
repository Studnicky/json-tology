import type { QuadInterface } from '../interfaces/Quad.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { LiftContextType } from './LiftContext.js';

/** Arguments for lifting an array of matching quads for one property. */
export type LiftMatchingQuadsArgsType = {
  readonly 'ctx': LiftContextType;
  readonly 'isArray': boolean;
  readonly 'matching': QuadInterface[];
  readonly 'nestedNode': SchemaGraphNodeType;
  readonly 'propGraph': SchemaGraphInterface;
  readonly 'resolvedNode': SchemaGraphNodeType;
};
