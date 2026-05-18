/**
 * Compose.equivalent — Anti-pattern 3: Using equivalent to rename in place
 *
 * If the original name is no longer needed, do not alias it. Change
 * the source schema's `$id` and update references instead. Two names
 * for the same class create registry drift.
 *
 * The constructive shape: equivalent is for the case where both names
 * must coexist in the domain model (catalog feed alias + canonical
 * primitive). Renaming-in-place is structural refactoring, not OWL
 * equivalence.
 */

import { IsbnSchema } from '../bookstore/index.js';

// The canonical Isbn schema keeps its $id. Use it directly rather
// than building a sibling alias whose only purpose is to rename.
const canonicalId: string = IsbnSchema.$id;

console.assert(canonicalId.length > 0);
