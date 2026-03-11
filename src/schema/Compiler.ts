/**
 * Compiler
 *
 * Thin wrapper over the single graph engine. This preserves the existing
 * public API without introducing a second validation implementation.
 */

import type { ValidationError } from '../interfaces/validation.js';
import { GraphEngine } from './GraphEngine.js';

export interface CompiledSchema {
  'check': (value: unknown) => boolean;
  'errors': (value: unknown) => ValidationError[];
  'normalize': (obj: Record<string, unknown>) => void;
  'normalizeAndCheck': (obj: Record<string, unknown>) => boolean;
}

const compiledCache = new WeakMap<object, CompiledSchema>();

export class Compiler {
  public static compile(schema: object): CompiledSchema {
    const cached = compiledCache.get(schema);

    if (cached !== undefined) {
      return cached;
    }

    const engine = new GraphEngine(schema as Record<string, unknown>);
    const compiled: CompiledSchema = {
      'check': (value) => {
        return engine.check(value);
      },
      'errors': (value) => {
        return engine.errors(value);
      },
      'normalize': (obj) => {
        const result = engine.execute(obj, '', {
          'applyDefaults': true,
          'collectErrors': false,
          'coerce': true,
          'removeAdditional': true
        });

        if (result.value !== obj && typeof result.value === 'object' && result.value !== null) {
          Object.assign(obj, result.value);
        }
      },
      'normalizeAndCheck': (obj) => {
        const result = engine.execute(obj, '', {
          'applyDefaults': true,
          'collectErrors': false,
          'coerce': true,
          'removeAdditional': true
        });

        if (result.value !== obj && typeof result.value === 'object' && result.value !== null) {
          Object.assign(obj, result.value);
        }

        return result.valid;
      }
    };

    compiledCache.set(schema, compiled);

    return compiled;
  }
}
