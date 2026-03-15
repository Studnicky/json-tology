/**
 * Diff operation types — expressed as json-tology schemas and plain types.
 */

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
