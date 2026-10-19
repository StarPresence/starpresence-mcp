import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

// Pins the security boundary of the release workflow (be#4578). The workflow holds the only npm publishing permission
// of the repository, so every property below is one a reviewer must not have to re-derive: a change to release.yml
// that drops one of them fails here, in the pull request, before it can be merged.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Full-line comments are dropped before anything is examined: a header comment may say "id-token: write" or "CircleCI"
// without granting or running anything, and a test that a comment can satisfy or trip would pin nothing.
const code = (text) => text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');

const releaseRaw = read('../.github/workflows/release.yml');
const policyRaw = read('../.github/workflows/release-policy.yml');
const release = code(releaseRaw);
const policy = code(policyRaw);

const ACTIONS = new Map([
  ['actions/checkout', ['11d5960a326750d5838078e36cf38b85af677262', 'v4.4.0']],
  ['actions/setup-node', ['49933ea5288caeca8642d1e84afbd3f7d6820020', 'v4.4.0']],
  ['actions/upload-artifact', ['ea165f8d65b6e75b540449e92b4886f43607fa02', 'v4.6.2']],
  ['actions/download-artifact', ['d3f86a106a0bac45b974a628896c90dbdf5c8093', 'v4.3.0']],
]);

const examined = {
  releaseLines: release.split('\n').length,
  policyLines: policy.split('\n').length,
  commentLines: releaseRaw.split('\n').length - release.split('\n').length + policyRaw.split('\n').length - policy.split('\n').length,
};

function jobsOf(text) {
  const marker = '\njobs:\n';
  const start = text.indexOf(marker);
  assert.ok(start > -1, 'missing jobs');
  const body = text.slice(start + marker.length);
  const headers = [...body.matchAll(/^ {2}([a-z_]+):$/gm)];
  const jobs = {};
  headers.forEach((match, index) => {
    const end = index + 1 < headers.length ? headers[index + 1].index : body.length;
    jobs[match[1]] = body.slice(match.index, end);
  });
  return jobs;
}

function runBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:- )?run:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    if (match[2] === '|' || match[2] === '>') {
      const body = [];
      let next = index + 1;
      while (
        next < lines.length
        && (lines[next].trim() === '' || lines[next].length - lines[next].trimStart().length > indent)
      ) {
        body.push(lines[next]);
        next += 1;
      }
      blocks.push(body.join('\n'));
    } else {
      blocks.push(match[2]);
    }
  }
  return blocks;
}

const usesOf = (text) => [...text.matchAll(/^\s*(?:- )?uses: (.+)$/gm)].map((match) => match[1].trim());

// The text of one named step of a job: from its `- name:` line to the next step, so a flag is looked for in the step
// that must carry it and not anywhere in the job (a flag that another step also has proves nothing about this one).
function stepOf(job, name) {
  const start = job.indexOf(`- name: ${name}\n`);
  assert.ok(start > -1, `missing step: ${name}`);
  const rest = job.slice(start + 1);
  const next = rest.search(/\n {6}- /);
  return next === -1 ? rest : rest.slice(0, next);
}

function inOrder(text, markers) {
  const positions = markers.map((marker) => text.indexOf(marker));
  positions.forEach((position, index) => assert.ok(position > -1, `missing step: ${markers[index]}`));
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], `out of order: ${markers[index - 1]} / ${markers[index]}`);
  }
}

const jobs = jobsOf(release);
examined.jobs = Object.keys(jobs).length;
examined.runBlocks = runBlocks(release).length + runBlocks(policy).length;
examined.usesLines = usesOf(release).length + usesOf(policy).length;

test('release.yml starts only on a push to main that changes a package file and on a manual dispatch with one dry-run input', () => {
  const onBlock = release.slice(release.indexOf('\non:\n') + 1, release.indexOf('\npermissions:\n'));
  assert.deepEqual([...onBlock.matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]), ['push', 'workflow_dispatch']);
  // The push is main only and limited to the package files: a change to a workflow, a test or a document starts nothing.
  assert.ok(onBlock.startsWith(
    'on:\n  push:\n    branches:\n      - main\n    paths:\n      - package.json\n      - server.json\n      - README.md\n'
    + '      - SKILL.md\n      - LICENSE\n      - agent-contract.generated.json\n  workflow_dispatch:\n',
  ));
  assert.deepEqual([...onBlock.matchAll(/^ {4}([a-z_-]+):/gm)].map((match) => match[1]), ['branches', 'paths', 'inputs']);
  assert.deepEqual([...onBlock.matchAll(/^ {6}([a-z_]+):$/gm)].map((match) => match[1]), ['publish']);
  assert.ok(onBlock.includes('type: boolean'));
  assert.ok(onBlock.includes('default: false'));
  assert.ok(!release.includes('pull_request'));
  assert.ok(!release.includes('workflow_run'));
  assert.ok(!release.includes('schedule:'));
  assert.ok(!/^\s+(?:tags|tags-ignore|branches-ignore|paths-ignore):/m.test(release));
});

test('grants read-only by default and id-token write only to the publish job, which names the protected environment', () => {
  const top = release.slice(release.indexOf('\npermissions:\n') + 1, release.indexOf('\nconcurrency:\n'));
  assert.equal(top, 'permissions:\n  contents: read\n');
  assert.deepEqual(Object.keys(jobs), ['verify_release_policy', 'candidate', 'publish', 'verify_registry']);
  assert.equal(release.match(/id-token: write/g)?.length, 1);
  assert.ok(jobs.publish.includes('\n    permissions:\n      contents: read\n      id-token: write\n'));
  assert.equal(release.match(/^ {4}environment: npm-publish$/gm)?.length, 1);
  assert.ok(jobs.publish.includes('\n    environment: npm-publish\n'));
  for (const name of ['verify_release_policy', 'candidate', 'verify_registry']) {
    assert.ok(!jobs[name].includes('id-token'), `${name} must not hold id-token`);
    assert.ok(!jobs[name].includes('environment:'), `${name} must not name an environment`);
  }
  for (const [name, job] of Object.entries(jobs)) {
    assert.ok(job.includes('\n    permissions:\n      contents: read\n'), `${name} must declare read-only permissions`);
  }
  assert.ok(!/write-all/.test(release));
  assert.ok(!/(?:contents|actions|packages|pull-requests|issues|checks|deployments|statuses): write/.test(release));
  assert.ok(jobs.publish.includes('needs: candidate'));
  assert.ok(jobs.candidate.includes('needs: verify_release_policy'));
});

test('pins every action by commit, with the reviewed version, and uses only the reviewed four', () => {
  for (const [file, text] of [['release.yml', release], ['release-policy.yml', policy]]) {
    const uses = usesOf(text);
    assert.ok(uses.length > 0, `${file} uses no action`);
    for (const use of uses) {
      const match = use.match(/^([a-z0-9-]+\/[a-z0-9-]+)@([0-9a-f]{40}) # (v\d+\.\d+\.\d+)$/);
      assert.ok(match, `${file}: not pinned by a full commit with a version comment: ${use}`);
      const [sha, version] = ACTIONS.get(match[1]) ?? [];
      assert.equal(match[2], sha, `${file}: ${match[1]} is not at the reviewed commit`);
      assert.equal(match[3], version, `${file}: ${match[1]} is not at the reviewed version`);
    }
    assert.ok(!text.includes('docker://'));
  }
});

test('reads no secret and interpolates no expression into any script', () => {
  for (const text of [release, policy]) {
    assert.ok(!text.includes('secrets.'));
    assert.ok(!text.includes('registry-url'));
    assert.ok(!text.includes('always-auth'));
  }
  const blocks = [...runBlocks(release), ...runBlocks(policy)];
  assert.ok(blocks.length >= 12, `only ${blocks.length} run blocks were examined`);
  for (const block of blocks) {
    assert.ok(!block.includes('${{'), `an expression reaches a script: ${block.slice(0, 80)}`);
  }
  const credentialLines = release.split('\n').filter((line) => /NPM_TOKEN|NODE_AUTH_TOKEN/.test(line));
  assert.equal(credentialLines.length, 1);
  assert.ok(credentialLines[0].includes('-n "${NPM_TOKEN:-}" || -n "${NODE_AUTH_TOKEN:-}"'));
  assert.ok(jobs.publish.includes(credentialLines[0]));
});

test('runs every job on a GitHub-hosted ubuntu-24.04 runner and serialises releases', () => {
  const runners = [...release.matchAll(/^ {4}runs-on: (.+)$/gm), ...policy.matchAll(/^ {4}runs-on: (.+)$/gm)];
  assert.equal(runners.length, 5);
  for (const runner of runners) assert.equal(runner[1], 'ubuntu-24.04');
  assert.ok(!/self-hosted|ubicloud/.test(`${release}\n${policy}`));
  assert.ok(release.includes('concurrency:\n  group: npm-publish-starpresence-mcp\n  cancel-in-progress: false\n'));
});

test('candidate checks out without credentials, packs one tarball, uploads it before consumer code and tests the exact CLI commit', () => {
  const candidate = jobs.candidate;
  assert.match(
    candidate,
    /uses: actions\/checkout@[0-9a-f]{40} # v4\.4\.0\n {8}with:\n {10}persist-credentials: false\n/,
  );
  assert.equal(candidate.match(/^\s+npm pack \\$/gm)?.length, 1);
  assert.match(candidate, /CLI_SHA: "[0-9a-f]{40}"/);
  assert.ok(candidate.includes('git -C "$RUNNER_TEMP/cli-consumer" checkout --detach "$CLI_SHA"'));
  assert.ok(candidate.includes('merge-base --is-ancestor'));
  const install = stepOf(candidate, 'Install the packed candidate without lifecycle scripts');
  for (const part of [
    '--no-save',
    '--package-lock=false',
    '--ignore-scripts',
    '"$RUNNER_TEMP/release/candidate/package.tgz"',
    'ajv@8.20.0',
    'ajv-formats@3.0.1',
  ]) {
    assert.ok(install.includes(part), `the install step lacks ${part}`);
  }
  assert.ok(stepOf(candidate, 'Pack and hash the exact candidate once').includes('--ignore-scripts'));
  assert.ok(stepOf(candidate, 'Test CLI requests against the exact candidate').includes('run: npm run test:contract\n'));
  assert.ok(
    stepOf(candidate, 'Verify the tested candidate is unchanged').includes('sha256sum --check package.tgz.sha256'),
  );
  inOrder(candidate, [
    'name: Guard repository, branch, event and exact current main commit',
    'name: Verify trusted-publishing toolchain',
    'name: Guard package metadata',
    'name: Pack and hash the exact candidate once',
    'name: Upload the immutable candidate before any consumer code runs',
    'name: Check out the exact CLI consumer commit',
    'name: Install the packed candidate without lifecycle scripts',
    'name: Test CLI requests against the exact candidate',
    'name: Verify the tested candidate is unchanged',
    'name: Decide publish or verified no-op',
  ]);
  assert.ok(candidate.includes('uses: actions/upload-artifact@'));
  assert.ok(candidate.includes('name: candidate\n          path: ${{ runner.temp }}/release/candidate\n'));
  assert.ok(candidate.includes('if-no-files-found: error'));
});

test('pins the runtime by exact version and checks the trusted-publishing minimums', () => {
  const setups = release.match(/node-version: "24\.18\.0"/g)?.length;
  assert.equal(setups, usesOf(release).filter((use) => use.startsWith('actions/setup-node@')).length);
  assert.equal(setups, 4);
  assert.ok(jobs.candidate.includes('Node.js >=22.14'));
  assert.ok(jobs.candidate.includes('npm >=11.5.1'));
  assert.ok(jobs.publish.includes('Node.js >=22.14'));
  assert.ok(jobs.publish.includes('npm >=11.5.1'));
  assert.ok(!/npm install (-g|--global)|npm i -g/.test(release));
});

test('binds the candidate and the publish job to this repository, main, a push or dispatch of release.yml and the exact commit', () => {
  const candidate = jobs.candidate;
  const publish = jobs.publish;
  for (const job of [candidate, publish]) {
    assert.ok(job.includes('"$GITHUB_REPOSITORY" != "StarPresence/starpresence-mcp"'));
    assert.ok(job.includes('"$GITHUB_REF" != "refs/heads/main"'));
    assert.ok(job.includes('"$GITHUB_EVENT_NAME" != "push" && "$GITHUB_EVENT_NAME" != "workflow_dispatch"'));
    assert.ok(job.includes(
      '"$GITHUB_WORKFLOW_REF" != "StarPresence/starpresence-mcp/.github/workflows/release.yml@refs/heads/main"',
    ));
  }
  assert.ok(candidate.includes('actual_sha="$(git rev-parse HEAD)"'));
  assert.ok(candidate.includes('"$actual_sha" != "$GITHUB_SHA"'));
  assert.ok(candidate.includes('"+refs/heads/main:refs/remotes/origin/main"'));
  assert.ok(candidate.includes('"$remote_main_sha" != "$GITHUB_SHA"'));
  assert.ok(candidate.includes("if (pkg.name !== '@starpresence/mcp') {"));
  assert.ok(!release.includes('@starreview/mcp'));
  assert.equal(release.split('starpresence-mcp-$version.tgz').length - 1, 3);
  assert.ok(publish.includes('git ls-remote'));
  assert.ok(publish.includes('"$remote_main_line" != "$mirror_sha"$\'\\trefs/heads/main\''));
  assert.ok(publish.includes('"$mirror_sha" != "$OUT_MIRROR_SHA" || "$mirror_sha" != "$GITHUB_SHA"'));
  assert.ok(publish.includes('"$expected_sha" != "$OUT_SHA256"'));
  assert.ok(publish.includes('"$version" != "$OUT_VERSION"'));
});

test('records a fail-closed publish or byte-identical no-op decision', () => {
  const candidate = jobs.candidate;
  assert.ok(candidate.includes('id: decide'));
  assert.ok(candidate.includes('npm view "$package_spec" version'));
  assert.ok(candidate.includes('npm pack "$package_spec"'));
  assert.ok(candidate.includes('"$actual_sha" != "$expected_sha"'));
  assert.ok(candidate.includes('decision="skip"'));
  assert.ok(candidate.includes('decision="publish"'));
  assert.ok(candidate.includes('grep -q \'E404\' "$registry_error"'));
  assert.ok(candidate.includes('printf \'decision=%s\\n\' "$decision" >> "$GITHUB_OUTPUT"'));
  assert.ok(jobs.publish.includes('grep -q \'E404\' "$registry_error"'));
  assert.ok(jobs.publish.includes('Refusing to overwrite existing registry version'));
  assert.ok(jobs.publish.includes('skipping OIDC token request and npm publish'));
});

test('keeps the publishing permission inside an artifact-only job that runs no repository or consumer code', () => {
  const publish = jobs.publish;
  assert.ok(!publish.includes('actions/checkout'));
  assert.ok(!publish.includes('cli-consumer'));
  assert.ok(!publish.includes('npm install'));
  assert.ok(!publish.includes('npm run'));
  assert.ok(!publish.includes('npm pack'));
  assert.ok(!publish.includes('npm ci'));
  assert.ok(publish.includes('uses: actions/download-artifact@'));
  assert.ok(publish.includes('sha256sum --check package.tgz.sha256'));
  assert.ok(publish.includes('diff --unified'));
  assert.ok(publish.includes('"$checksum_line" != "$expected_sha  package.tgz"'));
  assert.ok(publish.includes('"$INPUT_PUBLISH" != "true" && "$INPUT_PUBLISH" != "false"'));
  assert.ok(publish.includes('[[ -f "$HOME/.npmrc" || -n "${NPM_CONFIG_USERCONFIG:-}" ]]'));
  inOrder(publish, [
    'name: Download the immutable candidate',
    'name: Verify the exact approved artifact',
    'name: Guard current main, registry, and trusted-publishing toolchain',
    'name: Publish the exact tarball with short-lived OIDC and provenance',
  ]);
  const publishes = [...publish.matchAll(/^\s+npm publish "\$release_dir\/package\.tgz" \\\n((?:\s+--.+\\?\n)+)/gm)];
  assert.equal(publish.match(/npm publish /g)?.length, 2);
  assert.equal(release.match(/npm publish /g)?.length, 2, 'npm publish appears outside the publish job');
  assert.equal(publishes.length, 2);
  const [dryRun, real] = publishes.map((match) => match[1]);
  assert.ok(dryRun.includes('--dry-run'));
  assert.ok(!dryRun.includes('--provenance'));
  assert.ok(real.includes('--provenance'));
  assert.ok(real.includes('--access public'));
  assert.ok(real.includes('--ignore-scripts'));
  assert.ok(!real.includes('--dry-run'));
  assert.ok(dryRun.includes('--registry=https://registry.npmjs.org/'));
  assert.ok(real.includes('--registry=https://registry.npmjs.org/'));
  // `indexOf` is -1 for a missing marker and -1 < anything, so presence is asserted before the order is.
  const dryRunFlagAt = publish.indexOf('--dry-run');
  const provenanceFlagAt = publish.indexOf('--provenance');
  assert.ok(dryRunFlagAt > -1 && provenanceFlagAt > -1 && dryRunFlagAt < provenanceFlagAt);
  const afterGuard = publish.slice(publish.indexOf('name: Publish the exact tarball'));
  const skipAt = afterGuard.indexOf('"$OUT_DECISION" == "skip"');
  const dryRunBranchAt = afterGuard.indexOf('"$INPUT_PUBLISH" != "true"');
  assert.ok(skipAt > -1, 'the publish step lost its skip branch');
  assert.ok(dryRunBranchAt > -1, 'the publish step lost its dry-run branch');
  assert.ok(skipAt < afterGuard.indexOf('npm publish'));
  assert.ok(dryRunBranchAt < afterGuard.lastIndexOf('npm publish'));
  assert.equal(release.match(/--provenance/g)?.length, 1);
  // Whether a run publishes is decided here and nowhere else: a push to main (the merge of the approved release pull
  // request) publishes, a dispatch publishes only when its one input is ticked.
  assert.ok(publish.includes("\n      INPUT_PUBLISH: ${{ github.event_name == 'push' || inputs.publish }}\n"));
  assert.equal(release.match(/INPUT_PUBLISH: /g)?.length, 1);
  // The artifact is this run's own: a download from another run would let that run's files reach the publish token.
  assert.ok(!release.includes('run-id'));
  assert.ok(!release.includes('github-token'));
  const registries = [...release.matchAll(/--registry=(\S+)/g)].map((match) => match[1]);
  assert.ok(registries.length >= 8, `only ${registries.length} registry flags were examined`);
  for (const registry of registries) assert.equal(registry, 'https://registry.npmjs.org/');
});

test('verifies registry bytes, contents and provenance without publishing authority', () => {
  const verify = jobs.verify_registry;
  assert.ok(verify.includes("if: ${{ github.event_name == 'push' || inputs.publish }}"));
  assert.ok(verify.includes('uses: actions/download-artifact@'));
  assert.ok(!verify.includes('actions/checkout'));
  assert.ok(!verify.includes('npm publish'));
  assert.ok(!verify.includes('id-token'));
  assert.ok(!verify.includes('environment:'));
  assert.ok(verify.includes('npm view "$package_spec" version'));
  assert.ok(verify.includes('npm pack "$package_spec"'));
  assert.ok(verify.includes('"$actual_sha" != "$expected_sha"'));
  assert.ok(verify.includes('package/agent-contract.generated.json'));
  assert.ok(verify.includes('expected-registry-contents.txt'));
  assert.ok(verify.includes('actual-registry-contents.txt'));
  assert.ok(verify.includes('diff --unified'));
  assert.ok(verify.includes('npm view "$package_spec" dist.attestations.url'));
  assert.ok(verify.includes('needs:\n      - candidate\n      - publish\n'));
  // npm prints "Your package is being processed and may take a few minutes to become available". The first release's check
  // waited 60 s, gave up and ended red although the publish had worked (be#5022), so the waits are pinned: the version for
  // five minutes, the download and the attestation for three each, five seconds apart, and every loop fails on its last
  // attempt (a loop that simply ends would let the checks after it run on an empty value).
  const waits = [...verify.matchAll(/for attempt in \{1\.\.(\d+)\}; do/g)].map((match) => Number(match[1]));
  assert.equal(waits.length, 3, 'the registry check has three polling loops');
  assert.ok(waits[0] >= 60 && waits[1] >= 36 && waits[2] >= 36, `the registry waits are too short: ${waits.join(', ')} polls`);
  for (const wait of waits) {
    assert.ok(verify.includes(`if [[ "$attempt" == "${wait}" ]]; then`), `the loop of ${wait} polls does not fail on its last attempt`);
  }
  assert.equal(verify.match(/^\s+sleep 5$/gm)?.length, 3, 'every polling loop sleeps five seconds between polls');
});

test('fails closed: nothing outside the scripts is conditional or allowed to fail, and no refusal is disarmed unnoticed', () => {
  assert.ok(!release.includes('continue-on-error'));
  // The only conditional is the job-level one that skips the registry check on a dry run (a push always checks); every
  // other decision is made inside a script, where the refusals below are counted.
  assert.deepEqual(
    [...release.matchAll(/^\s+if:.*$/gm)].map((match) => match[0]),
    ["    if: ${{ github.event_name == 'push' || inputs.publish }}"],
  );
  assert.ok(release.includes('defaults:\n  run:\n    shell: bash\n'));
  const scripts = runBlocks(release).filter((block) => block.includes('\n'));
  assert.ok(scripts.length >= 12, `only ${scripts.length} scripts were examined`);
  for (const script of scripts) {
    assert.ok(script.trimStart().startsWith('set -euo pipefail\n'), `a script does not start strict: ${script.trim().slice(0, 60)}`);
  }
  // Counting the refusals pins each one: an `exit 1` removed (a check that reports and carries on) or an early `exit 0`
  // added (a step that succeeds before its later checks) changes a number below. Adding a guard on purpose means
  // changing the number in the same pull request, where a reviewer sees it.
  const exits = (name, code) => (jobs[name].match(new RegExp(`^\\s+exit ${code}$`, 'gm')) ?? []).length;
  assert.deepEqual(
    Object.fromEntries(Object.keys(jobs).map((name) => [name, [exits(name, 1), exits(name, 0)]])),
    { verify_release_policy: [0, 0], candidate: [20, 0], publish: [20, 3], verify_registry: [9, 0] },
  );
});

test('release-policy.yml runs the policy tests on pull requests and main with read-only access and nothing else', () => {
  assert.ok(policy.includes('on:\n  pull_request:\n  push:\n    branches:\n      - main\n'));
  assert.ok(policy.includes('\npermissions:\n  contents: read\n'));
  assert.ok(!policy.includes('id-token'));
  assert.ok(!policy.includes('environment:'));
  assert.ok(!policy.includes('pull_request_target'));
  assert.ok(!/(?:contents|actions|packages|pull-requests|issues|checks|deployments|statuses): write/.test(policy));
  assert.ok(policy.includes('        run: node --test\n'));
  assert.ok(policy.includes('persist-credentials: false'));
  assert.equal(Object.keys(jobsOf(policy)).length, 1);
});

test('leaves no CircleCI pipeline behind', () => {
  assert.ok(!existsSync(new URL('../.circleci', import.meta.url)));
  assert.ok(!/circleci/i.test(release));
  assert.ok(!/circleci/i.test(policy));
});

test('prints what it examined and refuses an empty examination', () => {
  console.log(
    `[release-workflow] examined release.yml (${examined.releaseLines} code lines) and release-policy.yml `
    + `(${examined.policyLines} code lines), ${examined.commentLines} comment lines left out: ${examined.jobs} jobs, `
    + `${examined.runBlocks} run blocks, ${examined.usesLines} uses lines`,
  );
  assert.ok(examined.releaseLines > 300);
  assert.ok(examined.policyLines > 15);
  assert.ok(examined.commentLines > 20);
  assert.equal(examined.jobs, 4);
  assert.ok(examined.runBlocks >= 12);
  assert.ok(examined.usesLines >= 9);
});
