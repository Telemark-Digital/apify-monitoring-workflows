# TED Tender Monitor - EU Procurement Alerts

Public examples for monitoring official TED procurement notices with the [TED Tender Monitor - EU Procurement Alerts Actor](https://apify.com/uplifted_novice_vbl/ted-tender-watch).

This is an unofficial, independent community tool. It is not affiliated with, endorsed by, or operated by TED, the European Union, or the Publications Office of the European Union.

## Included examples

- `apify-tasks/`: three bounded discovery Tasks for CPV, country plus keyword, and JSON notice output.
- `workflow-contract.md`: the platform-neutral contract for reliable scheduled monitoring.
- `n8n/ted-tender-monitor.json`: an importable, credential-free workflow using a persistent Apify Task.
- `make/implementation.md`: the credential-free specification for the live [TED Tender Alerts public Make scenario](https://us2.make.com/public/shared-scenario/udxoD7qdzBB/ted-tender-alerts-from-a-persistent-apif).
- `fixtures/sample-output.json`: sanitized representative dataset records.
- `VALIDATION.md`: completed local checks and account-gated checks still required.

## Discovery and monitoring are different

The public discovery Tasks use `sampleMode: true`. They return up to ten recent matching notices immediately, write no state, and omit all webhook fields.

For ongoing monitoring, copy a Task into your own Apify account, set `sampleMode` to `false`, and keep using that same persistent Task. The first non-sample run primes the Task's state and returns a `prime` record without delivering historical tenders. Later runs return only new or changed matching notices plus exactly one appended `summary` record. A quiet run can legitimately contain only the summary.

The included n8n workflow and Make specification intentionally retrieve one non-paginated page with limit 1000. Set `maxNewPerRun <= 999` so all tender rows plus the one summary control row fit. Verifying that saved Task cap is an account gate before activation.

Do not create a fresh Actor configuration on every scheduled run. Persistent Task identity is what keeps the monitoring state and deduplication behavior predictable.

## Quick start

1. Try one of the public Task configurations in `apify-tasks/` with sample mode enabled.
2. Copy it to a persistent Task in your Apify account.
3. Set `sampleMode` to `false` and run once to prime it.
4. Set `maxNewPerRun <= 999` for the included workflows, then run the same Task again or attach an Apify schedule.
5. Connect the Task to n8n or Make only after the Task itself has passed a prime run and a follow-up run and the saved cap has been verified.

Webhook destinations and signing secrets are intentionally absent from every public example. Configure them only in your private Task input when direct push delivery is required.

## Data source and pricing

The Actor uses the official keyless TED Search API and returns structured JSON. It charges `$0.005` for each newly delivered or changed tender. Sample runs, first-run priming, duplicates, quiet runs, and failures before the final charge step do not trigger tender event charges. Normal Apify platform usage may still apply under the user's Apify plan.

## Documentation

- [Publish an Apify Task](https://docs.apify.com/actors/publishing/publish-task)
- [Apify n8n integration](https://docs.apify.com/integrations/n8n)
- [Apify Make integration](https://docs.apify.com/integrations/make)
