import type { CheckFnType } from '../types/Validation.js';

/** A typed entry used in the dependent-schema check list. */
export type DepSchemaEntryType = {
  'check': CheckFnType;
  'trigger': string;
};
