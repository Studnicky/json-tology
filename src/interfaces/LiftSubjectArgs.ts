import type { QuadInterface } from './Quad.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { LiftContextInterface } from './LiftContext.js';

/** Arguments for lifting a single subject's quads to a typed JS object. */
export interface LiftSubjectArgsInterface {
  readonly 'classId': string;
  readonly 'ctx': LiftContextInterface;
  readonly 'graph': SchemaGraphInterface;
  readonly 'node': SchemaGraphNodeInterface;
  readonly 'subjectQuads': QuadInterface[];
}
