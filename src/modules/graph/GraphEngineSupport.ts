import {
  CURRENT_DIALECT_PREFIX,
  SUPPORTED_VOCABULARIES,
  VOCABULARY_FORMAT_ASSERTION
} from '../../constants/DIALECT.js';
import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';
import { isRecord } from '../data/DataTypes.js';
import { SchemaIri } from './SchemaIri.js';

import type { JsonSchemaDocumentType } from '../../types/Schema.js';
import type { RootDialectPlanType } from '../../types/RootDialectPlan.js';

export const GraphEngineSupport = {
  buildRootDialectPlan(rootSchema: JsonSchemaDocumentType): RootDialectPlanType {
    if (!isRecord(rootSchema)) {
      return {
        'contentAssertions': true,
        'formatAssertions': true
      };
    }

    const schemaUri = typeof rootSchema.$schema === 'string' ? rootSchema.$schema : undefined;

    if (schemaUri !== undefined && !schemaUri.startsWith(CURRENT_DIALECT_PREFIX)) {
      throw new GraphError(`Unsupported JSON Schema dialect: ${schemaUri}`, { 'code': GraphErrorCode.DIALECT_UNSUPPORTED });
    }

    const rawVocabulary = isRecord(rootSchema.$vocabulary)
      ? rootSchema.$vocabulary
      : undefined;

    // Default: both format and content assertions are ON (strict-by-default).
    // Opt-out: $vocabulary with format-assertion: false disables format checking.
    // Content assertions follow the same opt-out vocabulary key.
    let formatAssertions = true;
    let contentAssertions = true;

    if (rawVocabulary !== undefined) {
      for (const [
        uri,
        enabled
      ] of Object.entries(rawVocabulary)) {
        if (enabled && !SUPPORTED_VOCABULARIES.has(uri)) {
          throw new GraphError(`Unsupported required JSON Schema vocabulary: ${uri}`, { 'code': GraphErrorCode.VOCABULARY_UNSUPPORTED });
        }
      }

      const formatAssertionValue = rawVocabulary[VOCABULARY_FORMAT_ASSERTION];

      if (typeof formatAssertionValue === 'boolean') {
        formatAssertions = formatAssertionValue;
        contentAssertions = formatAssertionValue;
      }
    }

    return {
      contentAssertions,
      formatAssertions
    };
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
    // splitSubject returns fragment: null when no '#' is present.
    const { fragment } = SchemaIri.splitSubject(ref);

    if (fragment === null || fragment === '' || fragment.startsWith('/')) {
      return undefined;
    }

    return fragment;
  },

  schemaId(schema: JsonSchemaDocumentType): string | undefined {
    if (!isRecord(schema)) {
      return undefined;
    }

    return typeof schema.$id === 'string' ? schema.$id : undefined;
  }
} as const;
