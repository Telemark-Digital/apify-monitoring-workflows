# Bluesky Keyword & Mention Alerts

Monitor public Bluesky posts for keywords, phrases, handles, mentions, and hashtags. The Actor writes structured dataset items and can return only posts that a persistent Apify Task has not delivered before.

This package contains public examples and workflow templates for [Bluesky Keyword & Mention Alerts on Apify](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts).

> Unofficial and independent. This Actor is not affiliated with, endorsed by, or sponsored by Bluesky Social PBC.

## Choose a public example

| Goal | Example | Discovery target |
| --- | --- | --- |
| Find current keyword matches | `apify-tasks/find-bluesky-keyword-posts.json` | `bluesky` |
| Find brand-handle posts and mentions | `apify-tasks/find-bluesky-brand-mentions.json` | `bsky.app` |
| Find current hashtag matches | `apify-tasks/find-bluesky-hashtag-posts.json` | `photography` |
| Monitor product launch keywords | `apify-tasks/monitor-bluesky-product-launch-keywords.json` | `product launch`, `new product`, `launching today` |
| Monitor developer tools launches | `apify-tasks/monitor-bluesky-devtools-launches.json` | `developer tools`, `devtools`, `API launch` |
| Track open-source maintainers | `apify-tasks/track-bluesky-open-source-maintainers.json` | `open source`, `maintainer`, `GitHub` |
| Track brand and competitor handles | `apify-tasks/track-bluesky-brand-competitor-mentions.json` | `bsky.app`, `github.com` |
| Monitor AI policy posts | `apify-tasks/monitor-bluesky-ai-policy-posts.json` | `AI policy`, `AI regulation`, `AI governance` |
| Track security keywords | `apify-tasks/track-bluesky-security-keywords.json` | `cybersecurity`, `data breach`, `vulnerability` |
| Track data breach discussion | `apify-tasks/track-bluesky-data-breach-discussions.json` | `data breach`, `security incident`, `leaked data` |
| Monitor startup funding posts | `apify-tasks/monitor-bluesky-startup-funding-posts.json` | `startup funding`, `funding round`, `raised funding` |

The published examples use `onlyNew: false` and `maxPostsPerRun: 10`. This makes each discovery page repeatable, bounded, and likely to show a non-empty dataset when Apify or a visitor runs it. Discovery runs still update the Task's seen-post state, but prior state does not filter their output.

Live Apify Examples pages:

- [Find Bluesky keyword posts](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/find-bluesky-keyword-posts)
- [Find Bluesky brand mentions](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/find-bluesky-brand-mentions)
- [Find Bluesky hashtag posts](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/find-bluesky-hashtag-posts)
- [Monitor Bluesky product launch keywords](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/monitor-bluesky-product-launch-keywords)
- [Monitor Bluesky devtools launches](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/monitor-bluesky-devtools-launches)
- [Track Bluesky open source maintainers](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/track-bluesky-open-source-maintainers)
- [Track Bluesky brand and competitor handles](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/track-bluesky-brand-competitor-mentions)
- [Monitor Bluesky AI policy posts](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/monitor-bluesky-ai-policy-posts)
- [Track Bluesky security keywords](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/track-bluesky-security-keywords)
- [Track Bluesky data breach discussions](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/track-bluesky-data-breach-discussions)
- [Monitor Bluesky startup funding posts](https://apify.com/uplifted_novice_vbl/bluesky-keyword-mention-alerts/examples/monitor-bluesky-startup-funding-posts)

## Turn an example into monitoring

1. Copy the public example into your Apify account.
2. Keep it as one persistent Task. Do not launch a fresh Actor configuration on every poll.
3. Change `onlyNew` to `true`.
4. Choose a cap appropriate to your budget; start with `maxPostsPerRun: 25`. When using either included non-paginated automation workflow, keep `maxPostsPerRun <= 100` because dataset retrieval is fixed at 100.
5. Run once to establish the Task's state, then attach an Apify Schedule or use the included workflow.

The first monitoring run can return matches from the initial lookback. Later runs return only records not previously delivered to that Task. A successful quiet run can therefore have an empty dataset.

The included n8n workflow and Make specification do not paginate dataset retrieval. Their saved-Task account gate is `maxPostsPerRun <= 100` with a fixed retrieval limit of 100; do not activate either workflow until that Task setting has been verified.

Do not set `resetState: true` on a schedule. It erases that Task's cursor and seen-post history.

The Actor holds an exclusive Task-state lease through recovery, delivery, and state commit; a concurrent contender stops before delivery or charging. Set the schedule interval longer than the Task's hard timeout to avoid needless contention.

## Output

Each dataset item represents one matched public post. Important fields include:

- `uri`: stable post identity used for deduplication
- `url`: human-readable Bluesky post link
- `author.handle`: author handle
- `text`: post text
- `matchedTerms`: input terms that matched
- `source`: `keyword`, `handle`, `mention`, or `hashtag`
- `isNew`: whether the post was new to the Task on this run

See `fixtures/sample-posts.json` for sanitized example records.

## Workflow packages

- `workflows/WORKFLOW-CONTRACT.md`: platform-neutral behavior and acceptance rules
- `workflows/n8n/bluesky-alerts-task-to-json.json`: importable credential-free n8n workflow
- `workflows/n8n/README.md`: account connection and test steps; public n8n Creator submission `18103` is under review
- `workflows/make/README.md`: exact Make scenario implementation package
- `workflows/make/module-spec.json`: machine-readable module and mapping plan
- [Bluesky Keyword and Mention Alerts on Make](https://us2.make.com/public/shared-scenario/FtrDlcux4Vr/bluesky-keyword-and-mention-alerts-from): live public shared scenario

The n8n workflow contains no API token or credential identifier. After import, set your persistent Apify Task ID and connect your own Apify API or OAuth credential. The repository's Make package remains a credential-free design specification; the linked scenario is the validated public Make implementation.

## Cost controls

The Actor charges per run and per delivered post. With `onlyNew: true`, delivered posts are new to that persistent Task. With `onlyNew: false`, every delivered post is charged even if that Task has delivered it before. Keep `maxPostsPerRun` low while testing, use a schedule appropriate to the activity of the watched terms, and review the current price shown on the Apify Store listing before production use.

## Privacy and credentials

- Public examples contain no webhook URL, token, private URL, or personal identifier.
- Connect credentials inside n8n or Make; never paste them into a workflow export.
- Public posts may contain personal data. Process and retain results only for a lawful purpose.
