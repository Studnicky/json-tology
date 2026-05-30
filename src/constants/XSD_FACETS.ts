/**
 * XSD_FACETS — canonical bidirectional XSD facet ↔ JSON-Schema keyword table.
 *
 * Single source of truth for the correspondence between SHACL predicates,
 * XSD facet IRIs, and JSON-Schema keywords.
 *
 * Replaces the two independent tables that previously duplicated this mapping:
 *   - src/modules/rdf/OwlProjection.ts  — SHACL_TO_XSD_FACET + XSD_FACET_DATATYPE
 *   - src/modules/ontology/importDispatch/Datatypes.ts — FACET_MAP
 *
 * Both derived maps (SHACL_TO_XSD_FACET, XSD_FACET_DATATYPE, FACET_MAP) are
 * exported from this module so all three call sites import a single definition.
 */

import type { FacetDescriptorType } from '../types/FacetDescriptorType.js';
import {
  SH, XSD
} from './IRI.js';
import { STANDARD_PREFIXES } from './STANDARD_PREFIXES.js';

const XSD_NS = STANDARD_PREFIXES.xsd;

// ---------------------------------------------------------------------------
// Canonical facet table — one row per logical facet
// ---------------------------------------------------------------------------

interface FacetEntry {
  /** XSD facet IRI — full IRI form (e.g. `http://www.w3.org/2001/XMLSchema#minLength`). */
  readonly 'facetFull': string;
  /** XSD facet IRI — `xsd:` prefixed form. */
  readonly 'facetPrefixed': string;
  /** XSD datatype for the facet value literal (used by OwlProjection forward map). */
  readonly 'facetValueDatatype': string;
  /** JSON-Schema keyword descriptor (used by Datatypes.ts reverse map). */
  readonly 'jsonSchemaDescriptor': FacetDescriptorType;
  /** SHACL predicate full IRI (used by OwlProjection SHACL→XSD map; null for XSD-only facets). */
  readonly 'shaclPredicate': null | string;
}

const FACET_ENTRIES: readonly FacetEntry[] = [
  // --- numeric bounds ---
  {
    'facetFull': `${XSD_NS}maxExclusive`,
    'facetPrefixed': 'xsd:maxExclusive',
    'facetValueDatatype': XSD.decimal,
    'jsonSchemaDescriptor': {
      'key': 'exclusiveMaximum',
      'kind': 'numeric'
    },
    'shaclPredicate': SH.maxExclusive
  },
  {
    'facetFull': `${XSD_NS}maxInclusive`,
    'facetPrefixed': 'xsd:maxInclusive',
    'facetValueDatatype': XSD.decimal,
    'jsonSchemaDescriptor': {
      'key': 'maximum',
      'kind': 'numeric'
    },
    'shaclPredicate': SH.maxInclusive
  },
  {
    'facetFull': `${XSD_NS}minExclusive`,
    'facetPrefixed': 'xsd:minExclusive',
    'facetValueDatatype': XSD.decimal,
    'jsonSchemaDescriptor': {
      'key': 'exclusiveMinimum',
      'kind': 'numeric'
    },
    'shaclPredicate': SH.minExclusive
  },
  {
    'facetFull': `${XSD_NS}minInclusive`,
    'facetPrefixed': 'xsd:minInclusive',
    'facetValueDatatype': XSD.decimal,
    'jsonSchemaDescriptor': {
      'key': 'minimum',
      'kind': 'numeric'
    },
    'shaclPredicate': SH.minInclusive
  },
  // --- string length ---
  {
    'facetFull': `${XSD_NS}maxLength`,
    'facetPrefixed': 'xsd:maxLength',
    'facetValueDatatype': XSD.integer,
    'jsonSchemaDescriptor': {
      'key': 'maxLength',
      'kind': 'numeric'
    },
    'shaclPredicate': SH.maxLength
  },
  {
    'facetFull': `${XSD_NS}minLength`,
    'facetPrefixed': 'xsd:minLength',
    'facetValueDatatype': XSD.integer,
    'jsonSchemaDescriptor': {
      'key': 'minLength',
      'kind': 'numeric'
    },
    'shaclPredicate': SH.minLength
  },
  // --- pattern ---
  {
    'facetFull': `${XSD_NS}pattern`,
    'facetPrefixed': 'xsd:pattern',
    'facetValueDatatype': XSD.string,
    'jsonSchemaDescriptor': {
      'key': 'pattern',
      'kind': 'string'
    },
    'shaclPredicate': SH.pattern
  },
  // --- exact length (XSD-only; no SHACL counterpart) ---
  {
    'facetFull': `${XSD_NS}length`,
    'facetPrefixed': 'xsd:length',
    'facetValueDatatype': XSD.integer,
    'jsonSchemaDescriptor': { 'kind': 'length' },
    'shaclPredicate': null
  },
  // --- decimal facets ---
  {
    'facetFull': `${XSD_NS}fractionDigits`,
    'facetPrefixed': 'xsd:fractionDigits',
    'facetValueDatatype': XSD.integer,
    'jsonSchemaDescriptor': { 'kind': 'fractionDigits' },
    'shaclPredicate': null
  },
  {
    'facetFull': `${XSD_NS}totalDigits`,
    'facetPrefixed': 'xsd:totalDigits',
    'facetValueDatatype': XSD.integer,
    'jsonSchemaDescriptor': {
      'kind': 'unsupported',
      'predicate': 'xsd:totalDigits'
    },
    'shaclPredicate': null
  },
  // --- whitespace (no JSON Schema correlate; silently ignored) ---
  {
    'facetFull': `${XSD_NS}whiteSpace`,
    'facetPrefixed': 'xsd:whiteSpace',
    'facetValueDatatype': XSD.string,
    'jsonSchemaDescriptor': { 'kind': 'ignore' },
    'shaclPredicate': null
  }
];

// ---------------------------------------------------------------------------
// Derived maps
// ---------------------------------------------------------------------------

/**
 * SHACL_TO_XSD_FACET — SHACL predicate (full IRI) → XSD facet prefixed name.
 *
 * Used by OwlProjection.emitDatatypeQuads to convert SHACL constraint
 * predicates to XSD facet IRIs when emitting owl:withRestrictions lists.
 */
export const SHACL_TO_XSD_FACET: ReadonlyMap<string, string> = new Map(FACET_ENTRIES
  .filter((entry) => {
    return entry.shaclPredicate !== null;
  })
  .map((entry) => {
    return [
      entry.shaclPredicate as string,
      entry.facetPrefixed
    ];
  }));

/**
 * XSD_FACET_DATATYPE — XSD facet prefixed name → XSD datatype IRI for the facet value literal.
 *
 * Used by OwlProjection.emitDatatypeQuads to type the facet value literals correctly.
 */
export const XSD_FACET_DATATYPE: ReadonlyMap<string, string> = new Map(FACET_ENTRIES.map((entry) => {
  return [
    entry.facetPrefixed,
    entry.facetValueDatatype
  ];
}));

/**
 * FACET_MAP — XSD facet IRI (full and prefixed) → FacetDescriptorType.
 *
 * Used by Datatypes.ts importDispatch to convert XSD facet predicates read
 * from owl:withRestrictions blank nodes into JSON Schema keyword patches.
 */
export const FACET_MAP: ReadonlyMap<string, FacetDescriptorType> = new Map(FACET_ENTRIES.flatMap((entry) => {
  return [
    [
      entry.facetPrefixed,
      entry.jsonSchemaDescriptor
    ] as [string, FacetDescriptorType],
    [
      entry.facetFull,
      entry.jsonSchemaDescriptor
    ] as [string, FacetDescriptorType]
  ];
}));
