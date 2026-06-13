import type { CurieInterface } from './Curie.js';
import type { IdentifierIssuerInterface } from './IdentifierIssuer.js';
import type { QuadInterface } from './Quad.js';
import type { QuadObjectType } from '../types/Quad.js';

/** Arguments for emitRestriction. */
export interface EmitRestrictionArgsInterface {
  readonly 'constraint': string;
  readonly 'constraintValue': QuadObjectType;
  readonly 'curie': CurieInterface | undefined;
  readonly 'issuer'?: IdentifierIssuerInterface | undefined;
  readonly 'onProperty': string;
  readonly 'quads': QuadInterface[];
}
