# Privacy Policy

Effective date: July 29, 2026

This Privacy Policy describes how Telemark Digital ("Telemark," "we," "us," or "our") handles information when you use Telemark Feed Search, Telemark Public Post Search, or Telemark Procurement Search through an AI client, or contact us for support.

## How the service works

Each app connects to a product-specific, stateless Telemark Digital MCP gateway. The gateway accepts a deliberately limited search schema, pins each request to one Telemark Digital execution service, and returns a minimized result through the AI client. The public gateway does not expose webhook, secret, reset-state, shared-state, private-source, or arbitrary storage inputs.

## Information processed

Depending on the app and your request, the service may process:

- public feed URLs, keywords, regular expressions, exclusions, match fields, and bounded result limits;
- public-post keywords, exclusions, language filters, and bounded result limits;
- public-procurement classification, country, notice-type, keyword, value, date-window, and bounded result filters;
- public result fields needed to answer the request, such as feed item titles and links, public post text and public handles, or procurement notice titles, public buyer organizations, classification codes, values, and notice links;
- technical request and response data needed to authenticate and route an MCP call; and
- information you choose to send in a support request.

The apps do not accept credentials, authentication secrets, private feed URLs, private posts, confidential customer data, health or biometric data, social-security or government identity numbers, payment-card data, or other restricted or sensitive personal data. Do not submit that information.

## Data minimization

The public result tools remove internal run and storage identifiers and nonessential source metadata. Feed results omit author and full-content fields. Public-post results omit decentralized identifiers, content identifiers, avatars, engagement counts, and nonessential profile fields. Procurement results omit internal state keys, notice UUIDs, charge counters, and control rows.

Run and dataset references returned by the gateway are signed, product-scoped, short-lived capabilities. They can be used only for the originating product run and its result dataset.

## Storage and retention

The Telemark gateway code does not create application accounts, databases, or persistent application logs, and does not intentionally retain OAuth credentials, prompts, search inputs, or result rows. Its infrastructure provider may process limited network and security metadata to operate and protect the service.

Execution records are processed and retained in the connected execution account under that provider's settings and policies. The AI client may retain conversation and app-interaction data under its settings and policies. GitHub processes public support issues, and our email provider processes support email.

Support records are retained only as long as reasonably necessary to answer the request, maintain security, resolve disputes, and meet legal obligations.

## Purposes

We process information to provide the requested bounded search, authenticate and securely route calls, troubleshoot and protect the service, respond to support or privacy requests, and comply with applicable law.

## Sharing

We share information only as needed to provide the service, including with the connected execution provider, the AI-client provider you choose, Cloudflare as gateway infrastructure provider, GitHub for public support issues, and our email provider for private support. We may also disclose information when required by law or to protect rights or safety. We do not sell personal information collected through the gateway.

## Public-source limitations

Telemark Feed Search retrieves public feeds at URLs selected by the user. Telemark Public Post Search searches recent public posts on a decentralized social network. Telemark Procurement Search searches public European procurement notices. The apps do not bypass authentication, access controls, robots restrictions, or privacy settings.

## Your choices and rights

You control the searches and public sources you submit and the connected execution account. You can revoke connected-app access and manage execution records through that provider, subject to its capabilities and policies.

Depending on your location, you may have rights to access, correct, delete, restrict, or object to our processing of personal information. To make a privacy request, email [hello@telemarkdigital.com](mailto:hello@telemarkdigital.com). We may need enough information to verify and fulfill the request, but never send an access token or password.

## Security

We use bounded routing, HTTPS, OAuth delegation, signed run resources, minimized schemas, no-store response headers, and credential-free public app files. No system is completely secure, and we cannot guarantee absolute security.

## Changes

We may update this policy as the service evolves. The date at the top identifies the current version. Material changes will be published at this URL.

## Contact

Telemark Digital  
[hello@telemarkdigital.com](mailto:hello@telemarkdigital.com)

See [Support](./support.md) and the [Terms of Use](./terms.md).
