# Pay through Recourse

Paying through Recourse means paying the escrow, not the seller, and telling
the seller which payment you are presenting. The seller delivers instantly and
records the response on chain, signed. Nothing about this path runs consensus
on the happy case, so it adds no latency to an honest sale.

## What you need

- A funded studionet account. `sim_fundAccount` is a programmatic faucet:
  `{"method": "sim_fundAccount", "params": ["0x<you>", 100000000000000000000]}`
  against `https://studio.genlayer.com/api`, amount as a JSON number in wei.
  Read your balance before and after; the faucet's own reply is not evidence.
- The seller's address and their promise (`get_seller`).
- A request string that says what you are asking for. It is frozen on chain
  and the judge reads it, so make it the actual request.

## The call

`pay(seller: str, request: str) -> str`, payable. The return value is the
payment id, `p-000NNN`. Read it from the receipt rather than from `recent(1)`,
which is whichever payment landed last and is not necessarily yours.

```python
import json, os
from genlayer_py import create_account, create_client, studionet

ESCROW = "0x5125De939F7373eAE741B133FB32B7E9915C8F78"
SELLER = "0x965c98389197055CFb3FD8b1E3e9a11AE6d40C99"      # the demo seller on this deployment
GEN = 10**18

buyer = create_account(os.environ["RECOURSE_BUYER_KEY"])
client = create_client(chain=studionet, account=buyer)


def returned(receipt):
    """The contract's return value, or the refusal text as an exception."""
    leader = receipt["consensus_data"]["leader_receipt"]
    result = (leader[0] if isinstance(leader, list) else leader)["result"]
    if str(result.get("status", "")).lower() != "return":
        raise RuntimeError(f"refused: {result.get('payload')}")
    payload = result["payload"]
    return json.loads(payload["readable"]) if isinstance(payload, dict) and "readable" in payload else payload


promise = json.loads(client.read_contract(ESCROW, "get_seller", [SELLER]))["promise"]
request = "GET /quote?pair=ETH-USD"

tx = client.write_contract(address=ESCROW, function_name="pay", args=[SELLER, request], value=4 * GEN)
receipt = client.wait_for_transaction_receipt(transaction_hash=tx, status="ACCEPTED", interval=3000, retries=40)
pid = returned(receipt)          # "p-000008"
```

Refusals: `unknown seller`, `seller inactive`, `promise not judgeable`,
`zero value`, `request too long` (2000 characters).

## Present it to the seller

Ask the endpoint without paying first; a 402 tells you the scheme and the
header to put the proof in. On x402 that header is `x-payment-proof` and the
proof is the payment id. On an endpoint settling elsewhere the header and the
reference are that rail's own; the contracts never see either.

```python
import urllib.error, urllib.request

ENDPOINT = "http://localhost:4501/quote?pair=ETH-USD"     # the seller's URL

# 1. Ask without paying. A 402 is the expected answer and urllib raises on it.
try:
    urllib.request.urlopen(ENDPOINT, timeout=20)
    raise SystemExit("the endpoint served without payment; nothing to prove")
except urllib.error.HTTPError as challenge:
    assert challenge.code == 402, challenge.code
    offer = json.loads(challenge.read().decode("utf-8"))["accepts"][0]
    header = offer["header"]                          # "x-payment-proof" on x402

# 2. Present the payment id in the header the challenge named.
req = urllib.request.Request(ENDPOINT, headers={header: pid})
with urllib.request.urlopen(req, timeout=20) as response:
    body = response.read().decode("utf-8")           # record THIS string, byte for byte
    signature = response.headers.get("x-response-sig", "")
```

## Record the response

The seller normally records and signs. If the seller has not, you may record
it yourself with an empty signature: the row then shows `recorded_by` as you
and `signed` false, which is visibly a response the seller never stood behind.
Recording is required before a dispute can be opened, and it must happen
inside the window.

```python
tx = client.write_contract(address=ESCROW, function_name="record_response", args=[pid, body, ""])
client.wait_for_transaction_receipt(transaction_hash=tx, status="ACCEPTED", interval=3000, retries=40)
```

Refusals: `not a party`, `not open`, `response already recorded`,
`empty response`, `window closed`, `response too long` (4000),
`signature too long` (200).

Now go to `04-check-a-response.md` before doing anything else.
