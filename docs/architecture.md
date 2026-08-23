# Architecture

```text
Devpost / Unstop / Hackathons UK public pages
  -> stable Bright Data Scraper Studio collector
  -> FastAPI asynchronous refresh job
  -> schema inspection + Pydantic normalization
  -> PostgreSQL last-known-good event rows
  -> /scrapper-api/hackathons?country=…
  -> static Next.js application + client-side Three.js
```

The static frontend is served by Nginx at `/scrapper/`. FastAPI binds only to `127.0.0.1:8095` and is proxied at `/scrapper-api/`. Operator mutations require `X-HackRadar-Operator-Token`; browser-facing event reads are public. Provider credentials exist only in the root-readable systemd environment file.

The checked-in snapshot is a resilience layer. The frontend adopts live API data only when at least ten rows are available for the selected country; otherwise it discloses “verified snapshot.”
