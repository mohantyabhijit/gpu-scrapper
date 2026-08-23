# Historical Raster/GPU scraper evidence

These files preserve the earlier Raster GPU market-intelligence work. They are published for project-history transparency and are not presented as HackRadar's current runtime.

## Sanitized collector evidence

- [`collectors/`](collectors/) contains creation and run summaries for Dynacore, Infinity Computer, and PC Themes.
- [`healing/`](healing/) contains the published PC Themes before/after healing proof.
- [`postgres-cutover/count-reconciliation.json`](postgres-cutover/count-reconciliation.json) records the sanitized database cutover reconciliation.

## Additional preserved runs

- [`dgx-spark/`](dgx-spark/) contains the collector creation, contract-broken first run, same-ID heal receipt, and corrected rerun.
- [`dynacore-ram/`](dynacore-ram/) contains the creation receipt, 20-row public run, and the later capacity-field heal timeout.
- [`istudio-mac-mini/`](istudio-mac-mini/) contains the failed creation and repair receipts.
- [`dynacore-heal/`](dynacore-heal/) contains before/after GPU-schema verification and the heal receipt.
- [`pc-themes/`](pc-themes/) contains the empty baseline, 96-row discovery runs, both heal stages, price recovery runs, and the final 96-row verification envelope.

The artifacts retain public catalog fields, collector IDs, Studio links, repair prompts, counts, and workflow outcomes. Raw CLI stderr, provider response IDs, input envelopes, and unrelated local logs are intentionally excluded.
