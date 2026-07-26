// A call-signature-only shape. Declaring it as an `interface` in `src/interfaces/`
// trips `@typescript-eslint/prefer-function-type` (interface has only a call
// signature); declaring it as this `type` alias trips `folder-content-shape`
// if relocated to `src/interfaces/`, and `type-alias-invariants` here in
// `src/types/` since a function signature is a contract, not schema-derived
// data. No location or form satisfies every rule simultaneously.
export type PredicateForType = (context: { readonly 'classId': string;
  readonly 'propertyName': string }) => string | undefined;
