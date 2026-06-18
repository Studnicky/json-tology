import type { IdentifierIssuerInterface } from '../interfaces/IdentifierIssuerInterface.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { QuadEmitBaseType } from './QuadEmitBaseType.js';

/** Arguments for emitRestriction. */
export type EmitRestrictionArgsType = QuadEmitBaseType & {
  readonly 'constraint': string;
  readonly 'constraintValue': QuadObjectType;
  readonly 'issuer'?: IdentifierIssuerInterface | undefined;
  readonly 'onProperty': string;
};
