import type { CheckFnType } from '../types/Validation.js';

export type PropCheckType = {
  readonly 'check': CheckFnType;
  readonly 'name': string;
  readonly 'required': boolean;
};
