import type { TransformDirectionEntity } from '../entities/TransformDirectionEntity.js';
import type { TransformErrorCodeEntity } from '../entities/TransformErrorCodeEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';

/** Options accepted by the {@link TransformError} constructor. */
export interface TransformErrorOptionsInterface extends BaseErrorOptionsInterface {
  'code': TransformErrorCodeEntity.Type;
  'direction': TransformDirectionEntity.Type;
  'path'?: StringValueEntity.Type;
  'schemaId'?: StringValueEntity.Type;
}
