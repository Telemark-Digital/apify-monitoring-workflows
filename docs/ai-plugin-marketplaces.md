# AI Client Plugin Marketplaces

This repository includes foundational plugin packages for Codex, ChatGPT desktop, and Claude Code. Each plugin exposes one Telemark Digital Apify Actor through Apify's hosted MCP endpoint and adds a product-specific skill for safe use.

Status on 2026-09-02: repository-source installation and live OAuth/MCP canaries passed in Codex and Claude Code on 2026-07-23. Official MCP Registry and Smithery remote listings are live for all three products. Glama connector pages are live and report `Healthy` for all three products; see [MCP Directory Listing Pack](./mcp-directory-listings.md). Claude plugin submissions remain a separate review gate. OpenAI app listings are also separate from these repository-source packages; TED and Bluesky are released, and RSS is in review after the result-shape fixture fix.

## Directory Status

| Surface | Bluesky | RSS | TED |
| --- | --- | --- | --- |
| OpenAI app directory | Released | In review after fixture fix | Released |
| Claude plugin review | Pending review | Pending review | Pending review |
| Official MCP Registry | Live | Live | Live |
| Smithery | Live | Live | Live |
| Glama | Healthy | Healthy | Healthy |

## Included Plugins

| Plugin | Actor | Intended use |
| --- | --- | --- |
| `bluesky-keyword-alerts` | `uplifted_novice_vbl/bluesky-keyword-mention-alerts` | Bounded public Bluesky keyword, handle, mention, and hashtag discovery. |
| `rss-keyword-monitor` | `uplifted_novice_vbl/rss-keyword-monitor-only-new` | Bounded RSS, Atom, and RDF keyword or regex discovery. |
| `ted-tender-monitor` | `uplifted_novice_vbl/ted-tender-watch` | Bounded TED procurement notice discovery. |

The plugins use OAuth through Apify MCP. Do not add Apify tokens, authorization headers, webhook URLs, private Task IDs, or customer data to plugin manifests, marketplace files, skills, screenshots, examples, or support logs.

## Repository Layout

- `.agents/plugins/marketplace.json` is the Codex and ChatGPT desktop marketplace catalog.
- `.claude-plugin/marketplace.json` is the Claude Code marketplace catalog.
- `plugins/<plugin-name>/.codex-plugin/plugin.json` contains Codex presentation metadata.
- `plugins/<plugin-name>/.claude-plugin/plugin.json` contains Claude plugin metadata.
- `plugins/<plugin-name>/.mcp.json` pins Apify MCP to exactly one Actor.
- `plugins/<plugin-name>/skills/<plugin-name>/SKILL.md` documents the safe usage boundary.

## Usage Boundary

These plugins are for one-off, bounded Actor calls inside an AI client. They do not run in the background, keep schedules, or guarantee only-new delivery across time by themselves.

For monitoring, schedules, alerts, and only-new delivery, create a persistent saved Apify Task and connect the repository n8n workflow or the matching public Make shared scenario. Verify the saved Task cap before activation:

| Product | Saved Task cap |
| --- | --- |
| Bluesky Keyword & Mention Alerts | `maxPostsPerRun <= 100` |
| RSS Keyword Monitor | `maxItemsPerRun <= 200` |
| TED Tender Monitor | `maxNewPerRun <= 999` |

Public Make shared scenarios:

- [Bluesky Keyword and Mention Alerts](https://us2.make.com/public/shared-scenario/FtrDlcux4Vr/bluesky-keyword-and-mention-alerts-from)
- [RSS Keyword Alerts](https://us2.make.com/public/shared-scenario/3rwZCcptirx/rss-keyword-alerts-from-a-persistent-api)
- [TED Tender Alerts](https://us2.make.com/public/shared-scenario/udxoD7qdzBB/ted-tender-alerts-from-a-persistent-apif)

## Local Validation Commands

From the repository root:

```bash
npm run validate
```

Codex plugin manifests can also be checked individually with the local Codex plugin validator used during package preparation.

Claude Code supports marketplace validation with:

```bash
claude plugin validate .
```

The 2026-07-23 fresh-install canaries proved that each install exposes exactly one Actor-specific tool plus Apify's current `abort-actor-run`, `get-actor-run`, `get-dataset-items`, and `get-key-value-store-record` helpers. Each product completed OAuth without file-based secrets and passed bounded non-empty and valid empty-result calls in both Codex and Claude Code. The skills prohibit routine use of the destructive abort helper and keep one-off discovery separate from saved-Task monitoring.

## Candidate Install Paths

For Codex or ChatGPT desktop, add the repository marketplace and install a product plugin from `telemark-digital-apify`. Keep `plugins` in the marketplace checkout so each entry's relative source path resolves.

For Claude Code, add the repository marketplace and install a product plugin from `telemark-digital-apify`. A sparse checkout must include both `.claude-plugin` and `plugins`.

Confirm the exact CLI syntax against the current client documentation before publishing end-user instructions.

## Official References

- Apify MCP integration: <https://docs.apify.com/integrations/mcp>
- Codex plugin authoring: <https://learn.chatgpt.com/docs/build-plugins>
- Codex plugin submission: <https://learn.chatgpt.com/docs/submit-plugins>
- Claude Code plugins: <https://code.claude.com/docs/en/plugins>
- Claude Code marketplaces: <https://code.claude.com/docs/en/plugin-marketplaces>
