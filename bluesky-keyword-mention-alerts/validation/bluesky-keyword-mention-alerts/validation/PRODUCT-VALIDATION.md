# Product Validation Notes

Status: implementation-worker validation pending independent review and live publication checks.

## Source alignment

- Actor: `uplifted_novice_vbl/bluesky-keyword-mention-alerts`
- Accepted target fields: `keywords`, `handles`, and `hashtags`
- Total target limit: 20
- Actor output range: `maxPostsPerRun`, 1 through 800; included non-paginated workflows require `maxPostsPerRun <= 100` with retrieval limit 100
- Monitoring default: `onlyNew: true`
- Reset control: `resetState`, false in every public example
- Optional webhook: intentionally absent from every public example
- Dataset view: `overview`
- Required output fields are represented by `fixtures/sample-posts.json`

## Discovery design

The three public Task definitions deliberately use `onlyNew: false` and cap output at 10. They are discovery examples intended to remain repeatable and produce a visible landing-page dataset. Their selected targets are public, non-personal, and expected to be active, but each Task still requires a successful live run and non-empty dataset within 300 seconds before publication.

## Monitoring design

All monitoring documentation requires copying or editing one persistent Task, setting `onlyNew: true`, keeping `resetState: false`, enforcing `maxPostsPerRun <= 100` for the included workflows, and scheduling that same Task. It explicitly permits an empty dataset after a successful quiet run.

## n8n status

- JSON authored without a `credentials` object or API token.
- Uses verified Apify `Actor tasks` / **Run task** with **Wait for Finish**, then a separate `Datasets` / **Get items** operation keyed by the terminal run's `defaultDatasetId`.
- Sets `useCustomBody` to false, so the saved Task input and state semantics remain authoritative.
- Uses `alwaysOutputData` on dataset retrieval so failed empty datasets reach terminal reporting.
- Uses a fixed retrieval limit of 100 with no pagination; verification of the saved Task's `maxPostsPerRun <= 100` is an account gate.
- Upserts valid `bluesky:<postUri>` rows and sanitized deterministic run-row diagnostics into an n8n Data Table before the final node reports non-success; malformed raw values are not copied into diagnostics.
- Local fixtures prove failed committed-row ingestion, mixed valid-row survival, deterministic diagnostic replay, failed empty-dataset safety, and missing-dataset safety.
- The previous export imported on 2026-07-20; exact-file import of this revised ingest-first export remains account-gated.
- Credential selection, Data Table setup, authenticated execution, and account-owned export scrubbing remain account-gated.

## Make status

- Exact module order, fields, filters, mappings, error routes, and tests are documented.
- No blueprint is claimed because no Make editor export exists yet.
- Final blueprint publication is gated on account-owned import, live execution, export, and scrubbing.
- The specification fetches every available terminal dataset and reports failure only after Data Store persistence.

## Publication gates still owned by the release coordinator

1. Create each saved Task under the Actor owner account.
2. Run each Task and confirm `SUCCEEDED`, duration under 300 seconds, and at least one dataset item.
3. Configure Publication display information, selected input fields, and dataset view from each definition.
4. Obtain independent validator PASS.
5. Obtain independent adversarial reviewer PASS after resolving findings.
6. Publish and record Task IDs, public URLs, run IDs, durations, item counts, and timestamps.

## Local validation command

From this product directory:

```powershell
node validation/validate-package.mjs
```

The private release coordinator can additionally pass `--actor-readme=<path>` to include the deployed Actor README in the internal-name scan. Do not add a private workspace path to the public repository.
