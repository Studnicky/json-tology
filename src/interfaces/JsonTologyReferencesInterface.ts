/**
 * Consumer-augmentable global references registry.
 *
 * @remarks
 * A consumer-augmentable declaration-merge target: consumers add entries by
 * merging in their own `'<schema $id>': SomeInferredType` members. The only
 * member declared here is `jsonTologyBrand`, a `unique symbol`-typed brand —
 * it gives the interface real nominal signal without adding a real data key,
 * so it can never collide with a consumer's `$id`-keyed entry or cause an
 * unrelated `$ref` to resolve: `TReference extends keyof TReferences` checks
 * one exact literal string against the key union, and one extra named brand
 * key changes nothing about that check for any other string.
 *
 * @category Type Inference
 */
export interface JsonTologyReferencesInterface {
  readonly 'jsonTologyBrand'?: unique symbol;
}
