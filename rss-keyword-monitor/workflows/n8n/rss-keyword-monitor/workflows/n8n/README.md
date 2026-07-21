# n8n workflow

[`rss-task-only-new.json`](./rss-task-only-new.json) is a credential-free n8n export. It uses verified **Run task** with **Wait for Finish** to retain every terminal status, fetches `defaultDatasetId` separately, and upserts records before reporting failure.

Status: locally parsed and structurally validated against n8n 2.30.8, built-in Data Table 1.1, and `@apify/n8n-nodes-apify` 0.6.10. Exact-file import and authenticated runs of this revised export remain account gates.

## Before import

Install verified `@apify/n8n-nodes-apify` 0.6.10 or later if the Apify node is not already available. Version 0.6.10 supports n8n 1.57 or later and requires Node.js 22 or later when self-hosted.

## Configure after import

1. Create an Apify API-key connection in Cloud or self-hosted n8n. For OAuth2 in n8n Cloud, change the node's **Authentication** setting to **OAuth2** before attaching the credential.
2. Open **Run persistent RSS monitoring Task** and select that connection.
3. Keep the Task selector in **ID** mode and replace `PASTEYOURTASKID` with the alphanumeric ID of a Task configured with `onlyNew: true` and `maxItemsPerRun <= 200`.
4. Create `monitor-deliveries` as an n8n Data Table with the string columns shown by **Upsert committed RSS items**, and select it if name lookup is unavailable.
5. Set the schedule interval strictly longer than the saved Task's configured hard timeout.
6. Test once, then test again to confirm a quiet second run produces the zero-row envelope.

The separate dataset operation runs whenever a terminal run has a dataset ID, including `FAILED`, `TIMED-OUT`, and `ABORTED`. It has a fixed limit of 200 and no pagination, so account-gated validation must confirm `maxItemsPerRun <= 200` before activation. Each valid row is upserted under the URL-encoded tuple `rss:<encodedFeedUrl>:<encodedItemKey>`. A malformed non-empty row becomes a sanitized `rss:diagnostic:<encodedRunId>:row:<datasetIndex>` record containing only its error code, required-field names, run/dataset IDs, and row index, never the malformed raw payload. Valid and diagnostic rows share the same upsert path before final status reporting, so one bad row cannot block a valid neighbor. Equal `itemKey` values from different feeds remain distinct, while replay replaces the same valid and diagnostic rows. Empty and missing-dataset runs report safely without manufacturing an item.

**Fetch terminal run dataset** and **Upsert committed RSS items** each retry the same operation in place up to three times, with a five-second wait. They preserve the original `defaultDatasetId` and either the URL-encoded composite item key or run-row diagnostic key; they never rerun **Run persistent RSS monitoring Task**. If retries are exhausted, manual recovery must use the original run ID and its dataset. The workflow does not provide automatic exactly-once delivery.

The export deliberately contains no `credentials` object, regional timezone, or Task input/build/memory/timeout override. It inherits the n8n instance timezone and leaves runtime settings in the saved Task. Do not add a token to a node field, expression, sticky note, URL, or exported fixture.

Official references:

- https://docs.apify.com/integrations/n8n
- https://github.com/apify/n8n-nodes-apify
