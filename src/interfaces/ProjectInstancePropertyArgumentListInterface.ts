import type { ReferenceTargetInterface } from './ReferenceTargetInterface.js';
import type { ProjectInstanceArgumentListInterface } from './ProjectInstanceArgumentListInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for projectInstanceProperty. */
export interface ProjectInstancePropertyArgumentListInterface {
  'baseArgumentList': ProjectInstanceArgumentListInterface;
  'instIri': StringValueEntity.Type;
  'nodeId': StringValueEntity.Type;
  'propertyEntry': ReferenceTargetInterface;
  'propertyName': StringValueEntity.Type;
}
