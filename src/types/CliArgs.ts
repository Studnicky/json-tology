export interface BuildArgsInterface {
  'baseIRI': string | undefined;
  'command': 'build';
  'format': string;
  'output': string;
  'outputFile': string | undefined;
  'schema': string;
}

export interface VizArgsInterface {
  'command': 'viz';
  'noOpen': boolean;
  'output': string;
  'schema': string;
}

export type CliArgsType = BuildArgsInterface | VizArgsInterface;
