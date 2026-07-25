import type { IdentifierIssuerInterface } from '../interfaces/IdentifierIssuerInterface.js';
import type { QuadObjectType } from '../types/Quad.js';
import type { QuadEmitBaseType } from './QuadEmitBaseType.js';

/** Arguments for emitRestriction. */
export type EmitRestrictionArgumentListType = QuadEmitBaseType & {
  'constraint': string;
  'constraintValue': QuadObjectType;
  'issuer'?: IdentifierIssuerInterface | undefined;
  'onProperty': string;
};
