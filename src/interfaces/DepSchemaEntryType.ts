import type { CheckFnType } from '../types/Validation.js';

/** A typed entry used in the dependent-schema check list. */
export interface DepSchemaEntryType {
  'check': CheckFnType;
  'trigger': string;
}
