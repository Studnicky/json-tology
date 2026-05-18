/**
 * ExhaustiveType — Signature
 *
 * The canonical declaration of ExhaustiveType<T>: a compile-time
 * marker type that accepts only `never`. Use it in the `default`
 * branch of a switch statement to enforce that all union members are
 * handled. Adding a case to the union without a corresponding `case`
 * clause causes a compile error.
 */

import type { ExhaustiveType } from '../../../src/types/index.js';

// Type declaration mirrors the canonical export in src/types/Infer.ts:
//
// export type ExhaustiveType<T extends never> = T;

type Color = 'gold' | 'silver';

function describeColor(color: Color): string {
  switch (color) {
    case 'gold': return 'lustrous yellow';
    case 'silver': return 'cool grey';
    default: {
      // Adding 'bronze' to Color without a case here becomes a compile error.
      const _: ExhaustiveType<typeof color> = color;

      return _;
    }
  }
}

console.assert(describeColor('gold') === 'lustrous yellow');
console.assert(describeColor('silver') === 'cool grey');
