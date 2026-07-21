# n8n: Run a Persistent Bluesky Alert Task

Status: locally parsed and structurally validated against n8n 2.30.8, built-in Data Table 1.1, and `@apify/n8n-nodes-apify` 0.6.10. Exact-file import and authenticated runs of this revised export remain account gates.

## Import

1. Import `bluesky-alerts-task-to-json.json` into n8n.
2. Install or enable verified `@apify/n8n-nodes-apify` 0.6.10 or later if the Apify node is unavailable.
3. Open **Run persistent Bluesky monitoring Task**, keep the selector in **ID** mode, and replace `PASTEYOURTASKID` with the alphanumeric ID of a saved Task whose input has `onlyNew: true` and `maxPostsPerRun <= 100`.
4. Create or select an Apify credential inside n8n. API-key authentication works in Cloud and self-hosted n8n. OAuth2 is Cloud-only and requires changing **Authentication** from **API Key** to **OAuth2** before attaching the OAuth credential. The export contains no credential binding.
5. Create an n8n Data Table named `monitor-deliveries` with the columns displayed by **Upsert committed posts**: `deliveryKey`, `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, `runId`, `runStatus`, `datasetId`, and `payloadJson`, all strings. Select it in that node if name lookup is not available.
6. Leave the schedule disabled while testing. Run **Manual Trigger** twice.
7. Confirm both runs use the same Task, records are upserted under `bluesky:<postUri>`, and a second quiet run reports zero rows.
8. Confirm the saved Task's hard timeout, set the **Schedule Trigger** interval strictly longer than that timeout, then enable the trigger and activate the workflow.

The workflow sends no custom Actor input and omits build, memory, and timeout overrides. In verified community-node version 0.6.10, **Run task** with **Wait for Finish** polls until `SUCCEEDED`, `FAILED`, `TIMED-OUT`, or `ABORTED` and returns the terminal run object. **Fetch terminal run dataset** then reads `defaultDatasetId` for every status with a fixed limit of 100 and no pagination. The combined **Run task and get dataset** operation is deliberately not used because its implementation rejects non-`SUCCEEDED` runs before retrieval.

Every valid fetched post is prepared with `bluesky:<postUri>`. A malformed non-empty row is converted to a sanitized diagnostic under `bluesky:diagnostic:<encodedRunId>:row:<datasetIndex>`; the diagnostic contains only its error code, required-field names, run/dataset IDs, and row index, never the malformed raw payload. Valid and diagnostic rows share the same upsert path, so one bad row cannot block a valid neighbor. **Report terminal outcome after ingestion** runs only after all prepared rows are persisted and reports valid and diagnostic counts before surfacing a non-success status. An empty dataset reports zero rows; a terminal run without a dataset ID makes no dataset request and reports that condition separately.

**Fetch terminal run dataset** and **Upsert committed posts** each retry the same operation in place up to three times, with a five-second wait. They preserve the original `defaultDatasetId` and either the `bluesky:<postUri>` or run-row diagnostic key; they never rerun **Run persistent Bluesky monitoring Task**. If retries are exhausted, manual recovery must use the original run ID and its dataset. The workflow does not provide automatic exactly-once delivery.

## Security check before re-export

Inspect the exported JSON for credential IDs, credential names, tokens, authorization headers, private URLs, execution data, and pinned data. Remove them before publishing. Do not publish an export captured after pinning live Bluesky records.

## Account-gated live validation

- Connect a newly created Apify credential.
- Verify the selected saved Task has `maxPostsPerRun <= 100`, then run it against the workflow's fixed non-paginated retrieval limit of 100.
- Verify `FAILED`, `TIMED-OUT`, and `ABORTED` runs with committed rows persist those rows before the final node fails.
- Replay the same failed run dataset and verify one Data Table row remains for each key.
- Run the mixed valid/malformed fixture and verify the valid post and sanitized run-row diagnostic are both present before terminal failure is reported; replay must overwrite those same two keys.
- Exhaust both retry paths and verify manual recovery uses the original run ID without rerunning the Task.
- Verify failed empty and missing-dataset runs report safely with zero persisted rows.
- Verify the activated schedule interval is strictly longer than the selected Task's configured hard timeout.
- Re-export, scrub, and run the repository scans again.
