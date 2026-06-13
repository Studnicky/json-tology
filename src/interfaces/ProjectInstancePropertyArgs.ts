import type { RefTargetInterface } from './RefTarget.js';
import type { ProjectInstanceArgs } from './Projection.js';

/** Arguments for projectInstanceProperty. */
export interface ProjectInstancePropertyArgsInterface {
  readonly 'baseArgs': ProjectInstanceArgs;
  readonly 'instIRI': string;
  readonly 'nodeId': string;
  readonly 'propertyEntry': RefTargetInterface;
  readonly 'propertyName': string;
}
