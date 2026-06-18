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
| release → `main` | **merge commit** | preserve `develop`'s tip as a parent of `main`, so `develop` stays an ancestor of `main` |
| back-merge `main` → `develop` | **fast-forward** (now possible) | `develop` is already an ancestor of `main`'s release merge, so it FFs forward — no divergent commit, no conflict next time |

### Required repository settings

These must stay set (they are repo/branch config, not code):

- Repo: **Allow merge commits** = on (already enabled), **Allow squash** = on.
- Branch protection on `main` **and** `develop`: **Require linear history** = **off**.
  (Linear history forbids merge commits, which blocks the convergent release/back-merge
  above. Squash feature merges remain linear-friendly regardless.)

  Apply with:

  ```sh
  # disable required-linear-history (needs the full protection PUT; do via the
  # GitHub UI: Settings → Branches → main/develop → uncheck "Require linear history",
  # or PATCH the protection object via the API with required_linear_history=false).
  ```

## Release steps

1. From `develop`: bump `package.json` (`npm version <x.y.z> --no-git-tag-version`),
   run `npm run stamp-version`, finalize the `CHANGELOG.md` `[x.y.z]` section with the date.
2. Open the release PR `develop → main`; wait for green CI; **merge with a merge commit**.
3. Tag on `main` after merge: `git tag -a vX.Y.Z -m "…" && git push origin vX.Y.Z`.
   The pushed tag triggers `release.yml` (GitHub release) and `publish-gpr.yml`
   (GitHub Packages publish — see below).
4. Back-merge `main → develop` as a **fast-forward** so the branches re-converge.

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
