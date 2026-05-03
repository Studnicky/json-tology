export type JtExtraType = 'allow' | 'forbid' | 'ignore';

export interface JtConfigType {
  'extra'?: JtExtraType;
  'frozen'?: boolean;
  'strict'?: boolean;
}
