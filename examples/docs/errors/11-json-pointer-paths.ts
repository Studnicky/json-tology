import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Too',
  'rating': 6
});

if (!errs.ok) {
  // aggregate().paths is access form - use items for JSON Pointer
  const jsonPointerPaths = errs.items.map((err) => {
    return err.path;
  });

  console.assert(
    jsonPointerPaths.length > 0,
    'Should have JSON Pointer paths'
  );
  console.assert(
    jsonPointerPaths.every((path) => {
      return path.startsWith('/') || path === '';
    }),
    'Paths should be in JSON Pointer format'
  );
}
