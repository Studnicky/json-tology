/**
 * DataTypes — shared type guards and XSD type resolution
 *
 * Consolidates type checking predicates and JSON Schema → XSD type mappings
 * used across graph, ontology, validation, and data modules.
 */

import type { SchemaGraphSemanticsInterface } from '../../interfaces/schema-graph.js';

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
// XSD type maps
// ---------------------------------------------------------------------------

export const BASE_TYPE_MAP: Readonly<Record<string, string>> = {
  'boolean': 'xsd:boolean',
  'integer': 'xsd:integer',
  'null': 'owl:Nothing',
  'number': 'xsd:decimal',
  'string': 'xsd:string'
};

export const STRING_FORMAT_MAP: Readonly<Record<string, string>> = {
  'binary': 'xsd:hexBinary',
  'byte': 'xsd:base64Binary',
  'date': 'xsd:date',
  'date-time': 'xsd:dateTime',
  'duration': 'xsd:duration',
  'email': 'xsd:string',
  'hostname': 'xsd:string',
  'idn-email': 'xsd:string',
  'idn-hostname': 'xsd:string',
  'ipv4': 'xsd:string',
  'ipv6': 'xsd:string',
  'iri': 'xsd:anyURI',
  'iri-reference': 'xsd:anyURI',
  'json-pointer': 'xsd:string',
  'password': 'xsd:string',
  'regex': 'xsd:string',
  'relative-json-pointer': 'xsd:string',
  'time': 'xsd:time',
  'uri': 'xsd:anyURI',
  'uri-reference': 'xsd:anyURI',
  'uri-template': 'xsd:anyURI',
  'uuid': 'xsd:string'
};

export const NUMBER_FORMAT_MAP: Readonly<Record<string, string>> = {
  'double': 'xsd:double',
  'float': 'xsd:float',
  'int32': 'xsd:int',
  'int64': 'xsd:long'
};

// ---------------------------------------------------------------------------
// XSD type resolution
// ---------------------------------------------------------------------------

export function resolveSingleXsdType(type: string, format?: string): string | null {
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

export function resolveXsdType(semantics: SchemaGraphSemanticsInterface): string | null {
  const types = semantics.schemaTypes;
  const format = semantics.format;

  const nonNull = types.filter((entry) => entry !== 'null');

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

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }

    return true;
  }

  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }

  return false;
}
