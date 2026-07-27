/** Shared by BuildOptionsEntity and VizOptionsEntity — both CLI verbs read a source schema and write to an output location. */
export const SCHEMA_OUTPUT_OPTIONS_DEF = {
  'properties': {
    'output': { 'type': 'string' },
    'schema': { 'type': 'string' }
  },
  'required': [
    'output',
    'schema'
  ]
} as const;
