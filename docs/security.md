# Security model

- Operator routes fail closed without a configured token and constant exact header match.
- New-source URLs require public HTTPS, reject credentials, local/private addresses, internal suffixes, and government hosts.
- Collector IDs and targets are resolved from the database for heal/refresh operations.
- Provider subprocesses receive keys through the environment, not command arguments.
- Provider errors are sanitized; raw bodies and authorization headers are not persisted.
- CORS is restricted to the production domain and local development.
- Nginx bounds operator request bodies and proxy timeouts; FastAPI binds to localhost.
- Failed refreshes do not delete last-known-good records.

Secrets live in macOS Keychain locally, `/etc/hackradar-api.env` with mode `0600` in production, and GitHub Actions secrets for scheduled refresh. Rotate in those stores and restart only the HackRadar service.
