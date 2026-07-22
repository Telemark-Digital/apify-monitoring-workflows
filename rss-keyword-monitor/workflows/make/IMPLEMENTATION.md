# Make Implementation Package

Status: **DRAFT - NOT IMPORTED, RUN, OR EXPORTED BY MAKE**

This package is an exact construction specification, not a Make blueprint. It remains a draft until the account-gated export, clean re-import, live runs, and two independent reviews pass.

Use Make HTTP modules with a limited Apify API token in an `Authorization: Bearer <APIFY_TOKEN_PLACEHOLDER>` header. Do not use Make's Apify connector for this template; its connection test requires account/user access that is broader than the reviewed resource-scoped token. Never place a real token in an exported blueprint, fixture, or screenshot.

Create or select one Make data store named for monitor deliveries. Use the fields `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson`. The same store can be shared by all three templates; product-prefixed keys prevent collisions. Make's free plan includes one 1 MB data store.

## Canonical architecture

Use an **Apify Schedule** to run the same persistent Task. A Make scenario schedule polls recent Task runs with HTTP, reads one exact-key run cursor from the shared data store, processes only terminal Task runs newer than that cursor, fetches the selected run's default dataset, prepares every dataset row, writes every prepared delivery record through a single Data store sink, waits for a Make-native completion barrier, and only then writes the run cursor.

The saved Task must use:

- `maxItemsPerRun <= 200`; the dataset retrieval limit is fixed at `200` and pagination is intentionally disabled
- an Apify Schedule interval strictly longer than the saved Task's configured hard timeout
- `onlyNew: true` and `resetState: false`

Set the Make scenario schedule so expected outage coverage stays within the 1000-run polling window, and enable process-in-order/no-overlap behavior. If expected outage coverage can exceed `1000 * Apify Schedule interval`, add paginated backfill before activation.

Keep `maxRunsPerScenarioExecution` at `1` for the publication template. Normal catch-up requires `makePollsPerHour * maxRunsPerScenarioExecution > apifyRunsPerHour`. If that formula is not true, pause the Apify Schedule and perform paginated/manual backfill before activation.

## Exact build sequence

| Order | Make module or control | Configuration |
| --- | --- | --- |
| 1 | HTTP - Make a request | List terminal Task runs: `GET https://api.apify.com/v2/actor-tasks/{{TASK_ID}}/runs?desc=1&limit=1000&offset=0&status=SUCCEEDED,FAILED,ABORTED,TIMED-OUT` with the scrubbed Authorization placeholder. |
| 2 | Data store - Get a Record | Read exact cursor key `rss:cursor:{{TASK_ID}}`. The cursor record stores the last processed run ID in `sourceId`. Do not use Search Records or key-prefix filtering. |
| 3 | Tools - Set Multiple Variables | Compute `cursorExists`, `cursorPrimingStop`, `cursorBoundaryMissing`, `overflowStop`, and up to one `reversedRuns[]` entry because `maxRunsPerScenarioExecution=1`. First activation must prime the cursor unless an intentional bounded backfill is documented. |
| 4 | Router | Proceed when `overflowStop=false`. Stop on missing first-run cursor or missing cursor boundary; end with a diagnostic and do not reach module 5 or any write. |
| 5 | Tools - Iterator | Iterate module 3 `reversedRuns[]`, so the one cursor-selected run is processed oldest-to-newest within the fetched page. |
| 6 | Tools - Set Multiple Variables | Expose current run context from module 5: run ID, status, `defaultDatasetId`, and finish time. |
| 7 | Router | Dataset available: `defaultDatasetId` exists. Missing dataset: `defaultDatasetId` is missing or empty. |
| 8 | HTTP - Make a request | Dataset-available route. Fetch `{{module 5 defaultDatasetId}}` items as clean JSON with offset `0`, fixed limit `200`, and pagination disabled. |
| 9 | Tools - Iterator | Split module 8 parsed JSON array into one dataset-item bundle per row. |
| 10 | Tools - Set Multiple Variables | Prepare one delivery record per RSS row. Valid rows use `rss:<encodedFeedUrl>:<encodedItemKey>` from `feedUrl` and `itemKey`; invalid rows use `rss:run:<runId>:row:<bundleOrder>` and sanitized diagnostics. |
| 11 | Data store - Add/Replace a Record | Module 11 writes every prepared RSS delivery record. Key `{{module 10 recordKey}}`; **Overwrite an existing record = Yes**; map the module 10 record fields into the shared monitor-deliveries structure. |
| 12 | Tools - Array Aggregator | Source module `9`; **Stop processing after an empty aggregation = No**. This module 12 starts aggregation at the dataset-item iterator, waits for the downstream module 11 writes to complete, and emits Make's `Array[]`. It is the cursor completion barrier. |
| 13 | Tools - Set Multiple Variables | Dataset outcome after module 12. Record Task run status, defaultDatasetId, attempted dataset rows, completed delivery writes, valid product row count, diagnostic/run-scoped row count, and timestamp. Set `cursorWriteAllowed=true` only when `completedDeliveryWrites equals attemptedDatasetRows` and module 11 has zero incomplete executions. |
| 14 | Data store - Add/Replace a Record | Dataset-run cursor. Write `rss:cursor:{{TASK_ID}}` only after module 13 when `cursorWriteAllowed=true`. |
| 15 | Tools - Set Multiple Variables | Missing-dataset outcome. Record that no dataset request was attempted. |
| 16 | Data store - Add/Replace a Record | Missing-dataset cursor. Write `rss:cursor:{{TASK_ID}}` only after module 15. |

Valid RSS records preserve `itemKey`, `feedUrl`, `feedTitle`, title, link, publishedAt, firstSeenAt, matchedTerms, and `isNew`. Invalid rows are diagnostic records and do not block valid neighboring items.

## Failure and retry routes

- Non-`SUCCEEDED` run with a dataset ID: module 8 fetches it, module 10 prepares every row, module 11 writes every prepared delivery record, module 12 aggregates completed module 11 writes, module 13 verifies `completedDeliveryWrites equals attemptedDatasetRows` with zero module 11 incomplete executions, and module 14 writes the cursor only when that guard passes.
- Empty dataset: module 12 emits an empty `Array[]`, module 13 records zero completed delivery writes, and module 14 writes the cursor.
- Missing dataset ID: module 15 records that no dataset request was attempted, and module 16 writes the cursor without requesting dataset items.
- Scenario settings: set **Store incomplete executions = Yes** and process in order / no overlap.
- List-runs, exact cursor read, or dataset retrieval error: attach Make's **Retry** handler to modules 1, 2, and 8 with automatic completion, 3 attempts, and a 15-minute delay. Resume with the same Task ID or `defaultDatasetId`; never rerun the Task.
- Data-store error: attach Make's **Rollback** handler to module 11, not Retry/Break. Module 11 failure must stop the scenario before module 12 or module 14 can run, because Retry/Break can save failed bundles as incomplete executions while the scenario continues. Inject a post-commit timeout/failure and prove module 12/module 14 do not run, the cursor remains unchanged, and the next poll replays idempotently with exactly one record for the stable delivery key.
- Run-cursor error: retry module 14 or module 16. If Make fails before either cursor write, the next poll replays from the previous cursor idempotently and then leaves exactly one cursor record.
- Cursor-gap stop: if module 2 has no cursor, prime it before first activation. If the stored cursor run is not present in the fetched page, stop without writing product rows or a cursor and perform paginated/manual backfill before resuming. This applies whenever the cursor boundary is absent from the fetched page, not only when the page is full.

## Account-gated validation

1. Build the scenario from the structured specification in a user-owned Make account.
2. Confirm the saved Task has `maxItemsPerRun <= 200`, matching the fixed non-paginated retrieval limit of 200, and the Apify Schedule interval is strictly longer than the Task hard timeout.
3. Confirm `makePollsPerHour * maxRunsPerScenarioExecution > apifyRunsPerHour`; otherwise pause the Apify Schedule and perform paginated/manual backfill before activation.
4. Run a bounded non-empty Task and verify every normalized field.
5. Run the same only-new or primed Task again and verify the quiet/summary path succeeds without duplicate delivery keys.
6. Validate failed, aborted, and timed-out Task runs with committed rows; confirm Data Store writes precede cursor advancement.
7. Force list-runs, exact cursor read, dataset, data-store, and run-cursor failures and verify the Task is not rerun. Inject a post-commit timeout/failure at module 11 and verify module 12/module 14 do not run in that execution, the run cursor remains unchanged, and the next poll replays idempotently with exactly one record for `rss:<encodedFeedUrl>:<encodedItemKey>` or `rss:run:<runId>:row:<bundleOrder>`.
8. Export the blueprint, remove connection identifiers and private data, and scan the exact candidate.
9. Import that exact file into a fresh empty validation organization/team or clean account and reconnect credentials.
10. Save and activate the imported scenario only for validation; verify the HTTP modules still contain placeholder-shaped Authorization fields before reconnecting the limited token.
11. Repeat non-empty, quiet/empty-dataset, invalid-record, failed-with-rows, replay, failed-empty, `ABORTED`, `TIMED-OUT`, missing-dataset-ID, duplicate-poll, list-runs-retry, preflight-retry, dataset-retry, cursor-gap stop, completion-barrier, run-cursor, and data-store-retry runs, including the exactly-one-record post-commit test.
12. Obtain independent validator PASS and separate adversarial PASS before publication.

## Official references

- https://docs.apify.com/api/v2/actor-task-runs-get
- https://docs.apify.com/api/v2/dataset-items-get
- https://help.make.com/aggregator
- https://help.make.com/retry-error-handler
- https://help.make.com/automatic-retry-of-incomplete-executions
- https://help.make.com/data-stores
