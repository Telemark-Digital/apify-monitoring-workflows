# Platform submission checklist

Use this checklist for each of the three product directories. A local JSON import is useful evidence, but it is not proof that an authenticated workflow runs or that a public template has been accepted.

## n8n

- Import the exact allowlisted workflow JSON into the current n8n Cloud release.
- Install the verified `@apify/n8n-nodes-apify` community package when the instance does not already have it.
- Confirm the workflow opens without unknown-node or expression errors.
- Create an Apify credential in n8n's credential manager. Do not add it to the public JSON.
- Replace `PASTEYOURTASKID` only in the private validation copy and select the matching persistent Task.
- Verify the workflow is non-paginated and the saved Task cap guarantees full retrieval: Bluesky `maxPostsPerRun <= 100` with limit 100; RSS `maxItemsPerRun <= 200` with limit 200; TED `maxNewPerRun <= 999` with limit 1000 because exactly one summary row is appended.
- Run a bounded non-empty case, then the immediate only-new quiet case.
- Test an invalid Task plus `FAILED`, `TIMED-OUT`, and `ABORTED` runs with committed rows. Verify each row exists in the Data Table before terminal failure is surfaced.
- Replay the same terminal dataset and prove each product-prefixed key still has exactly one row. Test failed empty and missing-dataset runs separately.
- Confirm **Fetch terminal run dataset** and the Data Table upsert each retry in place at most three times with a five-second wait, preserving the original run/dataset ID and stable key. Confirm the Task-run node has no retry setting.
- Force each retry path to exhaust, then prove manual recovery using the original run ID succeeds without rerunning the Task. Do not describe the workflow as automatic exactly-once delivery.
- For TED, import a tender with `title:null` and verify it is persisted and exposed with null preserved.
- For TED, verify a maximum-size run can contain 999 tender rows plus exactly one summary control row without truncation.
- For RSS, verify two records with the same `itemKey` from different `feedUrl` values persist under distinct URL-encoded composite keys, and replay of either record remains idempotent.
- Download the publication candidate, remove credential bindings and private Task IDs, and compare it with the allowlisted file.
- Re-import that exact scrubbed file into a fresh workflow and repeat the import checks.
- Complete the n8n Creator Portal submission fields using the public product name and evidence. Record the submission URL and status.

## Make

- Build the scenario from the structured Make specification using `Apify - Watch Task Runs` as the instant trigger.
- Create the recommended Apify OAuth connection in Make's credential manager. Do not place a token in a module field.
- Create a Task-scoped webhook for the selected persistent Task and choose every finished run event.
- Set **Store incomplete executions** to **Yes**.
- Reproduce every module, filter, mapping, retrieval limit, diagnostic branch, and Retry handler in the specification.
- Confirm pagination is disabled and the saved Task cap matches the fixed retrieval limit: Bluesky 100/100, RSS 200/200, and TED 999 tender rows plus one summary row/1000.
- Keep the scenario inactive until a complete run-once test has passed.
- Run the non-empty, quiet, invalid-record, terminal-with-committed-rows, replay, failed-empty, missing-dataset, dataset-retry, and data-store-retry cases listed by the product package. Confirm status diagnostics follow persistence. Inject a post-commit timeout and prove the stable key leaves exactly one record.
- Export the blueprint, remove connection and webhook identifiers, and scan it for credentials, private URLs, internal names, and personal data.
- Import that exact scrubbed blueprint into a fresh empty team or clean account, reconnect credentials, save, and activate it.
- Verify Make recreated the Task-scoped watcher webhook, then repeat the full test matrix.
- Complete the public template submission fields using the public product name and evidence. Record the submission URL and status.

## Publication evidence

- Exact public file or blueprint hash
- Platform and version
- Private validation workflow or scenario ID
- Apify Task ID and Actor public URL
- Successful run ID, duration, and dataset item count
- Quiet-run evidence
- Failure-route and retry evidence
- Credential and internal-name scan result
- Independent validator PASS
- Separate adversarial PASS
- Public submission URL and review status

Never publish screenshots, exports, or logs containing credentials, private webhook URLs, connection identifiers, personal information, or private Task inputs.
