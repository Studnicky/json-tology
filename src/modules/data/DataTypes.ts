/**
 * DataTypes — shared type guards and deep equality
 *
 * Consolidates type checking predicates used across
 * graph, ontology, validation, and data modules.
 * IRI helpers live in `src/modules/graph/SchemaIri.ts`.
 * XSD type resolution lives in `src/constants/XSD_MAPS.ts`.
 */

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Type guard for non-null, non-array objects (`Record<string, unknown>`). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type guard for plain objects whose prototype is `Object.prototype` or `null`. */
export function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/**
 * Detect whether the value graph reachable from `value` contains a cycle.
 *
 * Walks plain objects and arrays only. Primitives and other reference types
 * (Date, Map, Set, class instances) are treated as leaves.
 */
export function hasCycle(value: unknown): boolean {
  return walkForCycle(value, new WeakSet());
}

function walkForCycle(value: unknown, seen: WeakSet<object>): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (seen.has(value)) {
    return true;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      if (walkForCycle(item, seen)) {
        return true;
      }
    }
    seen.delete(value);

    return false;
  }

  if (
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    && isRecord(value)
  ) {
    for (const child of Object.values(value)) {
      if (walkForCycle(child, seen)) {
        return true;
      }
    }
  }
  seen.delete(value);

  return false;
}

// ---------------------------------------------------------------------------
// Deep equality
// ---------------------------------------------------------------------------

/**
 * Recursive structural equality check for JSON-compatible values.
 *
 * Compares primitives by identity, arrays element-wise, and plain objects key-by-key.
 * Does not handle circular references, `Map`, `Set`, or class instances.
 */
export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  if (typeof left !== typeof right) {
    return false;
  }

  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    for (const [
      index,
      element
    ] of left.entries()) {
      if (!deepEqual(element, right[index])) {
        return false;
      }
    }

    return true;
  }

  if (isRecord(left) && isRecord(right)) {
    const leftObj = left;
    const rightObj = right;
    const leftKeys = Object.keys(leftObj);
    const rightKeys = Object.keys(rightObj);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!(key in rightObj)) {
        return false;
      }
      if (!deepEqual(leftObj[key], rightObj[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}
