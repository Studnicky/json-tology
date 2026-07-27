import type {
  BlankNode, NamedNode, Quad
} from '@rdfjs/types';

/** Result of building an RDF list — the head node and the constituent triples. */
export interface ListBuildResultInterface {
  'head': BlankNode | NamedNode;
  'triples': Quad[];
}
