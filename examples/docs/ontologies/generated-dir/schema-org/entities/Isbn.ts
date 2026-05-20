// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.522Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// IRI:       https://schema.org/Book#isbn
// ============================================================

import type { InferType } from 'json-tology/types';

export const IsbnSchema = {
  "$id": "https://schema.org/Book#isbn",
  "description": "The ISBN of the book.",
  "title": "isbn",
} as const;

export type Isbn = InferType<typeof IsbnSchema>;
