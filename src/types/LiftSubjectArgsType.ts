import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { LiftContextType } from './LiftContextType.js';

/** Arguments for lifting a single subject's quads to a typed JS object. */
export type LiftSubjectArgsType = {
  readonly 'classId': string;
  readonly 'ctx': LiftContextType;
  readonly 'graph': SchemaGraphInterface;
  readonly 'node': SchemaGraphNodeType;
  readonly 'subjectQuads': QuadInterface[];
};
