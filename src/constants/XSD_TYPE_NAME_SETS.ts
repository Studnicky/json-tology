/**
 * Local XSD name string sets (without prefix or full IRI), used to classify a
 * bare XSD local name as integer- or decimal-shaped during literal coercion.
 *
 * @category XSD
 * @since 0.1.0
 * @group Constants
 */
export const INTEGER_XSD_TYPE_NAMES: ReadonlySet<string> = new Set([
  'byte',
  'int',
  'integer',
  'long',
  'negativeInteger',
  'nonNegativeInteger',
  'nonPositiveInteger',
  'positiveInteger',
  'short',
  'unsignedByte',
  'unsignedInt',
  'unsignedLong',
  'unsignedShort'
]);

export const DECIMAL_XSD_TYPE_NAMES: ReadonlySet<string> = new Set([
  'decimal',
  'double',
  'float'
]);
