---
name: ted-tender-monitor
description: "Use when a user wants bounded TED procurement notice discovery or needs guidance for recurring saved-Task tender monitoring."
---

# TED Tender Monitor

Use this skill for bounded one-off discovery of official TED procurement notices through the Apify Actor `uplifted_novice_vbl/ted-tender-watch`. The Actor is independent and is not affiliated with TED, the European Union, or the Publications Office of the European Union.

## Direct Actor Use

Before calling the MCP Actor tool, identify the CPV code, country, keyword, notice type, or value filter. Default to `sampleMode: true` for discovery. Apify charges can apply to Actor runs and delivered tender records, so keep preview limits small.

Recommended discovery input:

```json
{
  "sampleMode": true,
  "cpvCodes": ["30"],
  "countries": ["FRA"],
  "keywords": [],
  "minValueEur": 0,
  "noticeTypes": ["cn-standard"],
  "includeChangeNotices": false,
  "lookbackDays": 3,
  "maxNewPerRun": 25
}
```

Use only the MCP Actor tool for `uplifted_novice_vbl/ted-tender-watch`. Do not call unrelated Apify Actor tools or broaden the actor set. If the first response does not include enough dataset detail, use `get-dataset-items` only with the dataset ID from that same run and keep its limit small. Use `get-actor-run` or `get-key-value-store-record` only when needed for that same run. Never call `abort-actor-run` during normal discovery; abort only when the user explicitly asks to stop a run.

## Monitoring Boundary

When the user asks to monitor, schedule, alert, or deliver only new or changed tenders over time, explain that this plugin does not run in the background. Tell them to create a persistent saved Apify Task, disable `sampleMode`, verify `maxNewPerRun <= 999`, and connect the repository n8n workflow or the [public Make shared scenario](https://us2.make.com/public/shared-scenario/udxoD7qdzBB/ted-tender-alerts-from-a-persistent-apif).

Do not place webhook URLs, tokens, private opportunity lists, customer identifiers, or secrets in examples.
