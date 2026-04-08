// ── NUMBER FORMAT UTILITIES ───────────────────────────────────────────────────
export const fmt = {
  usd: (v, dec = 2) =>
    v == null
      ? "—"
      : `$${Math.abs(v).toLocaleString("en-US", {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec,
        })}`,

  pnl: (v, dec = 2) =>
    v == null
      ? "—"
      : `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec,
        })}`,

  pct: (v, dec = 1) =>
    v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(dec)}%`,

  num: (v) => (v == null ? "—" : v.toLocaleString("en-US")),

  dec: (v, dec = 4) => (v == null ? "—" : v.toFixed(dec)),

  ms: (v) => (v == null ? "—" : `${v}ms`),

  short: (v) => {
    if (v == null) return "—";
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return fmt.usd(v);
  },
};
