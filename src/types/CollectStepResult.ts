import type {
  BnodeTermType, IriTermType
} from '../types/Quad.js';
import type { OptionalListObjectType } from '../types/OptionalListObjectType.js';

/** Result of a single collect() traversal step over an RDF list. */
export type CollectStepResultType = {
  readonly 'done': boolean;
  readonly 'item': OptionalListObjectType;
  readonly 'next': BnodeTermType | IriTermType | undefined;
};
