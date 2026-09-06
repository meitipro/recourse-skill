# File a dispute

You have run the checks in `04`, `contestable` is `True`, the response is
recorded, and `window_ends` is still ahead of the chain's clock. Now, and only
now, post the bond.

## What happens

`open_dispute(pid: str)`, payable, value exactly the bond (1 GEN on this
deployment, read `stats()["bond_amount"]` rather than assuming). The escrow
marks the payment DISPUTED, sets `dispute_ends` one hour out, and emits
`adjudicate` to the dispute contract on acceptance. The dispute contract asks
the question in both presentation orders inside one consensus round and
emits `settle` back on finalization. Judgment starts on acceptance and money
moves on finalization, so the verdict lands in about a minute and the money
about thirty seconds after it.

Neither party writes the timing block. The escrow builds it from the chain's
own record of when the request and the response were recorded, so neither
party can move the boundary they are judged against.

## The call

```python
import json, os
from genlayer_py import create_account, create_client, studionet

ESCROW = "0x5125De939F7373eAE741B133FB32B7E9915C8F78"
buyer = create_account(os.environ["RECOURSE_BUYER_KEY"])
client = create_client(chain=studionet, account=buyer)

bond = int(json.loads(client.read_contract(ESCROW, "stats", []))["bond_amount"])

tx = client.write_contract(address=ESCROW, function_name="open_dispute", args=[pid], value=bond)
receipt = client.wait_for_transaction_receipt(transaction_hash=tx, status="ACCEPTED", interval=3000, retries=40)

result = receipt["consensus_data"]["leader_receipt"][0]["result"]
assert str(result.get("status", "")).lower() == "return", f"refused: {result.get('payload')}"
```

Refusals, each `[EXPECTED] ...` in that payload: `not buyer`, `not open`,
`no response`, `window closed`, `wrong bond` (exact, not merely enough),
`dispute contract not set`.

**A refused dispute is still an ACCEPTED transaction.** The committee agreed
that refusing was the correct result. Read the execution result, not the
status. `06-read-a-verdict.md` is how.

## If judgment never lands

A model call inside consensus can fail to land: a rotation exhausts, a committee
never agrees, a transaction is dropped. After `dispute_ends` has passed with no
verdict, either party can unwind:

```python
tx = client.write_contract(address=ESCROW, function_name="reclaim", args=[pid])
client.wait_for_transaction_receipt(transaction_hash=tx, status="ACCEPTED", interval=3000, retries=40)
# payment to the seller, bond back to the buyer: the split neither party chose.
```

Refusals: `not a party`, `not disputed`, `judgment still running`,
`unknown payment`.
