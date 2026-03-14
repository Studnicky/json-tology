import type { SchemaGraph } from '../graph/SchemaGraph.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/schema-graph.js';


export class GraphSchemaSerializer {
  public serialize(graph: SchemaGraph): Record<string, unknown> {
    return this.serializeNode(graph, graph.rootNode) as Record<string, unknown>;
  }

  private serializeNode(graph: SchemaGraph, node: SchemaGraphNodeInterface): boolean | Record<string, unknown> {
    const semantics: SchemaGraphSemanticsInterface = graph.semantics(node);

    // Boolean schemas
    if (typeof node.schema === 'boolean') {
      return node.schema;
    }

    const result: Record<string, unknown> = {};

    // $id
    if (semantics.schemaId !== undefined) {
      result.$id = semantics.schemaId;
    }

    // $schema (root only)
    if (node.pointer === '' && semantics.schemaDialect !== undefined) {
      result.$schema = semantics.schemaDialect;
    }

    // $vocabulary (root only)
    if (node.pointer === '' && semantics.schemaVocabulary !== undefined) {
      result.$vocabulary = semantics.schemaVocabulary;
    }

    // $anchor
    if (semantics.schemaAnchor !== undefined) {
      result.$anchor = semantics.schemaAnchor;
    }

    // type
    if (semantics.schemaTypes.length === 1) {
      result.type = semantics.schemaTypes[0];
    } else if (semantics.schemaTypes.length > 1) {
      result.type = semantics.schemaTypes;
    }

    // properties
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

    // required
    if (semantics.required.length > 0) {
      result.required = semantics.required;
    }

    // items
    if (semantics.itemsNode) {
      result.items = this.serializeNode(graph, semantics.itemsNode);
    }

    // prefixItems
    if (semantics.prefixItems.length > 0) {
      result.prefixItems = semantics.prefixItems.map((n) => {
        return this.serializeNode(graph, n);
      });
    }

    // additionalProperties
    if (semantics.additionalPropertiesNode !== undefined) {
      if (typeof semantics.additionalPropertiesNode === 'boolean') {
        result.additionalProperties = semantics.additionalPropertiesNode;
      } else {
        result.additionalProperties = this.serializeNode(graph, semantics.additionalPropertiesNode);
      }
    }

    // ref
    if (semantics.ref !== undefined) {
      result.$ref = semantics.ref;
    }

    // composition
    if (semantics.allOf.length > 0) {
      result.allOf = semantics.allOf.map((n) => {
        return this.serializeNode(graph, n);
      });
    }
    if (semantics.anyOf.length > 0) {
      result.anyOf = semantics.anyOf.map((n) => {
        return this.serializeNode(graph, n);
      });
    }
    if (semantics.oneOf.length > 0) {
      result.oneOf = semantics.oneOf.map((n) => {
        return this.serializeNode(graph, n);
      });
    }
    if (semantics.notNode) {
      result.not = this.serializeNode(graph, semantics.notNode);
    }

    // conditionals
    if (semantics.ifNode) {
      result.if = this.serializeNode(graph, semantics.ifNode);
    }
    if (semantics.thenNode) {
      result.then = this.serializeNode(graph, semantics.thenNode);
    }
    if (semantics.elseNode) {
      result.else = this.serializeNode(graph, semantics.elseNode);
    }

    // string constraints
    if (semantics.minLength !== undefined) {
      result.minLength = semantics.minLength;
    }
    if (semantics.maxLength !== undefined) {
      result.maxLength = semantics.maxLength;
    }
    if (semantics.pattern !== undefined) {
      result.pattern = semantics.pattern;
    }

    // numeric constraints
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

    // array constraints
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

    // object constraints
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

    // unevaluated
    if (semantics.unevaluatedItemsNode) {
      result.unevaluatedItems = this.serializeNode(graph, semantics.unevaluatedItemsNode);
    }
    if (semantics.unevaluatedPropertiesNode) {
      result.unevaluatedProperties = this.serializeNode(graph, semantics.unevaluatedPropertiesNode);
    }

    // values
    if (semantics.hasDefault) {
      result.default = semantics.defaultValue;
    }
    if (semantics.hasConst) {
      result.const = semantics.constValue;
    }
    if (semantics.enumValues) {
      result.enum = semantics.enumValues;
    }

    // metadata
    if (semantics.title) {
      result.title = semantics.title;
    }
    if (semantics.description) {
      result.description = semantics.description;
    }
    if (semantics.format) {
      result.format = semantics.format;
    }
    if (semantics.deprecated) {
      result.deprecated = true;
    }
    if (semantics.readOnly) {
      result.readOnly = true;
    }
    if (semantics.writeOnly) {
      result.writeOnly = true;
    }
    if (semantics.contentEncoding) {
      result.contentEncoding = semantics.contentEncoding;
    }
    if (semantics.contentMediaType) {
      result.contentMediaType = semantics.contentMediaType;
    }

    // discriminator
    if (semantics.discriminatorPropertyName) {
      const disc: Record<string, unknown> = { 'propertyName': semantics.discriminatorPropertyName };

      if (semantics.discriminatorMapping !== undefined) {
        disc.mapping = semantics.discriminatorMapping;
      }

      result.discriminator = disc;
    }

    // dynamic
    if (semantics.dynamicAnchor) {
      result.$dynamicAnchor = semantics.dynamicAnchor;
    }
    if (semantics.dynamicRef) {
      result.$dynamicRef = semantics.dynamicRef;
    }

    // $defs
    const defsEntries = graph.entries(node, '$defs');

    if (defsEntries.length > 0) {
      const defs: Record<string, unknown> = {};

      for (const [
        name,
        defNode
      ] of defsEntries) {
        defs[name] = this.serializeNode(graph, defNode);
      }
      result.$defs = defs;
    }

    // definitions (draft-07)
    if (semantics.definitions.length > 0) {
      const defs: Record<string, unknown> = {};

      for (const [
        name,
        defNode
      ] of semantics.definitions) {
        defs[name] = this.serializeNode(graph, defNode);
      }
      result.definitions = defs;
    }

    // additionalItems
    if (semantics.additionalItemsNode !== undefined) {
      if (typeof semantics.additionalItemsNode === 'boolean') {
        result.additionalItems = semantics.additionalItemsNode;
      } else {
        result.additionalItems = this.serializeNode(graph, semantics.additionalItemsNode);
      }
    }

    // $recursiveAnchor / $recursiveRef
    if (semantics.recursiveAnchor) {
      result.$recursiveAnchor = true;
    }
    if (semantics.recursiveRef) {
      result.$recursiveRef = semantics.recursiveRef;
    }

    // $comment
    if (semantics.comment) {
      result.$comment = semantics.comment;
    }

    // examples
    if (semantics.examples) {
      result.examples = semantics.examples;
    }

    // Extension keywords (custom/unknown keywords preserved from authored schema)
    for (const [
      key,
      value
    ] of Object.entries(semantics.extensions)) {
      result[key] = value;
    }

    // Ontology extension keywords
    if (semantics.rdfsDomain) {
      result['rdfs:domain'] = semantics.rdfsDomain;
    }
    if (semantics.rdfsRange) {
      result['rdfs:range'] = semantics.rdfsRange;
    }
    if (semantics.disjointWith) {
      result.disjointWith = semantics.disjointWith;
    }
    if (semantics.equivalentTo) {
      result.equivalentTo = semantics.equivalentTo;
    }
    if (semantics.inverseOf) {
      result.inverseOf = semantics.inverseOf;
    }
    if (semantics.transitive) {
      result.transitive = true;
    }
    if (semantics.symmetric) {
      result.symmetric = true;
    }

    return result;
  }
}
