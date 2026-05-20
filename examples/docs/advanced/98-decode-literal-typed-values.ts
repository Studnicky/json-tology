/**
 * decodeLiteral — recover typed JS values from rdf/js Literal terms.
 *
 * Per the rdf/js spec, `Literal.value` is `string`. The original JS type
 * (number, boolean, Date) lives in `Literal.datatype.value` (`xsd:integer`,
 * `xsd:boolean`, `xsd:dateTime`, etc.). `decodeLiteral(literal)` reads the
 * datatype tag and parses the string back into a typed JS value. `fromQuads`,
 * the OWL importer, and `JsonLdFormatter` call it automatically — consumers
 * only need it when reading quads directly off `toQuads()` output.
 */

import {
  decodeLiteral, Terms
} from '../../../src/index.js';

// xsd:integer datatype tag
const ageLiteral = Terms.literal(30);
// xsd:boolean datatype tag
const activeLiteral = Terms.literal(true);
// xsd:string datatype tag
const nameLiteral = Terms.literal('Bastian');

console.assert(ageLiteral.value === '30', 'spec value is string');
console.assert(decodeLiteral(ageLiteral) === 30, 'decoded as number');
console.assert(decodeLiteral(activeLiteral) === true, 'decoded as boolean');
console.assert(decodeLiteral(nameLiteral) === 'Bastian', 'string passes through');

console.log('Literal.value:', typeof ageLiteral.value, ageLiteral.value);
console.log('decodeLiteral:', typeof decodeLiteral(ageLiteral), decodeLiteral(ageLiteral));
