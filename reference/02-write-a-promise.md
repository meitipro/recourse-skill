# Write a promise a judge can rule on

A promise is the standard a response is judged against. Nothing else is. If the
promise says only that data is accurate, a judge has two choices, invent a
standard the seller never agreed to or answer `unclear`, and `unclear` leaves
the payment with the seller and returns the bond, which is to say nobody
learned anything and everybody paid gas.

**Judgeable means it states something checkable: a count, a bound, a named
field, a freshness limit. Not judgeable means it states only a quality, such
as accurate, high quality or reliable.** That sentence is the deployed gate's
own wording and the linter asks it verbatim.

## Six examples

These are the linter's worked examples, taken from the evaluation sets so the
linter and the judge cannot tell different stories.

| | Promise | Why |
| --- | --- | --- |
| pass | Prices aggregated from at least three venues, refreshed within five seconds. | A count and a freshness bound. |
| pass | Returns at least ten items, each with a title and a url, published in the last twenty four hours. | A count, two named fields, a time window. |
| pass | Returns the full text of the requested document, or an explicit not found. | No number anywhere, still judgeable: both outcomes are named. |
| fail | Accurate market data. | Evaluation case 08, recorded unclear. Accurate against what, how fresh? |
| fail | High quality results. | A quality and a noun. Nothing to count, bound or name. |
| fail | Fast and reliable responses. | Fast compared to what, reliable measured how? |

The three failures never reach a model. The linter's first stage is
deterministic and free: length between 20 and 500, not composed only of
adjectives, and at least one measurable term (a number, a unit beside a
number, a time bound, a named field, or a named source). A promise that fails
there is told which check it failed.

## Two things to know before registering

**Registration lists you immediately.** `register_seller` stores the promise
and marks it judgeable. The on chain gate (`check_promise`) is not run at
registration; the contract owner can run it against any seller, and if it
rules a promise unjudgeable, `pay` refuses every buyer until the promise is
rewritten and reviewed. So the linter is what stands between you and a promise
that cannot be enforced, and a bad promise costs you buyers rather than a
transaction.

**The promise is frozen under a live payment.** `update_promise` refuses while
any payment is open, because a promise that changes after the money moved is
not a promise.

## Lint it

The linter is the same service behind the site panel and the MCP tool
`recourse_check_promise`. Stage 1 is free. Stage 2 asks the gate's question of
one model and is a dry run, not the gate's verdict.

```bash
curl -s -X POST https://recourse-linter.vercel.app/api/lint \
  -H "Content-Type: application/json" \
  -d '{"promise": "Accurate market data."}'
```

```json
{"judgeable": false, "reason": "Nothing here is measurable: no number, unit, time bound, count, named field or named source. Say what arrives and how fresh, not how good.", "failed_check": "no measurable term", "suggestion": null, "stage": 1}
```

The shape is always those five keys. `stage` is 1 or 2, `failed_check` is set
only on a stage 1 failure, `suggestion` only when the gate said no and a
rewrite that itself passes stage 1 could be produced. A 503 means no model was
available to ask; it is never an invented answer.

## Register it

Your own key, your own wallet. 20 to 500 characters.

```python
import os
from genlayer_py import create_account, create_client, studionet

ESCROW = "0x5125De939F7373eAE741B133FB32B7E9915C8F78"
seller = create_account(os.environ["RECOURSE_SELLER_KEY"])   # never paste a key into a tool
client = create_client(chain=studionet, account=seller)

tx = client.write_contract(
    address=ESCROW,
    function_name="register_seller",
    args=["Prices aggregated from at least three venues, refreshed within five seconds."],
)
receipt = client.wait_for_transaction_receipt(transaction_hash=tx, status="ACCEPTED", interval=3000, retries=40)
assert receipt["consensus_data"]["leader_receipt"][0]["result"]["status"] == "return", receipt["consensus_data"]["leader_receipt"][0]["result"]
```

Refusals you can get, all as `[EXPECTED] ...` in that `result` payload:
`already registered`, `promise length`.
