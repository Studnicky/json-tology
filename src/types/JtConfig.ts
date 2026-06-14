export type JtExtraType = 'allow' | 'forbid' | 'ignore';

export type JtConfigType = {
  'extra'?: JtExtraType;
  'frozen'?: boolean;
  'strict'?: boolean;
};
