/**
 * Operations — domain class for value mutation and cloning.
 *
 * Static-methods-only class. Mirrors the shape of `Hash`.
 * These are the source-of-truth implementations consumed directly
 * by call sites; `Value` no longer wraps them.
 */

import type { DiffOpType } from '../../types/Diff.js';
import {
  isPlainObject, isRecord
} from './DataTypes.js';

const UNSAFE_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype'
]);

export class Operations {
  /**
   * Apply a single diff operation (`set` or `delete`) to a value at the specified path.
   *
   * Returns a shallow-cloned copy of `root` with the operation applied.
   * Path segments are slash-delimited (e.g. `/address/city`).
   *
   * @param root - The value to patch.
   * @param operation - The diff operation containing `op`, `path`, and optionally `value`.
   * @returns The patched value.
   */
  /** Deep clone a value using `structuredClone`. */
  static clone<T>(value: T): T {
    return structuredClone(value);
  }

  static patch(root: unknown, operation: DiffOpType): unknown {
    const path = operation.path === '/' ? '' : operation.path;
    const segments = path.split('/').filter(Boolean);

    if (segments.length === 0) {
      return operation.op === 'set' ? operation.value : undefined;
    }

    let result: unknown;

    if (isPlainObject(root)) {
      result = { ...(root as object) };
    } else if (Array.isArray(root)) {
      result = [...(root as unknown[])];
    } else {
      result = root;
    }
    let current: unknown = result;

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];

      if (UNSAFE_KEYS.has(segment)) {
        return result;
      }

      if (!isRecord(current)) {
        break;
      }

      const child = current[segment];
      let next: unknown;

      if (isPlainObject(child)) {
        next = { ...(child as object) };
      } else if (Array.isArray(child)) {
        next = [...(child as unknown[])];
      } else {
        next = child;
      }

      current[segment] = next;
      current = next;
    }

    const lastSegment: string = segments.at(-1) ?? '';

    if (UNSAFE_KEYS.has(lastSegment)) {
      return result;
    }

    if (operation.op === 'set') {
      if (isRecord(current)) {
        current[lastSegment] = operation.value;
      }
    } else {
      if (Array.isArray(current)) {
        (current as unknown[]).splice(Number(lastSegment), 1);
      } else if (isRecord(current)) {
        delete current[lastSegment];
      }
    }

    return result;
  }
}
