import type { NormIRInterface } from './schema-graph.js';

export interface GraphArtifactInterface {
  'metadata': {
    'schemaHash': string;
  };
  'normIR': NormIRInterface;
  'semanticsHashes': Record<string, string>;
}
