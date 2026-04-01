import type { DiffOpType } from '../../types/Diff.js';
import { isPlainObject } from './dataTypes.js';

export function applyOp(root: unknown, operation: DiffOpType): unknown {
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
    const child = (current as Record<string, unknown>)[segment];
    let next: unknown;

    if (isPlainObject(child)) {
      next = { ...(child as object) };
    } else if (Array.isArray(child)) {
      next = [...(child as unknown[])];
    } else {
      next = child;
    }

    (current as Record<string, unknown>)[segment] = next;
    current = next;
  }

  const lastSegment: string = segments.at(-1) ?? '';

  if (operation.op === 'set') {
    (current as Record<string, unknown>)[lastSegment] = operation.value;
  } else {
    if (Array.isArray(current)) {
      (current as unknown[]).splice(Number(lastSegment), 1);
    } else {
      delete (current as Record<string, unknown>)[lastSegment];
    }
  }

  return result;
}

export function clone<T extends unknown>(value: T): T {
  return structuredClone(value);
}
