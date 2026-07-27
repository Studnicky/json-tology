---
"json-tology": patch
---

Adopted Changesets (`@changesets/cli`) in place of the hand-maintained
`CHANGELOG.md` `[Unreleased]` section — contributors now run
`npx changeset add` to describe a change, and version/changelog generation
happens automatically via `changeset version` (wired into a new
`release-version.yml` workflow that runs on `release/**` branch pushes).

Also ported several CI concepts from a sibling repo's more advanced pipeline,
adapted to this project's single-package, npm+GitHub-Packages-dual-publish
shape:

- A `detect-changes.yml` reusable workflow classifies PR/push diffs
  (`src`/`docs`/`bench`/`deps`/`ci_config`) so `license-check.yml` and
  `security.yml` can skip on doc-only diffs.
- Every GitHub Action reference across all workflows is now pinned to a
  resolved commit SHA (with a version comment) instead of a floating major
  tag.
- A `.github/actions/node-setup` composite action collapses the repeated
  checkout + `setup-node` + `npm ci` sequence duplicated across ~10
  workflow files.
- Added a `codeql.yml` SAST workflow (JavaScript/TypeScript), using a
  `gh-api-probe` composite action to skip cleanly on repos without GitHub
  Advanced Security enabled, instead of hard-failing.
- Fixed pre-existing drift in `publish.yml`: it had its own redundant
  `publish-gpr`/`release` jobs duplicating the already-standalone
  `publish-gpr.yml`/`release.yml` workflows — removed the duplicates.
- Changelog entries are generated via `@changesets/changelog-github`, linking
  each entry back to its PR/commit and crediting the contributor, matching
  the sibling repo's changelog format.
- Replaced the abandoned `license-checker` (unpatched since 2019, pinned to
  a vulnerable transitive `glob`/`minimatch`/`brace-expansion` chain — three
  high-severity advisories) with its actively maintained fork,
  `license-checker-rseidelsohn`. Same CLI flags, same `--summary`/`--failOn`
  behavior; `npm audit` now reports zero vulnerabilities.
