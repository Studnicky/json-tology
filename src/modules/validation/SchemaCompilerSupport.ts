import { Predicates } from './Predicates.js';

export const SchemaCompilerSupport = {
  coerceCompiledValue(types: string[], value: unknown): unknown {
    return Predicates.coerceValue(types, value);
  },

  normalizeKeywordTypes(type: string | string[] | undefined): string[] | undefined {
    if (type === undefined) {
      return undefined;
    }

    return Array.isArray(type) ? type : [type];
  }
} as const;
