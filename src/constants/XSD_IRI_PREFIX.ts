/**
 * Canonical XSD namespace IRI prefix.
 *
 * Single derived constant — import this instead of re-deriving `STANDARD_PREFIXES.xsd` locally.
 */
import { STANDARD_PREFIXES } from './STANDARD_PREFIXES.js';

const xsdPrefix = STANDARD_PREFIXES.xsd;

if (xsdPrefix === undefined) {
  throw new Error('STANDARD_PREFIXES.xsd is not defined');
}

export const XSD_IRI_PREFIX: string = xsdPrefix;
