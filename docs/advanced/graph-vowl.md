---
title: Graph in WebVOWL
---

# Bookstore ontology in WebVOWL

[WebVOWL](http://vowl.visualdataweb.org/webvowl.html) is the W3C-aligned ontology visualizer used by the semantic-web community. It renders OWL classes, properties, restrictions, and equivalences using the [VOWL visual notation](http://purl.org/vowl/).

The same `entities.toTbox().jsonLd()` output we render in [Cytoscape](/your-types-are-a-graph) feeds WebVOWL below. Same TBox, different visual language.

<WebVowlFrame />

If the iframe doesn't load (browser-blocked third-party iframes, dev environment without internet, etc.), [open the bookstore TBox in WebVOWL directly](https://service.webvowl.visualdataweb.org/webvowl/index.html#iri=https://studnicky.github.io/json-tology/data/bookstore-tbox.jsonld).

## How this is generated

```bash
npm run build:bookstore-graph
```

The build script writes `docs/public/data/bookstore-tbox.jsonld` from `bookstoreEntities.toTbox().jsonLd()`. The deployed Pages site serves it at a public URL; WebVOWL fetches and converts to its visual format server-side.
