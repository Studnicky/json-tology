/**
 * Diff operation types — expressed as json-tology schemas and plain types.
 */

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

export interface SetOpType {
  'op': 'set';
  'path': string;
  'value': unknown;
}

export interface DelOpType {
  'op': 'delete';
  'path': string;
}

export type DiffOpType = DelOpType | SetOpType;
