import type { NormIRType } from './SchemaGraph.js';

export type GraphArtifactType = {
  'metadata': {
    'schemaHash': string;
  };
  'normIR': NormIRType;
  'semanticsHashes': Record<string, string>;
};
