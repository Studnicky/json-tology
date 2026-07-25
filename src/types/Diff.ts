/**
 * Diff operation types — expressed as json-tology schemas and plain types.
 */

import type { InferType } from './Schema.js';

export const SET_OP_SCHEMA = {
  'properties': {
    'op': { 'const': 'set' },
    'path': { 'type': 'string' },
    'value': true
  },
  'required': [
    'op',
    'path',
    'value'
  ],
  'type': 'object'
} as const;

export type SetOpType = InferType<typeof SET_OP_SCHEMA>;

export const DEL_OP_SCHEMA = {
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

export type DelOpType = InferType<typeof DEL_OP_SCHEMA>;

export type DiffOpType = DelOpType | SetOpType;
