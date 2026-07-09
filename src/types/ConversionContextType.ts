import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { IdentifierIssuerInterface } from '../interfaces/IdentifierIssuerInterface.js';

/** Shared conversion context — groups per-call mutable state for JSON-LD to quads conversion. */
export type ConversionContextType = {
  'allQuads': QuadInterface[];
  'bnodeMap': Map<Record<string, unknown>, string>;
  'context': Record<string, string>;
  'counter': IdentifierIssuerInterface;
};
