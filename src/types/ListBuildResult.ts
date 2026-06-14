import type { Quad } from '@rdfjs/types';
import type {
  BnodeTermType, IriTermType
} from '../types/Quad.js';

/** Result of building an RDF list — the head node and the constituent triples. */
export type ListBuildResultType = {
  readonly 'head': BnodeTermType | IriTermType;
  readonly 'triples': Quad[];
};
