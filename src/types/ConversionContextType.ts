import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { IdentifierIssuerInterface } from '../interfaces/IdentifierIssuerInterface.js';

/** Shared conversion context — groups per-call mutable state for JSON-LD to quads conversion. */
export type ConversionContextType = {
  readonly 'allQuads': QuadInterface[];
  readonly 'bnodeMap': Map<Record<string, unknown>, string>;
  readonly 'context': Record<string, string>;
  readonly 'counter': IdentifierIssuerInterface;
};
