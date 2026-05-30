export type PredicateForType = (ctx: { readonly 'classId': string;
  readonly 'propertyName': string }) => string | undefined;
