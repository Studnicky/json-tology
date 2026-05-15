import { DECIMAL_RADIX } from './FORMAT_VALIDATION.js';

export const XSD_COERCERS: Map<string, (raw: string) => unknown> = new Map<string, (raw: string) => unknown>([
  [
    'boolean',
    (raw) => {
      return raw === 'true';
    }
  ],
  [
    'decimal',
    (raw) => {
      return Number.parseFloat(raw);
    }
  ],
  [
    'double',
    (raw) => {
      return Number.parseFloat(raw);
    }
  ],
  [
    'float',
    (raw) => {
      return Number.parseFloat(raw);
    }
  ],
  [
    'int',
    (raw) => {
      return Number.parseInt(raw, DECIMAL_RADIX);
    }
  ],
  [
    'integer',
    (raw) => {
      return Number.parseInt(raw, DECIMAL_RADIX);
    }
  ],
  [
    'long',
    (raw) => {
      return Number.parseInt(raw, DECIMAL_RADIX);
    }
  ],
  [
    'short',
    (raw) => {
      return Number.parseInt(raw, DECIMAL_RADIX);
    }
  ]
]);

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
// XSD type resolution is in src/modules/rdf/XsdTypes.ts (XsdTypes.resolve / resolveSingle).
// Re-exported here for consumers that import from XSD_MAPS.ts.
// ---------------------------------------------------------------------------

export { XsdTypes } from '../modules/rdf/XsdTypes.js';
