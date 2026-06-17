import {
  OWL, XSD
} from './IRI.js';

/**
 * Map of JSON Schema primitive `type` values to their canonical XSD datatype IRIs.
 *
 * @remarks
 * Used during OWL/SHACL projection to select the appropriate XSD datatype IRI
 * for a JSON Schema property based on its `type` keyword. `null` maps to
 * `owl:Nothing` as the empty class.
 *
 * @example
 * ```ts
 * const datatypeIri = BASE_TYPE_MAP[schema.type]; // e.g. XSD.string
 * ```
 *
 * @category XSD
 * @since 0.1.0
 * @see STRING_FORMAT_MAP
 * @defaultValue `{...}`
 * @group Constants
 */
export const BASE_TYPE_MAP: Readonly<Record<string, string>> = {
  'boolean': XSD.boolean,
  'integer': XSD.integer,
  'null': OWL.Nothing,
  'number': XSD.decimal,
  'string': XSD.string
};

/**
 * Map of JSON Schema string `format` values to their canonical XSD datatype IRIs.
 *
 * @remarks
 * Used during OWL/SHACL projection to refine the datatype IRI for `string`-typed
 * properties that carry a `format` keyword. Formats without a more specific XSD
 * equivalent fall back to `xsd:string`.
 *
 * @example
 * ```ts
 * const datatypeIri = STRING_FORMAT_MAP[schema.format] ?? XSD.string;
 * ```
 *
 * @category XSD
 * @since 0.1.0
 * @see NUMBER_FORMAT_MAP
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * Map of JSON Schema numeric `format` values to their canonical XSD datatype IRIs.
 *
 * @remarks
 * Used during OWL/SHACL projection to refine the datatype IRI for `number` or
 * `integer`-typed properties that carry a format keyword indicating IEEE precision.
 *
 * @example
 * ```ts
 * const datatypeIri = NUMBER_FORMAT_MAP[schema.format] ?? XSD.decimal;
 * ```
 *
 * @category XSD
 * @since 0.1.0
 * @see STRING_FORMAT_MAP
 * @defaultValue `{...}`
 * @group Constants
 */
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

// ---------------------------------------------------------------------------
// XSD type name sets — local XSD name strings (without prefix or full IRI)
// ---------------------------------------------------------------------------

export const INTEGER_XSD_TYPE_NAMES: ReadonlySet<string> = new Set([
  'byte',
  'int',
  'integer',
  'long',
  'negativeInteger',
  'nonNegativeInteger',
  'nonPositiveInteger',
  'positiveInteger',
  'short',
  'unsignedByte',
  'unsignedInt',
  'unsignedLong',
  'unsignedShort'
]);

export const DECIMAL_XSD_TYPE_NAMES: ReadonlySet<string> = new Set([
  'decimal',
  'double',
  'float'
]);
