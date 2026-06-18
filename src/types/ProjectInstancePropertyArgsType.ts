import type { RefTargetType } from './RefTargetType.js';
import type { ProjectInstanceArgsType } from './ProjectInstanceArgsType.js';

/** Arguments for projectInstanceProperty. */
export type ProjectInstancePropertyArgsType = {
  readonly 'baseArgs': ProjectInstanceArgsType;
  readonly 'instIRI': string;
  readonly 'nodeId': string;
  readonly 'propertyEntry': RefTargetType;
  readonly 'propertyName': string;
};
