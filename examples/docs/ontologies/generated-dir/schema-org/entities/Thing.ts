// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.522Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// IRI:       https://schema.org/Thing
// ============================================================

import type { InferType } from 'json-tology/types';

export const ThingSchema = {
  "$id": "https://schema.org/Thing",
  "description": "The most generic type.",
  "properties": {
    "name": {
      "type": "string",
    },
  },
  "required": [],
  "title": "Thing",
  "type": "object",
} as const;

export type Thing = InferType<typeof ThingSchema>;
