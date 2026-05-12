import {
  CURRENT_DIALECT_PREFIX,
  DEFAULT_DIALECT_URI,

  SUPPORTED_VOCABULARIES,
  VOCABULARY_FORMAT_ASSERTION
} from '../../constants/DIALECT.js';
import { GraphError } from '../../errors/GraphError.js';
import { isRecord } from '../data/DataTypes.js';

import type { JSONSchema7Definition } from 'json-schema';
import type { RootDialectPlanInterface } from '../../interfaces/RootDialectPlan.js';

export const GraphEngineSupport = {
  buildRootDialectPlan(rootSchema: JSONSchema7Definition): RootDialectPlanInterface {
    if (!isRecord(rootSchema)) {
      return { 'formatAssertions': true };
    }

    const schemaUri = typeof rootSchema.$schema === 'string' ? rootSchema.$schema : undefined;

    if (schemaUri !== undefined && !schemaUri.startsWith(CURRENT_DIALECT_PREFIX)) {
      throw new GraphError('DIALECT_UNSUPPORTED', `Unsupported JSON Schema dialect: ${schemaUri}`);
    }

    const rawVocabulary = isRecord(rootSchema.$vocabulary)
      ? rootSchema.$vocabulary
      : undefined;
    let formatAssertions = schemaUri === undefined;

    if (rawVocabulary !== undefined) {
      for (const [
        uri,
        enabled
      ] of Object.entries(rawVocabulary)) {
        if (enabled === true && !SUPPORTED_VOCABULARIES.has(uri)) {
          throw new GraphError('VOCABULARY_UNSUPPORTED', `Unsupported required JSON Schema vocabulary: ${uri}`);
        }
      }

      if (typeof rawVocabulary[VOCABULARY_FORMAT_ASSERTION] === 'boolean') {
        formatAssertions = rawVocabulary[VOCABULARY_FORMAT_ASSERTION];
      }
    } else if (schemaUri === DEFAULT_DIALECT_URI) {
      formatAssertions = false;
    }

    return { 'formatAssertions': formatAssertions };
  },

  cloneCandidate<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'object') {
      return structuredClone(value);
    }

    return value;
  },

  cloneDefault<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    return structuredClone(value);
  },

  extractNamedFragment(ref: string): string | undefined {
    if (!ref.includes('#')) {
      return undefined;
    }

    const fragment = ref.slice(ref.indexOf('#') + 1);

    if (fragment === '' || fragment.startsWith('/')) {
      return undefined;
    }

    return fragment;
  },

  parseRef(ref: string): {
    'fragment': string;
    'id': string;
  } {
    const hashIndex = ref.indexOf('#');
    const id = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

    return {
      fragment,
      id
    };
  },

  schemaId(schema: JSONSchema7Definition): string | undefined {
    if (!isRecord(schema)) {
      return undefined;
    }

    return typeof schema.$id === 'string' ? schema.$id : undefined;
  }
} as const;
