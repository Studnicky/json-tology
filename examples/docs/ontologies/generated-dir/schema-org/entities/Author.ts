// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.884Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// IRI:       https://schema.org/author
// ============================================================

import type { InferType } from 'json-tology/types';

export const AuthorSchema = {
  "$id": "https://schema.org/author",
  "description": "The author of this content.",
  "title": "author",
} as const;

export type Author = InferType<typeof AuthorSchema>;
