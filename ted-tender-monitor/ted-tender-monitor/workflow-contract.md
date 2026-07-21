# Workflow Contract

## Purpose

Run one persistent TED Tender Monitor - EU Procurement Alerts Task on a schedule, wait for any terminal status, persist every committed dataset record, and only then expose tender records and report the terminal outcome.

## Required configuration

- `actorTaskId`: the user's alphanumeric persistent Apify Task ID.
- Apify connection: supplied through the workflow platform's credential store, never in workflow JSON.
- Schedule: daily by default and always strictly longer than the saved Task's configured hard timeout; broad filters may need a higher cadence, but `maxNewPerRun` must remain at or below 999 for this package.
- Retrieval contract: fixed limit 1000 with no pagination; `maxNewPerRun <= 999` reserves one row for the Actor's exactly one appended summary control record.
- Destination connection: optional and supplied by the user after import.
- Canonical store: n8n Data Table or Make Data Store with upsert/overwrite enabled.

The saved Task owns all filters, state behavior, build, memory, and timeout. The workflow must not override those settings during routine runs.

## Preconditions

1. The Task belongs to the workflow user or is accessible to that user's Apify connection.
2. The Task has `sampleMode: false`.
3. The Task has completed one successful prime run.
4. The Task has no public webhook value or signing secret.
5. The Task's first follow-up run has been inspected, including a legitimate quiet result if no new notices exist.

## Execution sequence

Two launch profiles satisfy this contract:

- n8n: start manually for testing or from the included daily n8n schedule, then run the persistent Task.
- Make: an Apify Schedule runs the persistent Task; **Watch Task Runs** starts the Make scenario for every finished run of that Task.

For either launch profile, the schedule interval must be strictly longer than the saved Task's hard timeout to reduce avoidable contention. The Actor's Task-state lease, not schedule cadence, provides mutual exclusion and rejects a contender before delivery.

1. Start from the selected launch profile while reusing the same persistent Task.
2. Read the persistent `actorTaskId` from workflow configuration.
3. Run that Task and let the Apify node poll until the Task reaches a terminal state, subject to the saved Task's own timeout.
4. If the terminal run has a `defaultDatasetId`, retrieve its items regardless of `SUCCEEDED`, `FAILED`, `TIMED-OUT`, or `ABORTED`, using the fixed non-paginated limit of 1000. The saved Task cap of 999 leaves room for exactly one appended summary row.
5. Upsert identified tenders under `ted:<publicationNumber>`. Persist summary, prime, or malformed rows under deterministic `ted:run:<runId>:row:<rowIndex>` fallback keys so retrying the same run cannot duplicate them.
6. Only after those writes, expose records where `recordType` is `tender` and `publicationNumber` exists.
7. Preserve all tender fields. `title` may be a string or `null`; keep null in the payload and normalized object. `Tender <publicationNumber>` may be used only as a display label.
8. Report zero records safely for an empty dataset and avoid retrieval when no dataset ID exists.
9. After ingestion, expose terminal failure through n8n's final status node or Make's post-persistence diagnostic.

## Invariants

- Never replace the Task run with a fresh Actor run.
- Never set `sampleMode: true` in the monitoring workflow.
- Never put an Apify token, destination credential, webhook URL, or signing secret in an exported workflow.
- Never expose `prime` or `summary` records as tenders; persist them under run-scoped keys for a complete ingestion ledger.
- Never activate this non-paginated workflow with `maxNewPerRun > 999`; 999 tender rows plus exactly one summary control row must fit the limit of 1000.
- Never retry a successful run merely because its dataset contains no tender records.
- Preserve `publicationNumber` as the downstream idempotency key.

## Error behavior

- Authentication or permission failure: stop and request a valid Apify connection.
- Task not found: stop and request a persistent Task identifier owned by the connected account.
- Actor status other than `SUCCEEDED`: fetch and persist the run's dataset first when an ID exists, then report the status. Never use n8n's success-gated combined operation for this workflow.
- Workflow timeout: check the Apify run before retrying because the run may still be active.
- Canonical Make data-store failure: retry only the failed **Add/Replace a Record** sink with the same dataset bundle. Module 8 retries identified tenders with `ted:<publicationNumber>`; module 9 retries every run-scoped row with `ted:run:<runId>:row:<bundleOrder>`. Both sinks use overwrite, and neither retry reruns the Apify Task. Optional downstream destinations need their own idempotency contract.
- Tender without `publicationNumber`: persist it under the deterministic run-row fallback key, record a diagnostic, and do not expose it as a tender.
- Tender with `title: null`: persist and expose it normally; a display-only fallback must not overwrite the null payload value.

## Acceptance tests

1. Prime run returns no `tender` records and is considered successful.
2. Quiet follow-up returns no `tender` records and is considered successful.
3. A fixture containing one tender and one summary emits exactly one tender.
4. A change notice preserves `isChangeNotice` and `modifiesPublicationNumber`.
5. A failed Task run with committed rows persists every row before terminal failure is reported; replay leaves exactly one row per stable key.
6. Failed empty and missing-dataset runs report zero persisted rows safely.
7. A tender missing `publicationNumber` is persisted under its run-row key but is not exposed as a tender.
8. A tender with `title: null` is persisted and exposed with null preserved and an optional display fallback.
9. The exported workflow contains no credential binding or secret value.
10. Make post-commit timeout tests independently prove exactly one record after retry at module 8 and module 9, using each route's stable key.
11. Account-gated validation confirms `maxNewPerRun <= 999`, retrieval limit 1000, no pagination, and exactly one appended summary control row before activation.
