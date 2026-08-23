# Public Status And Glama Gate

Checked on 2026-08-24.

## Live Surfaces

- Apify Store examples are live for Bluesky, RSS, and TED.
- Make shared scenarios are live for Bluesky, RSS, and TED.
- n8n public workflow templates are live for RSS (`17430`), TED (`18030`), and Bluesky (`18103`).
- Official MCP Registry entries are live for all three product-scoped remote routes.
- Smithery external Streamable HTTP listings are live for all three product-scoped remote routes.
- OpenAI app directory status: TED and Bluesky are released; RSS is in review after a result-shape fixture fix.
- Claude plugin submissions are pending review for all three products.

## Glama Gate

Glama has discovered the product connector pages, but each still reports `Unhealthy`.

Our public-side checks are in place:

- Repository-root `glama.json` exists for GitHub organization ownership.
- The MCP gateway serves `/.well-known/glama.json` with connector ownership metadata.
- The MCP gateway serves `/.well-known/mcp/server-card.json` and product-specific server cards.
- Product routes return the expected OAuth protected-resource challenge instead of exposing unauthenticated tool execution.

Open action: request a Glama retest or diagnostic if the pages do not automatically move to healthy. The support question is whether Glama's crawler can validate OAuth-protected Streamable HTTP connectors from public metadata, or whether it needs test credentials or a manual retry.
