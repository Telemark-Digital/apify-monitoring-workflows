# n8n Workflow

`ted-tender-monitor.json` is a credential-free n8n workflow export.

## Import and configure

1. Import the JSON through n8n's workflow import menu.
2. Install verified `@apify/n8n-nodes-apify` 0.6.10 or later when prompted.
3. Create an Apify API-key credential in Cloud or self-hosted n8n. For OAuth2 in n8n Cloud, change **Authentication** to **OAuth2** before attaching the credential.
4. Replace `PASTEYOURTASKID` with the alphanumeric ID of a Task that has `sampleMode: false`, `maxNewPerRun <= 999`, and has already completed its first prime run.
5. Create an n8n Data Table named `monitor-deliveries` with the string columns displayed by **Upsert committed TED records**, and select it if name lookup is unavailable.
6. Run manually and inspect the output before activating the daily trigger. Confirm the daily interval is strictly longer than the saved Task's hard timeout.
7. Add a destination after **Report terminal outcome after ingestion** only when that destination has its own idempotency plan.

The export intentionally contains no `credentials` object and no Task input, timeout, memory, or build override. Its executable graph was imported and authenticated-run validated in n8n 2.30.8. The final publication export adds documentation notes without changing executable nodes and passes exact-file repository validation. Its Creator submission is queued behind n8n's one-pending-template policy.

Verified `@apify/n8n-nodes-apify` 0.6.10 **Run task** with **Wait for Finish** returns the run object for every terminal status. The workflow fetches its dataset separately with a fixed limit of 1000 and no pagination, upserts every row, and only then reports a non-success status. Because the Actor appends exactly one summary control row, account-gated validation must confirm `maxNewPerRun <= 999`. Identified tenders use `ted:<publicationNumber>`; control or malformed rows use `ted:run:<runId>:row:<rowIndex>`.

**Fetch terminal run dataset** and **Upsert committed TED records** each retry the same operation in place up to three times, with a five-second wait. They preserve the original `defaultDatasetId` and stable tender or run-row key and never rerun **Run persistent TED monitoring Task**. If retries are exhausted, manual recovery must use the original run ID and its dataset. The workflow does not provide automatic exactly-once delivery.

A tender with `title: null` is valid. The null remains in `payloadJson` and normalized `title`; `Tender <publicationNumber>` is used only as `displayTitle` and the Data Table's display-oriented title column. A missing `publicationNumber` prevents tender exposure but not persistence. Empty and missing-dataset runs report zero rows safely.
