import type { SchemaGraphSemanticsInterface } from '../interfaces/SchemaGraph.js';

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
