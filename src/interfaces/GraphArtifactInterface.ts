import type { NormIRInterface } from './NormIRInterface.js';
import type { GraphArtifactMetadataEntity } from '../entities/GraphArtifactMetadataEntity.js';

export interface GraphArtifactInterface {
  'metadata': GraphArtifactMetadataEntity.Type;
  'normIR': NormIRInterface;
  'semanticsHashes': Record<string, string>;
}
