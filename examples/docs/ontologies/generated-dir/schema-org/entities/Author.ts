// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.522Z
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
