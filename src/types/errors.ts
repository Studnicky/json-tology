import type { SetOp, DelOp } from '../interfaces/diff.js';

// DiffOp is a type alias (union), so it lives here
export type DiffOp = SetOp | DelOp;

// Re-export ParseResult from FailResult.ts (where OkResult/FailResult classes live)
export type { ParseResult } from '../schema/FailResult.js';
