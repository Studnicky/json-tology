/** BCP-47 language tag pattern: one or more subtags of 1–8 ASCII chars, hyphen-separated. */
export const BCP47_TAG_RE = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/u;

/** Error message prefix for invalid BCP-47 language tags. */
export const BCP47_INVALID_TAG_PREFIX = 'x-jt-language value is not a valid BCP-47 language tag: ';
