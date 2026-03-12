/**
 * Value utilities
 *
 * Instance methods (cast, clean, convert, parse, create) delegate to a
 * SchemaRegistry for schema-aware operations.
 *
 * Static methods (clone, hash, diff, applyOp) operate on plain values
 * without requiring a schema or registry.
 */

import type { DiffOpType } from '../../types/diff.js';
import type { SchemaRegistry } from '../registry/SchemaRegistry.js';
import { isPlainObject } from './DataTypes.js';
import { Hash } from '../hash/Hash.js';
import { Changeset } from './Changeset.js';

export class Value {

  // ---------------------------------------------------------------------------
  // Static — pure value operations (no schema/registry)
  // ---------------------------------------------------------------------------

  static applyOp(root: unknown, operation: DiffOpType): unknown {
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
      const segment = segments[i] as string;
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

  public static clone<T>(value: T): T {
    return structuredClone(value);
  }

  public static diff(before: unknown, after: unknown): Changeset {
    const operations: DiffOpType[] = [];

    diffAt('', before, after, operations);

    return new Changeset(operations);
  }

  public static hash(value: unknown): string {
    return Hash.value(value);
  }

  // ---------------------------------------------------------------------------
  // Constructor + instance — schema-aware operations (delegate to registry)
  // ---------------------------------------------------------------------------

  constructor(private readonly registry: SchemaRegistry) {}

  public cast(schemaId: string, data: unknown): unknown {
    return this.registry.cast(schemaId, data);
  }

  public clean(schemaId: string, data: unknown): unknown {
    return this.registry.clean(schemaId, data);
  }

  public convert(schemaId: string, data: unknown): unknown {
    return this.registry.convert(schemaId, data);
  }

  public create(schemaId: string): unknown {
    return this.registry.create(schemaId);
  }

  public parse(schemaId: string, data: unknown): unknown {
    return this.registry.parse(schemaId, data);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function diffAt(path: string, before: unknown, after: unknown, ops: DiffOpType[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;

    for (const key in beforeObj) {
      const child = `${path}/${key}`;

      if (key in afterObj) {
        diffAt(child, beforeObj[key], afterObj[key], ops);
      } else {
        ops.push({
          'op': 'delete',
          'path': child
        });
      }
    }
    for (const key in afterObj) {
      if (!(key in beforeObj)) {
        ops.push({
          'op': 'set',
          'path': `${path}/${key}`,
          'value': afterObj[key]
        });
      }
    }
  } else if (Array.isArray(before) && Array.isArray(after)) {
    const bl = before.length;
    const al = after.length;
    const min = Math.min(bl, al);

    for (let i = 0; i < min; i++) {
      diffAt(`${path}/${i}`, before[i], after[i], ops);
    }
    for (let i = min; i < al; i++) {
      ops.push({
        'op': 'set',
        'path': `${path}/${i}`,
        'value': (after as unknown[])[i]
      });
    }
    for (let i = min; i < bl; i++) {
      ops.push({
        'op': 'delete',
        'path': `${path}/${i}`
      });
    }
  } else if (before !== after) {
    ops.push({
      'op': 'set',
      'path': path || '/',
      'value': after
    });
  }
}

