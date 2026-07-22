# RSS monitoring workflow contract

## Purpose

Run one persistent RSS Keyword Monitor Task on a schedule, wait for any terminal status, idempotently ingest its committed dataset records, and then expose both the records and terminal outcome.

## Configuration

The user supplies these values outside the public workflow files:

| Value | Requirement |
| --- | --- |
| Apify connection | Created in the automation platform; never embedded in an export |
| Apify Task ID | A persistent Task owned or copied by the user |
| Task input | `onlyNew: true`, `resetState: false`, `maxItemsPerRun <= 200`, blank webhook unless deliberately configured in Apify |
| Schedule | Interval strictly longer than the saved Task's configured hard timeout |
| Canonical store | n8n Data Table or Make Data Store that upserts on the URL-encoded tuple `rss:<encodedFeedUrl>:<encodedItemKey>` |

## Required behavior

Two launch profiles satisfy this contract:

- n8n: an n8n schedule starts the workflow, which runs the persistent Task.
- Make: an Apify Schedule runs the persistent Task; a Make scenario schedule polls recent Task runs over HTTP, skips checkpointed run IDs, fetches default dataset items, writes product rows, and writes the run checkpoint last. The Apify Schedule interval must be strictly longer than the saved Task's configured hard timeout.

The Actor's Task-state lease is the mutual-exclusion mechanism: a contender stops before delivery or charging. The longer schedule interval is a separate cadence guard that reduces contention; it is not itself a lock.

1. The selected schedule profile always reuses the same persistent Task.
2. The workflow runs or observes that Task without overriding its saved input, build, memory, or timeout.
3. The workflow waits for a terminal run state.
4. If `defaultDatasetId` exists, it retrieves that dataset for every terminal status, not only `SUCCEEDED`, with a fixed limit of 200 and no pagination. The saved Task cap must remain at or below 200.
5. It validates records using `itemKey` and `feedUrl`, URL-encodes both components, then upserts each valid one under `rss:<encodedFeedUrl>:<encodedItemKey>`. Each malformed non-empty row is persisted as a sanitized `rss:diagnostic:<encodedRunId>:row:<datasetIndex>` record that omits raw malformed values, so valid neighbors still reach the destination.
6. After all valid and diagnostic rows are persisted, it returns an envelope with run metadata, `hasNewItems`, `newItemCount`, `recordsPersisted`, `validRecordsPersisted`, `diagnosticRecordsPersisted`, and valid `items`.
7. An empty dataset produces a zero-record envelope. A missing dataset ID makes no dataset request and returns or reports a safe diagnostic.
8. Only after persistence, a failed, aborted, or timed-out Task run is surfaced with its run ID, status, dataset ID, and persisted count.
9. Dataset and destination retries resume from the failed module with the same dataset ID or URL-encoded `rss:<encodedFeedUrl>:<encodedItemKey>`; they never rerun the Task.

## State invariant

Every scheduled call must run the same Task ID. Starting the Actor directly or creating a fresh Task per poll creates a different state scope and can redeliver old records.

## Output envelope

```json
{
  "hasNewItems": true,
  "newItemCount": 2,
  "items": [
    {
      "feedUrl": "https://blog.apify.com/rss/",
      "itemKey": "guid:https://blog.apify.com/example-automation-update/",
      "title": "A practical automation update",
      "link": "https://example.org/articles/automation-update",
      "matchedTerms": ["automation"],
      "isNew": true
    }
  ]
}
```

## Acceptance tests

1. First run: succeeds and returns records matching the saved Task input.
2. Immediate second run: succeeds and normally returns zero records.
3. Empty result: downstream branch receives the successful empty envelope.
4. Invalid Task ID: in n8n, execution fails through the platform error path and stops delivery. In Make, the Task cannot be selected for the watcher, so configuration, activation, or Task-scoped webhook registration must fail visibly; no dataset or destination module may run.
5. Feed outage: the Actor can still succeed; inspect the Actor run's `OUTPUT` record for per-feed errors.
6. Credential export: the exported workflow contains no token, credential ID, connection ID, or secret URL.
7. Failed committed-row fixture: each row exists under its URL-encoded `rss:<encodedFeedUrl>:<encodedItemKey>` key before terminal failure is reported; equal `itemKey` values from different feeds remain distinct.
8. Replay fixture: repeating the same failed dataset leaves one row for each composite stable key.
9. Mixed valid/malformed fixture: the valid item and sanitized run-row diagnostic both persist before terminal failure is reported; replay overwrites the same two keys.
10. Failed empty and missing-dataset fixtures report safely with zero persisted rows.
11. Account-gated validation confirms `maxItemsPerRun <= 200`, retrieval limit 200, and no pagination before activation.
