/**
 * Format brands — Email resolves to a branded string type.
 *
 * With `formatBrands: true` (the default), `InferType` on a
 * `format: 'email'` schema produces `string & FormatBrandInterface<'email'>`.
 * Plain strings cannot satisfy the branded type — values must come
 * through the validation API.
 */

import type { InferType } from '../../../src/types/index.js';

const _EmailSchema = {
  'format': 'email',
  'type': 'string'
} as const;

type Email = InferType<typeof _EmailSchema>;

// Email is structurally a string with the email format brand.
void 0 as unknown as Email;
