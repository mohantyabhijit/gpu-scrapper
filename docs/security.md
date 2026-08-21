# Security and public-data boundary

Raster is a public comparison site, but its collection and ingestion controls
are privileged. This document is the security baseline for implementation and
release review.

## Credential handling

- The Bright Data key previously shared in conversation is considered exposed.
  Revoke it and create a replacement before the first live collector or CI run.
- Store the replacement only in macOS Keychain/equivalent local secure storage,
  the deployment secret store, and GitHub Actions secrets.
- Keep `.env.example` names-only. Real `.env` files, provider output, raw
  authorization headers, and diagnostic bodies are ignored and must never be
  committed.
- Collector IDs are non-secret identifiers. They may appear in sanitized
  evidence; API keys, bearer tokens, cookies, and signed URLs may not.
- Before each push, scan the working tree, git history, build output, evidence,
  and CI logs for credential-shaped strings. Rotate immediately if anything
  appears.

## Collection boundary

Only public catalog/product pages from an approved source register may be
requested. The system must reject login-walled pages, paywalled content,
private APIs, personal data, checkout/account routes, arbitrary user URLs, and
CAPTCHA-bypass workflows. Rate limits and terms are reviewed per source.

## Ingestion boundary

The browser performs read-only catalog queries. A refresh route is server-owned,
authenticated with a short-lived HMAC request, restricted to registered source
slugs and bounded batches, and rate-limited. It must not accept arbitrary URLs or
return raw provider error bodies. GitHub Actions receives the minimum secret
scope needed to sign a refresh request and has read-only permissions by default.

## Data minimization

Store only fields required for comparison and auditability: public title, source
URL, public SKU/MPN, model identity, price/currency, availability, image URL,
source, timestamp, validation status, and safe checksums. Quarantine invalid
rows with redacted reason codes. Do not store names, emails, phone numbers,
account identifiers, cookies, or payment data.

## Release checklist

- [ ] Exposed setup key revoked and replacement verified without printing it.
- [ ] `.env.example` contains names only; `.env` is ignored.
- [ ] No secrets in source, git history, bundles, screenshots, evidence, or logs.
- [ ] Source register has public-data and pre-built-library decisions.
- [ ] Trigger rejects anonymous, invalid-signature, arbitrary-source, and
      oversized requests.
- [ ] Outbound links are host-allowlisted and visibly attributed.
- [ ] Stale/degraded data is labelled and never presented as a guarantee.
