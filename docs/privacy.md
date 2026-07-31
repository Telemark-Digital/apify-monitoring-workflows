# Privacy Policy

Effective date: July 31, 2026

This Privacy Policy describes how Telemark Digital ("Telemark," "we," "us," or "our") handles information when you use Telemark Feed Search, Telemark Public Post Search, or Telemark Procurement Search through an AI client, or contact us for support.

## How the service works

Each app connects to a product-specific Telemark Digital MCP gateway. Access uses a one-click pseudonymous authorization flow and does not require a user account, email address, password, payment method, MFA, or a user-owned execution-provider account. The gateway accepts a deliberately limited search schema, pins each request to one Telemark Digital-funded execution service, and returns a minimized result through the AI client. The public gateway does not expose webhook, secret, reset-state, shared-state, private-source, or arbitrary storage inputs.

## Information processed

Depending on the app and your request, the service may process:

- public feed URLs, keywords, regular expressions, exclusions, match fields, and bounded result limits;
- public-post keywords, exclusions, language filters, and bounded result limits;
- public-procurement classification, country, notice-type, keyword, value, date-window, and bounded result filters;
- public result fields needed to answer the request, such as feed item titles and links, public post text and public URLs, or procurement notice titles, public buyer organizations, classification codes, values, and notice links;
- a random pseudonymous browser-session identifier, signed authorization artifacts, and a one-way hash of that pseudonymous identifier used to enforce shared daily capacity;
- aggregate execution-cost reservations and usage-cycle totals used to enforce the Telemark-funded monthly ceiling;
- technical request and response data needed to authenticate, secure, and route an MCP call; and
- information you choose to send in a support request.

The apps do not accept credentials, authentication secrets, private feed URLs, private posts, confidential customer data, health or biometric data, social-security or government identity numbers, payment-card data, or other restricted or sensitive personal data. Do not submit that information.

## Data minimization

The public result tools remove internal run and storage identifiers and nonessential source metadata. Feed results omit author and full-content fields. Public-post results omit decentralized identifiers, content identifiers, avatars, engagement counts, and nonessential profile fields. Procurement results omit internal state keys, notice UUIDs, charge counters, and control rows.

Run and dataset references returned by the gateway are signed, product-scoped, short-lived capabilities. They can be used only for the originating product run and its result dataset.

## Storage and retention

The service does not create a named Telemark application account for the user and does not ask for or store a user execution-provider credential. Authorization artifacts are signed and self-contained: an authorization code expires after 5 minutes, an access token after 4 hours, a refresh token after 30 days, and signed run/result references after 24 hours. The authorization server sets a secure, HTTP-only pseudonymous subject cookie for up to 1 year so the same browser can share the portfolio's daily capacity; the user can remove it by clearing site data. The AI client may retain its refresh token according to that client's controls.

The budget service stores a one-way pseudonymous subject hash with a daily counter, temporary run reservations, and aggregate usage-cycle amounts. These records enforce the 30-search daily limit and the shared Telemark-funded monthly ceiling; they are not used for advertising, profiling, or identifying a person. Daily and usage-cycle records are deleted during scheduled service cleanup after their operational period, with a maximum active retention target of 35 days after the relevant usage cycle ends. Infrastructure backups and security metadata may persist for the provider's documented backup or security-retention period.

Search inputs, run metadata, and minimized public result rows are processed in Telemark Digital's execution-provider account, not an account controlled by the user. The current provider may retain the ten most recent free-plan runs and their unnamed storage for up to 4 months; other unnamed records are deleted under the provider's applicable retention schedule. Telemark may delete records earlier and will consider a supported deletion request. See the execution provider's [data-retention documentation](https://docs.apify.com/storage#data-retention).

The AI client retains conversation and app-interaction data according to the user's client settings and that provider's published policy. Public support issues remain public until removed under the repository's moderation and retention process.

Private support email and privacy-request records are normally deleted within 24 months after the last substantive contact. We may retain a record longer only when required by law, needed to resolve an active dispute, or necessary to investigate a documented security incident; when that exception ends, the record is deleted.

## Purposes

We process information to provide the requested bounded search, authorize and securely route calls, enforce per-browser and shared cost limits, prevent abuse, troubleshoot and protect the service, respond to support or privacy requests, and comply with applicable law.

## Sharing

We share information only as needed to provide the service, including with Telemark Digital's execution provider, the AI-client provider you choose, Cloudflare as authorization, gateway, and budget infrastructure provider, GitHub for public support issues, and our email provider for private support. We may also disclose information when required by law or to protect rights or safety. We do not sell personal information collected through the gateway.

## Public-source limitations

Telemark Feed Search retrieves public feeds at URLs selected by the user. Telemark Public Post Search searches recent public posts on a decentralized social network. Telemark Procurement Search searches public European procurement notices. The apps do not bypass authentication, access controls, robots restrictions, or privacy settings.

These apps are not third-party account connectors or arbitrary API pass-throughs. Telemark Public Post Search uses a source-provided unauthenticated public-web API and adds bounded keyword, phrase, exclusion, declared-language, sorting, and field-minimization logic. Telemark Procurement Search uses the official public Search API made available for analysis and reuse and adds bounded classification, country, notice-type, keyword, value, date-window, change-notice, and field-minimization logic. No app authenticates as a user of the public source or performs source-account actions.

## Your choices and rights

You control the searches and public sources you submit. You can disconnect the app in the AI client and clear the Telemark authorization site's browser data to remove the pseudonymous subject cookie. Because execution runs occur in Telemark Digital's provider account, they do not appear in a user-owned execution account. You may ask Telemark to locate and delete supported service records, but a request must include enough non-secret context to locate them; never send an access token or password.

Depending on your location, you may have rights to access, correct, delete, restrict, or object to our processing of personal information. To make a privacy request, email [hello@telemarkdigital.com](mailto:hello@telemarkdigital.com). We may need enough information to verify and fulfill the request, but never send an access token or password.

## Security

We use bounded routing, HTTPS, OAuth delegation, signed run resources, minimized schemas, no-store response headers, and credential-free public app files. No system is completely secure, and we cannot guarantee absolute security.

## Changes

We may update this policy as the service evolves. The date at the top identifies the current version. Material changes will be published at this URL.

## Contact

Telemark Digital  
[hello@telemarkdigital.com](mailto:hello@telemarkdigital.com)

See [Support](./support.md) and the [Terms of Use](./terms.md).
