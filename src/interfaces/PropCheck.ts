import type { CheckFnType } from '../types/Validation.js';

export interface PropCheckInterface {
  readonly 'check': CheckFnType;
  readonly 'name': string;
  readonly 'required': boolean;
}
