/**
 * BookListPage — paginated container of Book results.
 *
 * InferType resolves to a paginated container whose `items` array holds Book values:
 *   {
 *     items: Book[];
 *     total: PageCount;      // non-negative integer count of all matching records
 *     page: PageNumber;      // 1-based page index
 *     pageSize: PageSize;    // items per page (≥ 1)
 *     hasNext?: boolean;
 *     hasPrev?: boolean;
 *     nextCursor?: string;
 *     prevCursor?: string;
 *     totalPages?: PageCount; // total number of pages, optional
 *   }
 *
 * Demonstrates:
 *   - Authoring a pagination container directly with named-primitive $refs
 *     (PageCount, PageNumber, PageSize) so every property is a canonical type
 *     rather than an inline shape — required by strict-graph defaults
 *   - The items array uses a $ref to the registered Book schema
 */

import { BookSchema } from './Book.js';

export const BookListPageSchema = {
  '$id': 'urn:bookstore:BookListPage',
  'description': 'A page of Book results with pagination metadata',
  'properties': {
    'hasNext': { 'type': 'boolean' },
    'hasPrev': { 'type': 'boolean' },
    'items': {
      'items': { '$ref': BookSchema.$id },
      'type': 'array'
    },
    'nextCursor': { 'type': 'string' },
    'page': { '$ref': 'urn:bookstore:PageNumber' },
    'pageSize': { '$ref': 'urn:bookstore:PageSize' },
    'prevCursor': { 'type': 'string' },
    'total': { '$ref': 'urn:bookstore:PageCount' },
    'totalPages': { '$ref': 'urn:bookstore:PageCount' }
  },
  'required': [
    'items',
    'total',
    'page',
    'pageSize'
  ],
  'type': 'object'
} as const;
