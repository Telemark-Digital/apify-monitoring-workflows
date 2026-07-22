# Make Implementation Package

Status: **DRAFT - NOT IMPORTED, RUN, OR EXPORTED BY MAKE**

This package is an exact construction specification, not a Make blueprint. It remains a draft until the account-gated export, clean re-import, live runs, and two independent reviews pass.

Use Make HTTP modules with a limited Apify API token in an `Authorization: Bearer <APIFY_TOKEN_PLACEHOLDER>` header. Do not use Make's Apify connector for this template; its connection test requires account/user access that is broader than the reviewed resource-scoped token. Never place a real token in an exported blueprint, fixture, or screenshot.

Create or select one Make data store named for monitor deliveries. Use the fields `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson`. The same store can be shared by all three templates; product-prefixed keys prevent collisions. Make's free plan includes one 1 MB data store.

## Canonical architecture

Use an **Apify Schedule** to run the same persistent RSS monitoring Task. A Make scenario schedule polls recent Task runs with HTTP, skips run IDs already checkpointed in the shared data store, fetches each uncheckpointed terminal run's default dataset, writes product rows first, and writes the run checkpoint last.

The saved Task must use:

- `onlyNew: true`
- `resetState: false`
- `maxItemsPerRun <= 200`; the dataset retrieval limit is fixed at `200` and pagination is intentionally disabled
- an Apify Schedule interval strictly longer than the saved Task's configured hard timeout

Set the Make scenario schedule so expected outage coverage stays within the 1000-run polling window, and enable process-in-order/no-overlap behavior. If expected outage coverage can exceed `1000 * Apify Schedule interval`, add paginated backfill before activation. Do not add a Make `Run a Task`, `Run an Actor`, or Make Apify connector module; the persistent Task is the state boundary.

## Exact build sequence

| Order | Make module or control | Configuration |
| --- | --- | --- |
| 1 | HTTP - Make a request | List Task runs: `GET https://api.apify.com/v2/actor-tasks/{{TASK_ID}}/runs?desc=1&limit=1000&offset=0` with the scrubbed Authorization placeholder. |
| 2 | Data store - Search Records | Read pre-existing checkpoint keys with prefix `rss:run:` for module 1 run IDs. This is read-only and happens before any product or checkpoint write. |
| 3 | Tools - Set Multiple Variables | Compute `pageIsFull`, `preExistingCheckpointBoundaryFound`, `overflowStop`, and `reversedRuns`. The checkpoint boundary must use only records read by module 2. |
| 4 | Router | Proceed when `overflowStop=false`. Overflow-stop when `overflowStop=true`; end with a diagnostic and do not reach module 5 or any write. |
| 5 | Tools - Iterator | Iterate module 3 `reversedRuns[]`, so uncheckpointed runs are processed oldest-to-newest within the fetched page. |
| 6 | Data store - Get a Record | Read checkpoint key `rss:run:{{module 5 id}}` for the current run. |
| 7 | Router | Dataset available: terminal run, checkpoint missing, and `defaultDatasetId` exists. Missing dataset: terminal run, checkpoint missing, and ID does not exist. Already checkpointed or non-terminal: end safely. |
| 8 | HTTP - Make a request | Dataset-available route. Fetch `{{module 5 defaultDatasetId}}` items as clean JSON with offset `0`, fixed limit `200`, and pagination disabled. |
| 9 | Router | Validate each bundle before aggregation. Valid: `itemKey` and `feedUrl` exist and `isNew=true`. Invalid: the exact complement. |
| 10 | Tools - Array Aggregator | Valid-record route; source module `8`; include the RSS fields; **Stop processing after an empty aggregation = No**. Make exposes module 10 `Array[]`; do not try to rename it. |
| 11 | Router | New items: `length(module 10 Array[]) > 0`. Quiet: `length(module 10 Array[]) = 0`. |
| 12 | Tools - Set Multiple Variables | New-item route. Lifetime: one execution. Set `hasNewItems=true`, `newItemCount=length(module 10 Array[])`, and `items=module 10 Array[]`. |
| 13 | Tools - Iterator | Required whenever module 14 is present. Iterate module 10 `Array[]` on the new-item route. |
| 14 | Data store - Add/Replace a Record | Connect after module 13. Key `rss:{{encodeURL(feedUrl)}}:{{encodeURL(itemKey)}}`; **Overwrite an existing record = Yes**; map each Iterator bundle into the shared monitor-deliveries structure. |
| 15 | Tools - Set Multiple Variables | Invalid-record diagnostic with Task run ID and missing fields; end normally. |
| 16 | Tools - Set Multiple Variables | After module 14, when `status != SUCCEEDED`, report the persisted key and terminal status. |
| 17 | Tools - Set Multiple Variables | Quiet route with `status != SUCCEEDED`; report the fetched zero-row dataset. |
| 18 | Tools - Set Multiple Variables | Missing-dataset route; report that no request was attempted. |
| 19 | Data store - Add/Replace a Record | Write checkpoint key `rss:run:{{module 5 id}}` only after all product row upserts and diagnostics for the run have completed. |

The Array Aggregator must have empty aggregation processing enabled. Without it, zero dataset bundles stop the route before the required false envelope can be created.

This package defines a per-item data-store write. Module 13 is therefore mandatory: module 14 must consume scalar fields from each Iterator bundle, never the aggregate array directly.

## Idempotent data-store mappings

| Dataset field | Destination use |
| --- | --- |
| `itemKey` | Second component of the stable identity; URL-encode before key construction |
| `feedUrl` | First component of the stable identity and source feed URL; URL-encode before key construction |
| `feedTitle` | Source label |
| `title` | Message or row title |
| `link` | Clickable item URL |
| `publishedAt` | Source publication time |
| `firstSeenAt` | Monitoring delivery time |
| `matchedTerms[]` | Triggering terms |
| `isNew` | Defensive delivery filter; require `true` |

The canonical sink uses `rss:<encodedFeedUrl>:<encodedItemKey>` as its native Make data-store key with overwrite enabled. Build it with Make's `encodeURL()` function on both components. Retrying the module therefore leaves exactly one record for that feed/item tuple, while identical `itemKey` values from different feeds remain distinct. Add Slack, email, or another destination only after this record if desired; those optional side effects are at-least-once unless that destination has its own tested idempotency mechanism.

## Failure and retry routes

- Non-`SUCCEEDED` run with a dataset ID: module 8 fetches it and module 14 upserts every valid RSS item first. Module 16 then records the run status, dataset ID, stable key, and `record persisted = true`.
- Non-`SUCCEEDED` empty dataset: module 17 records zero rows after retrieval. Missing dataset ID: module 18 records that retrieval was not attempted. End these polling branches normally; throwing can disable the scenario.
- Scenario settings: set **Store incomplete executions = Yes** and process in order / no overlap.
- List-runs, preflight checkpoint search, or dataset retrieval error: attach Make's **Retry** handler to modules 1, 2, and 8 with automatic completion, 3 attempts, and a 15-minute delay. Resume with the same Task ID or `defaultDatasetId`; never rerun the Task.
- Invalid RSS record: stop that bundle before delivery and record only Task run ID plus missing field names.
- Data-store error: attach the same Retry settings to module 14. Resume only that operation with the same URL-encoded `rss:<encodedFeedUrl>:<encodedItemKey>` key. Inject a failure after a committed write and prove retry leaves exactly one record.
- Run-checkpoint error: retry module 19. If Make fails before module 19, the next poll replays the run idempotently and then writes exactly one checkpoint.
- Overflow stop: if module 1 returns `count=1000` and the page contains no checkpointed terminal run boundary, stop without writing new run checkpoints and perform paginated/manual backfill before resuming.
- Quiet run: return the false envelope and finish successfully.

## Account-gated validation

1. Build the scenario from `module-mapping.json` in a user-owned Make account.
2. Confirm the saved Task has `maxItemsPerRun <= 200`, matching the fixed non-paginated retrieval limit of 200, and the Apify Schedule interval is strictly longer than the Task's hard timeout. Create/select the shared monitor-deliveries data store and enable overwrite.
3. Run a bounded non-empty Task and verify the true envelope and every mapped field against `fixtures/rss-items.json`.
4. Run the same only-new Task again and verify the false envelope with zero destination writes.
5. Validate failed, aborted, and timed-out Task runs with committed rows; confirm Data Store writes precede diagnostics.
6. Force list-runs, dataset, data-store, and run-checkpoint failures and verify the Task is not rerun. Inject a post-commit timeout and verify exactly one URL-encoded `rss:<encodedFeedUrl>:<encodedItemKey>` record exists after retry; also prove equal `itemKey` values from different feeds produce distinct keys.
7. Export the blueprint, remove connection identifiers and private data, and scan the exact candidate.
8. Import that exact file into a fresh empty validation organization/team or clean account and reconnect credentials.
9. Save and activate the imported scenario only for validation; verify the HTTP modules still contain placeholder-shaped Authorization fields before reconnecting the limited token.
10. Repeat non-empty, quiet, invalid-record, failed-with-rows, replay, failed-empty, `ABORTED`, `TIMED-OUT`, missing-dataset-ID, duplicate-poll, list-runs-retry, dataset-retry, overflow-stop, run-checkpoint, and data-store-retry runs, including the exactly-one-record post-commit test.
11. Obtain independent validator PASS and separate adversarial PASS before publication.

## Official references

- https://docs.apify.com/api/v2/actor-task-runs-get
- https://docs.apify.com/api/v2/dataset-items-get
- https://help.make.com/aggregator
- https://help.make.com/retry-error-handler
- https://help.make.com/automatic-retry-of-incomplete-executions
- https://help.make.com/data-stores
