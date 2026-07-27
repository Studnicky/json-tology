import type { InstantiationErrorCodeEntity } from '../entities/InstantiationErrorCodeEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';

/** Options accepted by the {@link InstantiationError} constructor. */
export interface InstantiationErrorOptionsInterface extends BaseErrorOptionsInterface {
  'code': InstantiationErrorCodeEntity.Type;
  'message'?: StringValueEntity.Type;
}
