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

Use only the MCP Actor tool for `uplifted_novice_vbl/ted-tender-watch`. Do not call unrelated Apify tools or broaden the actor set. If the first tool response does not include enough dataset detail, use the paired `get-actor-output` tool for that same run only.

## Monitoring Boundary

When the user asks to monitor, schedule, alert, or deliver only new or changed tenders over time, explain that this plugin does not run in the background. Tell them to create a persistent saved Apify Task, disable `sampleMode`, verify `maxNewPerRun <= 999`, and connect the published n8n workflow or the Make implementation package after it has been built and validated in their Make account.

Do not place webhook URLs, tokens, private opportunity lists, customer identifiers, or secrets in examples.

