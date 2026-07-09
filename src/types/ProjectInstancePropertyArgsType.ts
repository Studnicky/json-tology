import type { RefTargetType } from './RefTargetType.js';
import type { ProjectInstanceArgsType } from './ProjectInstanceArgsType.js';

/** Arguments for projectInstanceProperty. */
export type ProjectInstancePropertyArgsType = {
  'baseArgs': ProjectInstanceArgsType;
  'instIri': string;
  'nodeId': string;
  'propertyEntry': RefTargetType;
  'propertyName': string;
};
