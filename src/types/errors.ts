import type {
  DelOp, SetOp
} from '../interfaces/diff.js';

// DiffOp is a type alias (union), so it lives here
export type DiffOp = DelOp | SetOp;

// Re-export ParseResult from FailResult.ts (where OkResult/FailResult classes live)
export type { ParseResult } from '../schema/FailResult.js';
