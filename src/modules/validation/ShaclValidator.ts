/**
 * ShaclValidator — native SHACL validation engine for json-tology.
 *
 * Consumes SHACL shape quads produced by `ShaclProjection` / `toShacl().shaclQuads()`
 * plus ABox instance data quads produced by `toQuads()`, and returns a structured
 * conformance report aligned with the SHACL specification.
 *
 * Covers every constraint component emitted by `ShaclProjection`:
 *   sh:minCount, sh:maxCount, sh:datatype, sh:class, sh:node,
 *   sh:pattern, sh:minLength, sh:maxLength,
 *   sh:minInclusive, sh:maxInclusive, sh:minExclusive, sh:maxExclusive,
 *   sh:hasValue, sh:in, sh:closed,
 *   sh:and, sh:or, sh:not,
 *   sh:qualifiedValueShape + sh:qualifiedMinCount/sh:qualifiedMaxCount.
 *
 * Non-validating annotations (sh:name, sh:description, sh:deactivated,
 * dash:readOnly, dash:writeOnly) are recognised and ignored.
 * Shapes and property shapes with sh:deactivated true are skipped.
 *
 * @module ShaclValidator
 * @category SHACL
 * @since 0.20.0
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { ShaclValidationReportType } from '../../types/ShaclValidationReportType.js';
import type { ShaclValidationResultType } from '../../types/ShaclValidationResultType.js';
import {
  RDF, SH, XSD
} from '../../constants/IRI.js';

// ---------------------------------------------------------------------------
// Internal index types
// ---------------------------------------------------------------------------

/** Subject-to-predicate-to-objects index for quad lookup. */
type SubjectPredicateIndex = Map<string, Map<string, string[]>>;

/** Predicate-to-object-literals index for a single subject. */
type PredicateIndex = Map<string, string[]>;

/** Per-subject type set for rdf:type lookups. */
type TypeIndex = Map<string, Set<string>>;

// ---------------------------------------------------------------------------
// Index builders
// ---------------------------------------------------------------------------

/**
 * Build a subject → predicate → object-values index from a quad array.
 * Object values are the `.value` strings of the object terms.
 */
function buildSubjectIndex(quads: readonly QuadInterface[]): SubjectPredicateIndex {
  const index: SubjectPredicateIndex = new Map();

  for (const quad of quads) {
    const subjectId = quad.subject.value;
    let pmap = index.get(subjectId);

    if (pmap === undefined) {
      pmap = new Map();
      index.set(subjectId, pmap);
    }

    const predId = quad.predicate.value;
    let objs = pmap.get(predId);

    if (objs === undefined) {
      objs = [];
      pmap.set(predId, objs);
    }

    objs.push(quad.object.value);
  }

  return index;
}

/** Build a subject → rdf:type set index. */
function buildTypeIndex(quads: readonly QuadInterface[]): TypeIndex {
  const index: TypeIndex = new Map();

  for (const quad of quads) {
    if (quad.predicate.value !== RDF.type) {
      continue;
    }

    if (quad.object.termType !== 'NamedNode') {
      continue;
    }

    const subjectId = quad.subject.value;
    let types = index.get(subjectId);

    if (types === undefined) {
      types = new Set();
      index.set(subjectId, types);
    }

    types.add(quad.object.value);
  }

  return index;
}

// ---------------------------------------------------------------------------
// RDF list traversal
// ---------------------------------------------------------------------------

/**
 * Walk an rdf:first/rdf:rest chain and return all `.value` strings of
 * `rdf:first` objects (in list order). Works against the shapes quad index.
 */
function collectRdfListValues(
  headId: string,
  shapeIndex: SubjectPredicateIndex
): string[] {
  const values: string[] = [];
  let current = headId;

  while (current !== RDF.nil && current !== '') {
    const node = shapeIndex.get(current);

    if (node === undefined) {
      break;
    }

    const firstArr = node.get(RDF.first);

    if (firstArr !== undefined && firstArr.length > 0) {
      values.push(firstArr[0]);
    }

    const restArr = node.get(RDF.rest);

    if (restArr === undefined || restArr.length === 0) {
      break;
    }

    current = restArr[0];
  }

  return values;
}

// ---------------------------------------------------------------------------
// Datatype index — maps subject+predicate to the object's datatype IRI
// ---------------------------------------------------------------------------

/** Datatype IRI of each literal object per subject+predicate, for data quads. */
type DatatypeIndex = Map<string, Map<string, string[]>>;

/**
 * Build subject → predicate → datatype-IRI[] index from literal quads.
 * Non-literal objects produce no entry.
 */
function buildDatatypeIndex(quads: readonly QuadInterface[]): DatatypeIndex {
  const index: DatatypeIndex = new Map();

  for (const quad of quads) {
    if (quad.object.termType !== 'Literal') {
      continue;
    }

    const subjectId = quad.subject.value;
    let pmap = index.get(subjectId);

    if (pmap === undefined) {
      pmap = new Map();
      index.set(subjectId, pmap);
    }

    const predId = quad.predicate.value;
    let dtArr = pmap.get(predId);

    if (dtArr === undefined) {
      dtArr = [];
      pmap.set(predId, dtArr);
    }

    // Object is guaranteed Literal here (non-Literal cases continued above)
    dtArr.push(quad.object.datatype.value);
  }

  return index;
}

// ---------------------------------------------------------------------------
// Shape index — parsed representation of SHACL shapes
// ---------------------------------------------------------------------------

/** A parsed property shape. */
type PropertyShapeIndexType = {
  readonly 'bnodeId': string;
  readonly 'constraints': PredicateIndex;
  readonly 'isDeactivated': boolean;
  readonly 'path': string;
};

/** A parsed node shape. */
type NodeShapeIndexType = {
  readonly 'constraints': PredicateIndex;
  readonly 'isDeactivated': boolean;
  readonly 'propertyShapes': PropertyShapeIndexType[];
  readonly 'shapeIri': string;
};

/**
 * Determine whether a blank node is marked sh:deactivated true.
 */
function isDeactivated(bnodeId: string, shapeIndex: SubjectPredicateIndex): boolean {
  const node = shapeIndex.get(bnodeId);

  if (node === undefined) {
    return false;
  }

  return node.get(SH.deactivated)?.includes('true') === true;
}

/**
 * Extract the `PredicateIndex` for a subject from the shape quad index.
 */
function extractConstraints(id: string, shapeIndex: SubjectPredicateIndex): PredicateIndex {
  const node = shapeIndex.get(id);

  return node ?? new Map<string, string[]>();
}

/**
 * Build a parsed shape view for any subject id — a named NodeShape IRI, or an
 * anonymous blank-node shape used as an `sh:and`/`sh:or`/`sh:not`/`sh:node`
 * member. Returns `undefined` when the subject carries no shape content.
 */
function buildShapeView(shapeId: string, shapeIndex: SubjectPredicateIndex): NodeShapeIndexType | undefined {
  const pmap = shapeIndex.get(shapeId);

  if (pmap === undefined) {
    return undefined;
  }

  const propertyBnodeIds = pmap.get(SH.property) ?? [];
  const propertyShapes: PropertyShapeIndexType[] = [];

  for (const bnodeId of propertyBnodeIds) {
    const psNode = shapeIndex.get(bnodeId);

    if (psNode === undefined) {
      continue;
    }

    const pathArr = psNode.get(SH.path);

    if (pathArr === undefined || pathArr.length === 0) {
      continue;
    }

    propertyShapes.push({
      'bnodeId': bnodeId,
      'constraints': extractConstraints(bnodeId, shapeIndex),
      'isDeactivated': isDeactivated(bnodeId, shapeIndex),
      'path': pathArr[0]
    });
  }

  return {
    'constraints': extractConstraints(shapeId, shapeIndex),
    'isDeactivated': pmap.get(SH.deactivated)?.includes('true') === true,
    'propertyShapes': propertyShapes,
    'shapeIri': shapeId
  };
}

/**
 * Parse all named (non-blank-node) NodeShape IRIs. These are the top-level
 * shapes whose focus nodes are selected by implicit class target (rdf:type).
 */
function buildNodeShapes(shapeIndex: SubjectPredicateIndex): NodeShapeIndexType[] {
  const shapes: NodeShapeIndexType[] = [];

  for (const [
    subject,
    pmap
  ] of shapeIndex) {
    if (pmap.get(RDF.type)?.includes(SH.NodeShape) !== true) {
      continue;
    }

    if (subject.startsWith('_:')) {
      continue;
    }

    const view = buildShapeView(subject, shapeIndex);

    if (view !== undefined) {
      shapes.push(view);
    }
  }

  return shapes;
}

/**
 * Shared validation context threaded through every evaluator. `resolveShape`
 * returns the parsed view for any shape id (named NodeShape or anonymous
 * blank-node member shape), and `visited` guards `sh:node`/`sh:and`/`sh:or`/
 * `sh:not` recursion against cyclic data so a self-referential graph cannot
 * overflow the stack.
 */
type ValidationContextType = {
  readonly 'dataIndex': SubjectPredicateIndex;
  readonly 'datatypeBySubjectPredicate': DatatypeIndex;
  readonly 'dataTypeIndex': TypeIndex;
  readonly 'resolveShape': (shapeId: string) => NodeShapeIndexType | undefined;
  readonly 'shapeIndex': SubjectPredicateIndex;
  readonly 'visited': Set<string>;
};

/**
 * Build a memoised shape resolver over the named shapes plus on-demand
 * blank-node member shapes.
 */
function makeShapeResolver(
  namedShapes: NodeShapeIndexType[],
  shapeIndex: SubjectPredicateIndex
): (shapeId: string) => NodeShapeIndexType | undefined {
  const byIri = new Map<string, NodeShapeIndexType>();

  for (const shape of namedShapes) {
    byIri.set(shape.shapeIri, shape);
  }

  const cache = new Map<string, NodeShapeIndexType | undefined>();

  return (shapeId: string): NodeShapeIndexType | undefined => {
    const named = byIri.get(shapeId);

    if (named !== undefined) {
      return named;
    }

    if (cache.has(shapeId)) {
      return cache.get(shapeId);
    }

    const view = buildShapeView(shapeId, shapeIndex);

    cache.set(shapeId, view);

    return view;
  };
}

// ---------------------------------------------------------------------------
// Focus node selection
// ---------------------------------------------------------------------------

/**
 * Select focus nodes for a NodeShape.
 *
 * `ShaclProjection` emits shapes whose IRI equals the class IRI.
 * Focus nodes are all ABox subjects that carry `rdf:type <shapeIri>`.
 */
function selectFocusNodes(
  shapeIri: string,
  dataTypeIndex: TypeIndex
): string[] {
  const nodes: string[] = [];

  for (const [
    subject,
    types
  ] of dataTypeIndex) {
    if (types.has(shapeIri)) {
      nodes.push(subject);
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Numeric comparison helpers
// ---------------------------------------------------------------------------

function parseNumeric(value: string): number {
  const num = Number(value);

  return Number.isFinite(num) ? num : Number.NaN;
}

// ---------------------------------------------------------------------------
// Constraint evaluation helpers
// ---------------------------------------------------------------------------

/** Arguments shared across all constraint evaluators. */
type EvalArgsType = {
  readonly 'constraints': PredicateIndex;
  readonly 'dataIndex': SubjectPredicateIndex;
  readonly 'datatypeBySubjectPredicate': DatatypeIndex;
  readonly 'dataTypeIndex': TypeIndex;
  readonly 'focusNode': string;
  readonly 'path': string;
  readonly 'shapeId': string;
  readonly 'shapeIndex': SubjectPredicateIndex;
  readonly 'valueCount': number;
  readonly 'values': string[];
};

/**
 * Build a single violation result. A node-level constraint (no property path)
 * passes `path` as `undefined` or `''`; per the SHACL spec the result then omits
 * `sh:resultPath` rather than carrying an empty path.
 */
function violation(
  focusNode: string,
  path: string | undefined,
  component: string,
  message: string,
  value: string | undefined,
  sourceShape: string | undefined
): ShaclValidationResultType {
  return {
    'focusNode': focusNode,
    'resultMessage': message,
    'resultSeverity': 'Violation',
    'sourceConstraintComponent': component,
    ...(path === undefined || path === '' ? {} : { 'resultPath': path }),
    ...(sourceShape === undefined ? {} : { 'sourceShape': sourceShape }),
    ...(value === undefined ? {} : { 'value': value })
  };
}

/** Evaluate sh:minCount constraint. */
function evalMinCount(args: EvalArgsType): ShaclValidationResultType[] {
  const minCountArr = args.constraints.get(SH.minCount);

  if (minCountArr === undefined || minCountArr.length === 0) {
    return [];
  }

  const min = parseNumeric(minCountArr[0]);

  if (Number.isNaN(min) || args.valueCount >= min) {
    return [];
  }

  return [violation(
    args.focusNode,
    args.path,
    SH.MinCountConstraintComponent,
    `Expected at least ${min} value(s) for <${args.path}> but found ${args.valueCount}.`,
    undefined,
    args.shapeId
  )];
}

/** Evaluate sh:maxCount constraint. */
function evalMaxCount(args: EvalArgsType): ShaclValidationResultType[] {
  const maxCountArr = args.constraints.get(SH.maxCount);

  if (maxCountArr === undefined || maxCountArr.length === 0) {
    return [];
  }

  const max = parseNumeric(maxCountArr[0]);

  if (Number.isNaN(max) || args.valueCount <= max) {
    return [];
  }

  return [violation(
    args.focusNode,
    args.path,
    SH.MaxCountConstraintComponent,
    `Expected at most ${max} value(s) for <${args.path}> but found ${args.valueCount}.`,
    String(args.valueCount),
    args.shapeId
  )];
}

/** Evaluate sh:datatype constraint against each value node. */
function evalDatatype(args: EvalArgsType): ShaclValidationResultType[] {
  const datatypeArr = args.constraints.get(SH.datatype);

  if (datatypeArr === undefined || datatypeArr.length === 0) {
    return [];
  }

  const expectedDatatype = datatypeArr[0];
  const results: ShaclValidationResultType[] = [];
  const actualDatatypes = args.datatypeBySubjectPredicate.get(args.focusNode)?.get(args.path) ?? [];

  for (let idx = 0; idx < args.values.length; idx++) {
    const actualDt = actualDatatypes[idx] ?? XSD.string;

    if (actualDt !== expectedDatatype) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.DatatypeConstraintComponent,
        `Value "${args.values[idx]}" has datatype <${actualDt}> but expected <${expectedDatatype}>.`,
        args.values[idx],
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:pattern constraint against each value node. */
function evalPattern(args: EvalArgsType): ShaclValidationResultType[] {
  const patternArr = args.constraints.get(SH.pattern);

  if (patternArr === undefined || patternArr.length === 0) {
    return [];
  }

  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    for (const pattern of patternArr) {
      let matches: boolean;

      try {
        matches = new RegExp(pattern).test(value);
      } catch {
        // Invalid regex — skip
        matches = true;
      }

      if (!matches) {
        results.push(violation(
          args.focusNode,
          args.path,
          SH.PatternConstraintComponent,
          `Value "${value}" does not match pattern "${pattern}".`,
          value,
          args.shapeId
        ));
      }
    }
  }

  return results;
}

/** Evaluate sh:minLength constraint. */
function evalMinLength(args: EvalArgsType): ShaclValidationResultType[] {
  const minLenArr = args.constraints.get(SH.minLength);

  if (minLenArr === undefined || minLenArr.length === 0) {
    return [];
  }

  const min = parseNumeric(minLenArr[0]);
  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    if (value.length < min) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.MinLengthConstraintComponent,
        `Value "${value}" has length ${value.length} which is less than sh:minLength ${min}.`,
        value,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:maxLength constraint. */
function evalMaxLength(args: EvalArgsType): ShaclValidationResultType[] {
  const maxLenArr = args.constraints.get(SH.maxLength);

  if (maxLenArr === undefined || maxLenArr.length === 0) {
    return [];
  }

  const max = parseNumeric(maxLenArr[0]);
  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    if (value.length > max) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.MaxLengthConstraintComponent,
        `Value "${value}" has length ${value.length} which exceeds sh:maxLength ${max}.`,
        value,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:minInclusive constraint. */
function evalMinInclusive(args: EvalArgsType): ShaclValidationResultType[] {
  const minArr = args.constraints.get(SH.minInclusive);

  if (minArr === undefined || minArr.length === 0) {
    return [];
  }

  const min = parseNumeric(minArr[0]);
  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    const num = parseNumeric(value);

    if (Number.isNaN(num) || num < min) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.MinInclusiveConstraintComponent,
        `Value ${value} is less than sh:minInclusive ${minArr[0]}.`,
        value,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:maxInclusive constraint. */
function evalMaxInclusive(args: EvalArgsType): ShaclValidationResultType[] {
  const maxArr = args.constraints.get(SH.maxInclusive);

  if (maxArr === undefined || maxArr.length === 0) {
    return [];
  }

  const max = parseNumeric(maxArr[0]);
  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    const num = parseNumeric(value);

    if (Number.isNaN(num) || num > max) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.MaxInclusiveConstraintComponent,
        `Value ${value} exceeds sh:maxInclusive ${maxArr[0]}.`,
        value,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:minExclusive constraint. */
function evalMinExclusive(args: EvalArgsType): ShaclValidationResultType[] {
  const minArr = args.constraints.get(SH.minExclusive);

  if (minArr === undefined || minArr.length === 0) {
    return [];
  }

  const min = parseNumeric(minArr[0]);
  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    const num = parseNumeric(value);

    if (Number.isNaN(num) || num <= min) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.MinExclusiveConstraintComponent,
        `Value ${value} must be greater than sh:minExclusive ${minArr[0]}.`,
        value,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:maxExclusive constraint. */
function evalMaxExclusive(args: EvalArgsType): ShaclValidationResultType[] {
  const maxArr = args.constraints.get(SH.maxExclusive);

  if (maxArr === undefined || maxArr.length === 0) {
    return [];
  }

  const max = parseNumeric(maxArr[0]);
  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    const num = parseNumeric(value);

    if (Number.isNaN(num) || num >= max) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.MaxExclusiveConstraintComponent,
        `Value ${value} must be less than sh:maxExclusive ${maxArr[0]}.`,
        value,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:hasValue constraint. */
function evalHasValue(args: EvalArgsType): ShaclValidationResultType[] {
  const hasValueArr = args.constraints.get(SH.hasValue);

  if (hasValueArr === undefined || hasValueArr.length === 0) {
    return [];
  }

  const results: ShaclValidationResultType[] = [];

  for (const required of hasValueArr) {
    if (!args.values.includes(required)) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.HasValueConstraintComponent,
        `sh:hasValue "${required}" not found among values for <${args.path}>.`,
        undefined,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:in constraint against a list head bnode. */
function evalIn(args: EvalArgsType): ShaclValidationResultType[] {
  const inArr = args.constraints.get(SH.in);

  if (inArr === undefined || inArr.length === 0) {
    return [];
  }

  const listHead = inArr[0];
  const allowed = collectRdfListValues(listHead, args.shapeIndex);

  if (allowed.length === 0) {
    return [];
  }

  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    if (!allowed.includes(value)) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.InConstraintComponent,
        `Value "${value}" is not in the sh:in list [${allowed.join(', ')}].`,
        value,
        args.shapeId
      ));
    }
  }

  return results;
}

/** Evaluate sh:class constraint — value nodes must have the required rdf:type. */
function evalClass(args: EvalArgsType): ShaclValidationResultType[] {
  const classArr = args.constraints.get(SH.class);

  if (classArr === undefined || classArr.length === 0) {
    return [];
  }

  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    for (const requiredClass of classArr) {
      const types = args.dataTypeIndex.get(value);
      const hasClass = types?.has(requiredClass) ?? false;

      if (!hasClass) {
        results.push(violation(
          args.focusNode,
          args.path,
          SH.ClassConstraintComponent,
          `Value <${value}> does not have required rdf:type <${requiredClass}>.`,
          value,
          args.shapeId
        ));
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// sh:node — recursive shape evaluation
// ---------------------------------------------------------------------------

/** Evaluate sh:node — each value node must conform to the referenced shape. */
function evalNode(
  args: EvalArgsType,
  ctx: ValidationContextType
): ShaclValidationResultType[] {
  const nodeArr = args.constraints.get(SH.node);

  if (nodeArr === undefined || nodeArr.length === 0) {
    return [];
  }

  const results: ShaclValidationResultType[] = [];

  for (const value of args.values) {
    for (const nodeShapeIri of nodeArr) {
      const nested = validateShape(value, nodeShapeIri, ctx);

      if (nested.length > 0) {
        results.push(violation(
          args.focusNode,
          args.path,
          SH.NodeConstraintComponent,
          `Value <${value}> does not conform to node shape <${nodeShapeIri}>.`,
          value,
          args.shapeId
        ));
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// sh:closed
// ---------------------------------------------------------------------------

/**
 * Evaluate sh:closed constraint.
 *
 * Collects all declared sh:path IRIs from property shapes on this node shape
 * and flags any ABox predicates (minus rdf:type) that are not in that set.
 */
function evalClosed(
  focusNode: string,
  shape: NodeShapeIndexType,
  dataIndex: SubjectPredicateIndex
): ShaclValidationResultType[] {
  const closedArr = shape.constraints.get(SH.closed);

  if (closedArr?.includes('true') !== true) {
    return [];
  }

  const allowedPaths = new Set<string>();

  for (const ps of shape.propertyShapes) {
    allowedPaths.add(ps.path);
  }

  const focusPredicates = dataIndex.get(focusNode);

  if (focusPredicates === undefined) {
    return [];
  }

  const results: ShaclValidationResultType[] = [];

  for (const [predicate] of focusPredicates) {
    if (predicate === RDF.type) {
      continue;
    }

    if (!allowedPaths.has(predicate)) {
      results.push(violation(
        focusNode,
        predicate,
        SH.ClosedConstraintComponent,
        `Predicate <${predicate}> is not allowed because sh:closed is true.`,
        undefined,
        shape.shapeIri
      ));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// sh:qualifiedValueShape + sh:qualifiedMinCount / sh:qualifiedMaxCount
// ---------------------------------------------------------------------------

/** Evaluate qualified value shape cardinality constraints. */
function evalQualifiedValueShape(
  args: EvalArgsType,
  ctx: ValidationContextType
): ShaclValidationResultType[] {
  const qvsArr = args.constraints.get(SH.qualifiedValueShape);

  if (qvsArr === undefined || qvsArr.length === 0) {
    return [];
  }

  const qvsRef = qvsArr[0];
  const innerShape = ctx.resolveShape(qvsRef);
  // A blank-node inner shape constraining only sh:datatype validates the value
  // nodes' datatype at the parent path (the values are literals, whose datatype
  // is recorded per subject+predicate, not retrievable from the value alone).
  const datatypeOnly = qvsRef.startsWith('_:')
    && innerShape?.propertyShapes.length === 0
    && innerShape.constraints.has(SH.datatype)
    && !innerShape.constraints.has(SH.node);
  const expectedDt = datatypeOnly ? innerShape.constraints.get(SH.datatype)?.[0] : undefined;
  const actualDts = args.datatypeBySubjectPredicate.get(args.focusNode)?.get(args.path) ?? [];
  const results: ShaclValidationResultType[] = [];
  let qualifiedCount = 0;

  for (const value of args.values) {
    const valueConforms = datatypeOnly
      ? expectedDt !== undefined && actualDts.includes(expectedDt)
      : validateShape(value, qvsRef, ctx).length === 0;

    if (valueConforms) {
      qualifiedCount++;
    }
  }

  const qMinArr = args.constraints.get(SH.qualifiedMinCount);

  if (qMinArr !== undefined && qMinArr.length > 0) {
    const qMin = parseNumeric(qMinArr[0]);

    if (!Number.isNaN(qMin) && qualifiedCount < qMin) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.QualifiedMinCountConstraintComponent,
        `Expected at least ${qMin} value(s) matching sh:qualifiedValueShape but found ${qualifiedCount}.`,
        undefined,
        args.shapeId
      ));
    }
  }

  const qMaxArr = args.constraints.get(SH.qualifiedMaxCount);

  if (qMaxArr !== undefined && qMaxArr.length > 0) {
    const qMax = parseNumeric(qMaxArr[0]);

    if (!Number.isNaN(qMax) && qualifiedCount > qMax) {
      results.push(violation(
        args.focusNode,
        args.path,
        SH.QualifiedMaxCountConstraintComponent,
        `Expected at most ${qMax} value(s) matching sh:qualifiedValueShape but found ${qualifiedCount}.`,
        undefined,
        args.shapeId
      ));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// sh:and / sh:or / sh:not — logical constraints at node shape level
// ---------------------------------------------------------------------------

/** Evaluate sh:and — the focus node must conform to every member shape. */
function evalAnd(
  focusNode: string,
  shapeConstraints: PredicateIndex,
  ctx: ValidationContextType,
  shapeIri: string
): ShaclValidationResultType[] {
  const andArr = shapeConstraints.get(SH.and);

  if (andArr === undefined || andArr.length === 0) {
    return [];
  }

  const memberIris = collectRdfListValues(andArr[0], ctx.shapeIndex);
  const results: ShaclValidationResultType[] = [];

  for (const memberIri of memberIris) {
    if (validateShape(focusNode, memberIri, ctx).length > 0) {
      results.push(violation(
        focusNode,
        undefined,
        SH.AndConstraintComponent,
        `Focus node does not conform to sh:and member <${memberIri}>.`,
        undefined,
        shapeIri
      ));
    }
  }

  return results;
}

/** Evaluate sh:or — the focus node must conform to at least one member shape. */
function evalOr(
  focusNode: string,
  shapeConstraints: PredicateIndex,
  ctx: ValidationContextType,
  shapeIri: string
): ShaclValidationResultType[] {
  const orArr = shapeConstraints.get(SH.or);

  if (orArr === undefined || orArr.length === 0) {
    return [];
  }

  const memberIris = collectRdfListValues(orArr[0], ctx.shapeIndex);

  if (memberIris.length === 0) {
    return [];
  }

  for (const memberIri of memberIris) {
    if (validateShape(focusNode, memberIri, ctx).length === 0) {
      return [];
    }
  }

  return [violation(
    focusNode,
    undefined,
    SH.OrConstraintComponent,
    `Focus node does not conform to any sh:or member [${memberIris.join(', ')}].`,
    undefined,
    shapeIri
  )];
}

/** Evaluate sh:not — the focus node must NOT conform to the referenced shape. */
function evalNot(
  focusNode: string,
  shapeConstraints: PredicateIndex,
  ctx: ValidationContextType,
  shapeIri: string
): ShaclValidationResultType[] {
  const notArr = shapeConstraints.get(SH.not);

  if (notArr === undefined || notArr.length === 0) {
    return [];
  }

  const results: ShaclValidationResultType[] = [];

  for (const notRef of notArr) {
    if (validateShape(focusNode, notRef, ctx).length === 0) {
      results.push(violation(
        focusNode,
        undefined,
        SH.NotConstraintComponent,
        `Focus node must NOT conform to shape <${notRef}> but it does.`,
        undefined,
        shapeIri
      ));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

/** Build the shared evaluator args bag for a focus node + path + constraints. */
function buildEvalArgs(
  focusNode: string,
  path: string,
  shapeId: string,
  constraints: PredicateIndex,
  values: string[],
  ctx: ValidationContextType
): EvalArgsType {
  return {
    constraints,
    'dataIndex': ctx.dataIndex,
    'datatypeBySubjectPredicate': ctx.datatypeBySubjectPredicate,
    'dataTypeIndex': ctx.dataTypeIndex,
    focusNode,
    path,
    shapeId,
    'shapeIndex': ctx.shapeIndex,
    'valueCount': values.length,
    values
  };
}

/**
 * Evaluate a shape's own (node-level) constraints against the focus node as a
 * single value node. Only IRI-safe components apply here — `sh:in`, `sh:hasValue`,
 * `sh:class`, `sh:node` — because in this contract a focus node reached by an
 * implicit class target or `sh:node` is always an IRI, never a literal; datatype,
 * range, length and pattern constraints are carried by property shapes instead.
 * Path is empty so node-level results omit `sh:resultPath`.
 */
function evalNodeLevelConstraints(
  focusNode: string,
  shape: NodeShapeIndexType,
  ctx: ValidationContextType
): ShaclValidationResultType[] {
  const args = buildEvalArgs(focusNode, '', shape.shapeIri, shape.constraints, [focusNode], ctx);

  return [
    ...evalIn(args),
    ...evalHasValue(args),
    ...evalClass(args),
    ...evalNode(args, ctx)
  ];
}

/**
 * Validate a single focus node against a shape (named NodeShape or anonymous
 * blank-node member shape). Recursion through `sh:node`/`sh:and`/`sh:or`/`sh:not`
 * is guarded by `ctx.visited`: re-entering the same (focusNode, shape) pair while
 * it is already on the stack returns conforming, so cyclic data cannot overflow.
 */
function validateShape(
  focusNode: string,
  shapeId: string,
  ctx: ValidationContextType
): ShaclValidationResultType[] {
  const visitKey = `${focusNode} ${shapeId}`;

  if (ctx.visited.has(visitKey)) {
    return [];
  }

  ctx.visited.add(visitKey);

  try {
    const shape = ctx.resolveShape(shapeId);

    if (shape === undefined || shape.isDeactivated) {
      return [];
    }

    const focusPredicates = ctx.dataIndex.get(focusNode);
    const results: ShaclValidationResultType[] = [];

    results.push(...evalNodeLevelConstraints(focusNode, shape, ctx));

    for (const ps of shape.propertyShapes) {
      if (ps.isDeactivated) {
        continue;
      }

      const values = focusPredicates?.get(ps.path) ?? [];
      const evalArgs = buildEvalArgs(focusNode, ps.path, ps.bnodeId, ps.constraints, values, ctx);

      results.push(...evalMinCount(evalArgs));
      results.push(...evalMaxCount(evalArgs));
      results.push(...evalDatatype(evalArgs));
      results.push(...evalPattern(evalArgs));
      results.push(...evalMinLength(evalArgs));
      results.push(...evalMaxLength(evalArgs));
      results.push(...evalMinInclusive(evalArgs));
      results.push(...evalMaxInclusive(evalArgs));
      results.push(...evalMinExclusive(evalArgs));
      results.push(...evalMaxExclusive(evalArgs));
      results.push(...evalHasValue(evalArgs));
      results.push(...evalIn(evalArgs));
      results.push(...evalClass(evalArgs));
      results.push(...evalNode(evalArgs, ctx));
      results.push(...evalQualifiedValueShape(evalArgs, ctx));
    }

    results.push(...evalClosed(focusNode, shape, ctx.dataIndex));
    results.push(...evalAnd(focusNode, shape.constraints, ctx, shape.shapeIri));
    results.push(...evalOr(focusNode, shape.constraints, ctx, shape.shapeIri));
    results.push(...evalNot(focusNode, shape.constraints, ctx, shape.shapeIri));

    return results;
  } finally {
    ctx.visited.delete(visitKey);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Native SHACL validation engine.
 *
 * Consumes SHACL shape quads (from `toShacl().shaclQuads()`) and ABox instance
 * data quads (from `toQuads()`), and returns a structured conformance report.
 *
 * Only handles SHACL constructs emitted by `ShaclProjection`. Complex path
 * expressions (inverse, sequence, alternative, zero-or-more, etc.) are not
 * supported because `ShaclProjection` emits only simple predicate paths.
 *
 * @example
 * ```ts
 * const shapeQuads = jt.toShacl().shaclQuads();
 * const dataQuads  = jt.toQuads(MySchema, instance);
 * const report = ShaclValidator.validate(shapeQuads, dataQuads);
 * console.log(report.conforms); // true / false
 * ```
 *
 * @category SHACL
 * @since 0.20.0
 */
export const ShaclValidator = {
  validate(
    shapes: readonly QuadInterface[],
    data: readonly QuadInterface[]
  ): ShaclValidationReportType {
    const shapeIndex = buildSubjectIndex(shapes);
    const dataIndex = buildSubjectIndex(data);
    const dataTypeIndex = buildTypeIndex(data);
    const datatypeBySubjectPredicate = buildDatatypeIndex(data);

    const allNodeShapes = buildNodeShapes(shapeIndex);
    const ctx: ValidationContextType = {
      dataIndex,
      datatypeBySubjectPredicate,
      dataTypeIndex,
      'resolveShape': makeShapeResolver(allNodeShapes, shapeIndex),
      shapeIndex,
      'visited': new Set<string>()
    };
    const results: ShaclValidationResultType[] = [];

    for (const shape of allNodeShapes) {
      if (shape.isDeactivated) {
        continue;
      }

      const focusNodes = selectFocusNodes(shape.shapeIri, dataTypeIndex);

      for (const focusNode of focusNodes) {
        results.push(...validateShape(focusNode, shape.shapeIri, ctx));
      }
    }

    const conforms = results.every((result) => {
      return result.resultSeverity !== 'Violation';
    });

    return {
      conforms,
      results
    };
  }
} as const;
