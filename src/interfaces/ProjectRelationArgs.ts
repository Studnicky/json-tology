import type { CurieInterface } from './Curie.js';
import type { IdentifierIssuerInterface } from './IdentifierIssuer.js';
import type { QuadInterface } from './Quad.js';
import type { SchemaGraphRelationInterface } from './SchemaGraph.js';

/** Arguments for the projectRelation function. */
export interface ProjectRelationArgsInterface {
  readonly 'curie': CurieInterface | undefined;
  readonly 'issuer': IdentifierIssuerInterface;
  readonly 'quads': QuadInterface[];
  readonly 'relation': SchemaGraphRelationInterface;
}
