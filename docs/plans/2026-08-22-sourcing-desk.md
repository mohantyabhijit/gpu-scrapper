---
title: Raster Sourcing Desk
type: feat
date: 2026-08-22
---

# Raster Sourcing Desk

## Product intent

Turn Raster's existing market-local offer comparison into a useful sourcing workspace for a hardware buyer. This is a comparison and outbound-purchase product, never a merchant: no cart, checkout, payment, inventory reservation, artificial availability, or claim that fixtures are live data.

## Global constraints

- Preserve the four supported markets and their currency boundary. Never rank or total across currencies.
- Preserve the current fixture/live disclosure. A fixture must remain visibly labelled as a sample and never be presented as current inventory.
- Shortlist state stays in browser local storage only. No account, personal data, analytics event, or server-side write is introduced.
- Include only safe fields already in the `Offer` model in the source brief. Never include secrets, raw collector output, or user-provided text.
- Every interactive control is keyboard-operable, visibly focused, labelled, and has a non-color status label.
- Do not modify the user-owned `README.md`, deployment configuration, credential paths, or collector configuration.

## Task 1: Build the sourcing desk

**Goal:** Give a procurement user a focused way to hold and evaluate selected, market-local GPU offers while retaining the current discovery flow.

**Owned files:** `components/sourcing-desk.tsx`, `app/page.tsx`, `app/globals.css`, `tests/rendered-html.test.mjs`, plus any focused new tests. Do not touch `README.md`.

**Requirements:**

1. Add a client-side “Add to source desk” action to every offer card. It must be a button, expose pressed/added state, work from keyboard, and use a single local-storage key with a small bounded selection limit.
2. Render a compact sticky source-desk summary on the homepage. It must say how many offers are selected, tell the user that selections are stored only in this browser, and provide a clear action.
3. The expanded desk must show selected offer model/brand, retailer, market/currency, observed timestamp, availability, source health, and a safe outbound retailer link. It must make fixture state explicit.
4. Enforce a one-market desk: selecting an offer from another market replaces the current desk only after an explicit acknowledgement in the UI; never mix or total currencies. Within one market, selected offers may have different GPU models but must not claim they are like-for-like price comparisons.
5. Add a deterministic, user-triggered “Copy sourcing brief” action that contains only the selected safe fields and a dated source-verification reminder. Include an in-UI success/failure status and a readable fallback when Clipboard access is unavailable.
6. Add a clear/remove action and a no-selection empty state. Preserve selections across reloads when browser storage is available; invalid or stale stored state must fail closed to an empty desk.
7. Preserve the existing server-rendered catalog, filters, model detail routes, and fixture/live label. The homepage must remain meaningful with JavaScript disabled.
8. Add focused assertions for server markup and the client component’s serialization/brief construction. Run the full repository gate before commit.

**Acceptance:** A sourcer can select offers in one market, open a concise source desk, inspect provenance/freshness, safely copy a procurement brief, clear it, and move to another market without misleading cross-currency comparison.

