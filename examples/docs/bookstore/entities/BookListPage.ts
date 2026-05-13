/**
 * BookListPage — demonstrates the BaseTypes.page() factory.
 *
 * InferType resolves to a paginated container whose `items` array holds Book values:
 *   {
 *     items: Book[];
 *     total: number;
 *     page: number;
 *     pageSize: number;
 *     hasNext?: boolean;
 *     hasPrev?: boolean;
 *     nextCursor?: string;
 *     prevCursor?: string;
 *     totalPages?: number;
 *   }
 *
 * Demonstrates:
 *   - BaseTypes.page(itemSchema, id) factory producing a typed pagination container
 *   - The factory wires items: { items: BookSchema, type: 'array' } so InferType
 *     resolves items to the full Book inferred type
 */

import { BaseTypes } from '../../../../src/modules/data/BaseTypes.js';
import { BookSchema } from './Book.js';

export const BookListPageSchema = BaseTypes.page(BookSchema, 'urn:bookstore:BookListPage');
