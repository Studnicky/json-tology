import type { NormIRInterface } from './SchemaGraph.js';

export interface GraphArtifactInterface {
  'metadata': {
    'schemaHash': string;
  };
  'normIR': NormIRInterface;
  'semanticsHashes': Record<string, string>;
}
