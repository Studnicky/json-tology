import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Short',
  'rating': 6
});

if (!errs.ok) {
  const messages = errs.items.map((err) => {
    return `${err.path || 'root'}: ${err.message}`;
  });

  console.assert(messages.length > 0, 'Should have error messages');
  console.assert(
    messages.some((m) => {
      return m.includes('must be');
    }),
    'Should have validation error messages'
  );
}
