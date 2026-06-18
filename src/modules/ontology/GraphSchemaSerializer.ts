import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { GraphSchemaSerializerInterface } from '../../interfaces/GraphSchemaSerializerInterface.js';


/**
 * Serializes a schema graph back into a JSON Schema document.
 *
 * @remarks
 * Reconstructs a JSON Schema 2020-12 object (or draft-07 subset) from the
 * canonical {@link SchemaGraphInterface}. The output is lossless for all
 * keywords tracked by the graph semantics layer, including custom extension
 * keywords, ontology annotations, and composition keywords.
 *
 * @example
 * ```ts
 * const serializer = new GraphSchemaSerializer();
 * const schema = serializer.serialize(graph);
 * ```
 *
 * @category Ontology
 * @since 0.1.0
 * @see {@link SchemaGraphInterface}
 * @group Serialization
 */
export class GraphSchemaSerializer implements GraphSchemaSerializerInterface {
  private static copyIfPresent(result: Record<string, unknown>, key: string, value: string | undefined): void {
    if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }

  private applyAnnotationFlags(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.deprecated) {
      result.deprecated = true;
    }

    if (semantics.readOnly) {
      result.readOnly = true;
    }

    if (semantics.writeOnly) {
      result.writeOnly = true;
    }

    if (semantics.recursiveAnchor) {
      result.$recursiveAnchor = true;
    }
  }

  private applyArrayConstraints(
    graph: SchemaGraphInterface,
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.minItems !== undefined) {
      result.minItems = semantics.minItems;
    }

    if (semantics.maxItems !== undefined) {
      result.maxItems = semantics.maxItems;
    }

    if (semantics.uniqueItems) {
      result.uniqueItems = true;
    }

    if (semantics.containsNode) {
      result.contains = this.serializeNode(graph, semantics.containsNode);
    }

    if (semantics.minContains !== undefined) {
      result.minContains = semantics.minContains;
    }

    if (semantics.maxContains !== undefined) {
      result.maxContains = semantics.maxContains;
    }

    if (semantics.unevaluatedItemsNode) {
      result.unevaluatedItems = this.serializeNode(graph, semantics.unevaluatedItemsNode);
    }

    if (semantics.additionalItemsNode !== undefined) {
      if (typeof semantics.additionalItemsNode === 'boolean') {
        result.additionalItems = semantics.additionalItemsNode;
      } else {
        result.additionalItems = this.serializeNode(graph, semantics.additionalItemsNode);
      }
    }
  }

  private applyCompositionKeywords(
    graph: SchemaGraphInterface,
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.allOf.length > 0) {
      result.allOf = semantics.allOf.map((n: SchemaGraphNodeType): boolean | Record<string, unknown> => {
        return this.serializeNode(graph, n);
      });
    }

    if (semantics.anyOf.length > 0) {
      result.anyOf = semantics.anyOf.map((n: SchemaGraphNodeType): boolean | Record<string, unknown> => {
        return this.serializeNode(graph, n);
      });
    }

    if (semantics.oneOf.length > 0) {
      result.oneOf = semantics.oneOf.map((n: SchemaGraphNodeType): boolean | Record<string, unknown> => {
        return this.serializeNode(graph, n);
      });
    }

    if (semantics.complementNode) {
      result.not = this.serializeNode(graph, semantics.complementNode);
    }
  }

  private applyConditionalKeywords(
    graph: SchemaGraphInterface,
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.ifNode) {
      result.if = this.serializeNode(graph, semantics.ifNode);
    }

    if (semantics.thenNode) {
      Reflect.set(result, 'then', this.serializeNode(graph, semantics.thenNode));
    }

    if (semantics.elseNode) {
      result.else = this.serializeNode(graph, semantics.elseNode);
    }
  }

  private applyDescriptiveMetadata(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    GraphSchemaSerializer.copyIfPresent(result, 'title', semantics.title);
    GraphSchemaSerializer.copyIfPresent(result, 'description', semantics.description);
    GraphSchemaSerializer.copyIfPresent(result, 'format', semantics.format);
    GraphSchemaSerializer.copyIfPresent(result, 'contentEncoding', semantics.contentEncoding);
    GraphSchemaSerializer.copyIfPresent(result, 'contentMediaType', semantics.contentMediaType);
    GraphSchemaSerializer.copyIfPresent(result, '$comment', semantics.comment);
    GraphSchemaSerializer.copyIfPresent(result, '$recursiveRef', semantics.recursiveRef);

    if (semantics.examples) {
      result.examples = semantics.examples;
    }
  }

  private applyDiscriminatorAndExtensions(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.discriminatorPropertyName !== undefined && semantics.discriminatorPropertyName !== '') {
      const disc: Record<string, unknown> = { 'propertyName': semantics.discriminatorPropertyName };

      if (semantics.discriminatorMapping !== undefined) {
        disc.mapping = semantics.discriminatorMapping;
      }

      result.discriminator = disc;
    }

    // Extension keywords (custom/unknown keywords preserved from authored schema)
    for (const [
      key,
      value
    ] of Object.entries(semantics.extensions)) {
      result[key] = value;
    }
  }

  private applyDraft07Definitions(
    graph: SchemaGraphInterface,
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.definitions.length === 0) {
      return;
    }

    const defs: Record<string, unknown> = {};

    for (const [
      name,
      defNode
    ] of semantics.definitions) {
      defs[name] = this.serializeNode(graph, defNode);
    }
    result.definitions = defs;
  }

  private applyDynamicKeywords(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.dynamicAnchor !== undefined && semantics.dynamicAnchor !== '') {
      result.$dynamicAnchor = semantics.dynamicAnchor;
    }

    if (semantics.dynamicRef !== undefined && semantics.dynamicRef !== '') {
      result.$dynamicRef = semantics.dynamicRef;
    }
  }

  private applyIdentityKeywords(
    result: Record<string, unknown>,
    node: SchemaGraphNodeType,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.schemaId !== undefined) {
      result.$id = semantics.schemaId;
    }

    if (node.pointer === '' && semantics.schemaDialect !== undefined) {
      result.$schema = semantics.schemaDialect;
    }

    if (node.pointer === '' && semantics.schemaVocabulary !== undefined) {
      result.$vocabulary = semantics.schemaVocabulary;
    }

    if (semantics.schemaAnchor !== undefined) {
      result.$anchor = semantics.schemaAnchor;
    }

    if (semantics.ref !== undefined) {
      result.$ref = semantics.ref;
    }
  }

  private applyJsonSchemaDefs(
    graph: SchemaGraphInterface,
    result: Record<string, unknown>,
    node: SchemaGraphNodeType
  ): void {
    const defsEntries = graph.entries(node, '$defs');

    if (defsEntries.length === 0) {
      return;
    }

    const defs: Record<string, unknown> = {};

    for (const [
      name,
      defNode
    ] of defsEntries) {
      defs[name] = this.serializeNode(graph, defNode);
    }
    result.$defs = defs;
  }

  private applyMetadataKeywords(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    this.applyDescriptiveMetadata(result, semantics);
    this.applyAnnotationFlags(result, semantics);
    this.applyDiscriminatorAndExtensions(result, semantics);
  }

  private applyNumericConstraints(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.minimum !== undefined) {
      result.minimum = semantics.minimum;
    }

    if (semantics.maximum !== undefined) {
      result.maximum = semantics.maximum;
    }

    if (semantics.exclusiveMinimum !== undefined) {
      result.exclusiveMinimum = semantics.exclusiveMinimum;
    }

    if (semantics.exclusiveMaximum !== undefined) {
      result.exclusiveMaximum = semantics.exclusiveMaximum;
    }

    if (semantics.multipleOf !== undefined) {
      result.multipleOf = semantics.multipleOf;
    }
  }

  private applyObjectConstraints(
    graph: SchemaGraphInterface,
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.minProperties !== undefined) {
      result.minProperties = semantics.minProperties;
    }

    if (semantics.maxProperties !== undefined) {
      result.maxProperties = semantics.maxProperties;
    }

    if (semantics.propertyNamesNode) {
      result.propertyNames = this.serializeNode(graph, semantics.propertyNamesNode);
    }

    if (semantics.patternPropertyEntries.length > 0) {
      const pp: Record<string, unknown> = {};

      for (const [
        pattern,
        patNode
      ] of semantics.patternPropertyEntries) {
        pp[pattern] = this.serializeNode(graph, patNode);
      }
      result.patternProperties = pp;
    }

    if (Object.keys(semantics.dependentRequired).length > 0) {
      result.dependentRequired = semantics.dependentRequired;
    }

    if (semantics.dependentSchemaEntries.length > 0) {
      const ds: Record<string, unknown> = {};

      for (const [
        key,
        dsNode
      ] of semantics.dependentSchemaEntries) {
        ds[key] = this.serializeNode(graph, dsNode);
      }
      result.dependentSchemas = ds;
    }

    if (semantics.unevaluatedPropertiesNode) {
      result.unevaluatedProperties = this.serializeNode(graph, semantics.unevaluatedPropertiesNode);
    }
  }

  private applyOntologyKeywords(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    GraphSchemaSerializer.copyIfPresent(result, 'rdfs:domain', semantics.rdfsDomain);
    GraphSchemaSerializer.copyIfPresent(result, 'rdfs:range', semantics.rdfsRange);
    GraphSchemaSerializer.copyIfPresent(result, 'disjointWith', semantics.disjointWith);
    GraphSchemaSerializer.copyIfPresent(result, 'equivalentTo', semantics.equivalentTo);
    GraphSchemaSerializer.copyIfPresent(result, 'inverseOf', semantics.inverseOf);
    this.applyOntologyPropertyCharacteristics(result, semantics);
  }

  private applyOntologyPropertyCharacteristics(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.transitive) {
      result.transitive = true;
    }

    if (semantics.symmetric) {
      result.symmetric = true;
    }

    if (semantics.asymmetric) {
      result.asymmetric = true;
    }

    if (semantics.functional) {
      result.functional = true;
    }

    if (semantics.inverseFunctional) {
      result.inverseFunctional = true;
    }

    if (semantics.reflexive) {
      result.reflexive = true;
    }

    if (semantics.irreflexive) {
      result.irreflexive = true;
    }
  }

  private applyStringConstraints(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.minLength !== undefined) {
      result.minLength = semantics.minLength;
    }

    if (semantics.maxLength !== undefined) {
      result.maxLength = semantics.maxLength;
    }

    if (semantics.pattern !== undefined) {
      result.pattern = semantics.pattern;
    }
  }

  private applyTypeAndProperties(
    graph: SchemaGraphInterface,
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.schemaTypes.length === 1) {
      result.type = semantics.schemaTypes[0];
    } else if (semantics.schemaTypes.length > 1) {
      result.type = semantics.schemaTypes;
    }

    if (semantics.properties.size > 0) {
      const props: Record<string, unknown> = {};

      for (const [
        name,
        propNode
      ] of semantics.properties) {
        props[name] = this.serializeNode(graph, propNode);
      }
      result.properties = props;
    }

    if (semantics.required.length > 0) {
      result.required = semantics.required;
    }

    if (semantics.itemsNode) {
      result.items = this.serializeNode(graph, semantics.itemsNode);
    }

    if (semantics.prefixItems.length > 0) {
      result.prefixItems = semantics.prefixItems.map((n: SchemaGraphNodeType): boolean | Record<string, unknown> => {
        return this.serializeNode(graph, n);
      });
    }

    if (semantics.additionalPropertiesNode !== undefined) {
      if (typeof semantics.additionalPropertiesNode === 'boolean') {
        result.additionalProperties = semantics.additionalPropertiesNode;
      } else {
        result.additionalProperties = this.serializeNode(graph, semantics.additionalPropertiesNode);
      }
    }
  }

  private applyValueKeywords(
    result: Record<string, unknown>,
    semantics: SchemaGraphSemanticsType
  ): void {
    if (semantics.hasDefault) {
      result.default = semantics.defaultValue;
    }

    if (semantics.hasConst) {
      result.const = semantics.constValue;
    }

    if (semantics.enumValues) {
      result.enum = semantics.enumValues;
    }
  }

  /**
   * Serialize a schema graph back into a JSON Schema document.
   *
   * @param graph - Schema graph to serialize
   * @returns JSON Schema object reconstructed from the graph
   */
  public serialize(graph: SchemaGraphInterface): Record<string, unknown> {
    return this.serializeNode(graph, graph.rootNode) as Record<string, unknown>;
  }

  private serializeNode(
    graph: SchemaGraphInterface,
    node: SchemaGraphNodeType
  ): boolean | Record<string, unknown> {
    if (typeof node.schema === 'boolean') {
      return node.schema;
    }

    const semantics: SchemaGraphSemanticsType = graph.semantics(node);
    const result: Record<string, unknown> = {};

    this.applyIdentityKeywords(result, node, semantics);
    this.applyTypeAndProperties(graph, result, semantics);
    this.applyCompositionKeywords(graph, result, semantics);
    this.applyConditionalKeywords(graph, result, semantics);
    this.applyStringConstraints(result, semantics);
    this.applyNumericConstraints(result, semantics);
    this.applyArrayConstraints(graph, result, semantics);
    this.applyObjectConstraints(graph, result, semantics);
    this.applyValueKeywords(result, semantics);
    this.applyMetadataKeywords(result, semantics);
    this.applyOntologyKeywords(result, semantics);
    this.applyDynamicKeywords(result, semantics);
    this.applyJsonSchemaDefs(graph, result, node);
    this.applyDraft07Definitions(graph, result, semantics);

    return result;
  }
}
