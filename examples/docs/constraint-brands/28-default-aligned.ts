/**
 * DefaultAlignedType — validates that `default` values match the
 * declared type. Resolves to `never` when a default mismatches.
 *
 * The "Good" schema declares a number default for a number property;
 * the "Bad" schema declares a string default for a number property.
 * The bad-shape type resolves to `never`, which is how the type
 * system surfaces the misalignment without a runtime check.
 */

import type { DefaultAlignedType } from '../../../src/types/index.js';

const _GoodCountSchema = {
  'properties': {
    'count': {
      'default': 0,
      'type': 'number'
    }
  },
  'type': 'object'
} as const;

const _BadCountSchema = {
  'properties': {
    'count': {
      'default': 'zero',
      'type': 'number'
    }
  },
  'type': 'object'
} as const;

type Good = DefaultAlignedType<typeof _GoodCountSchema>;
type Bad = DefaultAlignedType<typeof _BadCountSchema>;

// Good keeps the schema type; Bad collapses to never.
// The check is entirely compile-time: Good === typeof _GoodCountSchema,
// Bad === never (the string default mismatches the number property type).
type GoodIsSchema = Good extends typeof _GoodCountSchema ? true : false;
type BadIsNever = [Bad] extends [never] ? true : false;

const goodIsSchema: GoodIsSchema = true;
const badIsNever: BadIsNever = true;

console.log('Good matches schema shape (default 0 aligns with number type):', goodIsSchema);
console.log('Bad collapses to never (default "zero" mismatches number type):', badIsNever);
