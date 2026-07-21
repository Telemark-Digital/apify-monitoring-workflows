# RSS Keyword Monitor - Only New Items & Webhooks

Monitor RSS, Atom, and RDF feeds for keywords or regular expressions and return clean JSON records. A persistent Apify Task can remember which matching items it has already delivered, making the Actor useful for scheduled alerts and automation pipelines.

[Open RSS Keyword Monitor on Apify](https://apify.com/uplifted_novice_vbl/rss-keyword-monitor-only-new)

## What it does

- Fetches 1 to 500 RSS, Atom, or RDF feeds per run.
- Matches case-insensitive keywords and safe regular expressions.
- Removes records containing configured exclusion terms before delivery and charging.
- Returns one structured dataset record per matching item.
- Suppresses previously delivered records when `onlyNew` is enabled on a persistent Task.
- Can send a JSON webhook only when new records are available.
- Isolates feed errors so one unavailable or malformed feed does not fail the whole run.

## Start with a discovery example

The examples in [`apify-tasks`](./apify-tasks/) use `onlyNew: false` and a small item limit. This makes their public landing pages useful immediately: visitors can see a bounded current dataset, and prior Task state does not filter the output. A discovery run still records each delivered item in that Task's seen-set.

Choose one:

1. Monitor multiple RSS feeds for keyword alerts.
2. Filter RSS feeds with regex and exclusions.
3. Get webhook-ready RSS updates as JSON.

Each example uses public feeds, leaves `webhookUrl` blank, and limits output to ten records or fewer.

## Create a recurring monitor

1. Open one of the examples on Apify and copy it to your account.
2. Save the configuration as an Apify Task.
3. Set `onlyNew` to `true`.
4. Keep `resetState` set to `false`.
5. When using either included non-paginated automation workflow, set `maxItemsPerRun <= 200`; dataset retrieval is fixed at 200.
6. Run the same Task on every poll, either with an Apify Schedule or an automation platform.

The first monitoring run returns the current matching records up to `maxItemsPerRun` and records them as seen. A later run can correctly return an empty dataset when no unseen matching records exist. Do not create a new Task for every poll: deduplication state is scoped to the persistent Task.

## Output

Each dataset record follows this shape:

```json
{
  "feedUrl": "https://blog.apify.com/rss/",
  "feedTitle": "Apify Blog",
  "feedType": "rss",
  "itemKey": "guid:https://blog.apify.com/example-automation-update/",
  "guid": "https://blog.apify.com/example-automation-update/",
  "title": "A practical automation update",
  "link": "https://example.org/articles/automation-update",
  "author": "Apify",
  "publishedAt": "2026-07-20T08:00:00.000Z",
  "firstSeenAt": "2026-07-20T08:05:00.000Z",
  "categories": ["automation"],
  "description": "A sample description from an RSS item.",
  "content": null,
  "matchedTerms": ["automation"],
  "isNew": true
}
```

See the complete sanitized fixture in [`fixtures/rss-items.json`](./fixtures/rss-items.json).

## Automation packages

- [`workflows/WORKFLOW-CONTRACT.md`](./workflows/WORKFLOW-CONTRACT.md) defines the platform-neutral behavior.
- [`workflows/n8n/rss-task-only-new.json`](./workflows/n8n/rss-task-only-new.json) is an importable, credential-free n8n workflow.
- [`workflows/make/IMPLEMENTATION.md`](./workflows/make/IMPLEMENTATION.md) gives exact Make modules, mappings, filters, error routes, and account-gated tests.

Both integrations run a persistent Apify Task. They do not start a fresh Actor configuration for every poll. Their canonical delivery identity is the URL-encoded tuple `rss:<encodedFeedUrl>:<encodedItemKey>`, so the same `itemKey` from different feeds cannot overwrite another feed's record.

## Pricing and limits

The Actor charges `$0.005` per run and `$0.002` per delivered matching item. With `onlyNew: true`, delivered items are new to that persistent Task; excluded records, previously delivered records, failed feeds, and unchanged feeds do not create an item charge. With `onlyNew: false`, every delivered matching item is charged even if that Task has delivered it before. Check the Apify listing before production use because pricing can change.

Useful limits:

| Setting | Range or behavior |
| --- | --- |
| `feeds` | 1 to 500 unique public HTTP(S) feed URLs |
| `maxItemsPerRun` | Actor range 1 to 2,000; included non-paginated workflows require 1 to 200 |
| `dedupWindow` | 7 to 365 days |
| `matchFields` | `title`, `description`, `content`, `categories` |
| `webhookUrl` | Optional secret field; blank in every public example |

## Reliability notes

- Network requests are bounded and redirects are revalidated.
- Responses larger than 10 MB are rejected per feed.
- Invalid or unsafe regular expressions fail fast with a clear input error.
- RSS 2.0, Atom 1.0, and RSS 1.0/RDF are supported; JSON Feed is not.
- `includeContent` returns feed-provided `content:encoded` HTML when available. It does not fetch article pages.
- The Actor holds an exclusive Task-state lease through recovery, delivery, and state commit; a concurrent contender stops before delivery or charging. Still set the schedule interval longer than the Task's hard timeout to avoid needless contention.

## Local package validation

From this product directory, run:

```powershell
node validation/validate-rss-package.mjs
```

This checks JSON parsing, allowed Actor fields, output fixture shape, persistent-Task workflow semantics, blank credentials, and internal-name or likely-secret leakage. Live platform tests and public Task publication are separate release gates.

