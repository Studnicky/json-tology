/**
 * Diff operation types — expressed as json-tology schemas and plain types.
 */

export const SetOpSchema = {
  '$id': 'https://json-tology.dev/SetOp',
  'type': 'object',
  'properties': {
    'op': { 'const': 'set' },
    'path': { 'type': 'string' },
    'value': {}
  },
  'required': ['op', 'path', 'value']
} as const;

export const DelOpSchema = {
  '$id': 'https://json-tology.dev/DelOp',
  'type': 'object',
  'properties': {
    'op': { 'const': 'delete' },
    'path': { 'type': 'string' }
  },
  'required': ['op', 'path']
} as const;

export const DiffOpSchema = {
  '$id': 'https://json-tology.dev/DiffOp',
  'oneOf': [
    { '$ref': '#/$defs/SetOp' },
    { '$ref': '#/$defs/DelOp' }
  ],
  '$defs': {
    'SetOp': SetOpSchema,
    'DelOp': DelOpSchema
  }
} as const;

export interface SetOpType {
  op: 'set';
  path: string;
  value: unknown;
}

export interface DelOpType {
  op: 'delete';
  path: string;
}

export type DiffOpType = DelOpType | SetOpType;
