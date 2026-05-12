<p align="center"><a href="https://nodejs.org/api/"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/public/nodejs-node.svg" alt="Node.js" width="36" height="36" /></a><a href="https://json-schema.org/"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/public/json-schema-node.svg" alt="JSON Schema" width="48" height="48" /></a><a href="https://www.typescriptlang.org/"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/public/typescript-node.svg" alt="TypeScript" width="64" height="64" /></a><a href="https://studnicky.github.io/json-tology/"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/public/jst-node.svg" alt="json-tology" width="112" height="112" /></a><a href="https://www.w3.org/TR/rdf12-concepts/"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/public/rdf-node.svg" alt="RDF" width="64" height="64" /></a><a href="https://www.w3.org/"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/public/w3c-node.svg" alt="W3C" width="48" height="48" /></a><a href="https://json-schema.org/draft/2020-12/json-schema-validation"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/public/validation-node.svg" alt="Validation" width="36" height="36" /></a></p>

# json-tology

> One source of truth for TypeScript types, runtime validation, coercion, and OWL ontology output. Author in JSON Schema; share with any backend; reason over the graph.

## Documentation

The full documentation is published at **https://studnicky.github.io/json-tology/**.

- [Getting Started](https://studnicky.github.io/json-tology/getting-started)
- [Picking a method](https://studnicky.github.io/json-tology/picking-a-method)
- [Argument conventions](https://studnicky.github.io/json-tology/argument-conventions)
- [Bookstore domain](https://studnicky.github.io/json-tology/bookstore-domain) - the running example used throughout the docs
- [Validation](https://studnicky.github.io/json-tology/validation/instantiate), [Composition](https://studnicky.github.io/json-tology/composition/extend), [Serialization](https://studnicky.github.io/json-tology/serialization/dump)
- [Ontology and Graphs](https://studnicky.github.io/json-tology/advanced/ontology) - OWL TBox, SHACL, JSON-LD, ABox projection
- [Usage Examples](https://studnicky.github.io/json-tology/usage-examples/transforms-recipes) - transforms cookbook, custom format validators

## Requirements

Node.js >= 24 (matches `engines.node` in `package.json`).

## Install

```bash
npm install json-tology
```

or from GitHub Packages (current canonical pre-1.0 distribution):

```bash
echo '@studnicky:registry=https://npm.pkg.github.com' >> .npmrc
npm install @studnicky/json-tology
```

## License

MIT - see [LICENSE](./LICENSE).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) and the [GitHub releases](https://github.com/Studnicky/json-tology/releases).
