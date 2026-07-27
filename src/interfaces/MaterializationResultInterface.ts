import type { QuadInterface } from './QuadInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { StringArrayEntity } from '../entities/StringArrayEntity.js';

/** Outcome of a single `Materializer.execute` call: coerced value plus validation/ABox artifacts. */
export interface MaterializationResultInterface {
  'abox': QuadInterface[];
  'errors': StringArrayEntity.Type;
  'valid': BooleanValueEntity.Type;
  'value': unknown;
}
