# Public Status And Glama Gate

Checked on 2026-08-24. Superseded by [MCP promotion checkpoint](./2026-09-02-mcp-directory-promotion.md).

## Live Surfaces

- Apify Store examples are live for Bluesky, RSS, and TED.
- Make shared scenarios are live for Bluesky, RSS, and TED.
- n8n public workflow templates are live for RSS (`17430`), TED (`18030`), and Bluesky (`18103`).
- Official MCP Registry entries are live for all three product-scoped remote routes.
- Smithery external Streamable HTTP listings are live for all three product-scoped remote routes.
- OpenAI app directory status: TED and Bluesky are released; RSS is in review after a result-shape fixture fix.
- Claude plugin submissions are pending review for all three products.

## Glama Gate

Glama originally discovered the product connector pages but reported `Unhealthy`. As of 2026-09-02, all three product connector pages report `Healthy`.

Our public-side checks are in place:

- Repository-root `glama.json` exists for GitHub organization ownership.
- The MCP gateway serves `/.well-known/glama.json` with connector ownership metadata.
- The MCP gateway serves `/.well-known/mcp/server-card.json` and product-specific server cards.
- Product routes return the expected OAuth protected-resource challenge instead of exposing unauthenticated tool execution.

Closed action: no local Glama health fix remains. Keep the ownership, server-card, and OAuth challenge metadata live.
