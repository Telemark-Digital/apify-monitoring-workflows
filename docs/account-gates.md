# Account Gates

Most assets in this repository can be prepared without cloud workflow accounts. Publication and final platform validation happen only after the account owner completes account creation, recovery, and two-factor authentication.

## GitHub

Use a dedicated maintainer personal account operated by one accountable person; never share that login. Put the repository in the public `telemark-digital` organization rather than the maintainer's personal namespace.

The organization and maintainer should be transparently attributable to `Telemark Digital`. This separation is a credential and repository boundary, not an anonymous identity.

1. Create the maintainer account with no access to private repositories.
2. Enable a secure two-factor method and retain recovery codes securely.
3. Create the `telemark-digital` organization and require secure two-factor authentication.
4. Before publication, either add a second trusted human owner with secure 2FA, or complete a single-owner contingency with two independent secure authentication methods, offline recovery codes, a dedicated recovery email, and a documented organization-recovery record.
5. Use either a write-enabled deploy key attached only to `apify-monitoring-workflows`, or a fine-grained token restricted to that repository. Do not rely on an account-wide personal SSH key for this boundary.
6. Create an empty public repository named `apify-monitoring-workflows`.
7. Run `npm run validate` before Git initialization and immediately before each push.
8. Set repository-local `user.name` and GitHub's ID-based `noreply` commit email before the first commit; do not rely on global Git identity.
9. Review the complete first commit and enable GitHub security features.
10. Enable private vulnerability reporting for the repository, verify the **Report a vulnerability** path is available, and confirm security-advisory notifications reach the responsible maintainer before publishing `SECURITY.md`.

## n8n

Earlier workflow revisions imported successfully into an isolated local n8n 2.30.8 instance. The current revised files have not all been imported exactly; exact-file import is an external account gate for each current candidate. The n8n Creator Portal is the public template-submission surface; n8n Cloud is a separate, optional hosted validation workspace.

1. Create a Creator Portal account and set the public creator name to `Telemark Digital`.
2. Choose one mandatory live-validation environment: n8n Cloud, or the retained isolated local/self-hosted n8n instance. Creator Portal alone cannot execute workflows.
3. Keep the chosen execution workspace isolated from private workflows, customer data, and private credentials.
4. Import one workflow at a time.
5. Connect a newly created Apify credential inside n8n.
6. Configure the user's persistent Apify Task ID and verify its delivery cap: Bluesky `maxPostsPerRun <= 100`, RSS `maxItemsPerRun <= 200`, or TED `maxNewPerRun <= 999`. The workflows are non-paginated; TED's retrieval limit of 1000 reserves one row for the appended summary.
7. Connect the destination account, such as Slack, Microsoft Teams, or Google Sheets.
8. Run the workflow with the cap-verified bounded test Task and confirm the fixed retrieval limit is 100 for Bluesky, 200 for RSS, or 1000 for TED.
9. Verify a successful-result run and a valid empty-result run.
10. Export again; scrub credential names and IDs, authorization headers, tokens, webhook URLs, pinned data, execution data, personal records, and internal names; then rerun repository validation.
11. Submit each sanitized workflow separately through Creator Portal and verify the public attribution preview.

Creator Portal: <https://creators.n8n.io/hub>

## Make

Make has no local runtime equivalent for authoritative blueprint validation. The implementation packages in this repository therefore remain drafts until the following steps pass:

1. Create the `Telemark Digital` Make organization. Select the EU data region carefully because Make does not allow changing it later.
2. Register the human user accurately, set the organization timezone to `Europe/Oslo`, and use `Public Integrations` as the sole/default team on lower plans or a dedicated team when the plan supports multiple teams.
3. Keep the organization free of private scenarios, customer data, connections, webhooks, keys, and data stores.
4. Build or import the scenario in Make.
5. Connect the user's limited Apify connection, select the persistent Task, and verify its delivery cap: Bluesky `maxPostsPerRun <= 100`, RSS `maxItemsPerRun <= 200`, or TED `maxNewPerRun <= 999` because TED appends one summary row.
6. Create or select the shared monitor-deliveries Make data store with `product`, `sourceId`, `sourceUrl`, `title`, `observedAt`, and `payloadJson` fields.
7. Run once with sample data and once with an empty result.
8. Validate mappings, filters, error handling, scheduling, operation counts, disabled pagination, and the fixed retrieval limit: 100 for Bluesky, 200 for RSS, or 1000 for TED. Inject a post-commit timeout at **Add/Replace a Record** and prove retry leaves exactly one product-prefixed stable key.
9. Export the blueprint from Make, remove connection identifiers and private data, and scan the exact file. It remains a candidate at this point.
10. Import that exact scrubbed export into a fresh empty validation organization/team or separate clean Make account and reconnect credentials there.
11. Complete both a result-producing run and a valid empty-result run from the re-imported export, then repeat the exactly-one-record post-commit test.
12. Obtain independent validator PASS and separate adversarial PASS on that exact export and its run evidence.
13. Enable and inspect the public scenario page, using accurate human account fields and Telemark Digital only in a separate public display field when Make permits it.
14. Create and publish a team template.
15. Select **Request approval** to submit the tested template to Make's public library.

Publishing a team template creates a shareable link. Inclusion in Make's public template library is a separate review and approval step.

