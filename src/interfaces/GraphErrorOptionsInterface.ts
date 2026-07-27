import type { GraphErrorCodeEntity } from '../entities/GraphErrorCodeEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';

/** Options accepted by the {@link GraphError} constructor. */
export interface GraphErrorOptionsInterface extends BaseErrorOptionsInterface {
  'code': GraphErrorCodeEntity.Type;
  'pointer'?: StringValueEntity.Type;
}
