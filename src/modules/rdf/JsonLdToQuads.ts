/**
 * JsonLdToQuads — synchronous compact JSON-LD to QuadInterface[] converter.
 *
 * Handles the specific compact JSON-LD format that OwlProjection + OntologyBuilder
 * emit: a document with a prefix map (`context`) and a flat node array (`graph`).
 * Each node has an `id`, a `type` (plain string or string[]), and predicate-value
 * entries where predicates are CURIE strings and values are IRI references,
 * list structures, or literals.
 *
 * This is NOT a general-purpose JSON-LD processor. It is designed specifically
 * to invert the output of JsonLdFormatter.fromQuads (which is what toTbox() produces).
 * For arbitrary JSON-LD documents use importAsync() with the optional jsonld peer.
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { TokenParseResultType } from '../../types/TokenParseResultType.js';
import type { NQuadLineResultType } from '../../types/NQuadLineResultType.js';
import type { ParsedLiteralInterface } from '../../interfaces/ParsedLiteral.js';
import type { ConversionContextInterface } from '../../interfaces/ConversionContext.js';
import {
  RDF, XSD
} from '../../constants/IRI.js';
import { Lists } from './Lists.js';
import { Terms } from './Terms.js';
import { IdentifierIssuer } from './IdentifierIssuer.js';
import { Curie } from './Curie.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of tokens required to form a valid N-Quad line. */
const NQUAD_MIN_TOKENS = 3;

/** Number of characters consumed by the `^^<` datatype prefix in N-Quads. */
const NQUAD_DATATYPE_PREFIX_LENGTH = 3;

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
// Shared conversion context — groups per-call mutable state to avoid
// passing 4–5 arguments through every recursive call.
// ---------------------------------------------------------------------------

function makeConversionContext(context: Record<string, string>): ConversionContextInterface {
  return {
    'allQuads': [],
    'bnodeMap': new Map(),
    'context': context,
    'counter': new IdentifierIssuer({ 'prefix': '_:jld' })
  };
}

// ---------------------------------------------------------------------------
// Convert a JSON-LD object value to a QuadObjectType
// ---------------------------------------------------------------------------

function convertIdObject(
  obj: Record<string, unknown>,
  iriValue: string,
  ctx: ConversionContextInterface
): QuadObjectType {
  if (iriValue.startsWith('_:')) {
    return Terms.blank(iriValue.slice(2));
  }

  // Inlined blank node (has keys beyond @id)
  if (Object.keys(obj).length > 1) {
    const bnodeId = convertInlinedBnode(obj, ctx);

    return Terms.blank(bnodeId.slice(2));
  }

  return Terms.iri(Curie.expandWithContext(iriValue, ctx.context));
}

function convertRdfList(
  rawList: unknown[],
  ctx: ConversionContextInterface
): QuadObjectType {
  const items: QuadObjectType[] = [];

  for (const rawItem of rawList) {
    const term = jsonLdValueToTerm(rawItem, ctx);

    if (term !== null) {
      items.push(term);
    }
  }

  const {
    head, triples
  } = Lists.build(items, ctx.counter);

  for (const triple of triples) {
    ctx.allQuads.push(triple);
  }

  return head;
}

function convertInlinedBnode(
  obj: Record<string, unknown>,
  ctx: ConversionContextInterface
): string {
  const existingId = ctx.bnodeMap.get(obj);
  const bnodeId = existingId ?? ctx.counter.getId();

  if (existingId === undefined) {
    ctx.bnodeMap.set(obj, bnodeId);
    emitNodeQuads(bnodeId, obj, ctx);
  }

  return bnodeId;
}

function convertStringValue(value: string, ctx: ConversionContextInterface): QuadObjectType {
  if (isLiteralString(value, ctx.context)) {
    return Terms.literal(value);
  }

  return Terms.iri(Curie.expandWithContext(value, ctx.context));
}

function convertObjectValue(
  obj: Record<string, unknown>,
  originalValue: unknown,
  ctx: ConversionContextInterface
): null | QuadObjectType {
  if ('@list' in obj && Array.isArray(obj['@list'])) {
    return convertRdfList(obj['@list'] as unknown[], ctx);
  }

  if ('@id' in obj && typeof obj['@id'] === 'string') {
    return convertIdObject(obj, obj['@id'], ctx);
  }

  if ('@value' in obj) {
    return Terms.literal(obj['@value']);
  }

  if (Object.keys(obj).length > 0) {
    return Terms.blank(convertInlinedBnode(obj, ctx).slice(2));
  }

  return Terms.literal(originalValue);
}

function jsonLdValueToTerm(
  value: unknown,
  ctx: ConversionContextInterface
): null | QuadObjectType {
  if (typeof value === 'string') {
    return convertStringValue(value, ctx);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return Terms.literal(value);
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return convertObjectValue(value as Record<string, unknown>, value, ctx);
}

// ---------------------------------------------------------------------------
// Emit quads for a single JSON-LD node
// ---------------------------------------------------------------------------

function emitTypeQuads(
  subjectTerm: ReturnType<typeof Terms.blank> | ReturnType<typeof Terms.iri>,
  types: unknown[],
  ctx: ConversionContextInterface
): void {
  for (const typeValue of types) {
    if (typeof typeValue !== 'string') {
      continue;
    }
    ctx.allQuads.push(Terms.quad(
      subjectTerm,
      Terms.iri(RDF.type),
      Terms.iri(Curie.expandWithContext(typeValue, ctx.context)),
      Terms.defaultGraph()
    ));
  }
}

function emitNodeQuads(
  subjectId: string,
  node: Record<string, unknown>,
  ctx: ConversionContextInterface
): void {
  const subjectTerm = subjectId.startsWith('_:')
    ? Terms.blank(subjectId.slice(2))
    : Terms.iri(subjectId);

  for (const [
    key,
    rawValue
  ] of Object.entries(node)) {
    if (key === '@id') {
      continue;
    }
    if (key === '@type') {
      const types = Array.isArray(rawValue) ? rawValue : [rawValue];

      emitTypeQuads(subjectTerm, types, ctx);
      continue;
    }

    const predicateIri = Curie.expandWithContext(key, ctx.context);
    const predicateTerm = Terms.iri(predicateIri);
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const itemValue of values) {
      const objectTerm = jsonLdValueToTerm(itemValue, ctx);

      if (objectTerm === null) {
        continue;
      }
      ctx.allQuads.push(Terms.quad(
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
 * Convert a compact JSON-LD node array to a flat array of RDF quads.
 *
 * @remarks
 * Accepts the format that OntologyBuilder + JsonLdFormatter produce: a prefix
 * map (`context`) and a flat node array (`graph`). Each node must carry an
 * `id` (subject IRI or blank node ID), an optional `type` (class IRI string
 * or string[]), and predicate keys that are CURIE strings mapping to IRI
 * references, list structures, or literal values.
 *
 * @example
 * ```ts
 * const quads = jsonLdNodesToQuads(doc.graph, doc.prefixMap);
 * ```
 *
 * @param nodes - Array of JSON-LD node objects from the graph array.
 * @param prefixMap - Prefix expansion map from the document (e.g. `{ owl: 'http://www.w3.org/2002/07/owl#' }`).
 * @returns Flat array of QuadInterface objects.
 *
 * @category RDF
 * @since 0.18.0
 * @see {@link parseNQuads}
 * @group JsonLdToQuads
 */
export function jsonLdNodesToQuads(
  nodes: Array<Record<string, unknown>>,
  prefixMap: Record<string, string>
): QuadInterface[] {
  const ctx = makeConversionContext(prefixMap);

  for (const node of nodes) {
    const subjectRaw = node['@id'];

    if (typeof subjectRaw !== 'string') {
      continue;
    }
    const subjectId = Curie.expandWithContext(subjectRaw, ctx.context);

    emitNodeQuads(subjectId, node, ctx);
  }

  return ctx.allQuads;
}

// ---------------------------------------------------------------------------
// N-Quads parser (for jsonld.js v8 output with format: 'application/n-quads')
// ---------------------------------------------------------------------------

function parseNQuadObjectTerm(objectToken: string): QuadObjectType {
  if (objectToken.startsWith('"')) {
    const {
      datatype, language, value
    } = parseLiteralToken(objectToken);

    return Terms.literal(value, {
      'datatype': Terms.iri(datatype),
      'language': language
    });
  }

  if (objectToken.startsWith('_:')) {
    return Terms.blank(objectToken.slice(2));
  }

  return Terms.iri(objectToken.slice(1, -1));
}

function parseNQuadLine(body: string): NQuadLineResultType {
  const tokens = tokenizeNQuadLine(body);

  if (tokens.length < NQUAD_MIN_TOKENS) {
    return undefined;
  }

  const subjectToken = tokens[0];
  const predicateToken = tokens[1];
  const objectToken = tokens[2];

  const subjectTerm = subjectToken.startsWith('_:')
    ? Terms.blank(subjectToken.slice(2))
    : Terms.iri(subjectToken.slice(1, -1));
  const predicateTerm = Terms.iri(predicateToken.slice(1, -1));
  const objectTerm = parseNQuadObjectTerm(objectToken);

  return Terms.quad(subjectTerm, predicateTerm, objectTerm, Terms.defaultGraph());
}

/**
 * Parse N-Quads produced by jsonld.js v8.
 *
 * @remarks
 * Handles lines of the form: `<subject> <predicate> <object> [<graph>] .`
 * Comment lines (starting with `#`) and blank lines are ignored.
 * Blank node subjects are recognized by the `_:` prefix. Literal objects
 * with optional `^^<datatype>` or `@lang` suffixes are fully supported.
 *
 * @example
 * ```ts
 * const quads = parseNQuads(nquadsString);
 * ```
 *
 * @param nquads - N-Quads document as a plain string.
 * @returns Flat array of QuadInterface objects.
 *
 * @category RDF
 * @since 0.18.0
 * @see {@link jsonLdNodesToQuads}
 * @group JsonLdToQuads
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
    const quad = parseNQuadLine(body);

    if (quad !== undefined) {
      quads.push(quad);
    }
  }

  return quads;
}

function advancePastLiteralQuotes(line: string, startPos: number): number {
  let end = startPos + 1;

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

  return end;
}

function advancePastLiteralSuffix(line: string, endPos: number): number {
  if (endPos < line.length && line[endPos] === '^') {
    const afterCaret = endPos + 2;
    const dtEnd = line.indexOf('>', afterCaret);

    return dtEnd === -1 ? line.length : dtEnd + 1;
  }
  if (endPos < line.length && line[endPos] === '@') {
    const langEnd = line.indexOf(' ', endPos);

    return langEnd === -1 ? line.length : langEnd;
  }

  return endPos;
}

function tokenizeLiteralAt(line: string, pos: number): TokenParseResultType {
  const afterQuotes = advancePastLiteralQuotes(line, pos);
  const end = advancePastLiteralSuffix(line, afterQuotes);

  return [
    line.slice(pos, end),
    end
  ];
}

function tokenizeIriAt(line: string, pos: number): TokenParseResultType {
  const end = line.indexOf('>', pos);

  if (end === -1) {
    return [
      '',
      line.length
    ];
  }

  return [
    line.slice(pos, end + 1),
    end + 1
  ];
}

function tokenizeBnodeAt(line: string, pos: number): TokenParseResultType {
  const end = line.indexOf(' ', pos);
  const token = end === -1 ? line.slice(pos) : line.slice(pos, end);

  return [
    token,
    end === -1 ? line.length : end
  ];
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
        const [
          token,
          nextPos
        ] = tokenizeLiteralAt(line, pos);

        tokens.push(token);
        pos = nextPos;

        break;
      }
      case '<': {
        const [
          token,
          nextPos
        ] = tokenizeIriAt(line, pos);

        if (token === '') {
        // No closing bracket — malformed, stop tokenizing this line.
          pos = line.length;
        } else {
          tokens.push(token);
          pos = nextPos;
        }

        break;
      }
      case '_': {
        const [
          token,
          nextPos
        ] = tokenizeBnodeAt(line, pos);

        tokens.push(token);
        pos = nextPos;

        break;
      }
      default:
      // Unknown token character — skip
        pos++;
    }
  }

  return tokens;
}

function parseLiteralToken(token: string): ParsedLiteralInterface {
  const closingQuote = token.lastIndexOf('"');

  if (closingQuote <= 0) {
    return {
      'datatype': XSD.string,
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
      'datatype': suffix.slice(NQUAD_DATATYPE_PREFIX_LENGTH, -1),
      'language': '',
      value
    };
  }
  if (suffix.startsWith('@')) {
    return {
      'datatype': RDF.langString,
      'language': suffix.slice(1),
      value
    };
  }

  return {
    'datatype': XSD.string,
    'language': '',
    value
  };
}
