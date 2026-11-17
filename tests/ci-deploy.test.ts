import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/ci-deploy.sh", import.meta.url));
const revision = "a".repeat(40);

function run(t: TestContext, overrides: Record<string, string> = {}, sha = revision) {
  const root = mkdtempSync(join(tmpdir(), "kctf-deploy-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  const site = join(root, "site");
  const backupDir = join(root, "backups");
  mkdirSync(bin);
  mkdirSync(join(site, "scripts"), { recursive: true });
  writeFileSync(join(site, ".env.prod.local"), "KCTF_HOST_PORT='4444'\n");
  writeFileSync(join(bin, "git"), `#!/bin/sh
case "$1 $2" in
  'status --porcelain') [ "\${DIRTY:-0}" = 0 ] || echo dirty;;
  'fetch --no-tags') echo fetch >> "$MOCK_LOG";;
  'rev-parse FETCH_HEAD') printf '%s\\n' "$MOCK_SHA";;
  'rev-parse HEAD') printf '%s\\n' "\${OLD_SHA}";;
  'checkout --detach') echo checkout >> "$MOCK_LOG";;
  *) exit 2;;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "docker"), `#!/bin/sh
case " $* " in
  *' exec -T postgres '*)
    echo backup >> "$MOCK_LOG"
    [ "\${BACKUP_FAIL:-0}" = 0 ] || exit 1
    printf 'database dump\\n';;
  *' port app 3000 '*)
    echo port >> "$MOCK_LOG"
    printf '%s\\n' "\${MOCK_ADDRESS:-127.0.0.1:4444}";;
  *) exit 2;;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "curl"), `#!/bin/sh
echo "health:$*" >> "$MOCK_LOG"
[ "\${HEALTH_FAIL:-0}" = 0 ]
`, { mode: 0o755 });
  writeFileSync(join(site, "scripts/deploy-prod.sh"), `#!/bin/sh
echo deploy >> "$MOCK_LOG"
[ "\${DEPLOY_FAIL:-0}" = 0 ]
`, { mode: 0o755 });

  const log = join(root, "events");
  const result = spawnSync("sh", [script, sha, site], {
    encoding: "utf8",
    timeout: 3000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, KCTF_BACKUP_DIR: backupDir, MOCK_LOG: log, MOCK_SHA: revision, OLD_SHA: "b".repeat(40), ...overrides },
  });
  const events = (() => { try { return readFileSync(log, "utf8").trim().split("\n"); } catch { return []; } })();
  const backups = (() => { try { return readdirSync(backupDir); } catch { return []; } })();
  return { result, events, backups };
}

test("deployment backs up before checkout and probes the published port", (t) => {
  const { result, events, backups } = run(t);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(events.map((event) => event.split(":")[0]), ["fetch", "backup", "checkout", "deploy", "port", "health"]);
  assert.match(events.at(-1) ?? "", /127\.0\.0\.1:4444\/api\/health/);
  assert.match(result.stdout, /Previous revision: b{40}/);
  assert.equal(backups.length, 1);
});

test("dirty checkout blocks fetch and backup", (t) => {
  const { result, events, backups } = run(t, { DIRTY: "1" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dirty/);
  assert.deepEqual(events, []);
  assert.deepEqual(backups, []);
});

test("failed backup blocks checkout and deploy and removes partial dump", (t) => {
  const { result, events, backups } = run(t, { BACKUP_FAIL: "1" });
  assert.notEqual(result.status, 0);
  assert.deepEqual(events, ["fetch", "backup"]);
  assert.deepEqual(backups, []);
});

test("invalid revision blocks host operations", (t) => {
  const { result, events, backups } = run(t, {}, "invalid");
  assert.notEqual(result.status, 0);
  assert.deepEqual(events, []);
  assert.deepEqual(backups, []);
});

test("fetched Master mismatch blocks backup and checkout", (t) => {
  const { result, events, backups } = run(t, { MOCK_SHA: "c".repeat(40) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Master advanced/);
  assert.deepEqual(events, ["fetch"]);
  assert.deepEqual(backups, []);
});

test("failed deployment retains the completed backup", (t) => {
  const { result, events, backups } = run(t, { DEPLOY_FAIL: "1" });
  assert.notEqual(result.status, 0);
  assert.deepEqual(events, ["fetch", "backup", "checkout", "deploy"]);
  assert.equal(backups.length, 1);
});

test("failed health check reports failure and retains the backup", (t) => {
  const { result, events, backups } = run(t, { HEALTH_FAIL: "1" });
  assert.notEqual(result.status, 0);
  assert.equal(events.at(-1)?.split(":")[0], "health");
  assert.equal(backups.length, 1);
});

test("non-loopback app address blocks health request and retains backup", (t) => {
  const { result, events, backups } = run(t, { MOCK_ADDRESS: "0.0.0.0:4444" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /bind to 127\.0\.0\.1/);
  assert.deepEqual(events, ["fetch", "backup", "checkout", "deploy", "port"]);
  assert.equal(backups.length, 1);
});
