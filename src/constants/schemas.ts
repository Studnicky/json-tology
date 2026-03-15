export const SetOpSchema = {
  '$id': 'https://json-tology.dev/SetOp',
  'properties': {
    'op': { 'const': 'set' },
    'path': { 'type': 'string' },
    'value': {}
  },
  'required': [
    'op',
    'path',
    'value'
  ],
  'type': 'object'
} as const;

export const DelOpSchema = {
  '$id': 'https://json-tology.dev/DelOp',
  'properties': {
    'op': { 'const': 'delete' },
    'path': { 'type': 'string' }
  },
  'required': [
    'op',
    'path'
  ],
  'type': 'object'
} as const;

export const DiffOpSchema = {
  '$defs': {
    'DelOp': DelOpSchema,
    'SetOp': SetOpSchema
  },
  '$id': 'https://json-tology.dev/DiffOp',
  'oneOf': [
    { '$ref': '#/$defs/SetOp' },
    { '$ref': '#/$defs/DelOp' }
  ]
} as const;

export const SchemaLoadErrorSchema = {
  '$id': 'https://json-tology.dev/SchemaLoadError',
  'properties': {
    'file': { 'type': 'string' },
    'message': { 'type': 'string' },
    'reason': {
      'enum': [
        'duplicate-anchor',
        'duplicate-id',
        'invalid-json',
        'invalid-schema',
        'no-id',
        'not-json',
        'unknown'
      ],
      'type': 'string'
    }
  },
  'required': [
    'file',
    'message',
    'reason'
  ],
  'type': 'object'
} as const;

export const SchemaLoadResultSchema = {
  '$defs': { 'SchemaLoadError': SchemaLoadErrorSchema },
  '$id': 'https://json-tology.dev/SchemaLoadResult',
  'properties': {
    'errors': {
      'items': { '$ref': '#/$defs/SchemaLoadError' },
      'type': 'array'
    },
    'failed': { 'type': 'number' },
    'skipped': { 'type': 'number' },
    'successful': { 'type': 'number' }
  },
  'required': [
    'errors',
    'failed',
    'skipped',
    'successful'
  ],
  'type': 'object'
} as const;

export const ValidationErrorSchema = {
  '$id': 'https://json-tology.dev/ValidationError',
  'properties': {
    'keyword': {
      'description': 'Schema keyword that triggered the error',
      'type': 'string'
    },
    'message': {
      'description': 'Human-readable error message',
      'type': 'string'
    },
    'params': {
      'description': 'Keyword-specific parameters',
      'type': 'object'
    },
    'path': {
      'description': 'JSON Pointer path to the failing value',
      'type': 'string'
    }
  },
  'required': [
    'keyword',
    'message',
    'params',
    'path'
  ],
  'type': 'object'
} as const;
