# AI Client Plugin Marketplaces

This repository includes foundational plugin packages for Codex, ChatGPT desktop, and Claude Code. Each plugin exposes one Telemark Digital Apify Actor through Apify's hosted MCP endpoint and adds a product-specific skill for safe use.

Status: these files are ready for local and repository-source validation, but they are not official OpenAI or Anthropic marketplace submissions.

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

For monitoring, schedules, alerts, and only-new delivery, create a persistent saved Apify Task and connect the published n8n workflow or a Make implementation package after it has been built and validated in the destination Make account. Verify the saved Task cap before activation:

| Product | Saved Task cap |
| --- | --- |
| Bluesky Keyword & Mention Alerts | `maxPostsPerRun <= 100` |
| RSS Keyword Monitor | `maxItemsPerRun <= 200` |
| TED Tender Monitor | `maxNewPerRun <= 999` |

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

Run fresh-install tests before linking users to these plugins. A complete release gate must prove that each install exposes only its own Actor tool plus Apify's paired output helper, completes OAuth without file-based secrets, produces a bounded result, handles a valid empty result, and preserves the one-off versus saved-Task monitoring boundary.

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

