import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { LiftContextInterface } from './LiftContextInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for lifting a single subject's quads to a typed JS object. */
export interface LiftSubjectArgumentListInterface {
  'classId': StringValueEntity.Type;
  'context': LiftContextInterface;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
  'subjectQuads': QuadInterface[];
}
