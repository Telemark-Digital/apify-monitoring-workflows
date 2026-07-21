# Make Implementation Package

Status: **DRAFT - NOT IMPORTED, RUN, OR EXPORTED BY MAKE**

This package is an exact construction specification, not a Make blueprint. It remains a draft until the account-gated export, clean re-import, live runs, and two independent reviews pass.

Create the Apify connection through Make's connection manager. OAuth is recommended when offered; an API-token connection is also supported. Never place the token in a module field, exported blueprint, fixture, or screenshot.

Create or select one Make data store named for monitor deliveries. Use the fields `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson`. The same store can be shared by all three templates; product-prefixed keys prevent collisions. Make's free plan includes one 1 MB data store.

## Canonical architecture

Use an **Apify Schedule** to run the same persistent Task. Make begins with **Apify - Watch Task Runs**, which fires whenever that selected Task finishes. This event-driven design avoids Make's 120-second synchronous `Run a Task` ceiling and retains the Task run ID and terminal status.

The saved Task must use:

- `onlyNew: true`
- `resetState: false`
- `maxPostsPerRun <= 100`; the dataset retrieval limit is fixed at `100` and pagination is intentionally disabled
- an Apify Schedule interval strictly longer than the saved Task's configured hard timeout

Do not add a Make scenario schedule or `Run a Task` module to this canonical scenario. Do not use `Run an Actor`; the persistent Task is the state boundary.

## Exact build sequence

| Order | Make module or control | Configuration |
| --- | --- | --- |
| 1 | Apify - Watch Task Runs | Select the persistent Task. Trigger on any finished Task run. |
| 2 | Router | Dataset available: `defaultDatasetId` exists for any terminal status. Missing dataset: ID does not exist. Do not filter on `SUCCEEDED`. |
| 3 | Apify - Get Dataset Items | Dataset-available route. Dataset ID from module 1; Clean; JSON; offset `0`; fixed limit `100`; pagination disabled. |
| 4 | Tools - Array Aggregator | Source module `3`; include all post fields; **Stop processing after an empty aggregation = No**. Make exposes the result as module 4 `Array[]`; do not try to rename that field. |
| 5 | Router | New posts: `length(module 4 Array[]) > 0`. Quiet: `length(module 4 Array[]) = 0`. |
| 6 | Tools - Iterator | New-post route only; iterate module 4 `Array[]`. `Get Dataset Items` already emits bundles, so the Iterator belongs after the empty-safe aggregator. |
| 7 | Router | Valid: `uri` and `url` exist and `isNew=true`. Invalid: the exact complement. |
| 8 | Data store - Add/Replace a Record | Valid-post route only. Key `bluesky:<postUri>`; **Overwrite an existing record = Yes**; map the normalized object below into the shared monitor-deliveries structure. |
| 9 | Tools - Set Multiple Variables | Invalid-post diagnostic with Task run ID and missing fields; end normally. |
| 10 | Tools - Set Multiple Variables | After module 8, when `status != SUCCEEDED`, report the persisted key and terminal status. |
| 11 | Tools - Set Multiple Variables | Quiet route with `status != SUCCEEDED`; report the fetched zero-row dataset. |
| 12 | Tools - Set Multiple Variables | Missing-dataset route; report that no request was attempted. |

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

- Non-`SUCCEEDED` run with a dataset ID: module 3 fetches it and module 8 upserts every valid post first. Module 10 then records the run status, dataset ID, stable key, and `record persisted = true`.
- Non-`SUCCEEDED` empty dataset: module 11 records zero rows after retrieval. Missing dataset ID: module 12 records that retrieval was not attempted. End these instant-triggered branches normally; throwing can disable the scenario.
- Scenario settings: set **Store incomplete executions = Yes**.
- Dataset retrieval error: attach Make's **Retry** handler to module 3 with automatic completion, 3 attempts, and a 15-minute delay. Resume at module 3 with the same `defaultDatasetId`; never rerun the Task. Make automatically applies exponential backoff to connection, rate-limit, and module-timeout errors.
- Data-store error: attach the same Retry settings to module 8. Resume only that operation with the same `bluesky:<postUri>` key. Inject a failure after a committed write and prove retry leaves exactly one record.
- Invalid post: stop that bundle before delivery; do not manufacture missing identity fields.

## Account-gated validation

1. Build the scenario from `module-spec.json` in a user-owned Make account.
2. Confirm the saved Task has `maxPostsPerRun <= 100`, matching the fixed non-paginated retrieval limit of 100, and the Apify Schedule interval is strictly longer than the Task's hard timeout. Create/select the shared monitor-deliveries data store and enable overwrite.
3. Run a bounded non-empty Task and verify every normalized field, including `isNew` and quote metrics.
4. Run the same only-new Task again and verify the quiet route succeeds with zero destination writes.
5. Validate failed, aborted, and timed-out Task runs with committed rows; confirm Data Store writes precede diagnostics.
6. Force dataset and data-store failures and verify the Task is not rerun. Inject a post-commit timeout and verify exactly one `bluesky:<postUri>` record exists after retry.
7. Export the blueprint, remove connection identifiers and private data, and scan the exact candidate.
8. Import that exact file into a fresh empty validation organization/team or clean account and reconnect credentials.
9. Save and activate the imported scenario; verify Make recreated the Task-scoped watcher webhook.
10. Repeat non-empty, quiet, invalid-post, failed-with-rows, replay, failed-empty, `ABORTED`, `TIMED-OUT`, missing-dataset-ID, dataset-retry, and data-store-retry runs, including the exactly-one-record post-commit test.
11. Obtain independent validator PASS and separate adversarial PASS before publication.

## Official references

- https://docs.apify.com/integrations/make
- https://apps.make.com/apify
- https://help.make.com/aggregator
- https://help.make.com/retry-error-handler
- https://help.make.com/automatic-retry-of-incomplete-executions
- https://help.make.com/data-stores
