// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.884Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// IRI:       https://schema.org/Book
// ============================================================

import type { InferType } from 'json-tology/types';

export const BookSchema = {
  "$id": "https://schema.org/Book",
  "allOf": [
    {
      "$ref": "https://schema.org/Thing",
    },
  ],
  "description": "A book.",
  "properties": {
    "author": {
      "$ref": "https://schema.org/Person",
    },
    "isbn": {
      "$ref": "https://schema.org/IsbnType",
    },
    "publisher": {
      "$ref": "https://schema.org/Organization",
    },
  },
  "required": [],
  "title": "Book",
  "type": "object",
} as const;

export type Book = InferType<typeof BookSchema>;
