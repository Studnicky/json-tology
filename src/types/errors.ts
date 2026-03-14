import type {
  DelOp, SetOp
} from '../interfaces/diff.js';

// DiffOp is a type alias (union), so it lives here
export type DiffOp = DelOp | SetOp;

import type { Result } from '../modules/data/Result.js';

export type ParseResult<T> = Result<T>;
