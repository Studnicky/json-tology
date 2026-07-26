import type { OwlImportErrorCodeEntity } from '../entities/OwlImportErrorCodeEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { BaseErrorOptionsInterface } from './BaseErrorOptionsInterface.js';

/** Options accepted by the {@link OwlImportError} constructor. */
export interface OwlImportErrorOptionsInterface extends BaseErrorOptionsInterface {
  'axiomIri': StringValueEntity.Type;
  'code': OwlImportErrorCodeEntity.Type;
  'subjectIri': null | StringValueEntity.Type;
}
