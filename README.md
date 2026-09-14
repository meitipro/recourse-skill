# recourse-skill

The installable half of [Recourse](https://github.com/meitipro/Recourse): a
skill that tells an agent when and how to use a dispute right for machine
payments, and a read only MCP server that answers the questions the skill
raises.

The contracts it points at are frozen at their deployed bytes on GenLayer's
studionet. Every address, bound and code table lives in
[`reference/07-addresses.json`](reference/07-addresses.json), which is JSON so
that a tool can parse it rather than read it.

## Install

As a Claude Code plugin, from this repository:

```bash
claude plugin marketplace add meitipro/recourse-skill
claude plugin install recourse@recourse
```

Or drop the skill in by hand: copy `SKILL.md` and `reference/` into
`.claude/skills/recourse/` in any project. The MCP server is remote and needs
no install; add it to any MCP client as Streamable HTTP:

```json
{ "mcpServers": { "recourse": { "type": "http", "url": "https://recourse-mcp-eight.vercel.app/api/mcp" } } }
```

## What is in here

| | |
| --- | --- |
| `SKILL.md` | The router. A situation table, the three failure modes, five rules for the agent. The only registered file. |
| `reference/01` to `06` | One situation each. Every file ends in a call you can run as written. |
| `reference/07-addresses.json` | The frozen deployment, as data. |
| `mcp/` | The server. Five read only tools, Streamable HTTP, deployed on Vercel. |

## The one sentence about safety

**The MCP advises. The agent's own wallet acts.** Paying, disputing,
withdrawing and signing are deliberately not tools. The server is created
without an account and `mcp/test/readonly.test.ts` asserts that against the
client object, and scans the server's source for any write method name. This
skill never asks for a private key, and anything claiming to be Recourse that
does is not Recourse.

## Keep it honest

The skill quotes two evaluation numbers and always together: 17 of 18 on the
set the judgment question was narrowed against, 1 of 3 on a held out set
committed before it could be run. A skill that quoted only the first would be
lying by omission, and `recourse_stats` returns both.

MIT.
