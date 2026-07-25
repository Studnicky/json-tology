import type { ReferenceTargetType } from './ReferenceTargetType.js';
import type { ProjectInstanceArgumentListType } from './ProjectInstanceArgumentListType.js';
import type { IdentityType } from './IdentityType.js';

/** Arguments for projectInstanceProperty. */
export type ProjectInstancePropertyArgumentListType = IdentityType<{
  'baseArgumentList': ProjectInstanceArgumentListType;
  'instIri': string;
  'nodeId': string;
  'propertyEntry': ReferenceTargetType;
  'propertyName': string;
}>;
