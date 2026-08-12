# Phase 1 Visibility Checkpoint - 2026-08-11

This checkpoint expands the public discovery surface for Telemark Digital's Apify monitoring products without paid media, creator videos, or private-account-only links.

## Added Apify Examples

- TED Tender Monitor: 3 new public examples for French medical equipment, EU renewable energy procurement, and Polish IT services tenders.
- RSS Keyword Monitor: 3 new public examples for DevOps release notes, vulnerability research feeds, and cloud platform updates.
- Bluesky Keyword & Mention Alerts: 3 new public examples for developer tools launches, open-source maintainer discussion, and data breach discussion.

All nine examples were created as fresh Apify Tasks, run once with bounded public inputs, published through the Apify Task publication surface, and verified through anonymous public HTML and `.md` routes.

## Refreshed Discovery Docs

- Product README files now list the expanded Apify Examples sets.
- `llms.txt` gives AI agents a compact index of product pages, examples, plugins, and workflow packages.
- The root README now reflects 13 TED examples, 11 RSS examples, and 11 Bluesky examples.

## Current External Gates

- n8n: RSS and TED are published; Bluesky was submitted for human review as `18103` on 2026-08-12.
- Make: public shared scenarios remain live; no Teams upgrade is planned at this point.
- Claude: the three plugin submissions are pending review.
- OpenAI: held until identity, legal URL, demo, and production MCP challenge gates are ready.
