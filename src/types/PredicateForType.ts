export type PredicateForType = (context: { readonly 'classId': string;
  readonly 'propertyName': string }) => string | undefined;
