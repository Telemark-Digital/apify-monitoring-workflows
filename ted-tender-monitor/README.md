# TED Tender Monitor - EU Tender Alerts & CPV

Public examples for monitoring official TED procurement notices with the [TED Tender Monitor - EU Tender Alerts & CPV Actor](https://apify.com/uplifted_novice_vbl/ted-tender-watch).

This is an unofficial, independent community tool. It is not affiliated with, endorsed by, or operated by TED, the European Union, or the Publications Office of the European Union.

## Included examples

- `apify-tasks/`: thirteen bounded discovery Tasks for CPV, country, keyword, change-notice, and JSON notice-output searches.
- `workflow-contract.md`: the platform-neutral contract for reliable scheduled monitoring.
- `n8n/ted-tender-monitor.json`: an importable, credential-free workflow using a persistent Apify Task; the public n8n template is live at https://n8n.io/workflows/18030-monitor-eu-ted-tenders-with-apify-and-store-notices-in-n8n-data-tables/.
- `make/implementation.md`: the credential-free specification for the live [TED Tender Alerts public Make scenario](https://us2.make.com/public/shared-scenario/udxoD7qdzBB/ted-tender-alerts-from-a-persistent-apif).
- `fixtures/sample-output.json`: sanitized representative dataset records.
- `VALIDATION.md`: completed local checks and account-gated checks still required.

## Public Apify Task examples

Each example below is published on the Actor's Apify Examples tab, uses `sampleMode: true`, and can be copied into a persistent scheduled Task after the user is ready to monitor only new or changed TED notices.

| Use case | Public example |
|---|---|
| EU AI procurement notices | [monitor-eu-ai-procurement-notices](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/monitor-eu-ai-procurement-notices) |
| EU cybersecurity tenders | [track-eu-cybersecurity-tenders](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/track-eu-cybersecurity-tenders) |
| EU healthcare tenders | [find-eu-healthcare-tenders](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/find-eu-healthcare-tenders) |
| French medical equipment tenders | [find-french-medical-equipment-tenders](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/find-french-medical-equipment-tenders) |
| Public sector SaaS tenders | [monitor-public-sector-saas-tenders](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/monitor-public-sector-saas-tenders) |
| EU construction procurement | [track-eu-construction-procurement](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/track-eu-construction-procurement) |
| Renewable energy procurement | [monitor-eu-renewable-energy-procurement](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/monitor-eu-renewable-energy-procurement) |
| CPV 72 software tenders | [watch-cpv-72-software-tenders](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/watch-cpv-72-software-tenders) |
| Polish IT services tenders | [find-polish-it-services-tenders](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/find-polish-it-services-tenders) |
| TED change notices and corrigenda | [track-ted-change-notices-and-corrigenda](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/track-ted-change-notices-and-corrigenda) |
| German managed detection tenders | [find-german-cybersecurity-tenders](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/find-german-cybersecurity-tenders) |
| Recent EU procurement JSON preview | [preview-recent-eu-procurement-notices-as-json](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/preview-recent-eu-procurement-notices-as-json) |
| EU software tenders by CPV | [preview-eu-software-tenders-by-cpv](https://apify.com/uplifted_novice_vbl/ted-tender-watch/examples/preview-eu-software-tenders-by-cpv) |

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
