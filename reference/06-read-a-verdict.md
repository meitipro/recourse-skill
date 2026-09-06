# Read a verdict

Two things are true about a Recourse transaction that are not true of most:
ACCEPTED is not SUCCEEDED, and the verdict is not the settlement.

**ACCEPTED means a committee agreed on the receipt.** The receipt can be a
refusal. Every refusal in the README is an ACCEPTED transaction with an
execution result of ERROR, and reading only the status would call each of them
a success.

**The verdict is written on acceptance; the money moves on finalization.** The
payment's `status` stays 2 (disputed) after the case row exists, and becomes 3
(resolved) only when `settle` has run. Poll the payment, not the case, if what
you want to know is whether the money moved.

## Poll

```python
import json, time
from genlayer_py import create_account, create_client, studionet

ESCROW = "0x5125De939F7373eAE741B133FB32B7E9915C8F78"
DISPUTE = "0x80A98929EcA334804dbB04d31F6050bca42C0Cc4"
STATUS = ["open", "withdrawn", "disputed", "resolved"]
VERDICT = ["pending", "honored", "not_honored", "unclear"]

# The SDK wants a sender address even for a read. A throwaway key holds
# nothing and signs nothing; your real key works too and is never needed here.
client = create_client(chain=studionet, account=create_account())

deadline = time.time() + 240
while time.time() < deadline:
    payment = json.loads(client.read_contract(ESCROW, "get_payment", [pid]))
    if payment["status"] == 3:
        break
    time.sleep(5)                            # Studio allows ~30 requests a minute

print(STATUS[payment["status"]], VERDICT[payment["verdict"]])
```

## Read the case

```python
case = json.loads(client.read_contract(DISPUTE, "get_case", [pid]))
# {
#   "pid": "p-000003",
#   "promise": "...", "request": "...", "response": "...",
#   "timing": "Request recorded on chain at 2026-09-05T20:18:32Z. Response recorded on chain at 2026-09-05T20:18:43Z.",
#   "verdict": 2, "verdict_name": "not_honored",
#   "reason": "Response timestamp ... far exceeding the 5-second freshness bound stated in the PROMISE.",
#   "opened_at": 1788639536, "decided_at": 1788639536
# }
```

`opened_at` and `decided_at` are one message's fixed datetime and are always
equal. Chain timestamps cannot tell you how long judgment took; only a wall
clock beside the transaction can.

## Read a receipt honestly

The refusal text is not in stderr, which is always empty. It is here:

```python
def execution(receipt):
    """('return', value) or ('rollback', '[EXPECTED] reason')."""
    leader = receipt["consensus_data"]["leader_receipt"]
    result = (leader[0] if isinstance(leader, list) else leader)["result"]
    status = str(result.get("status", "")).lower()
    payload = result.get("payload")
    if status == "return" and isinstance(payload, dict) and "readable" in payload:
        return status, json.loads(payload["readable"])
    return status, payload
```

## Cite it

A case is cited as `RC-<year decided>-<zero padded id>`: payment `p-000043`
decided in 2026 is `RC-2026-0043`. The site, the bot and the MCP server all
accept either form and print the citation.

```python
def citation(pid, decided_at):
    import datetime
    year = datetime.datetime.fromtimestamp(decided_at, datetime.timezone.utc).year
    return f"RC-{year}-{int(pid.split('-')[1]):04d}"
```
