# MCP Directory Listing Pack

This pack is for MCP directories and AI-agent connector indexes that accept GitHub-backed or remote Streamable HTTP MCP listings. Submit only the product-scoped Telemark gateway routes below. Do not submit direct, broad Apify MCP URLs, and do not describe these listings as official Bluesky, RSS, TED, EU, Apify, OpenAI, or Anthropic integrations.

Status on 2026-09-02: all three product gateway routes return the expected OAuth protected-resource challenge, and the public ownership and server-card metadata are live. Exact Official MCP Registry entries are live for all three products. Smithery external Streamable HTTP listings are live for all three products. Glama connector pages are live and report `Healthy` for all three products.

## Product Metadata

| Product | Registry name | Remote URL | Official registry file |
| --- | --- | --- | --- |
| Bluesky Keyword Alerts | `io.github.telemarkdigital-publisher/bluesky-keyword-alerts` | `https://telemark-apify-monitoring-mcp.katfu111111.workers.dev/bluesky` | `mcp/bluesky-keyword-alerts/server.json` |
| RSS Keyword Monitor | `io.github.telemarkdigital-publisher/rss-keyword-monitor` | `https://telemark-apify-monitoring-mcp.katfu111111.workers.dev/rss` | `mcp/rss-keyword-monitor/server.json` |
| TED Tender Monitor | `io.github.telemarkdigital-publisher/ted-tender-monitor` | `https://telemark-apify-monitoring-mcp.katfu111111.workers.dev/ted` | `mcp/ted-tender-monitor/server.json` |

## Submission Order

1. Official MCP Registry: completed for all three exact registry names. Verify through `https://registry.modelcontextprotocol.io/v0.1/servers?search=<registry-name>`.
2. Smithery: completed for all three products as external Streamable HTTP listings.
3. Glama: completed for all three product-specific connector pages. Keep the product-specific routes, not the generic provider route, and keep the repository-root `glama.json` plus gateway `/.well-known/glama.json` live for ownership proof.
4. mcpservers.org and similar curated directories: submit the GitHub repo URL, product name, one-sentence description, and category. Use free review first.
5. MCP.so: submit the public GitHub repository as a server or remote server. Its form reads the public README, so keep `README.md`, `llms.txt`, and this pack current before submission.
6. PulseMCP: submit or monitor after Official MCP Registry publication, because PulseMCP ingests the official registry and enriches `server.json` metadata.

## Current Listing Status

| Product | Official MCP Registry | Smithery | Glama |
| --- | --- | --- | --- |
| Bluesky Keyword Alerts | Live: `io.github.telemarkdigital-publisher/bluesky-keyword-alerts` | Live: `thetelemarkdigital/bluesky-keyword-alerts` | Healthy: `https://glama.ai/mcp/connectors/io.github.telemarkdigital-publisher/bluesky-keyword-alerts` |
| RSS Keyword Monitor | Live: `io.github.telemarkdigital-publisher/rss-keyword-monitor` | Live: `thetelemarkdigital/rss-keyword-monitor` | Healthy: `https://glama.ai/mcp/connectors/io.github.telemarkdigital-publisher/rss-keyword-monitor` |
| TED Tender Monitor | Live: `io.github.telemarkdigital-publisher/ted-tender-monitor` | Live: `thetelemarkdigital/ted-tender-monitor` | Healthy: `https://glama.ai/mcp/connectors/io.github.telemarkdigital-publisher/ted-tender-monitor` |

## Form Copy

| Product | Server name | Short description | Category | Link |
| --- | --- | --- | --- | --- |
| Bluesky Keyword Alerts | Bluesky Keyword Alerts | Search bounded public Bluesky keywords, handles, mentions, and hashtags. | Search / Web Data / Monitoring | `https://github.com/Telemark-Digital/apify-monitoring-workflows/tree/main/mcp/bluesky-keyword-alerts` |
| RSS Keyword Monitor | RSS Keyword Monitor | Search bounded RSS, Atom, and RDF feed matches by keyword or regex. | Search / Web Data / Monitoring | `https://github.com/Telemark-Digital/apify-monitoring-workflows/tree/main/mcp/rss-keyword-monitor` |
| TED Tender Monitor | TED Tender Monitor | Search EU TED procurement notices by CPV, country, keyword, value, or type. | Search / Procurement / Monitoring | `https://github.com/Telemark-Digital/apify-monitoring-workflows/tree/main/mcp/ted-tender-monitor` |

Contact email: `thetelemarkdigital@gmail.com`

Listing status: community or unofficial Telemark Digital listing, unless a platform's "official" badge means only that Telemark Digital owns the submitted MCP server entry.
