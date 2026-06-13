/**
 * Global schema references registry — the ambient `{ [$id]: schema }` map that
 * standalone `$ref` resolution defaults to.
 *
 * This is the auto-magic layer over cross-schema `$ref` resolution. A bare IRI
 * string in a `$ref` cannot, on its own, reach a schema declared in another
 * file — TypeScript has no ambient registry. This interface IS that registry:
 * consumers augment it once (declaration merging) to register their schemas by
 * `$id`, and every standalone `InferType<typeof Schema>` /
 * `CanonicalShapeType<typeof Schema>` then resolves cross-schema `$ref`s with
 * no references map passed by hand.
 *
 * Empty by default: with no augmentation `keyof` is `never`, so resolution is
 * identical to passing no references — an unreachable `$ref` is a
 * `RefNotFoundInterface` brand, never a silent `unknown`. Augmentation only
 * ADDS `$id` keys, so it merges cleanly with no conflicting declarations (unlike
 * {@link JsonTologyTypeConfigInterface}, which carries an index signature
 * because its flags are overridden rather than added).
 *
 * @example Register schemas so standalone resolution is automatic (in any
 * `.d.ts` on the include path, or any module):
 * ```ts
 * export {};
 * declare module 'json-tology/types' {
 *   interface JsonTologyReferencesInterface {
 *     'urn:slack:Channel': typeof ChannelSchema;
 *     'urn:slack:ChatMessage': typeof ChatMessageSchema;
 *   }
 * }
 *
 * // Now resolves with zero ceremony — channel/sender are their schema shapes:
 * type ChatMessage = CanonicalShapeType<typeof ChatMessageSchema>;
 * ```
 *
 * For precise, per-registry resolution without a global namespace, use the
 * registry-derived helpers (`RegisteredCanonicalType<typeof jt, '$id'>`)
 * instead — they read the references map straight off a `JsonTology` instance
 * type.
 *
 * @category Type Inference
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentionally empty: a consumer-augmentable declaration-merge target; any member would pollute `keyof` and resolve every $ref prematurely.
export interface JsonTologyReferencesInterface {}
