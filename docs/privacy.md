# Privacy Policy

Effective date: July 24, 2026

This Privacy Policy describes how Telemark Digital ("Telemark," "we," "us," or "our") handles information when you use Bluesky Keyword Alerts, RSS Keyword Monitor, or TED Tender Monitor through an AI client, including ChatGPT, or contact us for support.

## How the service works

Each plugin connects to a product-specific, stateless Telemark Digital MCP gateway. The gateway pins requests to one specified public Apify Actor and forwards the request to Apify using the authorization supplied through Apify OAuth. The Actor performs the requested work in the user's Apify account and returns its result through the gateway to the AI client.

## Information processed

Depending on the plugin and your request, the service may process:

- search terms, handles, hashtags, country or procurement filters, CPV codes, value filters, regular expressions, exclusions, and run limits;
- public RSS, Atom, or RDF feed URLs supplied by the user;
- public Bluesky posts and public TED procurement notices returned by the associated Actor;
- technical request and response data needed to route the MCP call;
- an Apify OAuth bearer credential while it is transmitted to Apify; and
- information you choose to send in a support request.

Do not submit secrets, private feed URLs, confidential customer data, or sensitive personal data unless the feature expressly requires it and you are authorized to do so.

## Storage and retention

The Telemark gateway code does not create application accounts, databases, or persistent logs, and does not intentionally retain OAuth credentials, prompts, Actor inputs, or Actor outputs. The gateway's infrastructure provider may process limited network and security metadata to operate and protect the service.

Actor runs, inputs, datasets, key-value records, and related account records are processed and retained by Apify under the user's Apify account, settings, and applicable Apify terms. ChatGPT or another AI client may retain conversation and plugin-interaction data under that provider's settings and policies. GitHub processes public support issues, and our email provider processes support email.

Support records are retained only as long as reasonably necessary to answer the request, maintain security, resolve disputes, and meet legal obligations.

## Purposes

We process information to:

- provide the requested plugin and Actor functionality;
- authenticate and securely route calls to the correct Actor;
- troubleshoot, secure, maintain, and improve the service;
- respond to support, privacy, and security requests; and
- comply with applicable law and enforce our Terms of Use.

## Sharing

We share information only as needed to provide the service, including with Apify, OpenAI or the AI-client provider you choose, Cloudflare as the gateway infrastructure provider, GitHub for public support issues, and our email provider for private support. We may also disclose information when required by law, to protect rights or safety, or in connection with a business reorganization. We do not sell personal information collected through the gateway.

## Public-source limitations

Bluesky Keyword Alerts is designed for public Bluesky content. TED Tender Monitor is designed for public procurement notices. RSS Keyword Monitor retrieves feeds at URLs selected by the user. These tools are not intended to bypass authentication, access controls, robots restrictions, or privacy settings.

## Your choices and rights

You control the searches and sources you submit, the Apify account used for Actor runs, and the data retained in that account. You can revoke connected-app access through Apify and manage or delete Actor records through Apify, subject to its capabilities and policies.

Depending on your location, you may have rights to access, correct, delete, restrict, or object to our processing of personal information. To make a privacy request, email [hello@telemarkdigital.com](mailto:hello@telemarkdigital.com). We may need enough information to verify and fulfill the request, but never send an access token or password.

## Security

We use bounded routing, HTTPS, OAuth delegation, no-store response headers, and credential-free public plugin files. No system is completely secure, and we cannot guarantee absolute security.

## Changes

We may update this policy as the service evolves. The date at the top identifies the current version. Material changes will be published at this URL.

## Contact

Telemark Digital  
[hello@telemarkdigital.com](mailto:hello@telemarkdigital.com)

See [Support](./support.md) and the [Terms of Use](./terms.md).
