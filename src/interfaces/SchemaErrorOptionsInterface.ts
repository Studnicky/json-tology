import type { SchemaErrorCodeEntity } from '../entities/SchemaErrorCodeEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';

/** Options accepted by the {@link SchemaError} constructor. */
export interface SchemaErrorOptionsInterface extends BaseErrorOptionsInterface {
  'code': SchemaErrorCodeEntity.Type;
  'schemaId'?: StringValueEntity.Type;
}
