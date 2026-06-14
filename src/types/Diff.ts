/**
 * Diff operation types — expressed as json-tology schemas and plain types.
 */

export type SetOpType = {
  'op': 'set';
  'path': string;
  'value': unknown;
};

export type DelOpType = {
  'op': 'delete';
  'path': string;
};

export type DiffOpType = DelOpType | SetOpType;
