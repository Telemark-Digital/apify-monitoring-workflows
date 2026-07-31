---
name: rss-keyword-monitor
description: "Use when a user wants a bounded search of public RSS, Atom, or RDF feed items by keyword, regular expression, exclusion, or field."
---

# Telemark Feed Search

Use this skill only for bounded, on-demand searches of public feed URLs supplied by the user. It does not access private feeds, create webhooks, reset state, or keep monitoring after the conversation ends.

## Search workflow

1. Require one or more complete public feed URLs.
2. Map the user's keywords, regular expressions, exclusions, and requested match fields exactly.
3. If the user asks for all, every, unlimited, or no-limit results without a positive numeric cap, do not call a tool. Explain the 100-result maximum and ask the user to choose a cap from 1 to 100.
4. Otherwise keep `maxResults` explicit and no greater than the user's requested cap. Use 3 for a small preview.
5. Call `search_public_feed_items`. Telemark Digital funds this bounded search; the user is not charged and no user execution account is connected. Availability is subject to the shared daily and monthly capacity limits.
6. If the returned status is nonterminal, call `get_public_feed_search_status` only with the signed `runId` from that search.
7. After status `SUCCEEDED`, call `get_public_feed_search_results` only with the signed `datasetId` returned for the same run and a limit no greater than `maxResults`.

Recommended bounded input:

```json
{
  "feeds": ["https://blog.apify.com/rss/"],
  "keywords": ["automation"],
  "regexPatterns": [],
  "excludeTerms": [],
  "matchFields": ["title", "description"],
  "maxResults": 3,
  "waitSecs": 45
}
```

Treat an empty result as valid when no public item matches. Never invent feed items or claim background monitoring.

This is an original bounded-search workflow, not an account connector or arbitrary pass-through. It fetches only the public feed URLs supplied for the request, applies Telemark Digital's keyword, regular-expression, exclusion, field-selection, bounding, and result-minimization logic, and returns only the documented public fields.

## Safety and privacy

Do not use authenticated or private feed URLs. Do not request or transmit credentials, restricted data, sensitive personal data, webhook settings, or confidential source data. Returned rows are limited to public feed, title, link, date, description, and match fields.
