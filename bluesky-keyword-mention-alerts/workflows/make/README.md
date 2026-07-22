# Make Implementation Package

Status: **DRAFT - NOT IMPORTED, RUN, OR EXPORTED BY MAKE**

This package is an exact construction specification, not a Make blueprint. It remains a draft until the account-gated export, clean re-import, live runs, and two independent reviews pass.

Use Make HTTP modules with a limited Apify API token in an `Authorization: Bearer <APIFY_TOKEN_PLACEHOLDER>` header. Do not use Make's Apify connector for this template; its connection test requires account/user access that is broader than the reviewed resource-scoped token. Never place a real token in an exported blueprint, fixture, or screenshot.

Create or select one Make data store named for monitor deliveries. Use the fields `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson`. The same store can be shared by all three templates; product-prefixed keys prevent collisions. Make's free plan includes one 1 MB data store.

## Canonical architecture

Use an **Apify Schedule** to run the same persistent Task. A Make scenario schedule polls recent Task runs with HTTP, skips run IDs already checkpointed in the shared data store, fetches each uncheckpointed terminal run's default dataset, writes product rows first, and writes the run checkpoint last.

The saved Task must use:

- `onlyNew: true`
- `resetState: false`
- `maxPostsPerRun <= 100`; the dataset retrieval limit is fixed at `100` and pagination is intentionally disabled
- an Apify Schedule interval strictly longer than the saved Task's configured hard timeout

Set the Make scenario schedule so expected outage coverage stays within the 1000-run polling window, and enable process-in-order/no-overlap behavior. If expected outage coverage can exceed `1000 * Apify Schedule interval`, add paginated backfill before activation. Do not add a Make `Run a Task`, `Run an Actor`, or Make Apify connector module; the persistent Task is the state boundary.

## Exact build sequence

| Order | Make module or control | Configuration |
| --- | --- | --- |
| 1 | HTTP - Make a request | List Task runs: `GET https://api.apify.com/v2/actor-tasks/{{TASK_ID}}/runs?desc=1&limit=1000&offset=0` with the scrubbed Authorization placeholder. |
| 2 | Data store - Search Records | Read pre-existing checkpoint keys with prefix `bluesky:run:` for module 1 run IDs. This is read-only and happens before any product or checkpoint write. |
| 3 | Tools - Set Multiple Variables | Compute `pageIsFull`, `preExistingCheckpointBoundaryFound`, `overflowStop`, and `reversedRuns`. The checkpoint boundary must use only records read by module 2. |
| 4 | Router | Proceed when `overflowStop=false`. Overflow-stop when `overflowStop=true`; end with a diagnostic and do not reach module 5 or any write. |
| 5 | Tools - Iterator | Iterate module 3 `reversedRuns[]`, so uncheckpointed runs are processed oldest-to-newest within the fetched page. |
| 6 | Data store - Get a Record | Read checkpoint key `bluesky:run:{{module 5 id}}` for the current run. |
| 7 | Router | Dataset available: terminal run, checkpoint missing, and `defaultDatasetId` exists. Missing dataset: terminal run, checkpoint missing, and ID does not exist. Already checkpointed or non-terminal: end safely. |
| 8 | HTTP - Make a request | Dataset-available route. Fetch `{{module 5 defaultDatasetId}}` items as clean JSON with offset `0`, fixed limit `100`, and pagination disabled. |
| 9 | Tools - Array Aggregator | Source module `8`; include all post fields; **Stop processing after an empty aggregation = No**. Make exposes module 9 `Array[]`; do not try to rename that field. |
| 10 | Router | New posts: `length(module 9 Array[]) > 0`. Quiet: `length(module 9 Array[]) = 0`. |
| 11 | Tools - Iterator | New-post route only; iterate module 9 `Array[]`. |
| 12 | Router | Valid: `uri` and `url` exist and `isNew=true`. Invalid: the exact complement. |
| 13 | Data store - Add/Replace a Record | Valid-post route only. Key `bluesky:<postUri>`; **Overwrite an existing record = Yes**; map the normalized object below into the shared monitor-deliveries structure. |
| 14 | Tools - Set Multiple Variables | Invalid-post diagnostic with Task run ID and missing fields; end normally. |
| 15 | Tools - Set Multiple Variables | After module 13, when `status != SUCCEEDED`, report the persisted key and terminal status. |
| 16 | Tools - Set Multiple Variables | Quiet route with `status != SUCCEEDED`; report the fetched zero-row dataset. |
| 17 | Tools - Set Multiple Variables | Missing-dataset route; report that no request was attempted. |
| 18 | Data store - Add/Replace a Record | Write checkpoint key `bluesky:run:{{module 5 id}}` only after all product row upserts and diagnostics for the run have completed. |

The quiet route succeeds without a destination operation. It does not create a placeholder post or retry the Task.

## Idempotent data-store record

| Output field | Dataset mapping |
| --- | --- |
| `postUri` | `uri` |
| `postUrl` | `url` |
| `authorHandle` | `author.handle` |
| `authorDisplayName` | `author.displayName` |
| `text` | `text` |
| `createdAt` | `createdAt` |
| `matchedTerms` | `matchedTerms[]` |
| `matchSource` | `source` |
| `isNew` | `isNew` |
| `metrics.likes` | `likeCount` |
| `metrics.reposts` | `repostCount` |
| `metrics.replies` | `replyCount` |
| `metrics.quotes` | `quoteCount` |

The canonical sink uses `bluesky:<postUri>` as its native Make data-store key with overwrite enabled. Retrying the module therefore leaves exactly one record for that post. Add Slack, email, or another destination only after this record if desired; those optional side effects are at-least-once unless that destination has its own tested idempotency mechanism.

## Failure and retry routes

- Non-`SUCCEEDED` run with a dataset ID: module 8 fetches it and module 13 upserts every valid post first. Module 15 then records the run status, dataset ID, stable key, and `record persisted = true`.
- Non-`SUCCEEDED` empty dataset: module 16 records zero rows after retrieval. Missing dataset ID: module 17 records that retrieval was not attempted. End these polling branches normally; throwing can disable the scenario.
- Scenario settings: set **Store incomplete executions = Yes** and process in order / no overlap.
- List-runs, preflight checkpoint search, or dataset retrieval error: attach Make's **Retry** handler to modules 1, 2, and 8 with automatic completion, 3 attempts, and a 15-minute delay. Resume with the same Task ID or `defaultDatasetId`; never rerun the Task.
- Data-store error: attach the same Retry settings to module 13. Resume only that operation with the same `bluesky:<postUri>` key. Inject a failure after a committed write and prove retry leaves exactly one record.
- Run-checkpoint error: retry module 18. If Make fails before module 18, the next poll replays the run idempotently and then writes exactly one checkpoint.
- Overflow stop: if module 1 returns `count=1000` and the page contains no checkpointed terminal run boundary, stop without writing new run checkpoints and perform paginated/manual backfill before resuming.
- Invalid post: stop that bundle before delivery; do not manufacture missing identity fields.

## Account-gated validation

1. Build the scenario from `module-spec.json` in a user-owned Make account.
2. Confirm the saved Task has `maxPostsPerRun <= 100`, matching the fixed non-paginated retrieval limit of 100, and the Apify Schedule interval is strictly longer than the Task's hard timeout. Create/select the shared monitor-deliveries data store and enable overwrite.
3. Run a bounded non-empty Task and verify every normalized field, including `isNew` and quote metrics.
4. Run the same only-new Task again and verify the quiet route succeeds with zero destination writes.
5. Validate failed, aborted, and timed-out Task runs with committed rows; confirm Data Store writes precede diagnostics.
6. Force list-runs, dataset, data-store, and run-checkpoint failures and verify the Task is not rerun. Inject a post-commit timeout and verify exactly one `bluesky:<postUri>` record exists after retry.
7. Export the blueprint, remove connection identifiers and private data, and scan the exact candidate.
8. Import that exact file into a fresh empty validation organization/team or clean account and reconnect credentials.
9. Save and activate the imported scenario only for validation; verify the HTTP modules still contain placeholder-shaped Authorization fields before reconnecting the limited token.
10. Repeat non-empty, quiet, invalid-post, failed-with-rows, replay, failed-empty, `ABORTED`, `TIMED-OUT`, missing-dataset-ID, duplicate-poll, list-runs-retry, dataset-retry, overflow-stop, run-checkpoint, and data-store-retry runs, including the exactly-one-record post-commit test.
11. Obtain independent validator PASS and separate adversarial PASS before publication.

## Official references

- https://docs.apify.com/api/v2/actor-task-runs-get
- https://docs.apify.com/api/v2/dataset-items-get
- https://help.make.com/aggregator
- https://help.make.com/retry-error-handler
- https://help.make.com/automatic-retry-of-incomplete-executions
- https://help.make.com/data-stores
