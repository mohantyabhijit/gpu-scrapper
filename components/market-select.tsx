"use client";

import type { ChangeEvent } from "react";
import type { MarketDefinition } from "../config/markets";

export default function MarketSelect({
  id,
  market,
  markets,
}: {
  id: string;
  market: string;
  markets: readonly MarketDefinition[];
}) {
  function applyMarket(event: ChangeEvent<HTMLSelectElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <select id={id} name="market" defaultValue={market} onChange={applyMarket}>
      {markets.map((item) => (
        <option key={item.code} value={item.slug}>
          {item.label} · {item.currency}
        </option>
      ))}
    </select>
  );
}
