# Make Implementation Package

Status: **DRAFT - NOT IMPORTED, RUN, OR EXPORTED BY MAKE**

This package is an exact construction specification, not a Make blueprint. It remains a draft until the account-gated export, clean re-import, live runs, and two independent reviews pass.

Create the Apify connection through Make's connection manager. OAuth is recommended when offered; an API-token connection is also supported. Never place the token in a module field, exported blueprint, fixture, or screenshot.

Create or select one Make data store named for monitor deliveries. Use the fields `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson`. The same store can be shared by all three templates; product-prefixed keys prevent collisions. Make's free plan includes one 1 MB data store.

## Canonical architecture

Use an **Apify Schedule** to run the same persistent TED monitoring Task. Make begins with **Apify - Watch Task Runs**, which fires whenever that selected Task finishes. This event-driven design avoids Make's 120-second synchronous `Run a Task` ceiling and retains the Task run ID and terminal status.

The saved Task must:

- use `sampleMode: false`
- have completed its prime run
- use `maxNewPerRun <= 999`; the Actor appends exactly one summary control row, the dataset retrieval limit is fixed at `1000`, and pagination is intentionally disabled
- use an Apify Schedule interval strictly longer than the saved Task's configured hard timeout

Do not add a Make scenario schedule or `Run a Task` module to this canonical scenario. Do not use `Run an Actor`; the persistent Task is the state boundary.

## Exact build sequence

| Order | Make module or control | Configuration |
| --- | --- | --- |
| 1 | Apify - Watch Task Runs | Select the persistent Task. Trigger on any finished Task run. |
| 2 | Router | Dataset available: `defaultDatasetId` exists for any terminal status. Missing dataset: ID does not exist. Do not filter on `SUCCEEDED`. |
| 3 | Apify - Get Dataset Items | Dataset-available route. Dataset ID from module 1; Clean; JSON; offset `0`; fixed limit `1000`; pagination disabled. The result can contain at most 999 tender rows plus exactly one summary row. |
| 4 | Tools - Array Aggregator | Source module `3`; include every TED record field; **Stop processing after an empty aggregation = No**. Make exposes module 4 `Array[]`; do not try to rename it. |
| 5 | Router | Records present: `length(module 4 Array[]) > 0`. Empty dataset: `length(module 4 Array[]) = 0`. |
| 6 | Tools - Iterator | Records-present route only; iterate module 4 `Array[]`. `Get Dataset Items` emits bundles, so no Iterator belongs directly after it. |
| 7 | Router | Identified-tender route: `recordType = tender` and `publicationNumber` exists. Run-scoped route: `recordType != tender` or `publicationNumber` is missing. This Router classifies bundles only; it does not assign either key. |
| 8 | Data store - Add/Replace a Record | Identified-tender route only. Key `ted:<publicationNumber>` using module 6 `publicationNumber`; **Overwrite an existing record = Yes**. Preserve the original dataset record in `payloadJson`, including `title: null`. |
| 9 | Data store - Add/Replace a Record | Run-scoped route only. Key `ted:run:<runId>:row:<Iterator bundle order>` using module 1 `id` and module 6 bundle order; **Overwrite an existing record = Yes**. Preserve the original dataset record in `payloadJson`, including `title: null`. |
| 10 | Router | After module 9. Invalid-tender diagnostic: `recordType = tender` and `publicationNumber` is missing. Terminal-failure diagnostic: `status != SUCCEEDED`. Both routes may run for a malformed row from a non-success run. |
| 11 | Tools - Set Multiple Variables | Module 10 invalid-tender route. Report the fallback key and that the malformed tender was persisted but is not exposed. |
| 12 | Tools - Set Multiple Variables | Module 10 terminal-failure route. Report the run-scoped key and terminal status after module 9 persisted the row. |
| 13 | Tools - Set Multiple Variables | After module 8 when `status != SUCCEEDED`; report the identified-tender key and terminal status after persistence. |
| 14 | Tools - Set Multiple Variables | Empty route with `status != SUCCEEDED`; report the fetched zero-row dataset. |
| 15 | Tools - Set Multiple Variables | Missing-dataset route; report that no request was attempted. |

Module 7 routes:

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

The two canonical sinks have disjoint routes. Module 8 alone uses `ted:<publicationNumber>` for identified tenders. Module 9 alone uses `ted:run:<runId>:row:<bundleOrder>` for every other row. Both enable overwrite, so retrying the failed sink with the same bundle leaves exactly one record for that route's key. Add optional side effects only after the applicable write; they remain at-least-once unless independently protected.

## Failure and retry routes

- Non-`SUCCEEDED` run with a dataset ID: module 3 fetches it. Module 8 persists each identified tender before module 13 reports its key and terminal status; module 9 persists each run-scoped row before module 10 routes it to module 12 for terminal reporting.
- Empty failed dataset: module 14 records zero rows after retrieval. Missing dataset ID: module 15 records that retrieval was not attempted. End these instant-triggered branches normally; throwing can disable the scenario.
- Missing publication number: module 9 persists the row under its run-scoped key, then module 10 routes it to module 11's diagnostic. Do not expose it as a tender. A null title is not invalid. On a non-success run, module 10 also routes the same persisted row to module 12.
- Scenario settings: set **Store incomplete executions = Yes**.
- Dataset retrieval error: attach Make's **Retry** handler to module 3 with automatic completion, 3 attempts, and a 15-minute delay. Resume at module 3 with the same `defaultDatasetId`; never rerun the Task. Make automatically applies exponential backoff to connection, rate-limit, and module-timeout errors.
- Data-store error: attach the same Retry settings independently to modules 8 and 9. Resume only the failed Data store operation with the same dataset bundle. Module 8 must retry `ted:<publicationNumber>`; module 9 must retry `ted:run:<runId>:row:<bundleOrder>`. Inject a failure after each committed write and prove each retry leaves exactly one record for its stable key without rerunning the Task.
- Quiet run: succeed without destination operations. Prime or summary rows are persisted under run-row keys but are not exposed as tenders.

## Account-gated validation

1. Build the scenario from `module-spec.json` in a user-owned Make account.
2. Confirm the saved Task has `maxNewPerRun <= 999`, so 999 tender rows plus the Actor's exactly one summary control row fit the fixed non-paginated retrieval limit of 1000, and the Apify Schedule interval is strictly longer than the Task's hard timeout. Create/select the shared monitor-deliveries data store and enable overwrite on both modules 8 and 9.
3. Verify a controlled fixture routes its identified tender only to module 8 under `ted:<publicationNumber>` and its summary only to module 9 under `ted:run:<runId>:row:<bundleOrder>`; confirm both writes use overwrite and the summary is not exposed.
4. Verify a quiet run has zero writes and a summary-only run has run-row writes but zero exposed tenders.
5. Verify a change notice preserves `noticeType`, change fields, and all three source links.
6. Validate a missing-publication-number row, a `title:null` tender, and failed, aborted, and timed-out runs with committed rows.
7. Force dataset and data-store failures and verify the Task is not rerun. Independently inject post-commit timeouts at modules 8 and 9; verify exactly one `ted:<publicationNumber>` record and exactly one `ted:run:<runId>:row:<bundleOrder>` record exist after their respective retries.
8. Export the blueprint, remove connection identifiers and private data, and scan the exact candidate.
9. Import that exact file into a fresh empty validation organization/team or clean account and reconnect credentials.
10. Save and activate the imported scenario; verify Make recreated the Task-scoped watcher webhook.
11. Repeat tender, null-title, quiet, prime/summary, malformed-tender, failed-with-rows, replay, failed-empty, `ABORTED`, `TIMED-OUT`, missing-dataset-ID, dataset-retry, and both module 8 and module 9 data-store-retry runs, including both exactly-one-record post-commit tests.
12. Obtain independent validator PASS and separate adversarial PASS before publication.

## Official references

- https://docs.apify.com/integrations/make
- https://apps.make.com/apify
- https://help.make.com/aggregator
- https://help.make.com/retry-error-handler
- https://help.make.com/automatic-retry-of-incomplete-executions
- https://help.make.com/data-stores
