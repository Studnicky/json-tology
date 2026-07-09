# Releasing

The gitflow keeps `main` (released) and `develop` (integration) **convergent** so that
release PRs never conflict. The earlier policy (squash-only merges + required linear
history on both branches) defeated this: every PR became a fresh squash commit, so
`main` and `develop` shared no recent ancestor and diverged at *every* release — the
release→main PR then had to be conflict-resolved by hand.

## Merge strategy (the fix)

| Merge | Method | Why |
|-------|--------|-----|
| feature → `develop` | **squash** | keep `develop` history clean, one commit per feature |
| release branch → `main` | **merge commit** | preserve the release branch (which carries `develop`'s tip) as a parent of `main`, so `develop` stays an ancestor of `main` |
| back-merge `main` → `develop` | **merge commit**, via a `develop`-based branch | brings `main`'s release commit back so the branches re-converge — no divergent squash |

### Required repository settings

Current repo/branch config (not code) that this flow depends on:

- Repo: **Allow merge commits** = on, **Allow squash** = on. *(set)*
- Branch protection on `main` **and** `develop`: **Require linear history** = **off**. *(set)*
  Linear history forbids merge commits, which would block the convergent release/back-merge
  below. Squash feature merges stay linear-friendly regardless. (Set via the GitHub UI —
  Settings → Branches — or a full protection `PUT` with `required_linear_history=false`;
  there is no granular toggle endpoint.)
- Branch protection: **Require branches to be up to date before merging**
  (`required_status_checks.strict`) = **on**. This shapes the steps below: any branch
  merged into `main`/`develop` must first be brought up to date with its base. A *direct*
  `main → develop` PR therefore cannot merge (its head is permanently behind `develop`) —
  the back-merge runs through a `develop`-based branch instead.

## Release steps

1. Cut a `release/vX.Y.Z` branch from `develop`. Bump `package.json`
   (`npm version <x.y.z> --no-git-tag-version`), run `npm run stamp-version`, finalize the
   `CHANGELOG.md` `[x.y.z]` section with the date.
2. **Bring the release branch up to date with `main`** — `git merge origin/main` on the
   release branch and resolve any divergence *once*, here, before the PR. (This is required
   by the strict up-to-date check and is what keeps the release→main PR conflict-free.)
3. Open the release PR `release/vX.Y.Z → main`; wait for green CI; **merge with a merge
   commit** (not squash — squash re-breaks ancestry).
4. Tag on `main` after merge: `git tag -a vX.Y.Z -m "…" && git push origin vX.Y.Z`.
   The pushed tag triggers `release.yml` (GitHub release) and `publish-gpr.yml`
   (GitHub Packages publish — see below).
5. Back-merge to `develop`: cut a `chore/back-merge-vX.Y.Z` branch from `develop`, merge
   `origin/main` into it (merge commit), PR → `develop`, and merge. `develop` now contains
   `main`'s release commit, so the two branches share lineage and the *next* release merges
   cleanly.

## Publishing

- **GitHub Packages (GPR)** — `publish-gpr.yml` triggers on **tag push** (`v*.*.*`).
  It previously listened only to `release: published`, which never fired because the
  release is created by `release.yml` under `GITHUB_TOKEN` (Actions-created events do
  not cascade to other workflows). The tag-push trigger makes GPR publish reliable.
- **npm** — `publish.yml` requires `NPM_TOKEN`; it is expected to fail until that secret
  is configured. GPR is the supported channel meanwhile.

## Versioning

`0.x` line: **breaking changes bump the minor** (`0.25.0` → `0.26.0`); non-breaking
fixes bump the patch. Versioning lives in git/releases, never in runtime code.
