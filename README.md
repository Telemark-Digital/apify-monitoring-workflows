# Apify Monitoring Workflows

Public Apify Task configurations, validated n8n workflow examples, and Make construction specifications for monitoring Bluesky posts, RSS feeds, and TED procurement notices.

Created and maintained by **Telemark Digital**.

## Products

- [Bluesky Keyword & Mention Alerts](./bluesky-keyword-mention-alerts/) monitors public Bluesky posts for keywords, handles, mentions, and hashtags.
- [RSS Keyword Monitor](./rss-keyword-monitor/) filters RSS, Atom, and RDF feeds by keyword, regular expression, and exclusion rules.
- [TED Tender Monitor](./ted-tender-monitor/) finds new or changed EU procurement notices by CPV code, country, keyword, value, and notice type.

Each product directory contains public Apify Task inputs, a platform-neutral workflow contract, an n8n workflow, a Make implementation package, fixtures, and validation notes.

## AI client plugins

Foundational Codex, ChatGPT desktop, and Claude Code plugin packages are included under [plugins](./plugins/). Each plugin exposes exactly one public Apify Actor through Apify MCP with OAuth and includes a product-specific skill that keeps bounded one-off discovery separate from saved-Task monitoring.

These plugin files are not official marketplace submissions yet. See [AI Client Plugin Marketplaces](./docs/ai-plugin-marketplaces.md) for the package layout, safe usage boundary, and validation gates.

Public product icons are in [assets/icons](./assets/icons/) using clean external filenames. The AI-client plugin manifests omit optional icon fields for this release so the plugin packages remain text-only and easy to publish through GitHub's web editor.

## Terminal-run reliability

Actor runs can commit dataset records before ending `FAILED`, `TIMED-OUT`, or `ABORTED`. For each terminal run they process, the public workflows fetch the run's `defaultDatasetId` when present, persist records under stable product-prefixed keys, and only then expose or report the terminal status. Failed empty datasets and runs without a dataset ID are reported safely. The terminal fixtures also prove replay idempotency, and the TED fixture confirms that `title: null` remains valid.

For Make, the construction specifications use Apify's maximum 1000-run task-runs page, one exact-key data-store cursor per Task, cursor-filtered reverse-page processing, first-run cursor priming, and an overflow stop whenever the fetched page does not contain the stored cursor run. Each publication template processes at most one selected Task run per scenario execution (`maxRunsPerScenarioExecution = 1`) so operation budgets stay bounded; if an account needs a longer outage window than `1000 * Apify Schedule interval`, add paginated backfill before activation.

In each n8n export, dataset retrieval and Data Table upsert retry the same operation in place up to three times, waiting five seconds between attempts. These retries keep the original `defaultDatasetId` and stable delivery key and never rerun the Apify Task. If either operation still fails after its retries, perform manual recovery using the original run ID and its dataset; this package does not claim automatic exactly-once delivery.

## Non-paginated delivery caps

The included n8n workflows and Make specifications intentionally make one non-paginated dataset request per Task run. Full retrieval therefore depends on the saved Task cap:

| Product | Saved Task cap | Fixed retrieval limit | Reserved control rows |
| --- | --- | --- | --- |
| Bluesky | `maxPostsPerRun <= 100` | `100` | None |
| RSS | `maxItemsPerRun <= 200` | `200` | None |
| TED | `maxNewPerRun <= 999` | `1000` | Exactly one appended summary row (`999 + 1 = 1000`) |

Do not activate a workflow until the account owner has verified the matching saved Task setting. Raising a cap requires a separately designed, documented, and validated paginated workflow; it is outside this package.

## Security

These examples contain no credentials. Connect your own Apify and destination accounts after importing a workflow. Read [SECURITY.md](./SECURITY.md) before publishing or modifying an export.

## Repository status

The examples are prepared and validated locally before publication. The repository currently contains Make construction specifications, not blueprints. A blueprint will exist only after the corresponding scenario has been built, run, exported from Make, scrubbed, and re-imported successfully.

See [Account Gates](./docs/account-gates.md) for the GitHub publisher, n8n Creator Portal, optional n8n Cloud, and Make publication steps.
