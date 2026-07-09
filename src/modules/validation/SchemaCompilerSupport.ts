import { Predicates } from '../data/Predicates.js';

export const SchemaCompilerSupport = {
  coerceCompiledValue(types: string[], value: unknown): unknown {
    const result = Predicates.coerceValue(types, value);

    return result;
  },

  normalizeKeywordTypes(type: string | string[] | undefined): string[] | undefined {
    if (type === undefined) {
      return undefined;
    }

    return Array.isArray(type) ? type : [type];
  }
} as const;
