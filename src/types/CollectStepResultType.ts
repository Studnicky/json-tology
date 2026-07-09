import type {
  BlankNode, NamedNode
} from '@rdfjs/types';
import type { OptionalListObjectType } from '../types/OptionalListObjectType.js';

/** Result of a single collect() traversal step over an RDF list. */
export type CollectStepResultType = {
  'done': boolean;
  'item': OptionalListObjectType;
  'next': BlankNode | NamedNode | undefined;
};
