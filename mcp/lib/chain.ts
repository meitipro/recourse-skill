/**
 * Reads the frozen Recourse contracts on whichever network is asked for.
 * Read only by construction.
 *
 * The client is created without an account. There is no key anywhere in this
 * process, so it cannot sign, submit, pay, dispute or withdraw even by
 * mistake, and test/readonly.test.ts asserts that against the client object
 * rather than against this comment. The MCP advises; the agent's own wallet
 * acts.
 *
 * The same frozen bytes are deployed once per network and addresses.json
 * carries every deployment. Bradbury is the default because it persists; a
 * network with no entry yet is refused by name rather than guessed at.
 *
 * genlayer-js builds its transport with retryCount 0, so one dropped
 * connection fails the call. Studio drops connections, so every read retries.
 */

import { createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";

import addresses from "../addresses.json";

export const ADDRESSES = addresses;

type Deployment = { chain_id: number; rpc: string; explorer: string; escrow: string; dispute: string };

const CHAINS = { studionet, bradbury: testnetBradbury } as const;
export type NetworkName = keyof typeof CHAINS;
export const NETWORKS = Object.keys(CHAINS) as NetworkName[];

export function deployments(): Record<string, Deployment> {
  return addresses.deployments as Record<string, Deployment>;
}

/** The network a request is about: what it asked for, else the default, else whatever is deployed. */
export function resolveNetwork(requested?: string | null): NetworkName {
  const have = deployments();
  if (requested) {
    if (!(requested in CHAINS)) throw new Error(`unknown network ${requested}; known: ${NETWORKS.join(", ")}`);
    if (!have[requested]) throw new Error(`the frozen contracts are not deployed on ${requested} yet; deployed: ${Object.keys(have).join(", ")}`);
    return requested as NetworkName;
  }
  const preferred = addresses.default_network as NetworkName;
  if (have[preferred]) return preferred;
  const first = Object.keys(have).find((n) => n in CHAINS) as NetworkName | undefined;
  if (!first) throw new Error("no deployments in addresses.json");
  return first;
}

export function deployment(network: NetworkName): Deployment {
  const entry = deployments()[network];
  if (!entry) throw new Error(`no deployment on ${network}`);
  return entry;
}

const clients = new Map<NetworkName, ReturnType<typeof createClient>>();

/** One client per network. No account, ever. */
export function client(network: NetworkName) {
  let cached = clients.get(network);
  if (!cached) {
    cached = createClient({ chain: CHAINS[network] });
    clients.set(network, cached);
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

export async function read<T = string>(network: NetworkName, address: string, functionName: string, args: ReadArg[] = []) {
  return withRetry(() =>
    client(network).readContract({ address: address as `0x${string}`, functionName, args }),
  ) as Promise<T>;
}

export async function readJson<T>(network: NetworkName, address: string, functionName: string, args: ReadArg[] = []) {
  return JSON.parse(await read<string>(network, address, functionName, args)) as T;
}

/**
 * A case citation is derived off chain from the payment id and the year the
 * verdict landed: p-000043 decided in 2026 is RC-2026-0043. Either form is
 * accepted everywhere a case id is taken, so the bot, the site and this server
 * agree. Ids are per network, so a citation is read on the network asked for.
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
