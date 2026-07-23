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

Use only the MCP Actor tool for `uplifted_novice_vbl/rss-keyword-monitor-only-new`. Do not call unrelated Apify Actor tools or broaden the actor set. If the first response does not include enough dataset detail, use `get-dataset-items` only with the dataset ID from that same run and keep its limit small. Use `get-actor-run` or `get-key-value-store-record` only when needed for that same run. Never call `abort-actor-run` during normal discovery; abort only when the user explicitly asks to stop a run.

## Monitoring Boundary

When the user asks to monitor, schedule, alert, or deliver only new feed items over time, explain that this plugin does not run in the background. Tell them to create a persistent saved Apify Task with `onlyNew: true`, verify `maxItemsPerRun <= 200`, and connect the repository n8n workflow or the [public Make shared scenario](https://us2.make.com/public/shared-scenario/3rwZCcptirx/rss-keyword-alerts-from-a-persistent-api).

Do not place webhook URLs, tokens, private feed URLs, customer identifiers, or secrets in examples.
