# Validation Notes

## Package status

Author implementation is complete. Local structural and Actor tests passed on 2026-07-21. Independent validation and adversarial review remain separate release gates and must be recorded by the release coordinator before publication.

## Local acceptance checklist

- Actor README uses the public product name and contains no internal codename.
- `webhookUrl` and `webhookSecret` are marked secret in the Actor input schema.
- Three Task packages use `sampleMode: true`, bounded CPV/country filters, and no webhook fields.
- Task publication metadata includes a goal-focused slug, SEO title, SEO description, displayed input fields, and the `overview` dataset view.
- Fixture records conform to the Actor's tender and summary field shapes and contain synthetic identifiers and names.
- n8n workflow uses persistent-Task **Run task** plus separate dataset retrieval, has no input override, and has no credential binding.
- n8n and Make use fixed non-paginated retrieval limit 1000 and require saved Task `maxNewPerRun <= 999`, reserving one row for the Actor's exactly one appended summary control record.
- n8n upserts every dataset row before terminal reporting; identified tenders use `ted:<publicationNumber>` and other rows use deterministic run-row keys.
- TED `title:null` is accepted, preserved in payload/normalized output, and may receive only a display fallback.
- Terminal fixtures prove failed committed-row ingestion, replay idempotency, failed empty-dataset safety, and missing-dataset safety.
- Make package is explicitly marked DRAFT and specifies disjoint module 13 and module 14 Data store sinks, mappings, filters, error routes, and account-gated retry tests for both keys.

## Account-gated checks

These checks cannot be claimed complete until the relevant accounts or authenticated publication surface exist:

1. Create, run, and publish each Apify Task from the existing publisher account.
2. Confirm every discovery run succeeds within five minutes and has a non-empty default dataset.
3. Record Task IDs, landing-page URLs, run IDs, durations, and dataset counts.
4. Connect an Apify credential, select a primed persistent Task, verify `maxNewPerRun <= 999`, and validate quiet and tender-producing runs including the one summary control row.
5. Build the Make scenario, run all error-path tests including independent post-commit retries for modules 13 and 14, export it from Make, and perform a fresh-account import.

Run the product validator from this product directory:

```powershell
node validation/validate-ted-package.mjs
```

## Evidence template

| Check | Result | Evidence |
|---|---|---|
| Actor tests | PASS | `npm.cmd test` on 2026-07-21: 5 files, 45 tests passed |
| TypeScript typecheck | PASS | `npm.cmd run typecheck` |
| Task input parser | PASS | All three inputs accepted by the Actor's `parseInput` implementation |
| JSON and package structure | PASS | Product validator parses Tasks, fixtures, workflow, and Make specification |
| Dataset fixture contract | PASS | Representative output plus terminal recovery and null-title scenarios |
| n8n static contract | PASS | Terminal metadata, separate retrieval, stable-key Data Table upsert, then status reporting |
| Internal-name scan | PASS | Zero findings in the public product package and modified Actor fields |
| Credential-pattern scan | PASS | Zero findings in the public product package |
| Independent validator | PENDING | Reviewer report |
| Adversarial reviewer | PENDING | Reviewer report |
| Live Apify Tasks | ACCOUNT GATE | IDs, URLs, run evidence |
| Fresh n8n import | ACCOUNT GATE | Revised ingest-first export requires exact-file import in n8n 2.30.8 or current release |
| Make blueprint | ACCOUNT GATE | Make-exported blueprint and run evidence |
