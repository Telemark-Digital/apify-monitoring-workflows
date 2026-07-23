---
name: bluesky-keyword-alerts
description: "Use when a user wants bounded public Bluesky post discovery or needs guidance for recurring Bluesky saved-Task monitoring."
---

# Bluesky Keyword Alerts

Use this skill for bounded one-off discovery of public Bluesky posts through the Apify Actor `uplifted_novice_vbl/bluesky-keyword-mention-alerts`. The Actor is independent and is not affiliated with Bluesky Social PBC.

## Direct Actor Use

Before calling the MCP Actor tool, identify the search target and keep the run small. If the user has not provided a target, ask for one keyword, handle, mention, or hashtag. Apify charges can apply to Actor runs and delivered records, so default to preview-sized limits.

Recommended discovery input:

```json
{
  "keywords": ["product research"],
  "handles": [],
  "hashtags": [],
  "excludeTerms": [],
  "langs": ["en"],
  "onlyNew": false,
  "maxPostsPerRun": 10,
  "sort": "latest",
  "resetState": false
}
```

Use only the MCP Actor tool for `uplifted_novice_vbl/bluesky-keyword-mention-alerts`. Do not call unrelated Apify Actor tools or broaden the actor set. If the first response does not include enough dataset detail, use `get-dataset-items` only with the dataset ID from that same run and keep its limit small. Use `get-actor-run` or `get-key-value-store-record` only when needed for that same run. Never call `abort-actor-run` during normal discovery; abort only when the user explicitly asks to stop a run.

## Monitoring Boundary

When the user asks to monitor, schedule, alert, or deliver only new posts over time, explain that this plugin does not run in the background. Tell them to create a persistent saved Apify Task with `onlyNew: true`, verify `maxPostsPerRun <= 100`, and connect the repository n8n workflow or the [public Make shared scenario](https://us2.make.com/public/shared-scenario/FtrDlcux4Vr/bluesky-keyword-and-mention-alerts-from).

Do not place webhook URLs, tokens, private handles, customer identifiers, or secrets in examples.
