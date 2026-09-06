# What Recourse is

x402 settles a machine payment in milliseconds and finally. Once settlement
confirms there is no chargeback path and no dispute window, by design, because a
push payment with no reversal is what lets machines transact without accounts
or credit relationships. Agents can spend money in milliseconds. Nothing in the
stack lets them get it back.

Recourse is the missing dispute right. It holds the payment for a short window,
lets the buying agent contest it, and has GenLayer validators rule.

## The cycle

1. The seller registers and publishes a delivery promise in plain language.
2. The buyer pays into `RecourseEscrow`. Funds enter escrow, not the seller.
3. The response is delivered instantly and recorded on chain, signed by the
   seller over its hash. No consensus runs here, so an honest sale adds no
   latency.
4. A settlement window runs (300 seconds on the frozen deployment). If nobody
   contests, the seller withdraws.
5. To contest, the buyer posts a bond (1 GEN). `RecourseDispute` receives the
   promise, the request, the response, and a timing block the chain wrote, and
   answers one narrow question in both presentation orders.
6. The verdict is written on acceptance and the money moves on finalization.

## The three verdicts

| Verdict | Payment | Bond | Seller record |
| --- | --- | --- | --- |
| honored | to seller | to seller | unchanged |
| not_honored | to buyer | to buyer | upheld plus one |
| unclear | to seller | to buyer | unchanged |

`unclear` exists so the system is never forced to manufacture certainty about
a promise written too loosely to judge. A losing dispute costs the buyer the
bond, or contesting everything is free; an unclear verdict is the promise's
fault rather than the buyer's, so the bond comes back.

## What is measured

Two evaluation sets, both published: 17 of 18 on the set the question was
narrowed against, and 1 of 3 on a held out set committed before it could be
run. Both numbers are always shown together. The pattern they agree on: a
promise that does not settle the question gets answered on its plain words.
Write promises that settle the question. `02-write-a-promise.md` is how.

## Read the live state

Read only, no key, no cost. Python with `genlayer_py`:

```python
import json
from genlayer_py import create_client, studionet

ESCROW = "0x5125De939F7373eAE741B133FB32B7E9915C8F78"
DISPUTE = "0x80A98929EcA334804dbB04d31F6050bca42C0Cc4"

client = create_client(chain=studionet)           # no account: cannot write

stats = json.loads(client.read_contract(ESCROW, "stats", []))
# {"bond_amount": "1000000000000000000", "held": "...", "payments": 7, "window_seconds": 300, ...}

recent = json.loads(client.read_contract(DISPUTE, "recent_verdicts", [10]))
# [{"pid": "p-000003", "verdict": 2, "verdict_name": "not_honored", "reason": "...", "decided_at": 1788639536}, ...]
```

Studio allows about thirty requests a minute for the whole node. Read pages
(`recent_rows`, `recent_verdicts`), not rows.
