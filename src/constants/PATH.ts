export const VALID_IDENTIFIER = /^[a-zA-Z_$][\w$]*$/u;
export const NUMERIC_SEGMENT = /^\d+$/u;

/** Matches a single trailing slash at the end of a path or URL pathname. */
export const TRAILING_SLASH = /\/$/u;

/** Matches any run of non-word characters, for stripping into a slug-safe token. */
export const NON_WORD_CHARS = /\W/gu;

/** Matches a string composed entirely of digits and dots (a bare version/numeric path segment). */
export const NUMERIC_DOTTED_SEGMENT = /^\d[\d.]*$/u;

/** Matches any character not safe for a filesystem-safe basename (not word char or hyphen). */
export const UNSAFE_FILENAME_CHARS = /[^\w-]/gu;

/** Matches any run of non-alphanumeric-ASCII characters, for deriving a safe identifier from a filename. */
export const NON_ALPHANUMERIC_ASCII = /[^a-zA-Z0-9]+/gu;

/** Matches any run of non-word characters, for collapsing into a single word-boundary separator. */
export const NON_WORD_RUN = /\W+/gu;

/** Matches any run of whitespace characters, for splitting into individual words. */
export const WHITESPACE_RUN = /\s+/u;
