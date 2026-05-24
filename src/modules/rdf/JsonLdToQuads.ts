/**
 * JsonLdToQuads — synchronous compact JSON-LD → QuadInterface[] converter.
 *
 * Handles the specific compact JSON-LD format that OwlProjection + OntologyBuilder
 * emit: a document with @context (prefix map) and @graph (flat node array).
 * Each node has @id, @type (plain string or string[]), and predicate-value entries
 * where predicates are CURIE strings and values are { @id }, { @list }, or literals.
 *
 * This is NOT a general-purpose JSON-LD processor. It is designed specifically
 * to invert the output of JsonLdFormatter.fromQuads (which is what toTbox() produces).
 * For arbitrary JSON-LD documents use importAsync() with the optional jsonld peer.
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import { Lists } from './Lists.js';
import { Terms } from './Terms.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';

// ---------------------------------------------------------------------------
// IRI expansion
// ---------------------------------------------------------------------------

function expandIri(value: string, context: Record<string, string>): string {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('urn:')) {
    return value;
  }
  if (value.startsWith('_:')) {
    return value;
  }
  const colonIndex = value.indexOf(':');

  if (colonIndex === -1) {
    return value;
  }
  const prefix = value.slice(0, colonIndex);
  const local = value.slice(colonIndex + 1);

  return prefix in context ? `${context[prefix]}${local}` : value;
}

/**
 * Return true when a plain JSON string value should be treated as a literal
 * rather than an IRI reference. A string is a literal when it cannot be a
 * valid IRI or CURIE: no colon, not starting with `_:` / `http:` / `https:`
 * / `urn:`. Covers JSON Schema format values (`email`, `date-time`, `uri`,
 * `uuid`, `int32`) and other plain-string annotations produced by
 * JsonLdFormatter.
 */
function isLiteralString(value: string, context: Record<string, string>): boolean {
  if (
    value.startsWith('_:')
    || value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('urn:')
  ) {
    return false;
  }

  const colonIndex = value.indexOf(':');

  if (colonIndex === -1) {
    return true;
  }

  const prefix = value.slice(0, colonIndex);

  return !(prefix in context);
}

// ---------------------------------------------------------------------------
// Blank node state (per-call counter)
// ---------------------------------------------------------------------------

function makeCounter(): IdentifierIssuer {
  return new IdentifierIssuer({ 'prefix': '_:jld' });
}

// ---------------------------------------------------------------------------
// Convert a JSON-LD object value to a QuadObjectType
// ---------------------------------------------------------------------------

function jsonLdValueToTerm(
  value: unknown,
  context: Record<string, string>,
  bnodeMap: Map<Record<string, unknown>, string>,
  allQuads: QuadInterface[],
  counter: IdentifierIssuer
): null | QuadObjectType {
  if (typeof value === 'string') {
    if (isLiteralString(value, context)) {
      return Terms.literal(value);
    }

    return Terms.iri(expandIri(value, context));
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return Terms.literal(value);
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const obj = value as Record<string, unknown>;

  // { @list: [...] } — expand to standard rdf:first / rdf:rest triple chain
  // so the rest of the pipeline only sees spec-compliant rdf/js quads.
  if ('@list' in obj && Array.isArray(obj['@list'])) {
    const items = (obj['@list'] as unknown[])
      .map((item) => {
        return jsonLdValueToTerm(item, context, bnodeMap, allQuads, counter);
      })
      .filter((item): item is QuadObjectType => {
        return item !== null;
      });
    const {
      head, triples
    } = Lists.build(items, counter);

    for (const triple of triples) {
      allQuads.push(triple);
    }

    return head;
  }

  // { @id: "..." } — named node or inlined blank node
  if ('@id' in obj && typeof obj['@id'] === 'string') {
    const iriValue = obj['@id'];

    if (iriValue.startsWith('_:')) {
      return Terms.blank(iriValue.slice(2));
    }

    // Inlined blank node (has keys beyond @id)
    if (Object.keys(obj).length > 1) {
      const existingId = bnodeMap.get(obj);
      const bnodeId = existingId ?? counter.getId();

      if (existingId === undefined) {
        bnodeMap.set(obj, bnodeId);
        emitNodeQuads(bnodeId, obj, context, bnodeMap, allQuads, counter);
      }

      return Terms.blank(bnodeId.slice(2));
    }

    return Terms.iri(expandIri(iriValue, context));
  }

  // { @value: ... } — plain literal object emitted by JsonLdFormatter
  if ('@value' in obj) {
    return Terms.literal(obj['@value']);
  }

  // Anonymous inlined blank node — an object without @id / @list / @value
  // whose remaining keys are predicate IRIs. Produced by
  // `JsonLdFormatter.inlineBnodes()` when it strips @id from a
  // singly-referenced blank node. Both `@type`-typed nodes (e.g. an
  // inlined owl:Class wrapping owl:unionOf) and untyped facet bnodes
  // arrive in this form.
  const objKeys = Object.keys(obj);

  if (objKeys.length > 0) {
    const existingId = bnodeMap.get(obj);
    const bnodeId = existingId ?? counter.getId();

    if (existingId === undefined) {
      bnodeMap.set(obj, bnodeId);
      emitNodeQuads(bnodeId, obj, context, bnodeMap, allQuads, counter);
    }

    return Terms.blank(bnodeId.slice(2));
  }

  // Bare object with no keys — fall back to literal stringification.
  return Terms.literal(value);
}

// ---------------------------------------------------------------------------
// Emit quads for a single JSON-LD node
// ---------------------------------------------------------------------------

function emitNodeQuads(
  subjectId: string,
  node: Record<string, unknown>,
  context: Record<string, string>,
  bnodeMap: Map<Record<string, unknown>, string>,
  allQuads: QuadInterface[],
  counter: IdentifierIssuer
): void {
  const subjectTerm = subjectId.startsWith('_:')
    ? Terms.blank(subjectId.slice(2))
    : Terms.iri(subjectId);

  const rdfTypeIri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

  for (const [
    key,
    rawValue
  ] of Object.entries(node)) {
    if (key === '@id') {
      continue;
    }
    if (key === '@type') {
      const types = Array.isArray(rawValue) ? rawValue : [rawValue];

      for (const typeValue of types) {
        if (typeof typeValue !== 'string') {
          continue;
        }
        allQuads.push(Terms.quad(
          subjectTerm,
          Terms.iri(rdfTypeIri),
          Terms.iri(expandIri(typeValue, context)),
          Terms.defaultGraph()
        ));
      }
      continue;
    }

    const predicateIri = expandIri(key, context);
    const predicateTerm = Terms.iri(predicateIri);
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const itemValue of values) {
      const objectTerm = jsonLdValueToTerm(itemValue, context, bnodeMap, allQuads, counter);

      if (objectTerm === null) {
        continue;
      }
      allQuads.push(Terms.quad(
        subjectTerm,
        predicateTerm,
        objectTerm,
        Terms.defaultGraph()
      ));
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Convert a compact JSON-LD node array to a flat QuadInterface[].
 *
 * Accepts the format that OntologyBuilder + JsonLdFormatter produce:
 * - @context: prefix map (prefix → namespace IRI)
 * - @graph: array of subject nodes
 *
 * Each node is expected to have:
 * - @id: subject IRI or blank node ID
 * - @type: class IRI string or string[] (maps to rdf:type quads)
 * - predicate keys: CURIE strings mapping to { @id }, { @list }, or literal values
 *
 * @param nodes    - Array of JSON-LD node objects from @graph.
 * @param context  - Prefix-to-namespace map from @context.
 * @returns Flat array of QuadInterface objects.
 */
export function jsonLdNodesToQuads(
  nodes: Array<Record<string, unknown>>,
  context: Record<string, string>
): QuadInterface[] {
  const allQuads: QuadInterface[] = [];
  const bnodeMap = new Map<Record<string, unknown>, string>();
  const counter = makeCounter();

  for (const node of nodes) {
    const subjectRaw = node['@id'];

    if (typeof subjectRaw !== 'string') {
      continue;
    }
    const subjectId = expandIri(subjectRaw, context);

    emitNodeQuads(subjectId, node, context, bnodeMap, allQuads, counter);
  }

  return allQuads;
}

// ---------------------------------------------------------------------------
// N-Quads parser (for jsonld.js v8 output with format: 'application/n-quads')
// ---------------------------------------------------------------------------

/**
 * Parse N-Quads produced by jsonld.js v8.
 * Each non-comment line: <subject> <predicate> <object> [<graph>] .
 */
export function parseNQuads(nquads: string): QuadInterface[] {
  const quads: QuadInterface[] = [];
  const lines = nquads.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const body = trimmed.endsWith(' .') ? trimmed.slice(0, -2).trimEnd() : trimmed;
    const tokens = tokenizeNQuadLine(body);

    if (tokens.length < 3) {
      continue;
    }
    const subjectToken = tokens.at(0);
    const predicateToken = tokens.at(1);
    const objectToken = tokens.at(2);

    if (subjectToken === undefined || predicateToken === undefined || objectToken === undefined) {
      continue;
    }

    const subjectTerm = subjectToken.startsWith('_:')
      ? Terms.blank(subjectToken.slice(2))
      : Terms.iri(subjectToken.slice(1, -1));
    const predicateTerm = Terms.iri(predicateToken.slice(1, -1));
    let objectTerm: QuadObjectType;

    if (objectToken.startsWith('"')) {
      const {
        datatype, language, value
      } = parseLiteralToken(objectToken);

      objectTerm = Terms.literal(value, {
        'datatype': Terms.iri(datatype),
        'language': language
      });
    } else if (objectToken.startsWith('_:')) {
      objectTerm = Terms.blank(objectToken.slice(2));
    } else {
      objectTerm = Terms.iri(objectToken.slice(1, -1));
    }

    quads.push(Terms.quad(
      subjectTerm,
      predicateTerm,
      objectTerm,
      Terms.defaultGraph()
    ));
  }

  return quads;
}

function tokenizeNQuadLine(line: string): string[] {
  const tokens: string[] = [];
  let pos = 0;

  while (pos < line.length) {
    // Skip whitespace
    while (pos < line.length && line[pos] === ' ') {
      pos++;
    }
    if (pos >= line.length) {
      break;
    }
    const ch = line[pos];

    switch (ch) {
      case '"': {
        let end = pos + 1;

        while (end < line.length) {
          if (line[end] === '\\') {
            end += 2;
            continue;
          }
          if (line[end] === '"') {
            end++;
            break;
          }
          end++;
        }
        // Include optional ^^<datatype> or @lang suffix
        if (end < line.length && line[end] === '^') {
          end += 2;
          const dtEnd = line.indexOf('>', end);

          end = dtEnd === -1 ? line.length : dtEnd + 1;
        } else if (end < line.length && line[end] === '@') {
          const langEnd = line.indexOf(' ', end);

          end = langEnd === -1 ? line.length : langEnd;
        }
        tokens.push(line.slice(pos, end));
        pos = end;
        break;
      }
      case '<': {
        const end = line.indexOf('>', pos);

        if (end === -1) {
          // No closing bracket — malformed, stop tokenizing this line.
          pos = line.length;
        } else {
          tokens.push(line.slice(pos, end + 1));
          pos = end + 1;
        }
        break;
      }
      case '_': {
        const end = line.indexOf(' ', pos);
        const token = end === -1 ? line.slice(pos) : line.slice(pos, end);

        tokens.push(token);
        pos = end === -1 ? line.length : end;
        break;
      }
      default:
        // Unknown token character — skip
        pos++;
    }
  }

  return tokens;
}

function parseLiteralToken(token: string): { 'datatype': string;
  'language': string;
  'value': string } {
  const closingQuote = token.lastIndexOf('"');

  if (closingQuote <= 0) {
    return {
      'datatype': 'http://www.w3.org/2001/XMLSchema#string',
      'language': '',
      'value': token.slice(1, -1)
    };
  }
  const value = token.slice(1, closingQuote)
    .replaceAll('\\"', '"')
    .replaceAll('\\n', '\n')
    .replaceAll('\\t', '\t');
  const suffix = token.slice(closingQuote + 1);

  if (suffix.startsWith('^^<')) {
    return {
      'datatype': suffix.slice(3, -1),
      'language': '',
      value
    };
  }
  if (suffix.startsWith('@')) {
    return {
      'datatype': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
      'language': suffix.slice(1),
      value
    };
  }

  return {
    'datatype': 'http://www.w3.org/2001/XMLSchema#string',
    'language': '',
    value
  };
}
