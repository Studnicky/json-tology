import type { CoercionErrorCodeEntity } from '../entities/CoercionErrorCodeEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';

/** Options accepted by the {@link CoercionError} constructor. */
export interface CoercionErrorOptionsInterface extends BaseErrorOptionsInterface {
  'code': CoercionErrorCodeEntity.Type;
}
