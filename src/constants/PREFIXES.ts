import { STANDARD_PREFIXES } from './STANDARD_PREFIXES.js';
import {
  RDF, RDFS, XSD
} from './IRI.js';

/**
 * DEFAULT_PREFIXES — the prefix map used by project serializers and the Curie instance.
 *
 * Derived from STANDARD_PREFIXES (single source of truth). All namespace IRIs
 * are full IRIs. Consumers that need compact-form display call Curie.compact()
 * at presentation time; storage is always full IRI.
 */
export const DEFAULT_PREFIXES: Record<string, string> = { ...STANDARD_PREFIXES };

/** @deprecated Use STANDARD_PREFIXES.xsd directly or XSD constants from IRI.ts */
export const XSD_PREFIX = 'xsd:';
export const RDF_TYPE_IRI = RDF.type;
export const XSD_IRI_PREFIX = XSD.string.slice(0, XSD.string.lastIndexOf('#') + 1);
export const RDFS_IRI_PREFIX = RDFS.label.slice(0, RDFS.label.lastIndexOf('#') + 1);
export const RDFS_DOMAIN_IRI = RDFS.domain;
export const RDFS_RANGE_IRI = RDFS.range;
export const RDFS_SUB_CLASS_OF_IRI = RDFS.subClassOf;
