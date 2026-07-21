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

The published examples use `onlyNew: false` and `maxPostsPerRun: 10`. This makes each discovery page repeatable, bounded, and likely to show a non-empty dataset when Apify or a visitor runs it. Discovery runs still update the Task's seen-post state, but prior state does not filter their output.

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
- `workflows/n8n/README.md`: account connection and test steps
- `workflows/make/README.md`: exact Make scenario implementation package
- `workflows/make/module-spec.json`: machine-readable module and mapping plan

The n8n workflow contains no API token or credential identifier. After import, set your persistent Apify Task ID and connect your own Apify API or OAuth credential. The Make package is a design specification, not a validated or exported Make blueprint; Make validation requires an account and editor-generated export.

## Cost controls

The Actor charges per run and per delivered post. With `onlyNew: true`, delivered posts are new to that persistent Task. With `onlyNew: false`, every delivered post is charged even if that Task has delivered it before. Keep `maxPostsPerRun` low while testing, use a schedule appropriate to the activity of the watched terms, and review the current price shown on the Apify Store listing before production use.

## Privacy and credentials

- Public examples contain no webhook URL, token, private URL, or personal identifier.
- Connect credentials inside n8n or Make; never paste them into a workflow export.
- Public posts may contain personal data. Process and retain results only for a lawful purpose.
