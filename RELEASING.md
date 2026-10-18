# Releasing @starpresence/mcp

The package is published from this repository by GitHub Actions (`.github/workflows/release.yml`) with npm trusted
publishing and provenance. Nobody holds an npm token. The workflow's header explains the security boundary; this file
is the procedure.

## Steps

1. **Release pull request.** Copy the six package files (`LICENSE`, `README.md`, `SKILL.md`,
   `agent-contract.generated.json`, `package.json`, `server.json`) from `mcp-npm-package/` of the backend's `main`, and set
   `CLI_SHA` in `release.yml` to the merge commit of the `StarPresence/starpresence-agent` pull request that moved the
   CLI's exact `@starpresence/mcp` pin to the new version. Get one approving review: that review is the go-ahead to
   publish.
2. **Merge.** Merging the pull request publishes. The push to `main` changes a package file, which starts `release.yml` by
   itself: the policy tests, the pack, the consumer contract test against the pinned CLI commit, the registry decision, the
   publish guards, then the `publish` job (environment `npm-publish`, a short-lived OIDC token that npm requests itself,
   provenance), then `verify_registry`, which compares the registry's tarball bytes, its file list and its provenance
   attestation with the tested candidate. The run summary shows the version, the SHA-256 and the decision (`publish`, or
   `skip` when the exact bytes are already on npm). No dispatch and no further approval.
3. **Dry run (optional).** Actions, "Release @starpresence/mcp", Run workflow, branch `main`, `publish` unticked. Every
   check runs and `npm publish --dry-run` stands in for the publish; nothing is published.
4. **After a failure.** Fix the cause, then re-run the failed run (Actions, "Re-run failed jobs") or dispatch the workflow
   from `main` with `publish` ticked. A run refused as stale (another commit reached `main` first, and a commit that
   changes no package file starts no run of its own) is re-started the same way.
5. **Verify.** `npm view @starpresence/mcp version`.
6. **Registry listing.** The MCP registry entry (`server.json`) is updated by the owner with `mcp-publisher`, after the
   package is on npm.

## One-time setup outside the repository (owner)

- **Environment `npm-publish`:** Settings, Environments. Deployment branches limited to `main`, administrator bypass off,
  created before the workflow first runs (GitHub creates a missing environment with no protection). A required reviewer
  is optional and adds a click before every publish.
- **npm:** package `@starpresence/mcp`, Settings, Trusted publisher: GitHub Actions, organisation `StarPresence`,
  repository `starpresence-mcp`, workflow filename `release.yml`, environment `npm-publish`.
- **Branch protection of `main`:** one approving review, stale approvals dismissed, the approval taken after the last
  push, administrators included. The workflow is only as strong as the review of the pull request that changes it.
- Remove the CircleCI project and app (the old chain no longer exists).
- Optional: Settings, Actions, General, "Require actions to be pinned to a full-length commit SHA". The release test
  already pins every action in these two workflows; the setting makes GitHub refuse an unpinned one added later.

## When something goes wrong

- A run publishes only when it is a push to `main` that changed a package file, or a manual dispatch of `release.yml` from
  `main` with `publish` ticked; the checkout is the exact current `main` commit, the version is not on npm yet and the
  toolchain is current. Any other state fails the run before the publish step.
- A version already on npm with the same bytes is a no-op (`skip`); with different bytes it is refused: bump the version.
- A published version cannot be changed. Publish a new version, and `npm deprecate` the bad one.
