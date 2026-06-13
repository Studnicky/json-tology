import type { QuadInterface } from './Quad.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { LiftContextInterface } from './LiftContext.js';

/** Arguments for lifting an array of matching quads for one property. */
export interface LiftMatchingQuadsArgsInterface {
  readonly 'ctx': LiftContextInterface;
  readonly 'isArray': boolean;
  readonly 'matching': QuadInterface[];
  readonly 'nestedNode': SchemaGraphNodeInterface;
  readonly 'propGraph': SchemaGraphInterface;
  readonly 'resolvedNode': SchemaGraphNodeInterface;
}
