import { Predicates } from './Predicates.js';

export function coerceCompiledValue(types: string[], value: unknown): unknown {
  return Predicates.coerceValue(types, value);
}

export function normalizeKeywordTypes(type: string | string[] | undefined): string[] | undefined {
  if (type === undefined) {
    return undefined;
  }

  return Array.isArray(type) ? type : [type];
}

