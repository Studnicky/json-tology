import type { IriMinterInterface } from './IriMinterInterface.js';
import type { AnnotatedEdgeStructureInterface } from './AnnotatedEdgeStructureInterface.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for resolveEdgeTargetIri. */
export interface ResolveEdgeTargetIriArgumentsInterface {
  'depth': NumberValueEntity.Type;
  'edge': AnnotatedEdgeStructureInterface;
  'minter': IriMinterInterface;
  'path': StringValueEntity.Type;
  'target': unknown;
}
