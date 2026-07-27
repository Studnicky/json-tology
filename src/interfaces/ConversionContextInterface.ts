import type { QuadInterface } from './QuadInterface.js';
import type { IdentifierIssuerInterface } from './IdentifierIssuerInterface.js';

/** Shared conversion context — groups per-call mutable state for JSON-LD to quads conversion. */
export interface ConversionContextInterface {
  'allQuads': QuadInterface[];
  'bnodeMap': Map<Record<string, unknown>, string>;
  'context': Record<string, string>;
  'counter': IdentifierIssuerInterface;
}
