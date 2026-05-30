import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Too',
  'rating': 6
});

if (!errs.ok) {
  const rollup = errs.aggregate();

  // paths and keywords are bounded sets - safe as metric labels
  console.assert(rollup.count > 0, 'Should have errors to count');
  console.assert(rollup.paths.length > 0, 'Should have error paths');
  console.assert(rollup.keywords.length > 0, 'Should have error keywords');

  console.log('aggregate.count:', rollup.count);
  console.log('aggregate.paths:', rollup.paths);
  console.log('aggregate.keywords:', rollup.keywords);
}
