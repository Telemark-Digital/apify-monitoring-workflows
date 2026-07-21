# Make Implementation Package

Status: **DRAFT - NOT IMPORTED, RUN, OR EXPORTED BY MAKE**

This package is an exact construction specification, not a Make blueprint. It remains a draft until the account-gated export, clean re-import, live runs, and two independent reviews pass.

Create the Apify connection through Make's connection manager. OAuth is recommended when offered; an API-token connection is also supported. Never place the token in a module field, exported blueprint, fixture, or screenshot.

Create or select one Make data store named for monitor deliveries. Use the fields `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson`. The same store can be shared by all three templates; product-prefixed keys prevent collisions. Make's free plan includes one 1 MB data store.

## Canonical architecture

Use an **Apify Schedule** to run the same persistent RSS monitoring Task. Make begins with **Apify - Watch Task Runs**, which fires whenever that Task finishes. This event-driven design avoids Make's 120-second synchronous `Run a Task` ceiling and exposes the Task run ID, terminal status, and `defaultDatasetId`.

The saved Task must use:

- `onlyNew: true`
- `resetState: false`
- `maxItemsPerRun <= 200`; the dataset retrieval limit is fixed at `200` and pagination is intentionally disabled
- an Apify Schedule interval strictly longer than the saved Task's configured hard timeout

Do not add a Make scenario schedule or `Run a Task` module to this canonical scenario. Do not use `Run an Actor`; the persistent Task is the state boundary.

## Exact build sequence

| Order | Make module or control | Configuration |
| --- | --- | --- |
| 1 | Apify - Watch Task Runs | Select the persistent Task. Trigger on any finished Task run. |
| 2 | Router | Dataset available: `defaultDatasetId` exists for any terminal status. Missing dataset: ID does not exist. Do not filter on `SUCCEEDED`. |
| 3 | Apify - Get Dataset Items | Dataset-available route. Dataset ID from module 1; Clean; JSON; offset `0`; fixed limit `200`; pagination disabled. |
| 4 | Router | Validate each bundle before aggregation. Valid: `itemKey` and `feedUrl` exist and `isNew=true`. Invalid: the exact complement. |
| 5 | Tools - Array Aggregator | Valid-record route; source module `3`; include the RSS fields; **Stop processing after an empty aggregation = No**. Make exposes module 5 `Array[]`; do not try to rename it. |
| 6 | Router | New items: `length(module 5 Array[]) > 0`. Quiet: `length(module 5 Array[]) = 0`. |
| 7A | Tools - Set Multiple Variables | New-item route. Lifetime: one execution. Set `hasNewItems=true`, `newItemCount=length(module 5 Array[])`, and `items=module 5 Array[]`. |
| 7B | Tools - Set Multiple Variables | Quiet route. Lifetime: one execution. Set `hasNewItems=false`, `newItemCount=0`, and `items=[]`. |
| 9 | Tools - Iterator | Required whenever module 10 is present. Iterate module 5 `Array[]` on the new-item route. |
| 10 | Data store - Add/Replace a Record | Connect after module 9. Key `rss:{{encodeURL(feedUrl)}}:{{encodeURL(itemKey)}}`; **Overwrite an existing record = Yes**; map each Iterator bundle into the shared monitor-deliveries structure. |
| 11 | Tools - Set Multiple Variables | Invalid-record diagnostic with Task run ID and missing fields; end normally. |
| 12 | Tools - Set Multiple Variables | After module 10, when `status != SUCCEEDED`, report the persisted key and terminal status. |
| 13 | Tools - Set Multiple Variables | Quiet route with `status != SUCCEEDED`; report the fetched zero-row dataset. |
| 14 | Tools - Set Multiple Variables | Missing-dataset route; report that no request was attempted. |

The Array Aggregator must have empty aggregation processing enabled. Without it, zero dataset bundles stop the route before the required false envelope can be created.

This package defines a per-item data-store write. Module 9 is therefore mandatory: module 10 must consume scalar fields from each Iterator bundle, never the aggregate array directly.

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

- Non-`SUCCEEDED` run with a dataset ID: module 3 fetches it and module 10 upserts every valid RSS item first. Module 12 then records the run status, dataset ID, stable key, and `record persisted = true`.
- Non-`SUCCEEDED` empty dataset: module 13 records zero rows after retrieval. Missing dataset ID: module 14 records that retrieval was not attempted. End these instant-triggered branches normally; throwing can disable the scenario.
- Scenario settings: set **Store incomplete executions = Yes**.
- Dataset retrieval error: attach Make's **Retry** handler to module 3 with automatic completion, 3 attempts, and a 15-minute delay. Resume at module 3 with the same `defaultDatasetId`; never rerun the Task. Make automatically applies exponential backoff to connection, rate-limit, and module-timeout errors.
- Invalid RSS record: stop that bundle before delivery and record only Task run ID plus missing field names.
- Data-store error: attach the same Retry settings to module 10. Resume only that operation with the same URL-encoded `rss:<encodedFeedUrl>:<encodedItemKey>` key. Inject a failure after a committed write and prove retry leaves exactly one record.
- Quiet run: return the false envelope and finish successfully.

## Account-gated validation

1. Build the scenario from `module-mapping.json` in a user-owned Make account.
2. Confirm the saved Task has `maxItemsPerRun <= 200`, matching the fixed non-paginated retrieval limit of 200, and the Apify Schedule interval is strictly longer than the Task's hard timeout. Create/select the shared monitor-deliveries data store and enable overwrite.
3. Run a bounded non-empty Task and verify the true envelope and every mapped field against `fixtures/rss-items.json`.
4. Run the same only-new Task again and verify the false envelope with zero destination writes.
5. Validate failed, aborted, and timed-out Task runs with committed rows; confirm Data Store writes precede diagnostics.
6. Force dataset and data-store failures and verify the Task is not rerun. Inject a post-commit timeout and verify exactly one URL-encoded `rss:<encodedFeedUrl>:<encodedItemKey>` record exists after retry; also prove equal `itemKey` values from different feeds produce distinct keys.
7. Export the blueprint, remove connection identifiers and private data, and scan the exact candidate.
8. Import that exact file into a fresh empty validation organization/team or clean account and reconnect credentials.
9. Save and activate the imported scenario; verify Make recreated the Task-scoped watcher webhook.
10. Repeat non-empty, quiet, invalid-record, failed-with-rows, replay, failed-empty, `ABORTED`, `TIMED-OUT`, missing-dataset-ID, dataset-retry, and data-store-retry runs, including the exactly-one-record post-commit test.
11. Obtain independent validator PASS and separate adversarial PASS before publication.

## Official references

- https://docs.apify.com/integrations/make
- https://apps.make.com/apify
- https://help.make.com/aggregator
- https://help.make.com/retry-error-handler
- https://help.make.com/automatic-retry-of-incomplete-executions
- https://help.make.com/data-stores
