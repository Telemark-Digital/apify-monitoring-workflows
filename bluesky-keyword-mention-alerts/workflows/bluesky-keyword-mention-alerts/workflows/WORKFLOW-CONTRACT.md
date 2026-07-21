# Bluesky Alert Workflow Contract

## Purpose

Run one existing persistent Apify Task for Bluesky Keyword & Mention Alerts, wait for a terminal result, ingest that run's committed dataset records under stable keys, and only then expose the records and terminal status.

## Required configuration

- One user-owned persistent Apify Task created from the public Actor
- Task input with `onlyNew: true`, `resetState: false`, and `maxPostsPerRun <= 100`
- An Apify API credential stored in the workflow platform's credential manager
- A canonical workflow store: n8n Data Table or Make Data Store, with overwrite/upsert enabled on `bluesky:<postUri>`
- A schedule selected by the user whose interval is strictly longer than the saved Task's configured hard timeout

The Task ID is configuration, not a secret. The API token is a secret and must never appear in workflow JSON, logs, URLs, fixtures, or screenshots.

## Execution sequence

Two launch profiles satisfy this contract:

- n8n: trigger manually for testing or on an n8n schedule, then run the configured persistent Task.
- Make: an Apify Schedule runs the configured persistent Task; **Watch Task Runs** starts the Make scenario for every finished run of that Task.

1. Start from the selected launch profile while reusing the same persistent Task.
2. Run or observe the configured Task without overriding its input, build, memory, or timeout.
3. Retain the terminal run ID, status, and `defaultDatasetId`. In n8n, verified `@apify/n8n-nodes-apify` 0.6.10 **Run task** with **Wait for Finish** returns this run object for every terminal status; do not use its success-gated combined operation.
4. When `defaultDatasetId` exists, fetch up to the fixed limit of 100 items regardless of `SUCCEEDED`, `FAILED`, `TIMED-OUT`, or `ABORTED` status. This contract is intentionally non-paginated, so the saved Task cap must remain at or below 100.
5. Normalize each valid post and upsert it under `bluesky:<postUri>`. Convert each malformed non-empty row to a sanitized `bluesky:diagnostic:<encodedRunId>:row:<datasetIndex>` record without copying raw malformed values. A retry or replay replaces the same valid or diagnostic row, and one malformed row never suppresses valid neighbors.
6. After every valid and diagnostic row is persisted, expose the normalized records, valid/diagnostic counts, and terminal outcome. n8n reports a non-success status by failing the final status node; Make records a post-persistence diagnostic and ends the instant-triggered branch normally.
7. If the fetched dataset is empty, report zero persisted records safely. If no dataset ID exists, make no dataset request and report that condition safely.

## Normalized downstream object

```json
{
  "postUri": "at://did:plc:example/app.bsky.feed.post/example",
  "postUrl": "https://bsky.app/profile/example.bsky.social/post/example",
  "authorHandle": "example.bsky.social",
  "authorDisplayName": "Example account",
  "text": "Example matched post",
  "createdAt": "2026-07-20T10:00:00.000Z",
  "matchedTerms": ["example"],
  "matchSource": "keyword",
  "isNew": true,
  "metrics": {
    "likes": 0,
    "reposts": 0,
    "replies": 0,
    "quotes": 0
  }
}
```

## State rules

- The workflow runs a saved Task; it does not call the Actor with a new ad-hoc input.
- It never sets `resetState`.
- It does not override `onlyNew`.
- A first run can contain the initial lookback; subsequent runs can be empty.
- Retrying the same Task preserves the Actor's Task-keyed deduplication behavior.
- Retrying dataset retrieval or persistence never reruns the Task and never changes the `bluesky:<postUri>` key.
- The Actor's Task-state lease is the mutual-exclusion mechanism: a contender must stop before delivery or charging. For both n8n and Apify Schedule launch profiles, also configure the schedule interval strictly longer than the saved Task's hard timeout to reduce avoidable contention; cadence alone is not a lock.

## Acceptance tests

1. Import contains no credential object, token, private URL, or webhook URL.
2. Manual execution returns the terminal run ID, status, and `defaultDatasetId` before dataset retrieval.
3. Every terminal run with a dataset ID fetches that exact dataset, including `FAILED`, `TIMED-OUT`, and `ABORTED`; the retrieval limit is 100, pagination is absent, and account-gated validation confirms `maxPostsPerRun <= 100` before activation.
4. A non-empty fixture maps to the normalized object without losing the post URI or URL.
5. An empty dataset reports zero persisted records without manufacturing an alert; a missing dataset ID makes no retrieval request.
6. A failed run with committed rows upserts them before n8n fails or Make records the terminal diagnostic. Replaying the fixture leaves exactly one row per `bluesky:<postUri>` key.
7. A mixed valid/malformed failed dataset preserves its valid post plus one sanitized run-row diagnostic before reporting terminal failure; replay leaves exactly those same keys.
8. Two consecutive executions use the same Task ID.
9. A forced concurrent run is rejected before dataset delivery or charging, and the activated schedule interval is strictly longer than the selected Task's hard timeout as a separate cadence guard.
