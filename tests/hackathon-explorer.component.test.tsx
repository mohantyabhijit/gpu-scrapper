// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import HackathonExplorer from "../components/hackathon-explorer";
import { hackathons } from "../data/hackathons";

vi.mock("../components/orbit-scene", () => ({ default: () => <div aria-label="Radar visualization" /> }));

describe("HackathonExplorer worldwide and currency workflow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ hackathons }),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("switches from worldwide USD ranking to India local currency plus USD", async () => {
    render(<HackathonExplorer initialHackathons={hackathons} />);
    const market = screen.getByRole("combobox", { name: "Browse market" });

    await waitFor(() => expect(screen.getByText("live API")).toBeTruthy());
    fireEvent.change(market, { target: { value: "WORLD" } });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Top hackathons worldwide" })).toBeTruthy());
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getAllByText(/USD$/).length).toBeGreaterThan(0);

    fireEvent.change(market, { target: { value: "IN" } });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Top hackathons for India" })).toBeTruthy());
    expect(screen.getAllByText(/₹/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/USD · est\. INR$/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    expect(screen.getByRole("button", { name: "AI" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("ignores a stale worldwide response after a rapid switch to India", async () => {
    const pending = new Map<string, (value: { ok: boolean; json: () => Promise<{ hackathons: typeof hackathons }> }) => void>();
    vi.stubGlobal("fetch", vi.fn((url: string) => new Promise((resolve) => pending.set(url, resolve))));
    render(<HackathonExplorer initialHackathons={hackathons} />);
    const market = screen.getByRole("combobox", { name: "Browse market" });

    fireEvent.change(market, { target: { value: "WORLD" } });
    await waitFor(() => expect(pending.has("/scrapper-api/hackathons?country=WORLD&limit=50")).toBe(true));
    fireEvent.change(market, { target: { value: "IN" } });
    await waitFor(() => expect(pending.has("/scrapper-api/hackathons?country=IN&limit=50")).toBe(true));

    pending.get("/scrapper-api/hackathons?country=IN&limit=50")?.({ ok: true, json: async () => ({ hackathons }) });
    await waitFor(() => expect(screen.getByText("live API")).toBeTruthy());

    pending.get("/scrapper-api/hackathons?country=WORLD&limit=50")?.({ ok: true, json: async () => ({ hackathons }) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("heading", { name: "Top hackathons for India" })).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });

  test("opens a source-backed detail modal and restores focus when closed", async () => {
    render(<HackathonExplorer initialHackathons={hackathons} />);
    const openButton = await screen.findByRole("button", { name: "Open details for RevenueCat Shipaton 2026" });

    openButton.focus();
    fireEvent.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "RevenueCat Shipaton 2026" });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Every indexed country")).toBeTruthy();
    expect(within(dialog).getByText("$685,000 cash")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "View original page" }).getAttribute("href"))
      .toBe("https://revenuecat-shipaton-2026.devpost.com/");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(openButton);

    fireEvent.click(openButton);
    const reopenedDialog = screen.getByRole("dialog", { name: "RevenueCat Shipaton 2026" });
    fireEvent.click(reopenedDialog.parentElement!);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(openButton);
  });
});
