import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type {
  ObjectPropValidatorsMapType, OptionalCheckFnType, PatternPropChecksResultType
} from '../types/Validation.js';

/** Compiled object constraint checks for `runObjectCheck`. */
export interface ObjectChecksInterface {
  readonly 'additionalCheck': OptionalCheckFnType;
  readonly 'additionalIsFalse': boolean;
  readonly 'maxProperties': number | undefined;
  readonly 'minProperties': number | undefined;
  readonly 'patternChecks': PatternPropChecksResultType;
  readonly 'properties': ReadonlyMap<string, SchemaGraphNodeInterface>;
  readonly 'propValidators': ObjectPropValidatorsMapType;
  readonly 'required': readonly string[] | undefined;
}
