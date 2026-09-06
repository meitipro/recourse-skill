/**
 * The server is structurally incapable of writing to the chain.
 *
 * Not a policy, a property: the client has no account, so there is nothing to
 * sign with. This test reaches into the client rather than trusting the
 * comment above it, and it also scans the server's own source for any write
 * method name, because a future tool that calls writeContract would compile.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ADDRESSES, client, toCitation, toPid } from "../lib/chain";

test("the chain client is created without an account", () => {
  const instance = client() as unknown as { account?: unknown; localAccount?: unknown };
  assert.equal(instance.account ?? null, null);
  assert.equal(instance.localAccount ?? null, null);
});

test("no source file in this server names a write method", () => {
  const root = path.resolve(__dirname, "..");
  const banned = ["writeContract", "deployContract", "sendTransaction", "signMessage", "createAccount", "privateKey"];
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "test") return [];
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [full] : [];
    });
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, "utf8");
    for (const word of banned) {
      assert.ok(!source.includes(word), `${path.relative(root, file)} mentions ${word}`);
    }
  }
});

test("addresses are the frozen pair", () => {
  assert.equal(ADDRESSES.escrow, "0x5125De939F7373eAE741B133FB32B7E9915C8F78");
  assert.equal(ADDRESSES.dispute, "0x80A98929EcA334804dbB04d31F6050bca42C0Cc4");
  assert.equal(ADDRESSES.frozen, true);
});

test("the server's copy of the addresses is the skill's reference file", () => {
  // mcp/addresses.json exists so the deployment is self contained. It is a
  // copy, and this is what stops it drifting from reference/07-addresses.json.
  const reference = path.resolve(__dirname, "..", "..", "reference", "07-addresses.json");
  if (!fs.existsSync(reference)) return;
  const theirs = JSON.parse(fs.readFileSync(reference, "utf8"));
  assert.deepEqual(ADDRESSES, theirs);
});

test("a citation and a payment id name the same case", () => {
  assert.equal(toPid("RC-2026-0043"), "p-000043");
  assert.equal(toPid("p-000043"), "p-000043");
  assert.equal(toPid("p-43"), "p-000043");
  assert.equal(toPid("43"), "p-000043");
  assert.equal(toCitation("p-000043", 1788639536), "RC-2026-0043");
  assert.throws(() => toPid("case forty three"));
});
