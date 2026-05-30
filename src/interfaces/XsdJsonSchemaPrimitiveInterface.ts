/**
 * XsdJsonSchemaPrimitiveInterface — the JSON-Schema shape that a recognised XSD
 * type maps to.
 *
 * `format` is present only for XSD types that carry a JSON Schema format
 * counterpart (e.g. xsd:dateTime → `{ type: 'string', format: 'date-time' }`).
 *
 * Consumed by the canonical reverse XSD→JSON-Schema map
 * (src/constants/XSD_REVERSE_MAPS.ts) and by the OWL import property dispatch.
 */

export interface XsdJsonSchemaPrimitiveInterface {
  readonly 'format'?: string;
  readonly 'type': 'boolean' | 'integer' | 'number' | 'string';
}
