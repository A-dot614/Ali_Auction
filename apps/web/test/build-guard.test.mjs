import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadConfig(nodeEnv, demo) {
  const script = [
    "import('./next.config.ts')",
    "  .then(() => console.log('LOADED'))",
    "  .catch((error) => { console.error(error.message); process.exit(7); });",
  ].join("\n");
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: nodeEnv,
        NEXT_PUBLIC_DEMO_MODE: demo ? "true" : "false",
        VITE_DEMO_MODE: "",
      },
    }
  );
}

test("a production build fails when demo mode is on", () => {
  const result = loadConfig("production", true);
  assert.notEqual(result.status, 0, "next config import must fail in production with demo mode on");
  assert.match(
    `${result.stdout}${result.stderr}`,
    /DEMO_MODE_ENABLED_IN_PRODUCTION/,
    "failure must name the demo-mode build guard"
  );
});

test("dev demo and production without demo load successfully", () => {
  for (const [nodeEnv, demo] of [["development", true], ["production", false]]) {
    const result = loadConfig(nodeEnv, demo);
    assert.equal(result.status, 0, `${nodeEnv} demo=${demo}: ${result.stderr}`);
    assert.match(result.stdout, /LOADED/);
  }
});

test("demo mode is build-time only and accepts the Next public setting", async () => {
  const { demoModeFromEnv, assertDemoBuildAllowed, DEMO_BANNER_TEXT } = await import(
    "../src/lib/demo.ts"
  );
  assert.equal(demoModeFromEnv({}), false);
  assert.equal(demoModeFromEnv({ NEXT_PUBLIC_DEMO_MODE: "true" }), true);
  assert.equal(demoModeFromEnv({ VITE_DEMO_MODE: "true" }), true);
  assert.equal(demoModeFromEnv({ NEXT_PUBLIC_DEMO_MODE: "1" }), false);
  assert.equal(DEMO_BANNER_TEXT, "DEMO: not real, nothing is charged, no decision made");
  assert.doesNotThrow(() => assertDemoBuildAllowed("development", true));
  assert.doesNotThrow(() => assertDemoBuildAllowed("production", false));
  assert.throws(() => assertDemoBuildAllowed("production", true), /DEMO_MODE_ENABLED_IN_PRODUCTION/);
});
