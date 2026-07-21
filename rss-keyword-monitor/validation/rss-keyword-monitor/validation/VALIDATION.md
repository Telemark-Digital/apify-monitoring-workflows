# Product validation notes

## Locally validated

- Public Task bundles parse as JSON.
- Task inputs use only fields in the current Actor input schema.
- Discovery inputs are bounded and use public HTTP(S) feeds.
- Every public Task has `onlyNew: false`, a blank `webhookUrl`, and `resetState: false`.
- Monitoring documentation consistently requires `onlyNew: true` on one persistent Task.
- The fixture follows the current dataset schema and contains no private data.
- The n8n workflow parses, contains no credentials object, retains every terminal run through **Run task**, fetches datasets separately with fixed limit 200 and no pagination, and upserts valid URL-encoded `rss:<encodedFeedUrl>:<encodedItemKey>` rows plus sanitized deterministic run-row diagnostics before failure reporting.
- Both workflow artifacts require saved Task `maxItemsPerRun <= 200`; account-gated validation must confirm that cap before activation.
- Terminal fixtures prove failed committed-row ingestion, mixed valid-row survival, deterministic diagnostic replay, failed empty-dataset safety, and missing-dataset safety.
- The previous export imported on 2026-07-20; exact-file import of this revised ingest-first export remains account-gated.
- The Make package names exact modules and mappings but is clearly marked draft.
- Internal-name and likely-secret scans pass within this product directory.

Run `node validation/validate-rss-package.mjs` to reproduce these checks.

## Release-coordinator gates still required

1. Validate each public feed immediately before Task creation because third-party feeds can change or disappear.
2. Create each saved Task in the existing Apify account.
3. Run each discovery Task and verify `SUCCEEDED`, less than five minutes, and a non-empty default dataset.
4. Publish each Task with the supplied metadata and the `overview` dataset view.
5. Independently verify the published landing page, displayed fields, masked secret field, result shape, and URL.
6. Create/select the n8n Data Table, connect an Apify credential, and execute the imported workflow against controlled success and terminal-failure runs.
7. Prove failed committed rows exist before status reporting, equal `itemKey` values from different feeds use distinct composite keys, mixed malformed rows do not block valid neighbors, diagnostics omit raw malformed values, and replay leaves one row per valid or run-row diagnostic key.
8. Build and export the Make scenario only after a user-owned Make account exists.

No live Apify Task was created or published during product-worker validation, and no credential was read or used.
