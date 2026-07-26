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
 * All three derived maps (`SHACL_TO_XSD_FACET`, `XSD_FACET_DATATYPE`,
 * `FACET_MAP`) are grouped under the single `XSD_FACETS` export so all call
 * sites import one definition.
 *
 * @example
 * ```ts
 * XSD_FACETS.SHACL_TO_XSD_FACET.get('http://www.w3.org/ns/shacl#maxInclusive'); // 'xsd:maxInclusive'
 * XSD_FACETS.XSD_FACET_DATATYPE.get('xsd:maxInclusive'); // 'http://www.w3.org/2001/XMLSchema#decimal'
 * XSD_FACETS.FACET_MAP.get('xsd:minLength'); // { key: 'minLength', kind: 'numeric' }
 * ```
 *
 * @category Constants
 * @since 0.10.0
 * @group XsdFacets
 */

import type { FacetDescriptorType } from '../types/FacetDescriptorType.js';
import {
  SH, XSD
} from './IRI.js';
import { STANDARD_PREFIXES } from './STANDARD_PREFIXES.js';
import type { FacetEntryType } from '../types/FacetEntryType.js';

export const XSD_FACETS: {
  'FACET_MAP': ReadonlyMap<string, FacetDescriptorType>;
  'SHACL_TO_XSD_FACET': ReadonlyMap<string, string>;
  'XSD_FACET_DATATYPE': ReadonlyMap<string, string>;
} = (() => {
  const xsdNamespace = STANDARD_PREFIXES.xsd;

  // ---------------------------------------------------------------------------
  // Canonical facet table — one row per logical facet
  // ---------------------------------------------------------------------------
  const facetEntries: readonly FacetEntryType[] = [
    // --- numeric bounds ---
    {
      'facetFull': `${xsdNamespace}maxExclusive`,
      'facetPrefixed': 'xsd:maxExclusive',
      'facetValueDatatype': XSD.decimal,
      'jsonSchemaDescriptor': {
        'key': 'exclusiveMaximum',
        'kind': 'numeric'
      },
      'shaclPredicate': SH.maxExclusive
    },
    {
      'facetFull': `${xsdNamespace}maxInclusive`,
      'facetPrefixed': 'xsd:maxInclusive',
      'facetValueDatatype': XSD.decimal,
      'jsonSchemaDescriptor': {
        'key': 'maximum',
        'kind': 'numeric'
      },
      'shaclPredicate': SH.maxInclusive
    },
    {
      'facetFull': `${xsdNamespace}minExclusive`,
      'facetPrefixed': 'xsd:minExclusive',
      'facetValueDatatype': XSD.decimal,
      'jsonSchemaDescriptor': {
        'key': 'exclusiveMinimum',
        'kind': 'numeric'
      },
      'shaclPredicate': SH.minExclusive
    },
    {
      'facetFull': `${xsdNamespace}minInclusive`,
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
      'facetFull': `${xsdNamespace}maxLength`,
      'facetPrefixed': 'xsd:maxLength',
      'facetValueDatatype': XSD.integer,
      'jsonSchemaDescriptor': {
        'key': 'maxLength',
        'kind': 'numeric'
      },
      'shaclPredicate': SH.maxLength
    },
    {
      'facetFull': `${xsdNamespace}minLength`,
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
      'facetFull': `${xsdNamespace}pattern`,
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
      'facetFull': `${xsdNamespace}length`,
      'facetPrefixed': 'xsd:length',
      'facetValueDatatype': XSD.integer,
      'jsonSchemaDescriptor': { 'kind': 'length' },
      'shaclPredicate': null
    },
    // --- decimal facets ---
    {
      'facetFull': `${xsdNamespace}fractionDigits`,
      'facetPrefixed': 'xsd:fractionDigits',
      'facetValueDatatype': XSD.integer,
      'jsonSchemaDescriptor': { 'kind': 'fractionDigits' },
      'shaclPredicate': null
    },
    {
      'facetFull': `${xsdNamespace}totalDigits`,
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
      'facetFull': `${xsdNamespace}whiteSpace`,
      'facetPrefixed': 'xsd:whiteSpace',
      'facetValueDatatype': XSD.string,
      'jsonSchemaDescriptor': { 'kind': 'ignore' },
      'shaclPredicate': null
    }
  ];

  // ---------------------------------------------------------------------------
  // Derived maps
  // ---------------------------------------------------------------------------

  // SHACL predicate (full IRI) → XSD facet prefixed name. Only facets with a
  // corresponding SHACL predicate appear; purely XSD-only facets (e.g.
  // `xsd:length`, `xsd:fractionDigits`) are excluded.
  const shaclToXsdFacet: ReadonlyMap<string, string> = new Map(facetEntries
    .reduce((accumulator: Array<[string, string]>, entry: FacetEntryType): Array<[string, string]> => {
      if (entry.shaclPredicate !== null) {
        accumulator.push([
          entry.shaclPredicate,
          entry.facetPrefixed
        ]);
      }

      return accumulator;
    }, []));

  // XSD facet prefixed name → XSD datatype IRI for the facet value literal.
  // Numeric facets map to `xsd:decimal` or `xsd:integer`; pattern and
  // whitespace facets map to `xsd:string`.
  const xsdFacetDatatype: ReadonlyMap<string, string> = new Map(facetEntries.map((entry: FacetEntryType): [string, string] => {
    return [
      entry.facetPrefixed,
      entry.facetValueDatatype
    ];
  }));

  // XSD facet IRI (full and prefixed) → FacetDescriptorType. Both the
  // prefixed (`xsd:minLength`) and full-IRI forms are included so callers
  // never need to normalise before lookup.
  const facetMap: ReadonlyMap<string, FacetDescriptorType> = new Map(facetEntries.flatMap((entry: FacetEntryType): Array<[string, FacetDescriptorType]> => {
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

  return {
    'FACET_MAP': facetMap,
    'SHACL_TO_XSD_FACET': shaclToXsdFacet,
    'XSD_FACET_DATATYPE': xsdFacetDatatype
  };
})();
