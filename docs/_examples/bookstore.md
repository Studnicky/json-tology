# Bookstore Domain - Shared Schemas

This page defines every schema used across all documentation examples. All code blocks in the docs reference these schemas by name. Later examples build on earlier ones.

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';

// ──────────────────────────────────────────────
// Address
// ──────────────────────────────────────────────
export const AddressSchema = {
  $id: 'https://bookstore.example/Address',
  type: 'object',
  properties: {
    street:     { type: 'string' },
    city:       { type: 'string' },
    postalCode: { type: 'string' },
    country:    { type: 'string', default: 'US' },
  },
  required: ['street', 'city', 'postalCode'],
} as const;

export type Address = InferType<typeof AddressSchema>;

// ──────────────────────────────────────────────
// Customer
// ──────────────────────────────────────────────
export const CustomerSchema = {
  $id: 'https://bookstore.example/Customer',
  type: 'object',
  properties: {
    id:        { type: 'string', format: 'uuid' },
    email:     { type: 'string', format: 'email' },
    name:      { type: 'string' },
    addresses: {
      type: 'array',
      items: { $ref: 'https://bookstore.example/Address' },
      default: [],
    },
  },
  required: ['id', 'email', 'name'],
} as const;

export type Customer = InferType<typeof CustomerSchema>;

// ──────────────────────────────────────────────
// Book
// ──────────────────────────────────────────────
export const BookSchema = {
  $id: 'https://bookstore.example/Book',
  type: 'object',
  properties: {
    isbn:     { type: 'string', pattern: '^\\d{13}$' },
    title:    { type: 'string' },
    authors:  { type: 'array', items: { type: 'string' }, minItems: 1 },
    price:    { type: 'number', exclusiveMinimum: 0 },
    currency: { type: 'string', default: 'USD' },
    inStock:  { type: 'boolean', default: true },
  },
  required: ['isbn', 'title', 'authors', 'price'],
} as const;

export type Book = InferType<typeof BookSchema>;

// ──────────────────────────────────────────────
// OrderLine
// ──────────────────────────────────────────────
export const OrderLineSchema = {
  $id: 'https://bookstore.example/OrderLine',
  type: 'object',
  properties: {
    bookIsbn:  { type: 'string', pattern: '^\\d{13}$' },
    quantity:  { type: 'integer', minimum: 1 },
    unitPrice: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['bookIsbn', 'quantity', 'unitPrice'],
} as const;

export type OrderLine = InferType<typeof OrderLineSchema>;

// ──────────────────────────────────────────────
// Order
// ──────────────────────────────────────────────
export const OrderSchema = {
  $id: 'https://bookstore.example/Order',
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    customerId: { type: 'string', format: 'uuid' },
    items:      {
      type: 'array',
      items: { $ref: 'https://bookstore.example/OrderLine' },
      minItems: 1,
    },
    total:    { type: 'number', exclusiveMinimum: 0 },
    currency: { type: 'string', default: 'USD' },
    placedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'customerId', 'items', 'total', 'placedAt'],
} as const;

export type Order = InferType<typeof OrderSchema>;

// ──────────────────────────────────────────────
// Review
// ──────────────────────────────────────────────
export const ReviewSchema = {
  $id: 'https://bookstore.example/Review',
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    bookIsbn:   { type: 'string', pattern: '^\\d{13}$' },
    customerId: { type: 'string', format: 'uuid' },
    rating:     { type: 'integer', minimum: 1, maximum: 5 },
    body:       { type: 'string', minLength: 10 },
    postedAt:   { type: 'string', format: 'date-time' },
  },
  required: ['id', 'bookIsbn', 'customerId', 'rating', 'body', 'postedAt'],
} as const;

export type Review = InferType<typeof ReviewSchema>;

// ──────────────────────────────────────────────
// Single registered instance (shared across examples)
// ──────────────────────────────────────────────
export const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [
    AddressSchema,
    CustomerSchema,
    BookSchema,
    OrderLineSchema,
    OrderSchema,
    ReviewSchema,
  ] as const,
});
```
