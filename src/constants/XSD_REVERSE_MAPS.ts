/**
 * XSD_REVERSE_MAPS — canonical reverse XSD→JSON-Schema mapping.
 *
 * Single source of truth for converting XSD datatype IRIs back to JSON Schema
 * primitives (`{ type, format? }`) and for the supported-datatype membership
 * check used by the OWL import pipeline.
 *
 * Both full-IRI and prefixed (`xsd:` / `rdf:`) forms are included so callers
 * never need to normalise the IRI form before lookup.
 *
 * Replaces the three independent tables that previously diverged:
 *   - src/modules/ontology/importDispatch/Properties.ts   — XSD_TO_JSON_SCHEMA
 *   - src/modules/ontology/importDispatch/Datatypes.ts    — XSD_TO_SCHEMA_TYPE
 *   - src/modules/ontology/OwlImporter.ts                 — SUPPORTED_DATATYPES
 */

import type { XsdJsonSchemaPrimitiveInterface } from '../interfaces/XsdJsonSchemaPrimitiveInterface.js';
import {
  OWL, XSD
} from './IRI.js';
import { STANDARD_PREFIXES } from './STANDARD_PREFIXES.js';
import type { XsdEntryInterface } from '../interfaces/XsdEntry.js';

const RDF_NS = STANDARD_PREFIXES.rdf;
const XSD_NS = STANDARD_PREFIXES.xsd;

// ---------------------------------------------------------------------------
// Canonical entry table — one row per logical XSD type
//
// Keys are the prefixed curie form; full-IRI keys are derived below.
// Each entry carries:
//   prefixed  — the `xsd:localName` form (used as a canonical key)
//   full      — the expanded full IRI (derived from XSD_NS / RDF_NS)
//   primitive — the target JSON-Schema shape
//   supported — whether this type appears in the OWL-import supported set
// ---------------------------------------------------------------------------

const ENTRIES: readonly XsdEntryInterface[] = [
  // --- string-family with format ---
  {
    'full': XSD.anyURI,
    'prefixed': 'xsd:anyURI',
    'primitive': {
      'format': 'uri',
      'type': 'string'
    },
    'supported': true
  },
  {
    'full': `${XSD_NS}base64Binary`,
    'prefixed': 'xsd:base64Binary',
    'primitive': { 'type': 'string' },
    'supported': true
  },
  {
    'full': XSD.date,
    'prefixed': 'xsd:date',
    'primitive': {
      'format': 'date',
      'type': 'string'
    },
    'supported': true
  },
  {
    'full': XSD.dateTime,
    'prefixed': 'xsd:dateTime',
    'primitive': {
      'format': 'date-time',
      'type': 'string'
    },
    'supported': true
  },
  {
    'full': XSD.duration,
    'prefixed': 'xsd:duration',
    'primitive': { 'type': 'string' },
    'supported': true
  },
  {
    'full': `${XSD_NS}hexBinary`,
    'prefixed': 'xsd:hexBinary',
    'primitive': { 'type': 'string' },
    'supported': true
  },
  {
    'full': `${XSD_NS}ID`,
    'prefixed': 'xsd:ID',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  {
    'full': `${XSD_NS}IDREF`,
    'prefixed': 'xsd:IDREF',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  {
    'full': `${XSD_NS}language`,
    'prefixed': 'xsd:language',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  {
    'full': `${XSD_NS}Name`,
    'prefixed': 'xsd:Name',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  {
    'full': `${XSD_NS}NCName`,
    'prefixed': 'xsd:NCName',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  {
    'full': `${XSD_NS}NMTOKEN`,
    'prefixed': 'xsd:NMTOKEN',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  {
    'full': `${XSD_NS}normalizedString`,
    'prefixed': 'xsd:normalizedString',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  {
    'full': XSD.string,
    'prefixed': 'xsd:string',
    'primitive': { 'type': 'string' },
    'supported': true
  },
  {
    'full': XSD.time,
    'prefixed': 'xsd:time',
    'primitive': { 'type': 'string' },
    'supported': true
  },
  {
    'full': `${XSD_NS}token`,
    'prefixed': 'xsd:token',
    'primitive': { 'type': 'string' },
    'supported': false
  },
  // --- boolean ---
  {
    'full': XSD.boolean,
    'prefixed': 'xsd:boolean',
    'primitive': { 'type': 'boolean' },
    'supported': true
  },
  // --- number-family ---
  {
    'full': XSD.decimal,
    'prefixed': 'xsd:decimal',
    'primitive': { 'type': 'number' },
    'supported': true
  },
  {
    'full': XSD.double,
    'prefixed': 'xsd:double',
    'primitive': { 'type': 'number' },
    'supported': true
  },
  {
    'full': XSD.float,
    'prefixed': 'xsd:float',
    'primitive': { 'type': 'number' },
    'supported': true
  },
  // --- integer-family ---
  {
    'full': `${XSD_NS}byte`,
    'prefixed': 'xsd:byte',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  {
    'full': XSD.int,
    'prefixed': 'xsd:int',
    'primitive': { 'type': 'integer' },
    'supported': true
  },
  {
    'full': XSD.integer,
    'prefixed': 'xsd:integer',
    'primitive': { 'type': 'integer' },
    'supported': true
  },
  {
    'full': XSD.long,
    'prefixed': 'xsd:long',
    'primitive': { 'type': 'integer' },
    'supported': true
  },
  {
    'full': `${XSD_NS}negativeInteger`,
    'prefixed': 'xsd:negativeInteger',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  {
    'full': XSD.nonNegativeInteger,
    'prefixed': 'xsd:nonNegativeInteger',
    'primitive': { 'type': 'integer' },
    'supported': true
  },
  {
    'full': `${XSD_NS}nonPositiveInteger`,
    'prefixed': 'xsd:nonPositiveInteger',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  {
    'full': `${XSD_NS}positiveInteger`,
    'prefixed': 'xsd:positiveInteger',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  {
    'full': XSD.short,
    'prefixed': 'xsd:short',
    'primitive': { 'type': 'integer' },
    'supported': true
  },
  {
    'full': `${XSD_NS}unsignedByte`,
    'prefixed': 'xsd:unsignedByte',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  {
    'full': `${XSD_NS}unsignedInt`,
    'prefixed': 'xsd:unsignedInt',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  {
    'full': `${XSD_NS}unsignedLong`,
    'prefixed': 'xsd:unsignedLong',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  {
    'full': `${XSD_NS}unsignedShort`,
    'prefixed': 'xsd:unsignedShort',
    'primitive': { 'type': 'integer' },
    'supported': false
  },
  // --- rdf: namespace ---
  {
    'full': `${RDF_NS}langString`,
    'prefixed': 'rdf:langString',
    'primitive': { 'type': 'string' },
    'supported': false
  }
];

// ---------------------------------------------------------------------------
// Derived maps — built once from ENTRIES, never hand-coded again
// ---------------------------------------------------------------------------

/**
 * XSD_TO_JSON_SCHEMA — full-IRI and prefixed-form lookup → `{ type, format? }`.
 *
 * Used by Properties.ts and anywhere a range IRI must be converted to a
 * JSON Schema primitive shape.
 *
 * @remarks
 * Both the prefixed (`xsd:string`) and full-IRI forms map to the same
 * `XsdJsonSchemaPrimitiveInterface` so callers never need to normalise before lookup.
 *
 * @example
 * ```ts
 * XSD_TO_JSON_SCHEMA.get('xsd:dateTime'); // { type: 'string', format: 'date-time' }
 * ```
 *
 * @category Constants
 * @since 0.10.0
 * @see {@link XSD_TO_SCHEMA_TYPE}
 * @group XsdReverseMaps
 * @defaultValue Derived from all `ENTRIES` (prefixed + full IRI forms)
 */
export const XSD_TO_JSON_SCHEMA: ReadonlyMap<string, XsdJsonSchemaPrimitiveInterface>
  = new Map(ENTRIES.flatMap((entry: XsdEntryInterface): Array<[string, XsdJsonSchemaPrimitiveInterface]> => {
    return [
      [
        entry.prefixed,
        entry.primitive
      ] as [string, XsdJsonSchemaPrimitiveInterface],
      [
        entry.full,
        entry.primitive
      ] as [string, XsdJsonSchemaPrimitiveInterface]
    ];
  }));

/**
 * XSD_TO_SCHEMA_TYPE — full-IRI and prefixed-form lookup → JSON Schema type string only.
 *
 * Used by Datatypes.ts where only the base type is needed (facet processing
 * derives format separately via jt:format).
 *
 * @remarks
 * Returns the bare `type` string without any `format` property; use
 * {@link XSD_TO_JSON_SCHEMA} when both `type` and `format` are needed.
 *
 * @example
 * ```ts
 * XSD_TO_SCHEMA_TYPE.get('xsd:integer'); // 'integer'
 * ```
 *
 * @category Constants
 * @since 0.10.0
 * @see {@link XSD_TO_JSON_SCHEMA}
 * @group XsdReverseMaps
 * @defaultValue Derived from all `ENTRIES` (prefixed + full IRI forms)
 */
export const XSD_TO_SCHEMA_TYPE: ReadonlyMap<string, 'boolean' | 'integer' | 'number' | 'string'> = new Map(ENTRIES.flatMap((entry: XsdEntryInterface): Array<[string, 'boolean' | 'integer' | 'number' | 'string']> => {
  return [
    [
      entry.prefixed,
      entry.primitive.type
    ] as [string, 'boolean' | 'integer' | 'number' | 'string'],
    [
      entry.full,
      entry.primitive.type
    ] as [string, 'boolean' | 'integer' | 'number' | 'string']
  ];
}));

/**
 * SUPPORTED_XSD_DATATYPES — full-IRI and prefixed-form supported-type membership set.
 *
 * Used by OwlImporter.isDatatype() to recognise known XSD primitives as
 * datatype IRIs during the import pipeline.
 *
 * owl:Nothing is included for null-like type declarations.
 *
 * @remarks
 * Both prefixed and full-IRI forms of each supported type are included so
 * membership checks never need to normalise the IRI form first.
 * `owl:Nothing` (both prefixed and full) is always included for null-like declarations.
 *
 * @example
 * ```ts
 * SUPPORTED_XSD_DATATYPES.has('xsd:string');  // true
 * SUPPORTED_XSD_DATATYPES.has('xsd:ID');       // false (not supported)
 * ```
 *
 * @category Constants
 * @since 0.10.0
 * @see {@link XSD_TO_JSON_SCHEMA}
 * @group XsdReverseMaps
 * @defaultValue Derived from `ENTRIES` where `supported === true`, plus `owl:Nothing`
 */
export const SUPPORTED_XSD_DATATYPES: ReadonlySet<string> = new Set([
  // owl:Nothing for null-like types
  OWL.Nothing,
  'owl:Nothing',
  // XSD types marked supported in ENTRIES (both prefixed and full forms)
  ...ENTRIES
    .filter((entry: XsdEntryInterface): boolean => {
      return entry.supported;
    })
    .flatMap((entry: XsdEntryInterface): string[] => {
      return [
        entry.prefixed,
        entry.full
      ];
    })
]);
