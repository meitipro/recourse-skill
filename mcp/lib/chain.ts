/**
 * Reads the frozen Recourse contracts. Read only by construction.
 *
 * The client is created without an account. There is no key anywhere in this
 * process, so it cannot sign, submit, pay, dispute or withdraw even by
 * mistake, and test/readonly.test.ts asserts that against the client object
 * rather than against this comment. The MCP advises; the agent's own wallet
 * acts.
 *
 * genlayer-js builds its transport with retryCount 0, so one dropped
 * connection fails the call. Studio drops connections, so every read retries.
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import addresses from "../addresses.json";

export const ADDRESSES = addresses;
export const ESCROW = addresses.escrow as `0x${string}`;
export const DISPUTE = addresses.dispute as `0x${string}`;

let cached: ReturnType<typeof createClient> | null = null;

/** The one client. No account, ever. */
export function client() {
  if (!cached) {
    cached = createClient({ chain: studionet });
  }
  return cached;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(400 * 2 ** i, 4000)));
      }
    }
  }
  throw last;
}

type ReadArg = string | number | boolean;

export async function read<T = string>(address: `0x${string}`, functionName: string, args: ReadArg[] = []) {
  return withRetry(() => client().readContract({ address, functionName, args })) as Promise<T>;
}

export async function readJson<T>(address: `0x${string}`, functionName: string, args: ReadArg[] = []) {
  return JSON.parse(await read<string>(address, functionName, args)) as T;
}

/**
 * A case citation is derived off chain from the payment id and the year the
 * verdict landed: p-000043 decided in 2026 is RC-2026-0043. Either form is
 * accepted everywhere a case id is taken, so the bot, the site and this server
 * agree.
 */
export function toPid(caseId: string): string {
  const trimmed = caseId.trim();
  const cite = /^RC-\d{4}-(\d{4,6})$/i.exec(trimmed);
  if (cite) return `p-${cite[1].padStart(6, "0")}`;
  const plain = /^p-(\d{1,6})$/i.exec(trimmed);
  if (plain) return `p-${plain[1].padStart(6, "0")}`;
  if (/^\d{1,6}$/.test(trimmed)) return `p-${trimmed.padStart(6, "0")}`;
  throw new Error(`not a case id: ${caseId}. Use p-000043 or RC-2026-0043.`);
}

export function toCitation(pid: string, decidedAt: number): string {
  const year = decidedAt ? new Date(decidedAt * 1000).getUTCFullYear() : new Date().getUTCFullYear();
  // Four digits minimum, never truncated: p-000043 is RC-2026-0043 and
  // p-012345 is RC-2026-12345. padStart alone kept the six digit form.
  return `RC-${year}-${String(parseInt(pid.replace(/^p-/, ""), 10)).padStart(4, "0")}`;
}

export const STATUS = ["open", "withdrawn", "disputed", "resolved"] as const;
export const VERDICT = ["pending", "honored", "not_honored", "unclear"] as const;
