// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.884Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// IRI:       https://schema.org/Organization
// ============================================================

import type { InferType } from 'json-tology/types';

export const OrganizationSchema = {
  "$id": "https://schema.org/Organization",
  "allOf": [
    {
      "$ref": "https://schema.org/Thing",
    },
  ],
  "description": "An organization such as a school, NGO, corporation, club, etc.",
  "properties": {},
  "required": [],
  "title": "Organization",
  "type": "object",
} as const;

export type Organization = InferType<typeof OrganizationSchema>;
