/**
 * XsdTypes — XSD datatype resolution from JSON Schema type/format pairs.
 *
 * Consumes the pure-data maps in `src/constants/XSD_MAPS.ts`.
 * All return values are full IRIs (never compact CURIEs).
 */

import type { SchemaGraphSemanticsType } from '../../types/SchemaGraph.js';
import {
  BASE_TYPE_MAP, NUMBER_FORMAT_MAP, STRING_FORMAT_MAP
} from '../../constants/XSD_MAPS.js';
import {
  OWL, XSD
} from '../../constants/IRI.js';

export const XsdTypes = {
  /**
   * Resolve the XSD type from a schema node's semantics (types array + format).
   *
   * @param semantics - The schema graph semantics containing `schemaTypes` and `format`.
   * @returns Full IRI for the XSD type, `owl:Nothing` full IRI for null-only types,
   *   or `null` for ambiguous/composite types.
   */
  'resolve': (semantics: SchemaGraphSemanticsType): null | string => {
    const types = semantics.schemaTypes;
    const format = semantics.format;

    const nonNull = types.filter((schemaType) => {
      return schemaType !== 'null';
    });

    if (nonNull.length === 0) {
      return types.length > 0 ? OWL.Nothing : null;
    }
    if (nonNull.length === 1) {
      const singleType = nonNull[0];

      if (singleType === undefined) {
        return null;
      }

      return XsdTypes.resolveSingle(singleType, format === undefined ? undefined : { format });
    }

    return null;
  },

  /**
   * Resolve a single JSON Schema `type` (and optional `format`) to an XSD datatype full IRI.
   *
   * @param type - JSON Schema type (`string`, `number`, `integer`, `boolean`, `null`).
   * @param format - Optional format hint (e.g. `date-time`, `int32`).
   * @returns Full XSD IRI, or `null` for composite types (`object`, `array`) or unknown mappings.
   */
  'resolveSingle': (type: string, options?: { 'format'?: string }): null | string => {
    const format = options?.format;

    if (type === 'object' || type === 'array') {
      return null;
    }
    if (type === 'string') {
      return format !== undefined && format in STRING_FORMAT_MAP
        ? (STRING_FORMAT_MAP[format] ?? null)
        : XSD.string;
    }
    if (type === 'number' || type === 'integer') {
      return format !== undefined && format in NUMBER_FORMAT_MAP
        ? (NUMBER_FORMAT_MAP[format] ?? null)
        : (BASE_TYPE_MAP[type] ?? null);
    }

    return BASE_TYPE_MAP[type] ?? null;
  }
} as const;
