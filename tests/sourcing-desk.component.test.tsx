// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import SourcingDesk, { SOURCE_DESK_STORAGE_KEY, SourceDeskAddButton } from "../components/sourcing-desk";
import { encodeSourceDeskCatalog, serializeSourceDesk, type SourceDeskOffer } from "../components/sourcing-desk-model";

const usOffer: SourceDeskOffer = {
  id: "us-offer",
  market: "us",
  model: "GeForce RTX 5090",
  brand: "Canonical",
  source: "US Retailer",
  currency: "USD",
  price: 1999,
  availability: "In stock",
  observedAt: "2026-08-22T01:00:00.000Z",
  healthState: "healthy",
  freshness: "observed recently",
  freshnessState: "fresh",
  productUrl: "https://example.com/us-gpu",
};

const ukOffer: SourceDeskOffer = {
  ...usOffer,
  id: "uk-offer",
  market: "uk",
  source: "UK Retailer",
  currency: "GBP",
  price: 1899,
  productUrl: "https://example.com/uk-gpu",
};

function renderDesk() {
  return render(
    <SourcingDesk catalogBlob={encodeSourceDeskCatalog([usOffer, ukOffer])} visibleOfferIds={[usOffer.id, ukOffer.id]} marketLabel="United States">
      <SourceDeskAddButton offer={usOffer} />
      <SourceDeskAddButton offer={ukOffer} />
    </SourcingDesk>,
  );
}

describe("SourcingDesk browser workflow", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, String(value)),
      },
    });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });

  afterEach(cleanup);

  test("hydrates, replaces markets, exposes clipboard fallback, and clears persistence", async () => {
    window.localStorage.setItem(SOURCE_DESK_STORAGE_KEY, serializeSourceDesk([usOffer]));
    renderDesk();

    await waitFor(() => expect(screen.getByRole("button", { name: /Remove GeForce RTX 5090 from US Retailer/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Open source desk" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(window.localStorage.getItem(SOURCE_DESK_STORAGE_KEY)).toBe("[]");
    fireEvent.click(screen.getByRole("button", { name: /Add GeForce RTX 5090 from US Retailer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add GeForce RTX 5090 from UK Retailer/ }));

    expect(screen.getByRole("alert").textContent).toContain("Replace current desk?");
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge & replace/ }));

    await waitFor(() => expect(window.localStorage.getItem(SOURCE_DESK_STORAGE_KEY)).toContain("uk-offer"));
    expect(screen.getByText(/1 selected for uk/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy sourcing brief" }));
    await waitFor(() => expect(screen.getByText(/Clipboard unavailable\. Select and copy this brief manually/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Clear desk" }));
    expect(window.localStorage.getItem(SOURCE_DESK_STORAGE_KEY)).toBe("[]");
    expect(screen.getByText("Your desk is empty.")).toBeTruthy();
  });
});
