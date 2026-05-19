// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.884Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// IRI:       https://schema.org/IsbnType
// ============================================================

import type { InferType } from 'json-tology/types';

export const IsbnTypeSchema = {
  "$id": "https://schema.org/IsbnType",
  "description": "A 13-digit ISBN string. XSD-facet restriction: pattern ^\\d{13}$.",
  "pattern": "^\\d{13}$",
  "title": "IsbnType",
  "type": "string",
} as const;

export type IsbnType = InferType<typeof IsbnTypeSchema>;
