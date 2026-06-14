import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type {
  ObjectPropValidatorsMapType, OptionalCheckFnType, PatternPropChecksResultType
} from '../types/Validation.js';

/** Compiled object constraint checks for `runObjectCheck`. */
export type ObjectChecksType = {
  readonly 'additionalCheck': OptionalCheckFnType;
  readonly 'additionalIsFalse': boolean;
  readonly 'maxProperties': number | undefined;
  readonly 'minProperties': number | undefined;
  readonly 'patternChecks': PatternPropChecksResultType;
  readonly 'properties': ReadonlyMap<string, SchemaGraphNodeType>;
  readonly 'propValidators': ObjectPropValidatorsMapType;
  readonly 'required': readonly string[] | undefined;
};
