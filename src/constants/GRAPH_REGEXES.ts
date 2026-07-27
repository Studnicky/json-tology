export const ALLOF_EXTENSION_RE = /\/allOf\/\d+/u;

/**
 * Allowed absolute-IRI schemes for `x-jt-iriRef` property values.
 *
 * @remarks
 * Rejects dangerous schemes (e.g. `javascript:`, `data:`); alternatives are kept
 * alphabetically sorted.
 */
export const ALLOWED_IRI_SCHEME_RE = /^(?:file|ftp|https?|urn):/u;

/** Pattern matched by `Skolemize.wellKnownGenid` IRIs (W3C RDF 1.1 §3.5 well-known genid form). */
export const WELL_KNOWN_GENID_PATTERN = /\/\.well-known\/genid\//u;

/** Matches a string that looks like a full IRI or CURIE (scheme:, #fragment, or /path prefix). */
export const IRI_LIKE_RE = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|#|\/)/u;

/** Matches a pointer consisting purely of one or more leading `/allOf/N` segments. */
export const ALLOF_PATH_ONLY_RE = /^(?:\/allOf\/\d+)+$/u;

/** Matches the leading run of `/allOf/N` segments in a pointer, for stripping. */
export const ALLOF_PATH_PREFIX_RE = /^(?:\/allOf\/\d+)+/u;
