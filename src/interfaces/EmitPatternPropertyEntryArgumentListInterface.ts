import type { ProjectionEmitContextInterface } from './ProjectionEmitContextInterface.js';
import type { RelationIndexInterface } from './RelationIndexInterface.js';
import type { PatternEntity } from '../entities/PatternEntity.js';
import type { IriEntity } from '../entities/IriEntity.js';

/** Arguments for emitPatternPropertyEntry. */
export interface EmitPatternPropertyEntryArgumentListInterface {
  'context': ProjectionEmitContextInterface;
  'pattern': PatternEntity.Type;
  'patternEntry': RelationIndexInterface | undefined;
  'subject': IriEntity.Type;
}
