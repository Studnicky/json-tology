/**
 * DataTypes — shared type guards and XSD type resolution
 *
 * Consolidates type checking predicates and JSON Schema → XSD type mappings
 * used across graph, ontology, validation, and data modules.
 */

import type { SchemaGraphSemanticsInterface } from '../../interfaces/SchemaGraph.js';
import {
  BASE_TYPE_MAP, NUMBER_FORMAT_MAP, STRING_FORMAT_MAP
} from '../../constants/XSD_MAPS.js';

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

/** Recursively freeze an object and all nested objects in place. */
export function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }

  return obj;
}

// ---------------------------------------------------------------------------
// XSD type resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single JSON Schema `type` (and optional `format`) to an XSD datatype IRI.
 *
 * @param type - JSON Schema type (`string`, `number`, `integer`, `boolean`, `null`).
 * @param format - Optional format hint (e.g. `date-time`, `int32`).
 * @returns The XSD type string, or `null` for composite types (`object`, `array`) or unknown mappings.
 */
export function resolveSingleXsdType(type: string, format?: string): null | string {
  if (type === 'object' || type === 'array') {
    return null;
  }
  if (type === 'string') {
    return format !== undefined && format in STRING_FORMAT_MAP
      ? STRING_FORMAT_MAP[format]
      : 'xsd:string';
  }
  if (type === 'number' || type === 'integer') {
    return format !== undefined && format in NUMBER_FORMAT_MAP
      ? NUMBER_FORMAT_MAP[format]
      : (BASE_TYPE_MAP[type] ?? null);
  }

  return BASE_TYPE_MAP[type] ?? null;
}

/**
 * Resolve the XSD type from a schema node's semantics (types array + format).
 *
 * @param semantics - The schema graph semantics containing `schemaTypes` and `format`.
 * @returns The XSD type string, `owl:Nothing` for null-only types, or `null` for ambiguous/composite types.
 */
export function resolveXsdType(semantics: SchemaGraphSemanticsInterface): null | string {
  const types = semantics.schemaTypes;
  const format = semantics.format;

  const nonNull = types.filter((schemaType) => {
    return schemaType !== 'null';
  });

  if (nonNull.length === 0) {
    return types.length > 0 ? 'owl:Nothing' : null;
  }
  if (nonNull.length === 1) {
    return resolveSingleXsdType(nonNull[0], format);
  }

  return null;
}

// ---------------------------------------------------------------------------
// IRI helpers
// ---------------------------------------------------------------------------

/**
 * Encodes a string for use as a URI path segment, preserving forward slashes.
 *
 * @param value - The raw string to escape.
 * @returns The percent-encoded string with `/` characters preserved.
 */
export function escapeSegment(value: string): string {
  return encodeURIComponent(value).replaceAll('%2F', '/');
}

/**
 * Generate a property IRI by appending a fragment to a class IRI.
 *
 * @param classId - The class `$id` (e.g. `https://example.io/User`).
 * @param propertyName - The property name (e.g. `email`).
 * @returns The property IRI (e.g. `https://example.io/User#email`).
 */
export function propertyIri(classId: string, propertyName: string): string {
  return `${classId}#${propertyName}`;
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

  if (typeof left === 'object') {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
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
