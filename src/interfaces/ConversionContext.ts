import type { QuadInterface } from './Quad.js';
import type { IdentifierIssuer } from '../modules/rdf/IdentifierIssuer.js';

/** Shared conversion context — groups per-call mutable state for JSON-LD to quads conversion. */
export interface ConversionContextInterface {
  readonly 'allQuads': QuadInterface[];
  readonly 'bnodeMap': Map<Record<string, unknown>, string>;
  readonly 'context': Record<string, string>;
  readonly 'counter': IdentifierIssuer;
}
