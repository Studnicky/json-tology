/**
 * DataType — shared type guards and deep equality
 *
 * Consolidates type checking predicates used across
 * graph, ontology, validation, and data modules.
 * IRI helpers live in `src/modules/graph/SchemaIri.ts`.
 * XSD type resolution lives in `src/constants/XSD_MAPS.ts`.
 */

/**
 * DataType — static type guards and structural equality for JSON-compatible values.
 */
export class DataType {
  /**
   * Recursive structural equality check for JSON-compatible values.
   *
   * Compares primitives by identity, arrays element-wise, and plain objects key-by-key.
   * Does not handle circular references, `Map`, `Set`, or class instances.
   */
  public static deepEqual(left: unknown, right: unknown): boolean {
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
        i,
        element
      ] of left.entries()) {
        if (!DataType.deepEqual(element, right[i])) {
          return false;
        }
      }

      return true;
    }

    if (DataType.isRecord(left) && DataType.isRecord(right)) {
      const leftObject = left;
      const rightObject = right;
      const leftKeys = Object.keys(leftObject);
      const rightKeys = Object.keys(rightObject);

      if (leftKeys.length !== rightKeys.length) {
        return false;
      }

      for (const key of leftKeys) {
        if (!(key in rightObject)) {
          return false;
        }
        if (!DataType.deepEqual(leftObject[key], rightObject[key])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Detect whether the value graph reachable from `value` contains a cycle.
   *
   * Walks plain objects and arrays only. Primitives and other reference types
   * (Date, Map, Set, class instances) are treated as leaves.
   */
  public static hasCycle(value: unknown): boolean {
    const result = DataType.walkForCycle(value, new WeakSet());

    return result;
  }

  /** Type guard for plain objects whose prototype is `Object.prototype` or `null`. */
  public static isPlainObject(value: unknown): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const proto = Object.getPrototypeOf(value) as unknown;

    return proto === Object.prototype || proto === null;
  }

  /** Type guard for non-null, non-array objects (`Record<string, unknown>`). */
  public static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static walkForCycle(value: unknown, seen: WeakSet<object>): boolean {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    if (seen.has(value)) {
      return true;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        if (DataType.walkForCycle(item, seen)) {
          return true;
        }
      }
      seen.delete(value);

      return false;
    }

    if (
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
      && DataType.isRecord(value)
    ) {
      for (const child of Object.values(value)) {
        if (DataType.walkForCycle(child, seen)) {
          return true;
        }
      }
    }
    seen.delete(value);

    return false;
  }
}
