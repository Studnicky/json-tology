import type { GraphEngineOptionsInterface } from '../interfaces/GraphEngine.js';

export const DRAFT_NAME = '2020-12';
export const CURRENT_DIALECT_PREFIX = 'https://json-schema.org/draft/2020-12/';
export const DEFAULT_DIALECT_URI = 'https://json-schema.org/draft/2020-12/schema';
export const VOCABULARY_CORE = 'https://json-schema.org/draft/2020-12/vocab/core';
export const VOCABULARY_APPLICATOR = 'https://json-schema.org/draft/2020-12/vocab/applicator';
export const VOCABULARY_UNEVALUATED = 'https://json-schema.org/draft/2020-12/vocab/unevaluated';
export const VOCABULARY_VALIDATION = 'https://json-schema.org/draft/2020-12/vocab/validation';
export const VOCABULARY_METADATA = 'https://json-schema.org/draft/2020-12/vocab/meta-data';
export const VOCABULARY_FORMAT_ANNOTATION = 'https://json-schema.org/draft/2020-12/vocab/format-annotation';
export const VOCABULARY_FORMAT_ASSERTION = 'https://json-schema.org/draft/2020-12/vocab/format-assertion';
export const VOCABULARY_CONTENT = 'https://json-schema.org/draft/2020-12/vocab/content';
export const SUPPORTED_VOCABULARIES = new Set([
  VOCABULARY_APPLICATOR,
  VOCABULARY_CONTENT,
  VOCABULARY_CORE,
  VOCABULARY_FORMAT_ANNOTATION,
  VOCABULARY_FORMAT_ASSERTION,
  VOCABULARY_METADATA,
  VOCABULARY_UNEVALUATED,
  VOCABULARY_VALIDATION
]);

export const DEFAULT_OPTIONS: Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>> = {
  'allowAdditionalProperties': false,
  'applyDefaults': false,
  'castTypes': false,
  'collectErrors': true,
  'enforceSchemaProperties': false,
  'materializeContainers': false,
  'removeAdditionalProperties': false,
  'synthesizeDefaults': false
};
