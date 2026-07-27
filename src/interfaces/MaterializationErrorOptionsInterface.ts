import type { MaterializationErrorCodeEntity } from '../entities/MaterializationErrorCodeEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { StringArrayEntity } from '../entities/StringArrayEntity.js';

/** Options accepted by the {@link MaterializationError} constructor. */
export interface MaterializationErrorOptionsInterface extends BaseErrorOptionsInterface {
  'code': MaterializationErrorCodeEntity.Type;
  'message'?: StringValueEntity.Type;
  'validationErrors': StringArrayEntity.Type;
}
