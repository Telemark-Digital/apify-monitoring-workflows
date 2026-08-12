# MCP Directory Listing Pack

This pack is for MCP directories and AI-agent connector indexes that accept GitHub-backed or remote Streamable HTTP MCP listings. Submit only the product-scoped Telemark gateway routes below. Do not submit direct, broad Apify MCP URLs, and do not describe these listings as official Bluesky, RSS, TED, EU, Apify, OpenAI, or Anthropic integrations.

Status on 2026-08-12: all three gateway routes returned `401 Unauthorized` with OAuth protected-resource metadata and no static token requirement in the public metadata. This is a route health smoke check, not a full paid tool-call canary. Complete a bounded MCP tool-call canary for a product before submitting that product to directories that automatically inspect or call tools.

## Product Metadata

| Product | Registry name | Remote URL | Official registry file |
| --- | --- | --- | --- |
| Bluesky Keyword Alerts | `io.github.telemark-digital/bluesky-keyword-alerts` | `https://telemark-apify-monitoring-mcp.katfu111111.workers.dev/bluesky` | `mcp/bluesky-keyword-alerts/server.json` |
| RSS Keyword Monitor | `io.github.telemark-digital/rss-keyword-monitor` | `https://telemark-apify-monitoring-mcp.katfu111111.workers.dev/rss` | `mcp/rss-keyword-monitor/server.json` |
| TED Tender Monitor | `io.github.telemark-digital/ted-tender-monitor` | `https://telemark-apify-monitoring-mcp.katfu111111.workers.dev/ted` | `mcp/ted-tender-monitor/server.json` |

## Submission Order

1. Official MCP Registry: use the matching `server.json` file. From that product directory, run `mcp-publisher login github`, complete the Telemark Digital GitHub authorization, then run `mcp-publisher publish`. Verify through `https://registry.modelcontextprotocol.io/v0.1/servers?search=<registry-name>`.
2. Glama: submit the public GitHub repository or inspect the remote URL after the full canary passes. Use community/unofficial classification and the product-specific route, not the generic provider route.
3. Smithery: publish as an external Streamable HTTP URL after login with `smithery mcp publish "<remote-url>" -n telemark-digital/<product-slug>`. Use the free route unless product usage justifies a paid placement.
4. mcpservers.org and similar curated directories: submit the GitHub repo URL, product name, one-sentence description, and category. Use free review first.
5. MCP.so: submit the public GitHub repository as a server or remote server. Its form reads the public README, so keep `README.md`, `llms.txt`, and this pack current before submission.
6. PulseMCP: prioritize after Official MCP Registry publication, because PulseMCP ingests the official registry and enriches `server.json` metadata.

## Form Copy

| Product | Server name | Short description | Category | Link |
| --- | --- | --- | --- | --- |
| Bluesky Keyword Alerts | Bluesky Keyword Alerts | Search bounded public Bluesky keywords, handles, mentions, and hashtags. | Search / Web Data / Monitoring | `https://github.com/Telemark-Digital/apify-monitoring-workflows/tree/main/mcp/bluesky-keyword-alerts` |
| RSS Keyword Monitor | RSS Keyword Monitor | Search bounded RSS, Atom, and RDF feed matches by keyword or regex. | Search / Web Data / Monitoring | `https://github.com/Telemark-Digital/apify-monitoring-workflows/tree/main/mcp/rss-keyword-monitor` |
| TED Tender Monitor | TED Tender Monitor | Search EU TED procurement notices by CPV, country, keyword, value, or type. | Search / Procurement / Monitoring | `https://github.com/Telemark-Digital/apify-monitoring-workflows/tree/main/mcp/ted-tender-monitor` |

Contact email: `thetelemarkdigital@gmail.com`

Listing status: community or unofficial Telemark Digital listing, unless a platform's "official" badge means only that Telemark Digital owns the submitted MCP server entry.
