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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

// ---------------------------------------------------------------------------
// XSD type resolution
// ---------------------------------------------------------------------------

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

export function propertyIri(classId: string, propertyName: string): string {
  return `${classId}#${propertyName}`;
}

// ---------------------------------------------------------------------------
// Deep equality
// ---------------------------------------------------------------------------

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
