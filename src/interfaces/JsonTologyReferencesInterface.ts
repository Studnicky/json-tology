/**
 * Consumer-augmentable global references registry.
 *
 * @remarks
 * Intentionally empty: a consumer-augmentable declaration-merge target.
 * Any member would pollute `keyof` and resolve every `$ref` prematurely.
 *
 * @category Type Inference
 */
export interface JsonTologyReferencesInterface {}
