export const EMPTY_ERROR_LIST: string[] = Object.freeze([]) as unknown as string[];

export const CAST_OPTIONS = Object.freeze({
  'applyDefaults': true,
  'castTypes': true,
  'collectErrors': false
});
export const CLEAN_OPTIONS = Object.freeze({
  'collectErrors': false,
  'enforceSchemaProperties': true
});
export const CONVERT_OPTIONS = Object.freeze({
  'castTypes': true,
  'collectErrors': false
});
export const COLLECT_ERRORS_OPTIONS = Object.freeze({ 'collectErrors': true });
