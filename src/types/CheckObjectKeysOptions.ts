import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type {
  ObjectPropValidatorsMapType, OptionalCheckFnType, PatternPropChecksResultType
} from '../types/Validation.js';

/** Options for `checkObjectKeys`. */
export type CheckObjectKeysOptionsType = {
  readonly 'additionalCheck': OptionalCheckFnType;
  readonly 'additionalIsFalse': boolean;
  readonly 'obj': Record<string, unknown>;
  readonly 'patternChecks': PatternPropChecksResultType;
  readonly 'properties': ReadonlyMap<string, SchemaGraphNodeType>;
  readonly 'propValidators': ObjectPropValidatorsMapType;
};
