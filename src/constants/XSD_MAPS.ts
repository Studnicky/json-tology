import { DECIMAL_RADIX } from './FORMAT_VALIDATION.js';
import {
  OWL, XSD
} from './IRI.js';

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
  'boolean': XSD.boolean,
  'integer': XSD.integer,
  'null': OWL.Nothing,
  'number': XSD.decimal,
  'string': XSD.string
};

export const STRING_FORMAT_MAP: Readonly<Record<string, string>> = {
  'binary': XSD.hexBinary,
  'byte': XSD.base64Binary,
  'date': XSD.date,
  'date-time': XSD.dateTime,
  'duration': XSD.duration,
  'email': XSD.string,
  'hostname': XSD.string,
  'idn-email': XSD.string,
  'idn-hostname': XSD.string,
  'ipv4': XSD.string,
  'ipv6': XSD.string,
  'iri': XSD.anyURI,
  'iri-reference': XSD.anyURI,
  'json-pointer': XSD.string,
  'password': XSD.string,
  'regex': XSD.string,
  'relative-json-pointer': XSD.string,
  'time': XSD.time,
  'uri': XSD.anyURI,
  'uri-reference': XSD.anyURI,
  'uri-template': XSD.anyURI,
  'uuid': XSD.string
};

export const NUMBER_FORMAT_MAP: Readonly<Record<string, string>> = {
  'double': XSD.double,
  'float': XSD.float,
  'int32': XSD.int,
  'int64': XSD.long
};

// ---------------------------------------------------------------------------
// XSD type resolution is in src/modules/rdf/XsdTypes.ts (XsdTypes.resolve / resolveSingle).
// Re-exported here for consumers that import from XSD_MAPS.ts.
// ---------------------------------------------------------------------------

export { XsdTypes } from '../modules/rdf/XsdTypes.js';
