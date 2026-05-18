/**
 * DefaultAlignedType — Example 3: Using as a generic constraint on a
 * registration helper.
 *
 * The helper accepts only schemas whose `default` values match their
 * declared types. A misaligned schema fails the constraint at the
 * call site, before any runtime code executes.
 */

import type { DefaultAlignedType } from '../../../src/types/index.js';
import {
  JsonTology
} from '../../../src/index.js';

const _BookSchema = {
  '$id': 'https://bookstore.example/AlignedBook',
  'properties': {
    'currency': {
      'default': 'USD',
      'type': 'string'
    },
    'inStock': {
      'default': true,
      'type': 'boolean'
    }
  },
  'type': 'object'
} as const;

function registerChecked<T>(schema: DefaultAlignedType<T>): void {
  // DefaultAlignedType<T> ensures the schema never reaches this
  // function when its defaults are misaligned — the call site itself
  // becomes a compile error in that case.
  // doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
  const jt = JsonTology.create({ 'baseIRI': 'https://bookstore.example' });

  jt.registry.set(schema as Record<string, unknown>);
}

registerChecked(_BookSchema);

void _BookSchema;
