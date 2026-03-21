import type { SchemaGraphNodeInterface } from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import type { ValidationErrorType } from '../../types/validation.js';
import {
  CURRENT_DIALECT_PREFIX,
  DEFAULT_DIALECT_URI,

  SUPPORTED_VOCABULARIES,
  VOCABULARY_FORMAT_ASSERTION
} from '../../constants/dialect.js';
import { GraphError } from '../../errors/GraphError.js';
import { isRecord } from '../data/DataTypes.js';

import type { JSONSchema7Definition } from 'json-schema';


export interface DynamicScopeEntryInterface {
  'anchor': string;
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}

export interface InternalExecutionResultInterface {
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number>;
  'evaluatedProperties': Set<string>;
  'valid': boolean;
  'value': unknown;
}

export interface RefTargetInterface {
  'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface;
}

export interface RootDialectPlanInterface {
  'formatAssertions': boolean;
}

export function buildRootDialectPlan(rootSchema: JSONSchema7Definition): RootDialectPlanInterface {
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
}

export function cloneCandidate<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'object') {
    return structuredClone(value);
  }

  return value;
}

export function cloneDefault<T>(value: T): T {
  return structuredClone(value);
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left !== typeof right) {
    return false;
  }
  if (typeof left !== 'object' || left === null || right === null) {
    return Number.isNaN(left) && Number.isNaN(right);
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((entry, index) => {
      return deepEqual(entry, right[index]);
    });
  }

  const leftKeys = Object.keys(left as Record<string, unknown>).sort();
  const rightKeys = Object.keys(right as Record<string, unknown>).sort();

  if (!deepEqual(leftKeys, rightKeys)) {
    return false;
  }

  return leftKeys.every((key) => {
    return deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]);
  });
}

export function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function extractNamedFragment(ref: string): string | undefined {
  if (!ref.includes('#')) {
    return undefined;
  }

  const fragment = ref.slice(ref.indexOf('#') + 1);

  if (fragment === '' || fragment.startsWith('/')) {
    return undefined;
  }

  return fragment;
}

export function inferValueType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

export function isIntegerValue(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value);
}

export function schemaId(schema: JSONSchema7Definition): string | undefined {
  if (!isRecord(schema)) {
    return undefined;
  }

  return typeof schema.$id === 'string' ? schema.$id : undefined;
}
