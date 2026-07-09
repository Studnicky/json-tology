import type { FacetDescriptorType } from '../types/FacetDescriptorType.js';

/**
 * One row in the canonical XSD facet table.
 *
 * @remarks
 * Used internally by {@link FACET_ENTRIES} in `XSD_FACETS.ts`. Consumers
 * should use the derived maps ({@link SHACL_TO_XSD_FACET}, {@link XSD_FACET_DATATYPE},
 * {@link FACET_MAP}) rather than iterating the raw entries.
 *
 * @internal
 */
export type FacetEntryType = {
  /** XSD facet IRI — full IRI form (e.g. `http://www.w3.org/2001/XMLSchema#minLength`). */
  'facetFull': string;
  /** XSD facet IRI — `xsd:` prefixed form. */
  'facetPrefixed': string;
  /** XSD datatype for the facet value literal (used by OwlProjection forward map). */
  'facetValueDatatype': string;
  /** JSON-Schema keyword descriptor (used by Datatypes.ts reverse map). */
  'jsonSchemaDescriptor': FacetDescriptorType;
  /** SHACL predicate full IRI (used by OwlProjection SHACL→XSD map; null for XSD-only facets). */
  'shaclPredicate': null | string;
};
