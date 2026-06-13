declare const TRANSFORM_WIRE: unique symbol;

/**
 * Phantom brand attaching a transform's raw wire type to a schema.
 *
 * A normalize transform's `decode` maps the free wire type `TWire` into the
 * schema's canonical (branded) form; `encode` maps back. The canonical output
 * is always `InferSchemaType<TSchema>` and need not be carried here — only the
 * wire type is non-derivable from the schema, so the brand records `TWire` so
 * `encode` and `dump` can recover the wire representation.
 */
export interface TransformBrandInterface<TWire> { readonly [TRANSFORM_WIRE]: TWire }
