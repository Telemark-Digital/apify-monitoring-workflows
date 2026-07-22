# Make Implementation Package

Status: **DRAFT - NOT IMPORTED, RUN, OR EXPORTED BY MAKE**

This package is an exact construction specification, not a Make blueprint. It remains a draft until the account-gated export, clean re-import, live runs, and two independent reviews pass.

Use Make HTTP modules with a limited Apify API token in an `Authorization: Bearer <APIFY_TOKEN_PLACEHOLDER>` header. Do not use Make's Apify connector for this template; its connection test requires account/user access that is broader than the reviewed resource-scoped token. Never place a real token in an exported blueprint, fixture, or screenshot.

Create or select one Make data store named for monitor deliveries. Use the fields `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson`. The same store can be shared by all three templates; product-prefixed keys prevent collisions. Make's free plan includes one 1 MB data store.

## Canonical architecture

Use an **Apify Schedule** to run the same persistent TED monitoring Task. A Make scenario schedule polls recent Task runs with HTTP, skips run IDs already checkpointed in the shared data store, fetches each uncheckpointed terminal run's default dataset, writes product rows first, and writes the run checkpoint last. This avoids Make's 120-second synchronous `Run a Task` ceiling without needing Make's Apify connector.

The saved Task must:

- use `sampleMode: false`
- have completed its prime run
- use `maxNewPerRun <= 999`; the Actor appends exactly one summary control row, the dataset retrieval limit is fixed at `1000`, and pagination is intentionally disabled
- use an Apify Schedule interval strictly longer than the saved Task's configured hard timeout

Set the Make scenario schedule so expected outage coverage stays within the 1000-run polling window, and enable process-in-order/no-overlap behavior. If expected outage coverage can exceed `1000 * Apify Schedule interval`, add paginated backfill before activation. Do not add a Make `Run a Task`, `Run an Actor`, or Make Apify connector module; the persistent Task is the state boundary.

## Exact build sequence

| Order | Make module or control | Configuration |
| --- | --- | --- |
| 1 | HTTP - Make a request | List Task runs: `GET https://api.apify.com/v2/actor-tasks/{{TASK_ID}}/runs?desc=1&limit=1000&offset=0` with the scrubbed Authorization placeholder. |
| 2 | Data store - Search Records | Read pre-existing checkpoint keys with prefix `ted:run:` for module 1 run IDs. This is read-only and happens before any product or checkpoint write. |
| 3 | Tools - Set Multiple Variables | Compute `pageIsFull`, `preExistingCheckpointBoundaryFound`, `overflowStop`, and `reversedRuns`. The checkpoint boundary must use only records read by module 2. |
| 4 | Router | Proceed when `overflowStop=false`. Overflow-stop when `overflowStop=true`; end with a diagnostic and do not reach module 5 or any write. |
| 5 | Tools - Iterator | Iterate module 3 `reversedRuns[]`, so uncheckpointed runs are processed oldest-to-newest within the fetched page. |
| 6 | Data store - Get a Record | Read checkpoint key `ted:run:{{module 5 id}}` for the current run. |
| 7 | Router | Dataset available: terminal run, checkpoint missing, and `defaultDatasetId` exists. Missing dataset: terminal run, checkpoint missing, and ID does not exist. Already checkpointed or non-terminal: end safely. |
| 8 | HTTP - Make a request | Dataset-available route. `GET https://api.apify.com/v2/datasets/{{module 5 defaultDatasetId}}/items?format=json&clean=1&offset=0&limit=1000`; fixed limit, clean JSON, pagination disabled. |
| 9 | Tools - Array Aggregator | Source module `8`; include every TED record field; **Stop processing after an empty aggregation = No**. Make exposes module 9 `Array[]`; do not try to rename it. |
| 10 | Router | Records present: `length(module 9 Array[]) > 0`. Empty dataset: `length(module 9 Array[]) = 0`. |
| 11 | Tools - Iterator | Records-present route only; iterate module 9 `Array[]`. |
| 12 | Router | Identified-tender route: `recordType = tender` and `publicationNumber` exists. Run-scoped route: `recordType != tender` or `publicationNumber` is missing. This Router classifies bundles only; it does not assign either key. |
| 13 | Data store - Add/Replace a Record | Identified-tender route only. Key `ted:<publicationNumber>` using module 11 `publicationNumber`; **Overwrite an existing record = Yes**. Preserve the original dataset record in `payloadJson`, including `title: null`. |
| 14 | Data store - Add/Replace a Record | Run-scoped route only. Key `ted:run:<runId>:row:<Iterator bundle order>` using module 5 `id` and module 11 bundle order; **Overwrite an existing record = Yes**. Preserve the original dataset record in `payloadJson`, including `title: null`. |
| 15 | Router | After module 14. Invalid-tender diagnostic: `recordType = tender` and `publicationNumber` is missing. Terminal-failure diagnostic: `status != SUCCEEDED`. Both routes may run for a malformed row from a non-success run. |
| 16 | Tools - Set Multiple Variables | Module 15 invalid-tender route. Report the fallback key and that the malformed tender was persisted but is not exposed. |
| 17 | Tools - Set Multiple Variables | Module 15 terminal-failure route. Report the run-scoped key and terminal status after module 14 persisted the row. |
| 18 | Tools - Set Multiple Variables | After module 13 when `status != SUCCEEDED`; report the identified-tender key and terminal status after persistence. |
| 19 | Tools - Set Multiple Variables | Empty-dataset route; report the fetched zero-row dataset. |
| 20 | Tools - Set Multiple Variables | Missing-dataset route; report that no request was attempted. |
| 21 | Data store - Add/Replace a Record | Write checkpoint key `ted:run:{{module 5 id}}` only after all product row upserts and diagnostics for the run have completed. |

Module 12 routes:

- Identified tender: `recordType = tender` and `publicationNumber` exists. `title` may be a string or `null`.
- Run-scoped record: `recordType != tender` or `publicationNumber` is missing. Persist under the deterministic run-row key. Prime and summary rows are not exposed as tenders.

## Idempotent data-store record

| Output field | Dataset mapping |
| --- | --- |
| `publicationNumber` | `publicationNumber` |
| `publicationDate` | `publicationDate` |
| `noticeType` | `noticeType` |
| `isChangeNotice` | `isChangeNotice` |
| `modifiesPublicationNumber` | `modifiesPublicationNumber` |
| `title` | Preserve string or `null` in `payloadJson` and normalized output |
| `displayTitle` | `title` when non-empty, otherwise `Tender <publicationNumber>` |
| `buyerName` | `buyerName` |
| `buyerCountry` | `buyerCountry` |
| `cpvCodes` | `cpvCodes[]` |
| `estimatedValueEur` | `estimatedValueEur` |
| `valueUnknown` | `valueUnknown` |
| `deadlineDate` | `deadlineDate` |
| `links.html` | `links.html` |
| `links.pdf` | `links.pdf` |
| `links.xml` | `links.xml` |
| `firstSeenAt` | `firstSeenAt` |

The two canonical product sinks have disjoint routes. Module 13 alone uses `ted:<publicationNumber>` for identified tenders. Module 14 alone uses `ted:run:<runId>:row:<bundleOrder>` for every other row. Both enable overwrite, so retrying the failed sink with the same bundle leaves exactly one record for that route's key. Module 21 is a separate run checkpoint written last. Add optional side effects only after the applicable write; they remain at-least-once unless independently protected.

## Failure and retry routes

- Non-`SUCCEEDED` run with a dataset ID: module 8 fetches it. Module 13 persists each identified tender before module 18 reports its key and terminal status; module 14 persists each run-scoped row before module 15 routes it to module 17 for terminal reporting.
- Empty failed dataset: module 19 records zero rows after retrieval. Missing dataset ID: module 20 records that retrieval was not attempted. End these polling branches normally; throwing can disable the scenario.
- Missing publication number: module 14 persists the row under its run-scoped key, then module 15 routes it to module 16's diagnostic. Do not expose it as a tender. A null title is not invalid. On a non-success run, module 15 also routes the same persisted row to module 17.
- Scenario settings: set **Store incomplete executions = Yes**.
- List-runs, preflight checkpoint search, or dataset retrieval error: attach Make's **Retry** handler to modules 1, 2, and 8 with automatic completion, 3 attempts, and a 15-minute delay. Resume with the same Task ID or `defaultDatasetId`; never rerun the Task.
- Data-store error: attach the same Retry settings independently to modules 13 and 14. Resume only the failed Data store operation with the same dataset bundle. Module 13 must retry `ted:<publicationNumber>`; module 14 must retry `ted:run:<runId>:row:<bundleOrder>`. Inject a failure after each committed write and prove each retry leaves exactly one record for its stable key without rerunning the Task.
- Run-checkpoint error: retry module 21. Because product rows are already upserted, duplicate polls must replay idempotently and then leave exactly one checkpoint for `ted:run:<runId>`.
- Overflow stop: if module 1 returns `count=1000` and the page contains no checkpointed terminal run boundary, stop without writing new run checkpoints and perform paginated/manual backfill before resuming.
- Quiet run: succeed without destination operations. Prime or summary rows are persisted under run-row keys but are not exposed as tenders.

## Account-gated validation

1. Build the scenario from `module-spec.json` in a user-owned Make account.
2. Confirm the saved Task has `maxNewPerRun <= 999`, so 999 tender rows plus the Actor's exactly one summary control row fit the fixed non-paginated retrieval limit of 1000, and the Apify Schedule interval is strictly longer than the Task's hard timeout. Create/select the shared monitor-deliveries data store and enable overwrite on product modules 13 and 14 plus checkpoint module 21.
3. Verify a controlled fixture routes its identified tender only to module 13 under `ted:<publicationNumber>` and its summary only to module 14 under `ted:run:<runId>:row:<bundleOrder>`; confirm both writes use overwrite and the summary is not exposed.
4. Verify a quiet run has zero writes and a summary-only run has run-row writes but zero exposed tenders.
5. Verify a change notice preserves `noticeType`, change fields, and all three source links.
6. Validate a missing-publication-number row, a `title:null` tender, and failed, aborted, and timed-out runs with committed rows.
7. Force list-runs, preflight checkpoint search, dataset, data-store, and run-checkpoint failures and verify the Task is not rerun. Independently inject post-commit timeouts at modules 13 and 14; verify exactly one `ted:<publicationNumber>` record and exactly one `ted:run:<runId>:row:<bundleOrder>` record exist after their respective retries.
8. Export the blueprint, remove connection identifiers and private data, and scan the exact candidate.
9. Import that exact file into a fresh empty validation organization/team or clean account and reconnect credentials.
10. Save and activate the imported scenario only for validation; verify the HTTP modules still contain placeholder-shaped Authorization fields before reconnecting the limited token.
11. Repeat tender, null-title, quiet, prime/summary, malformed-tender, failed-with-rows, replay, failed-empty, `ABORTED`, `TIMED-OUT`, missing-dataset-ID, duplicate-poll, list-runs-retry, preflight-retry, dataset-retry, overflow-stop, run-checkpoint, and both module 13 and module 14 data-store-retry runs, including both exactly-one-record post-commit tests.
12. Obtain independent validator PASS and separate adversarial PASS before publication.

## Official references

- https://docs.apify.com/api/v2/actor-task-runs-get
- https://docs.apify.com/api/v2/dataset-items-get
- https://help.make.com/aggregator
- https://help.make.com/retry-error-handler
- https://help.make.com/automatic-retry-of-incomplete-executions
- https://help.make.com/data-stores
