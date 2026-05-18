/**
 * LoadError — file-loading failure.
 *
 * LoadError surfaces inside the file-loader path. The catch shape
 * demonstrates the public surface: `code`, `filePath`, and
 * `retryable` — IO failures are flagged retryable because they are
 * often transient.
 */

import { LoadError } from '../../../src/index.js';

// LoadError is constructed by the file loader when stopOnError is set.
// Reproduce the shape directly so the catch demonstrates the public
// surface without depending on a missing file on disk.
const synthetic = new LoadError(
  'LOAD_INVALID_JSON',
  'Invalid JSON in Order.schema.json',
  '/path/to/Order.schema.json'
);

if (synthetic instanceof LoadError) {
  console.assert(synthetic.code === 'LOAD_INVALID_JSON');
  console.assert(synthetic.filePath === '/path/to/Order.schema.json');
  console.assert(synthetic.retryable);
}
