import type { CurieInterface } from '../interfaces/Curie.js';
import type { IdentifierIssuerInterface } from '../interfaces/IdentifierIssuer.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { SchemaGraphRelationInterface } from '../interfaces/SchemaGraph.js';

export type SpecialHandlerFn = (
  subject: string,
  predicate: string,
  targetId: string,
  relation: SchemaGraphRelationInterface,
  quads: QuadInterface[],
  curie: CurieInterface | undefined,
  issuer: IdentifierIssuerInterface
) => void;
