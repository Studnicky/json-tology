/**
 * Supported content encoding and media type identifiers for runtime content validation.
 *
 * These sets define which `contentEncoding` and `contentMediaType` values the
 * engine validates at runtime. Encodings or media types outside these sets are
 * treated as unconstrained (validation passes) per the JSON Schema specification,
 * which permits leniency for unknown values.
 *
 * Both the interpreter ({@link GraphEngine} / {@link GraphEngineScalars}) and the
 * compiler ({@link SchemaCompiler} / `exec/Scalars`) reference these sets so that
 * supported-set membership is determined from a single source of truth.
 *
 * @remarks
 * `contentEncoding` values map to RFC 4648 / RFC 2045 encoding names.
 * `contentMediaType` values are IANA media type strings.
 *
 * @category Constants
 * @since 0.22.0
 * @group Constants
 */

/**
 * Set of `contentEncoding` values the engine validates at runtime.
 *
 * Encodings in this set are actively checked: the raw string must decode
 * without error under the named encoding. Encodings outside this set pass
 * unconditionally.
 *
 * @remarks
 * - `base64` — standard Base64 alphabet (RFC 4648 §4), padding required.
 * - `base64url` — URL-safe Base64 alphabet (RFC 4648 §5), no padding required.
 *
 * @category Constants
 * @since 0.22.0
 * @group Constants
 */
export const SUPPORTED_CONTENT_ENCODINGS: ReadonlySet<string> = new Set([
  'base64',
  'base64url'
]);

/**
 * Set of `contentMediaType` values the engine validates at runtime.
 *
 * Media types in this set are actively checked: the content (after optional
 * `contentEncoding` decode) must be parseable as the named media type. Media
 * types outside this set pass unconditionally.
 *
 * @remarks
 * - `application/json` — the decoded content must be valid JSON (`JSON.parse`).
 *
 * @category Constants
 * @since 0.22.0
 * @group Constants
 */
export const SUPPORTED_CONTENT_MEDIA_TYPES: ReadonlySet<string> = new Set(['application/json']);
