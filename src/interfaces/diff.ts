/** Set or add a value at a path. */
export interface SetOp { readonly 'op': 'set';
  readonly 'path': string;
  readonly 'value': unknown }
/** Delete a key at a path. */
export interface DelOp { readonly 'op': 'delete';
  readonly 'path': string }
