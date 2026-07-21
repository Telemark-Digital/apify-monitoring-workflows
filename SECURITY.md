# Security Policy

## Never commit credentials

Do not put API tokens, webhook URLs, passwords, OAuth values, credential names, credential IDs, private feed URLs, or personal identifiers in this repository.

Workflow users must connect their own credentials after import. Public Apify Task inputs keep webhook fields empty.

## Publication checks

Before every push:

1. Run the repository validation script.
2. Review the complete staged diff.
3. Confirm the Git remote belongs to the dedicated public publishing account.
4. Confirm the publishing credential has no access to private repositories.
5. Stop if GitHub push protection reports a secret. Do not bypass a real-secret warning.

## Reporting

Report security concerns through the repository's **Report a vulnerability** link, which opens GitHub private vulnerability reporting. Do not place credentials or private run data in a public issue. Repository publication is blocked until that private channel and its maintainer notifications have been verified.
