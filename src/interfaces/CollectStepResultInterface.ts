import type {
  BlankNode, NamedNode
} from '@rdfjs/types';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { QuadObjectType } from '../types/Quad.js';

/** Result of a single collect() traversal step over an RDF list. */
export interface CollectStepResultInterface {
  'done': BooleanValueEntity.Type;
  'item': QuadObjectType | undefined;
  'next': BlankNode | NamedNode | undefined;
}
