---
name: rss-keyword-monitor
description: "Use when a user wants bounded RSS, Atom, or RDF keyword discovery or needs guidance for recurring saved-Task feed monitoring."
---

# RSS Keyword Monitor

Use this skill for bounded one-off discovery from public RSS, Atom, and RDF feeds through the Apify Actor `uplifted_novice_vbl/rss-keyword-monitor-only-new`.

## Direct Actor Use

Before calling the MCP Actor tool, identify the feed URLs and match criteria. Keep the run small unless the user explicitly approves a larger preview. Apify charges can apply to Actor runs and delivered items.

Recommended discovery input:

```json
{
  "feeds": ["https://blog.apify.com/rss/"],
  "keywords": ["automation"],
  "regexPatterns": [],
  "excludeTerms": [],
  "matchFields": ["title", "description"],
  "onlyNew": false,
  "maxItemsPerRun": 10,
  "dedupWindow": 45,
  "includeContent": false,
  "resetState": false
}
```

Use only the MCP Actor tool for `uplifted_novice_vbl/rss-keyword-monitor-only-new`. Do not call unrelated Apify tools or broaden the actor set. If the first tool response does not include enough dataset detail, use the paired `get-actor-output` tool for that same run only.

## Monitoring Boundary

When the user asks to monitor, schedule, alert, or deliver only new feed items over time, explain that this plugin does not run in the background. Tell them to create a persistent saved Apify Task with `onlyNew: true`, verify `maxItemsPerRun <= 200`, and connect the published n8n workflow or the Make implementation package after it has been built and validated in their Make account.

Do not place webhook URLs, tokens, private feed URLs, customer identifiers, or secrets in examples.

