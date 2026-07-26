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
 * Architectural boundary: this engine indexes RDF quads (subject -> predicate ->
 * object-value-strings via SubjectPredicateIndexInterface, plus rdf:type and datatype
 * indexes). That is intentionally a distinct model from the canonical
 * SchemaGraph, which is a node/relation graph over a JSON Schema document. SHACL
 * conformance is defined over RDF triples, so it cannot be evaluated against the
 * JSON-Schema graph without re-deriving the SHACL vocabulary (the inverse of
 * ShaclProjection) -- these indexes are therefore not a duplication of
 * SchemaGraph and are not consolidated onto it. Their shapes are SHACL-specific
 * (they hold extracted `.value` strings, not QuadInterface[]) and are not shared
 * with the rdf/ quad-grouping utilities.
 *
 * @module ShaclValidator
 * @category SHACL
 * @since 0.20.0
 */

import type { EvalArgumentsInterface } from '../../interfaces/EvalArgumentsInterface.js';
import type { ValidationContextInterface } from '../../interfaces/ValidationContextInterface.js';
import type { NodeShapeIndexInterface } from '../../interfaces/NodeShapeIndexInterface.js';
import type { PropertyShapeIndexInterface } from '../../interfaces/PropertyShapeIndexInterface.js';
import type { DatatypeIndexInterface } from '../../interfaces/DatatypeIndexInterface.js';
import type { TypeIndexInterface } from '../../interfaces/TypeIndexInterface.js';
import type { SubjectPredicateIndexInterface } from '../../interfaces/SubjectPredicateIndexInterface.js';
import type { PredicateValuesIndexInterface } from '../../interfaces/PredicateValuesIndexInterface.js';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { ShaclValidationReportEntity } from '../../entities/ShaclValidationReportEntity.js';
import type { ShaclValidationResultEntity } from '../../entities/ShaclValidationResultEntity.js';
import {
  RDF, SH, XSD
} from '../../constants/IRI.js';

// ---------------------------------------------------------------------------
// Index builders
// ---------------------------------------------------------------------------

/** Index builders over raw RDF quad arrays. */
class Indexes {
  /**
   * Build subject → predicate → datatype-IRI[] index from literal quads.
   * Non-literal objects produce no entry.
   */
  static datatype(quads: readonly QuadInterface[]): DatatypeIndexInterface {
    const index: DatatypeIndexInterface = new Map();

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
      let datatypeValues = pmap.get(predId);

      if (datatypeValues === undefined) {
        datatypeValues = [];
        pmap.set(predId, datatypeValues);
      }

      // Object is guaranteed Literal here (non-Literal cases continued above)
      datatypeValues.push(quad.object.datatype.value);
    }

    return index;
  }

  /**
   * Build a subject → predicate → object-values index from a quad array.
   * Object values are the `.value` strings of the object terms.
   */
  static subject(quads: readonly QuadInterface[]): SubjectPredicateIndexInterface {
    const index: SubjectPredicateIndexInterface = new Map();

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
  static type(quads: readonly QuadInterface[]): TypeIndexInterface {
    const index: TypeIndexInterface = new Map();

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
}

// ---------------------------------------------------------------------------
// RDF list traversal
// ---------------------------------------------------------------------------

/** RDF list (`rdf:first`/`rdf:rest` chain) traversal over the shapes quad index. */
class RdfList {
  /**
   * Walk an rdf:first/rdf:rest chain and return all `.value` strings of
   * `rdf:first` objects (in list order). Works against the shapes quad index.
   */
  static collectValues(
    headId: string,
    shapeIndex: SubjectPredicateIndexInterface
  ): string[] {
    const values: string[] = [];
    let current = headId;

    while (current !== RDF.nil && current !== '') {
      const node = shapeIndex.get(current);

      if (node === undefined) {
        break;
      }

      const firstArray = node.get(RDF.first);

      if (firstArray !== undefined && firstArray.length > 0) {
        const firstValue = firstArray.at(0);

        if (firstValue !== undefined) {
          values.push(firstValue);
        }
      }

      const restArray = node.get(RDF.rest);

      if (restArray === undefined || restArray.length === 0) {
        break;
      }

      const next = restArray.at(0);

      if (next === undefined) {
        break;
      }

      current = next;
    }

    return values;
  }
}

// ---------------------------------------------------------------------------
// Shape index — parsed representation of SHACL shapes
// ---------------------------------------------------------------------------

/** Extraction of a subject's constraint index from the shape quad index. */
class Constraints {
  /**
   * Extract the `PredicateValuesIndexInterface` for a subject from the shape quad index.
   */
  static extract(id: string, shapeIndex: SubjectPredicateIndexInterface): PredicateValuesIndexInterface {
    const node = shapeIndex.get(id);

    return node ?? new Map<string, string[]>();
  }
}

/** Parsed shape-view construction over the shape quad index. */
class ShapeView {
  /**
   * Build a parsed shape view for any subject id — a named NodeShape IRI, or an
   * anonymous blank-node shape used as an `sh:and`/`sh:or`/`sh:not`/`sh:node`
   * member. Returns `undefined` when the subject carries no shape content.
   */
  static build(shapeId: string, shapeIndex: SubjectPredicateIndexInterface): NodeShapeIndexInterface | undefined {
    const pmap = shapeIndex.get(shapeId);

    if (pmap === undefined) {
      return undefined;
    }

    const propertyBnodeIds = pmap.get(SH.property) ?? [];
    const propertyShapes: PropertyShapeIndexInterface[] = [];

    for (const bnodeId of propertyBnodeIds) {
      const psNode = shapeIndex.get(bnodeId);

      if (psNode === undefined) {
        continue;
      }

      const pathArray = psNode.get(SH.path);

      if (pathArray === undefined || pathArray.length === 0) {
        continue;
      }

      const pathFirst = pathArray.at(0);

      if (pathFirst === undefined) {
        continue;
      }

      propertyShapes.push({
        'bnodeId': bnodeId,
        'constraints': Constraints.extract(bnodeId, shapeIndex),
        'isDeactivated': ShapeView.isDeactivated(bnodeId, shapeIndex),
        'path': pathFirst
      });
    }

    return {
      'constraints': Constraints.extract(shapeId, shapeIndex),
      'isDeactivated': pmap.get(SH.deactivated)?.includes('true') === true,
      'propertyShapes': propertyShapes,
      'shapeIri': shapeId
    };
  }

  /**
   * Determine whether a blank node is marked sh:deactivated true.
   */
  private static isDeactivated(bnodeId: string, shapeIndex: SubjectPredicateIndexInterface): boolean {
    const node = shapeIndex.get(bnodeId);

    if (node === undefined) {
      return false;
    }

    return node.get(SH.deactivated)?.includes('true') === true;
  }
}

/** Enumeration of named NodeShapes from the shape quad index. */
class NodeShapes {
  /**
   * Parse all named (non-blank-node) NodeShape IRIs. These are the top-level
   * shapes whose focus nodes are selected by implicit class target (rdf:type).
   */
  static build(shapeIndex: SubjectPredicateIndexInterface): NodeShapeIndexInterface[] {
    const shapes: NodeShapeIndexInterface[] = [];

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

      const view = ShapeView.build(subject, shapeIndex);

      if (view !== undefined) {
        shapes.push(view);
      }
    }

    return shapes;
  }
}

/** Memoised shape resolution over named shapes plus on-demand blank-node member shapes. */
class ShapeResolver {
  /**
   * Build a memoised shape resolver over the named shapes plus on-demand
   * blank-node member shapes.
   */
  static make(
    namedShapes: NodeShapeIndexInterface[],
    shapeIndex: SubjectPredicateIndexInterface
  ): (shapeId: string) => NodeShapeIndexInterface | undefined {
    const byIri = new Map<string, NodeShapeIndexInterface>();

    for (const shape of namedShapes) {
      byIri.set(shape.shapeIri, shape);
    }

    const cache = new Map<string, NodeShapeIndexInterface | undefined>();

    return (shapeId: string): NodeShapeIndexInterface | undefined => {
      const named = byIri.get(shapeId);

      if (named !== undefined) {
        return named;
      }

      if (cache.has(shapeId)) {
        return cache.get(shapeId);
      }

      const view = ShapeView.build(shapeId, shapeIndex);

      cache.set(shapeId, view);

      return view;
    };
  }
}

// ---------------------------------------------------------------------------
// Focus node selection
// ---------------------------------------------------------------------------

/** Selection of ABox focus nodes for a NodeShape via implicit class target (rdf:type). */
class FocusNodes {
  /**
   * Select focus nodes for a NodeShape.
   *
   * `ShaclProjection` emits shapes whose IRI equals the class IRI.
   * Focus nodes are all ABox subjects that carry `rdf:type <shapeIri>`.
   */
  static select(
    shapeIri: string,
    dataTypeIndex: TypeIndexInterface
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
}

// ---------------------------------------------------------------------------
// Numeric comparison helpers
// ---------------------------------------------------------------------------

/** Numeric literal parsing shared by the range constraint evaluators. */
class Numeric {
  static parse(value: string): number {
    const parsedNumber = Number(value);

    return Number.isFinite(parsedNumber) ? parsedNumber : Number.NaN;
  }
}

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

/** Construction of the shared evaluator argumentList bag for a focus node + path + constraints. */
class EvaluationArgumentsBuilder {
  static build(
    focusNode: string,
    path: string,
    shapeId: string,
    constraints: PredicateValuesIndexInterface,
    values: string[],
    context: ValidationContextInterface
  ): EvalArgumentsInterface {
    return {
      constraints,
      'dataIndex': context.dataIndex,
      'datatypeBySubjectPredicate': context.datatypeBySubjectPredicate,
      'dataTypeIndex': context.dataTypeIndex,
      focusNode,
      path,
      shapeId,
      'shapeIndex': context.shapeIndex,
      'valueCount': values.length,
      values
    };
  }
}

/**
 * Constraint evaluation and recursive per-shape validation, guarded against
 * cyclic re-entry. Grouped into a single class because every `eval*` method is
 * an internal helper used only within {@link Shape.validate} (directly or via
 * {@link Shape.evalNodeLevelConstraints}), and several call `Shape.validate`
 * back (sh:node, sh:qualifiedValueShape, sh:and, sh:or, sh:not).
 */
class Shape {
  /** Evaluate sh:and — the focus node must conform to every member shape. */
  private static evalAnd(
    focusNode: string,
    shapeConstraints: PredicateValuesIndexInterface,
    context: ValidationContextInterface,
    shapeIri: string
  ): ShaclValidationResultEntity.Type[] {
    const andArray = shapeConstraints.get(SH.and);

    if (andArray === undefined || andArray.length === 0) {
      return [];
    }

    const andListHead = andArray.at(0);

    if (andListHead === undefined) {
      return [];
    }

    const memberIris = RdfList.collectValues(andListHead, context.shapeIndex);
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const memberIri of memberIris) {
      if (Shape.validate(focusNode, memberIri, context).length > 0) {
        results.push(Shape.violation(
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

  /** Evaluate sh:class constraint — value nodes must have the required rdf:type. */
  private static evalClass(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const classArray = argumentList.constraints.get(SH.class);

    if (classArray === undefined || classArray.length === 0) {
      return [];
    }

    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      for (const requiredClass of classArray) {
        const types = argumentList.dataTypeIndex.get(value);
        const hasClass = types?.has(requiredClass) ?? false;

        if (!hasClass) {
          results.push(Shape.violation(
            argumentList.focusNode,
            argumentList.path,
            SH.ClassConstraintComponent,
            `Value <${value}> does not have required rdf:type <${requiredClass}>.`,
            value,
            argumentList.shapeId
          ));
        }
      }
    }

    return results;
  }

  /**
   * Evaluate sh:closed constraint.
   *
   * Collects all declared sh:path IRIs from property shapes on this node shape
   * and flags any ABox predicates (minus rdf:type) that are not in that set.
   */
  private static evalClosed(
    focusNode: string,
    shape: NodeShapeIndexInterface,
    dataIndex: SubjectPredicateIndexInterface
  ): ShaclValidationResultEntity.Type[] {
    const closedArray = shape.constraints.get(SH.closed);

    if (closedArray?.includes('true') !== true) {
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

    const results: ShaclValidationResultEntity.Type[] = [];

    for (const [predicate] of focusPredicates) {
      if (predicate === RDF.type) {
        continue;
      }

      if (!allowedPaths.has(predicate)) {
        results.push(Shape.violation(
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

  /** Evaluate sh:datatype constraint against each value node. */
  private static evalDatatype(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const datatypeConstraintArray = argumentList.constraints.get(SH.datatype);

    if (datatypeConstraintArray === undefined || datatypeConstraintArray.length === 0) {
      return [];
    }

    const expectedDatatype = datatypeConstraintArray[0];
    const results: ShaclValidationResultEntity.Type[] = [];
    const actualDatatypes = argumentList.datatypeBySubjectPredicate.get(argumentList.focusNode)?.get(argumentList.path) ?? [];
    const valuesLength = argumentList.values.length;

    for (let index = 0; index < valuesLength; index++) {
      const actualDt = actualDatatypes[index] ?? XSD.string;

      if (actualDt !== expectedDatatype) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.DatatypeConstraintComponent,
          `Value "${argumentList.values[index]}" has datatype <${actualDt}> but expected <${expectedDatatype}>.`,
          argumentList.values[index],
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:hasValue constraint. */
  private static evalHasValue(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const hasValueArray = argumentList.constraints.get(SH.hasValue);

    if (hasValueArray === undefined || hasValueArray.length === 0) {
      return [];
    }

    const results: ShaclValidationResultEntity.Type[] = [];
    const valueSet = new Set(argumentList.values);

    for (const required of hasValueArray) {
      if (!valueSet.has(required)) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.HasValueConstraintComponent,
          `sh:hasValue "${required}" not found among values for <${argumentList.path}>.`,
          undefined,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:in constraint against a list head bnode. */
  private static evalIn(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const inArray = argumentList.constraints.get(SH.in);

    if (inArray === undefined || inArray.length === 0) {
      return [];
    }

    const listHead = inArray.at(0);

    if (listHead === undefined) {
      return [];
    }
    const allowed = RdfList.collectValues(listHead, argumentList.shapeIndex);

    if (allowed.length === 0) {
      return [];
    }

    const results: ShaclValidationResultEntity.Type[] = [];
    const allowedSet = new Set(allowed);

    for (const value of argumentList.values) {
      if (!allowedSet.has(value)) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.InConstraintComponent,
          `Value "${value}" is not in the sh:in list [${allowed.join(', ')}].`,
          value,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:node — each value node must conform to the referenced shape. */
  private static evalNode(
    argumentList: EvalArgumentsInterface,
    context: ValidationContextInterface
  ): ShaclValidationResultEntity.Type[] {
    const nodeArray = argumentList.constraints.get(SH.node);

    if (nodeArray === undefined || nodeArray.length === 0) {
      return [];
    }

    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      for (const nodeShapeIri of nodeArray) {
        const nested = Shape.validate(value, nodeShapeIri, context);

        if (nested.length > 0) {
          results.push(Shape.violation(
            argumentList.focusNode,
            argumentList.path,
            SH.NodeConstraintComponent,
            `Value <${value}> does not conform to node shape <${nodeShapeIri}>.`,
            value,
            argumentList.shapeId
          ));
        }
      }
    }

    return results;
  }

  /**
   * Evaluate a shape's own (node-level) constraints against the focus node as a
   * single value node. Only IRI-safe components apply here — `sh:in`, `sh:hasValue`,
   * `sh:class`, `sh:node` — because in this contract a focus node reached by an
   * implicit class target or `sh:node` is always an IRI, never a literal; datatype,
   * range, length and pattern constraints are carried by property shapes instead.
   * Path is empty so node-level results omit `sh:resultPath`.
   */
  private static evalNodeLevelConstraints(
    focusNode: string,
    shape: NodeShapeIndexInterface,
    context: ValidationContextInterface
  ): ShaclValidationResultEntity.Type[] {
    const argumentList = EvaluationArgumentsBuilder.build(focusNode, '', shape.shapeIri, shape.constraints, [focusNode], context);

    return [
      ...Shape.evalIn(argumentList),
      ...Shape.evalHasValue(argumentList),
      ...Shape.evalClass(argumentList),
      ...Shape.evalNode(argumentList, context)
    ];
  }

  /** Evaluate sh:not — the focus node must NOT conform to the referenced shape. */
  private static evalNot(
    focusNode: string,
    shapeConstraints: PredicateValuesIndexInterface,
    context: ValidationContextInterface,
    shapeIri: string
  ): ShaclValidationResultEntity.Type[] {
    const notArray = shapeConstraints.get(SH.not);

    if (notArray === undefined || notArray.length === 0) {
      return [];
    }

    const results: ShaclValidationResultEntity.Type[] = [];

    for (const notReference of notArray) {
      if (Shape.validate(focusNode, notReference, context).length === 0) {
        results.push(Shape.violation(
          focusNode,
          undefined,
          SH.NotConstraintComponent,
          `Focus node must NOT conform to shape <${notReference}> but it does.`,
          undefined,
          shapeIri
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:or — the focus node must conform to at least one member shape. */
  private static evalOr(
    focusNode: string,
    shapeConstraints: PredicateValuesIndexInterface,
    context: ValidationContextInterface,
    shapeIri: string
  ): ShaclValidationResultEntity.Type[] {
    const orArray = shapeConstraints.get(SH.or);

    if (orArray === undefined || orArray.length === 0) {
      return [];
    }

    const orListHead = orArray.at(0);

    if (orListHead === undefined) {
      return [];
    }

    const memberIris = RdfList.collectValues(orListHead, context.shapeIndex);

    if (memberIris.length === 0) {
      return [];
    }

    for (const memberIri of memberIris) {
      if (Shape.validate(focusNode, memberIri, context).length === 0) {
        return [];
      }
    }

    return [Shape.violation(
      focusNode,
      undefined,
      SH.OrConstraintComponent,
      `Focus node does not conform to any sh:or member [${memberIris.join(', ')}].`,
      undefined,
      shapeIri
    )];
  }

  /** Evaluate sh:pattern constraint against each value node. */
  private static evalPattern(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const patternArray = argumentList.constraints.get(SH.pattern);

    if (patternArray === undefined || patternArray.length === 0) {
      return [];
    }

    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      for (const pattern of patternArray) {
        const matches = Shape.testPatternConstraint(pattern, value);

        if (matches === undefined) {
          results.push(Shape.violation(
            argumentList.focusNode,
            argumentList.path,
            SH.PatternConstraintComponent,
            `sh:pattern "${pattern}" is not a valid regular expression.`,
            value,
            argumentList.shapeId
          ));
          continue;
        }

        if (!matches) {
          results.push(Shape.violation(
            argumentList.focusNode,
            argumentList.path,
            SH.PatternConstraintComponent,
            `Value "${value}" does not match pattern "${pattern}".`,
            value,
            argumentList.shapeId
          ));
        }
      }
    }

    return results;
  }

  /** Evaluate qualified value shape cardinality constraints. */
  private static evalQualifiedValueShape(
    argumentList: EvalArgumentsInterface,
    context: ValidationContextInterface
  ): ShaclValidationResultEntity.Type[] {
    const qualifiedValueShapeArray = argumentList.constraints.get(SH.qualifiedValueShape);

    if (qualifiedValueShapeArray === undefined || qualifiedValueShapeArray.length === 0) {
      return [];
    }

    const qualifiedValueShapeReference = qualifiedValueShapeArray.at(0);

    if (qualifiedValueShapeReference === undefined) {
      return [];
    }

    const innerShape = context.resolveShape(qualifiedValueShapeReference);
    // A blank-node inner shape constraining only sh:datatype validates the value
    // nodes' datatype at the parent path (the values are literals, whose datatype
    // is recorded per subject+predicate, not retrievable from the value alone).
    const datatypeOnly = qualifiedValueShapeReference.startsWith('_:')
      && innerShape?.propertyShapes.length === 0
      && innerShape.constraints.has(SH.datatype)
      && !innerShape.constraints.has(SH.node);
    const expectedDt = datatypeOnly ? innerShape.constraints.get(SH.datatype)?.at(0) : undefined;
    const actualDts = argumentList.datatypeBySubjectPredicate.get(argumentList.focusNode)?.get(argumentList.path) ?? [];
    const actualDtSet = new Set(actualDts);
    const results: ShaclValidationResultEntity.Type[] = [];
    let qualifiedCount = 0;

    for (const value of argumentList.values) {
      const valueConforms = datatypeOnly
        ? expectedDt !== undefined && actualDtSet.has(expectedDt)
        : Shape.validate(value, qualifiedValueShapeReference, context).length === 0;

      if (valueConforms) {
        qualifiedCount++;
      }
    }

    const qualifiedMinimumArray = argumentList.constraints.get(SH.qualifiedMinCount);

    if (qualifiedMinimumArray !== undefined && qualifiedMinimumArray.length > 0) {
      const qualifiedMinimumValue = qualifiedMinimumArray.at(0);

      if (qualifiedMinimumValue !== undefined) {
        const qualifiedMinimum = Numeric.parse(qualifiedMinimumValue);

        if (!Number.isNaN(qualifiedMinimum) && qualifiedCount < qualifiedMinimum) {
          results.push(Shape.violation(
            argumentList.focusNode,
            argumentList.path,
            SH.QualifiedMinCountConstraintComponent,
            `Expected at least ${qualifiedMinimum} value(s) matching sh:qualifiedValueShape but found ${qualifiedCount}.`,
            undefined,
            argumentList.shapeId
          ));
        }
      }
    }

    const qualifiedMaximumArray = argumentList.constraints.get(SH.qualifiedMaxCount);

    if (qualifiedMaximumArray !== undefined && qualifiedMaximumArray.length > 0) {
      const qualifiedMaximumValue = qualifiedMaximumArray.at(0);

      if (qualifiedMaximumValue !== undefined) {
        const qualifiedMaximum = Numeric.parse(qualifiedMaximumValue);

        if (!Number.isNaN(qualifiedMaximum) && qualifiedCount > qualifiedMaximum) {
          results.push(Shape.violation(
            argumentList.focusNode,
            argumentList.path,
            SH.QualifiedMaxCountConstraintComponent,
            `Expected at most ${qualifiedMaximum} value(s) matching sh:qualifiedValueShape but found ${qualifiedCount}.`,
            undefined,
            argumentList.shapeId
          ));
        }
      }
    }

    return results;
  }

  /** Evaluate sh:maxCount constraint. */
  private static evaluateMaximumCount(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const maximumCountArray = argumentList.constraints.get(SH.maxCount);

    if (maximumCountArray === undefined || maximumCountArray.length === 0) {
      return [];
    }

    const maximumCountValue = maximumCountArray.at(0);

    if (maximumCountValue === undefined) {
      return [];
    }

    const maximum = Numeric.parse(maximumCountValue);

    if (Number.isNaN(maximum) || argumentList.valueCount <= maximum) {
      return [];
    }

    return [Shape.violation(
      argumentList.focusNode,
      argumentList.path,
      SH.MaxCountConstraintComponent,
      `Expected at most ${maximum} value(s) for <${argumentList.path}> but found ${argumentList.valueCount}.`,
      String(argumentList.valueCount),
      argumentList.shapeId
    )];
  }

  /** Evaluate sh:maxExclusive constraint. */
  private static evaluateMaximumExclusive(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const maximumArray = argumentList.constraints.get(SH.maxExclusive);

    if (maximumArray === undefined || maximumArray.length === 0) {
      return [];
    }

    const maximumExclusiveValue = maximumArray.at(0);

    if (maximumExclusiveValue === undefined) {
      return [];
    }

    const maximum = Numeric.parse(maximumExclusiveValue);
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      const parsedNumber = Numeric.parse(value);

      if (Number.isNaN(parsedNumber) || parsedNumber >= maximum) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.MaxExclusiveConstraintComponent,
          `Value ${value} must be less than sh:maxExclusive ${maximumExclusiveValue}.`,
          value,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:maxInclusive constraint. */
  private static evaluateMaximumInclusive(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const maximumArray = argumentList.constraints.get(SH.maxInclusive);

    if (maximumArray === undefined || maximumArray.length === 0) {
      return [];
    }

    const maximumInclusiveValue = maximumArray.at(0);

    if (maximumInclusiveValue === undefined) {
      return [];
    }

    const maximum = Numeric.parse(maximumInclusiveValue);
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      const parsedNumber = Numeric.parse(value);

      if (Number.isNaN(parsedNumber) || parsedNumber > maximum) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.MaxInclusiveConstraintComponent,
          `Value ${value} exceeds sh:maxInclusive ${maximumInclusiveValue}.`,
          value,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:maxLength constraint. */
  private static evaluateMaximumLength(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const maximumLengthArray = argumentList.constraints.get(SH.maxLength);

    if (maximumLengthArray === undefined || maximumLengthArray.length === 0) {
      return [];
    }

    const maximumLengthValue = maximumLengthArray.at(0);

    if (maximumLengthValue === undefined) {
      return [];
    }

    const maximum = Numeric.parse(maximumLengthValue);
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      if (value.length > maximum) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.MaxLengthConstraintComponent,
          `Value "${value}" has length ${value.length} which exceeds sh:maxLength ${maximum}.`,
          value,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:minCount constraint. */
  private static evaluateMinimumCount(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const minimumCountArray = argumentList.constraints.get(SH.minCount);

    if (minimumCountArray === undefined || minimumCountArray.length === 0) {
      return [];
    }

    const minimumCountValue = minimumCountArray.at(0);

    if (minimumCountValue === undefined) {
      return [];
    }

    const minimum = Numeric.parse(minimumCountValue);

    if (Number.isNaN(minimum) || argumentList.valueCount >= minimum) {
      return [];
    }

    return [Shape.violation(
      argumentList.focusNode,
      argumentList.path,
      SH.MinCountConstraintComponent,
      `Expected at least ${minimum} value(s) for <${argumentList.path}> but found ${argumentList.valueCount}.`,
      undefined,
      argumentList.shapeId
    )];
  }

  /** Evaluate sh:minExclusive constraint. */
  private static evaluateMinimumExclusive(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const minimumArray = argumentList.constraints.get(SH.minExclusive);

    if (minimumArray === undefined || minimumArray.length === 0) {
      return [];
    }

    const minimumExclusiveValue = minimumArray.at(0);

    if (minimumExclusiveValue === undefined) {
      return [];
    }

    const minimum = Numeric.parse(minimumExclusiveValue);
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      const parsedNumber = Numeric.parse(value);

      if (Number.isNaN(parsedNumber) || parsedNumber <= minimum) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.MinExclusiveConstraintComponent,
          `Value ${value} must be greater than sh:minExclusive ${minimumExclusiveValue}.`,
          value,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:minInclusive constraint. */
  private static evaluateMinimumInclusive(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const minimumArray = argumentList.constraints.get(SH.minInclusive);

    if (minimumArray === undefined || minimumArray.length === 0) {
      return [];
    }

    const minimumInclusiveValue = minimumArray.at(0);

    if (minimumInclusiveValue === undefined) {
      return [];
    }

    const minimum = Numeric.parse(minimumInclusiveValue);
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      const parsedNumber = Numeric.parse(value);

      if (Number.isNaN(parsedNumber) || parsedNumber < minimum) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.MinInclusiveConstraintComponent,
          `Value ${value} is less than sh:minInclusive ${minimumInclusiveValue}.`,
          value,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Evaluate sh:minLength constraint. */
  private static evaluateMinimumLength(argumentList: EvalArgumentsInterface): ShaclValidationResultEntity.Type[] {
    const minimumLengthArray = argumentList.constraints.get(SH.minLength);

    if (minimumLengthArray === undefined || minimumLengthArray.length === 0) {
      return [];
    }

    const minimumLengthValue = minimumLengthArray.at(0);

    if (minimumLengthValue === undefined) {
      return [];
    }

    const minimum = Numeric.parse(minimumLengthValue);
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const value of argumentList.values) {
      if (value.length < minimum) {
        results.push(Shape.violation(
          argumentList.focusNode,
          argumentList.path,
          SH.MinLengthConstraintComponent,
          `Value "${value}" has length ${value.length} which is less than sh:minLength ${minimum}.`,
          value,
          argumentList.shapeId
        ));
      }
    }

    return results;
  }

  /** Test a single sh:pattern regex against a value; `undefined` signals an invalid pattern. */
  private static testPatternConstraint(pattern: string, value: string): boolean | undefined {
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return undefined;
    }
  }

  /**
   * Validate a single focus node against a shape (named NodeShape or anonymous
   * blank-node member shape). Recursion through `sh:node`/`sh:and`/`sh:or`/`sh:not`
   * is guarded by `context.visited`: re-entering the same (focusNode, shape) pair while
   * it is already on the stack returns conforming, so cyclic data cannot overflow.
   */
  static validate(
    focusNode: string,
    shapeId: string,
    context: ValidationContextInterface
  ): ShaclValidationResultEntity.Type[] {
    const visitKey = `${focusNode} ${shapeId}`;

    if (context.visited.has(visitKey)) {
      return [];
    }

    context.visited.add(visitKey);

    try {
      const shape = context.resolveShape(shapeId);

      if (shape === undefined || shape.isDeactivated) {
        return [];
      }

      const focusPredicates = context.dataIndex.get(focusNode);
      const results: ShaclValidationResultEntity.Type[] = [];

      results.push(...Shape.evalNodeLevelConstraints(focusNode, shape, context));

      for (const ps of shape.propertyShapes) {
        if (ps.isDeactivated) {
          continue;
        }

        const values = focusPredicates?.get(ps.path) ?? [];
        const evaluationArguments = EvaluationArgumentsBuilder.build(focusNode, ps.path, ps.bnodeId, ps.constraints, values, context);

        results.push(...Shape.evaluateMinimumCount(evaluationArguments));
        results.push(...Shape.evaluateMaximumCount(evaluationArguments));
        results.push(...Shape.evalDatatype(evaluationArguments));
        results.push(...Shape.evalPattern(evaluationArguments));
        results.push(...Shape.evaluateMinimumLength(evaluationArguments));
        results.push(...Shape.evaluateMaximumLength(evaluationArguments));
        results.push(...Shape.evaluateMinimumInclusive(evaluationArguments));
        results.push(...Shape.evaluateMaximumInclusive(evaluationArguments));
        results.push(...Shape.evaluateMinimumExclusive(evaluationArguments));
        results.push(...Shape.evaluateMaximumExclusive(evaluationArguments));
        results.push(...Shape.evalHasValue(evaluationArguments));
        results.push(...Shape.evalIn(evaluationArguments));
        results.push(...Shape.evalClass(evaluationArguments));
        results.push(...Shape.evalNode(evaluationArguments, context));
        results.push(...Shape.evalQualifiedValueShape(evaluationArguments, context));
      }

      results.push(...Shape.evalClosed(focusNode, shape, context.dataIndex));
      results.push(...Shape.evalAnd(focusNode, shape.constraints, context, shape.shapeIri));
      results.push(...Shape.evalOr(focusNode, shape.constraints, context, shape.shapeIri));
      results.push(...Shape.evalNot(focusNode, shape.constraints, context, shape.shapeIri));

      return results;
    } finally {
      context.visited.delete(visitKey);
    }
  }

  /**
   * Build a single violation result. A node-level constraint (no property path)
   * passes `path` as `undefined` or `''`; per the SHACL spec the result then omits
   * `sh:resultPath` rather than carrying an empty path.
   */
  private static violation(
    focusNode: string,
    path: string | undefined,
    component: string,
    message: string,
    value: string | undefined,
    sourceShape: string | undefined
  ): ShaclValidationResultEntity.Type {
    return {
      'focusNode': focusNode,
      'resultMessage': message,
      'resultSeverity': 'Violation',
      'sourceConstraintComponent': component,
      ...(!(path === undefined || path === '') && { 'resultPath': path }),
      ...(!(sourceShape === undefined) && { 'sourceShape': sourceShape }),
      ...(!(value === undefined) && { 'value': value })
    };
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
  ): ShaclValidationReportEntity.Type {
    const shapeIndex = Indexes.subject(shapes);
    const dataIndex = Indexes.subject(data);
    const dataTypeIndex = Indexes.type(data);
    const datatypeBySubjectPredicate = Indexes.datatype(data);

    const allNodeShapes = NodeShapes.build(shapeIndex);
    const context: ValidationContextInterface = {
      dataIndex,
      datatypeBySubjectPredicate,
      dataTypeIndex,
      'resolveShape': ShapeResolver.make(allNodeShapes, shapeIndex),
      shapeIndex,
      'visited': new Set<string>()
    };
    const results: ShaclValidationResultEntity.Type[] = [];

    for (const shape of allNodeShapes) {
      if (shape.isDeactivated) {
        continue;
      }

      const focusNodes = FocusNodes.select(shape.shapeIri, dataTypeIndex);

      for (const focusNode of focusNodes) {
        results.push(...Shape.validate(focusNode, shape.shapeIri, context));
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
