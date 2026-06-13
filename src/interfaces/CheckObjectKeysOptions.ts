import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type {
  ObjectPropValidatorsMapType, OptionalCheckFnType, PatternPropChecksResultType
} from '../types/Validation.js';

/** Options for `checkObjectKeys`. */
export interface CheckObjectKeysOptionsInterface {
  readonly 'additionalCheck': OptionalCheckFnType;
  readonly 'additionalIsFalse': boolean;
  readonly 'obj': Record<string, unknown>;
  readonly 'patternChecks': PatternPropChecksResultType;
  readonly 'properties': ReadonlyMap<string, SchemaGraphNodeInterface>;
  readonly 'propValidators': ObjectPropValidatorsMapType;
}
