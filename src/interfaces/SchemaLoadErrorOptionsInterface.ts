import type { SchemaLoadErrorCodeEntity } from '../entities/SchemaLoadErrorCodeEntity.js';
import type { SchemaLoadReasonEntity } from '../entities/SchemaLoadReasonEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';
import type { FileValueEntity } from '../entities/FileValueEntity.js';
import type { StatusCodeValueEntity } from '../entities/StatusCodeValueEntity.js';

/** Options accepted by the {@link SchemaLoadError} constructor. */
export interface SchemaLoadErrorOptionsInterface extends BaseErrorOptionsInterface {
  'code': SchemaLoadErrorCodeEntity.Type;
  'file': FileValueEntity.Type;
  'reason': SchemaLoadReasonEntity.Type;
  'status'?: StatusCodeValueEntity.Type;
}
