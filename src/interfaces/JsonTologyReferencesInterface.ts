/**
 * Consumer-augmentable global references registry.
 *
 * @remarks
 * Intentionally empty: a consumer-augmentable declaration-merge target.
 * Any member would pollute `keyof` and resolve every `$ref` prematurely.
 *
 * @category Type Inference
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentionally empty: a consumer-augmentable declaration-merge target; any member would pollute `keyof` and resolve every $ref prematurely.
export interface JsonTologyReferencesInterface {}
