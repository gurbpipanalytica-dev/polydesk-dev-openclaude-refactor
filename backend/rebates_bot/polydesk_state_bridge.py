"""
polydesk_state_bridge.py
────────────────────────────────────────────────────────────────────────────
Shared module imported by every Polydesk bot.

Every bot calls:
    bridge = StateBridge("bond_bot")
    bridge.write(pnl=..., trades=..., positions=..., ...)

This writes a standardised JSON file to /app/state/{bot_name}_state.json
The orchestrator reads all these files.
The dashboard fetches them via /api/status.

Also handles demo mode — when LIVE_MODE=false the state is tagged "demo"
so the dashboard shows the DEMO badge.
"""

import json
import os
import time
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger("StateBridge")

# Supabase — imported lazily so bridge still works without it
try:
    from polydesk_db import db as _db
    _SUPABASE_OK = True
except Exception:
    _db = None
    _SUPABASE_OK = False

# Where state files live — mounted as Docker volume
# Locally falls back to ./state/
STATE_DIR = Path(os.environ.get("STATE_DIR", "/app/state"))


class StateBridge:
    """
    Write standardised state from any bot.
    Dashboard reads this via the orchestrator API.
    """

    def __init__(self, bot_name: str):
        self.bot_name  = bot_name
        self.is_demo   = os.environ.get("LIVE_MODE", "false").lower() != "true"
        self.state_file = STATE_DIR / f"{bot_name}_state.json"
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        log.info(f"StateBridge init: {self.state_file} | demo={self.is_demo}")

    def write(
        self,
        # Core metrics
        status:        str   = "live",       # live | paused | error | paper
        daily_pnl:     float = 0.0,
        total_pnl:     float = 0.0,
        trades_today:  int   = 0,
        total_trades:  int   = 0,
        win_rate:      float = 0.0,
        # Capital
        capital_deployed: float = 0.0,
        open_positions:   list  = None,
        # Performance
        sharpe:        Optional[float] = None,
        drawdown:      Optional[float] = None,
        total_rebates: Optional[float] = None,
        # Recent trades (last 20 for dashboard)
        recent_trades: list = None,
        # Bot-specific extras
        extra:         dict = None,
    ):
        """Write full state snapshot. Called every bot cycle."""
        state = {
            # Identity
            "bot":          self.bot_name,
            "mode":         "demo" if self.is_demo else "live",
            "status":       "paper" if self.is_demo else status,
            "updated_at":   datetime.now(timezone.utc).isoformat(),
            "uptime_since": self._uptime_since(),

            # P&L
            "daily_pnl":    round(daily_pnl,   2),
            "total_pnl":    round(total_pnl,   2),
            "trades_today": trades_today,
            "total_trades": total_trades,
            "win_rate":     round(win_rate,     2),

            # Capital
            "capital_deployed": round(capital_deployed, 2),
            "open_positions":   open_positions or [],
            "open_count":       len(open_positions or []),

            # Performance
            "sharpe":        sharpe,
            "drawdown":      drawdown,
            "total_rebates": total_rebates,

            # Trades for dashboard trade log
            "recent_trades": (recent_trades or [])[:20],

            # Extras (bot-specific fields)
            **(extra or {}),
        }

        # Write to local JSON file (fast, always works)
        try:
            with open(self.state_file, "w") as f:
                json.dump(state, f, indent=2, default=str)
        except Exception as e:
            log.error(f"Failed to write state file: {e}")

        # Write snapshot to Supabase (persistent, queryable)
        if _SUPABASE_OK and _db:
            try:
                _db.upsert_snapshot(
                    bot              = self.bot_name,
                    mode             = state["mode"],
                    status           = state["status"],
                    daily_pnl        = state["daily_pnl"],
                    total_pnl        = state["total_pnl"],
                    trades_today     = state["trades_today"],
                    total_trades     = state["total_trades"],
                    win_rate         = state["win_rate"],
                    capital_deployed = state["capital_deployed"],
                    open_count       = state["open_count"],
                    total_rebates    = state.get("total_rebates"),
                    extra            = state.get("extra", {}),
                )
            except Exception as e:
                log.warning(f"Supabase snapshot write failed (non-fatal): {e}")

    def write_trade(
        self,
        market:      str,
        side:        str,
        size_usd:    float,
        entry_price: float,
        exit_price:  Optional[float],
        pnl:         Optional[float],
        status:      str = "closed",   # open | closed | resolved
        exec_ms:     int = 0,
        method:      Optional[str] = None,
    ) -> dict:
        """
        Build a standardised trade dict for recent_trades list.
        Call this and append to your trades list, then pass to write().
        """
        trade = {
            "id":          f"{self.bot_name[:1].upper()}-{int(time.time()*100)%100000}",
            "time":        datetime.now(timezone.utc).strftime("%b %d %H:%M"),
            "market":      market[:60],
            "side":        side,
            "size":        round(size_usd, 2),
            "entry":       round(entry_price, 4),
            "exit":        round(exit_price, 4) if exit_price else None,
            "pnl":         round(pnl, 2) if pnl is not None else None,
            "exec_ms":     exec_ms,
            "status":      status,
            "method":      method,
            "mode":        "demo" if self.is_demo else "live",
        }

        # Persist to Supabase
        if _SUPABASE_OK and _db:
            try:
                _db.insert_trade(
                    trade_id    = trade["id"],
                    bot         = self.bot_name,
                    mode        = trade["mode"],
                    market      = trade["market"],
                    side        = trade["side"],
                    size_usd    = trade["size"],
                    entry_price = trade["entry"],
                    exit_price  = trade["exit"],
                    pnl         = trade["pnl"],
                    status      = trade["status"],
                    method      = trade["method"],
                    exec_ms     = trade["exec_ms"],
                )
            except Exception as e:
                log.warning(f"Supabase trade insert failed (non-fatal): {e}")

        return trade

    def write_error(self, error: str):
        """Write an error state — dashboard shows red indicator."""
        try:
            existing = self._read_existing()
            existing["status"]     = "error"
            existing["last_error"] = error
            existing["updated_at"] = datetime.now(timezone.utc).isoformat()
            with open(self.state_file, "w") as f:
                json.dump(existing, f, indent=2)
        except:
            pass

    def write_paused(self, reason: str = ""):
        """Write a paused state — bot received pause command."""
        try:
            existing = self._read_existing()
            existing["status"]       = "paused"
            existing["pause_reason"] = reason
            existing["updated_at"]   = datetime.now(timezone.utc).isoformat()
            with open(self.state_file, "w") as f:
                json.dump(existing, f, indent=2)
        except:
            pass

    def read_command(self) -> Optional[dict]:
        """
        Check if orchestrator has written a command for this bot.
        Returns command dict or None.
        Deletes the command file after reading (one-shot execution).
        """
        commands_dir = STATE_DIR.parent / "commands"
        cmd_file     = commands_dir / f"{self.bot_name}_command.json"
        if not cmd_file.exists():
            return None
        try:
            with open(cmd_file) as f:
                cmd = json.load(f)
            cmd_file.unlink()   # consume it
            log.info(f"Command received: {cmd.get('action')} — {cmd.get('reason','')}")
            return cmd
        except Exception as e:
            log.error(f"Failed to read command: {e}")
            return None

    def _read_existing(self) -> dict:
        try:
            if self.state_file.exists():
                with open(self.state_file) as f:
                    return json.load(f)
        except:
            pass
        return {"bot": self.bot_name}

    def _uptime_since(self) -> str:
        """Return ISO timestamp of when this bridge was first created."""
        marker = STATE_DIR / f"{self.bot_name}_started_at"
        if not marker.exists():
            ts = datetime.now(timezone.utc).isoformat()
            marker.write_text(ts)
            return ts
        return marker.read_text().strip()


# ── POLYMARKET DEMO DATA FETCHER ──────────────────────────────────────────────
class PolymarketLiveFeed:
    """
    Fetches real Polymarket market data for demo mode.
    No API key needed — public endpoints.
    Used by dashboard to show real prices in demo.
    """
    GAMMA_API = "https://gamma-api.polymarket.com"
    CLOB_API  = "https://clob.polymarket.com"

    @staticmethod
    async def fetch_top_markets(session, limit: int = 20) -> list:
        """Real top markets by volume — no auth needed."""
        import aiohttp
        try:
            async with session.get(
                f"{PolymarketLiveFeed.GAMMA_API}/markets",
                params={"active": "true", "limit": limit,
                        "order": "volume24hr", "ascending": "false"},
                timeout=aiohttp.ClientTimeout(total=8)
            ) as r:
                if r.status == 200:
                    markets = await r.json()
                    return [
                        {
                            "id":         m.get("conditionId", ""),
                            "question":   m.get("question", "")[:80],
                            "volume_24h": round(float(m.get("volume24hr") or 0)),
                            "end_date":   m.get("endDate", ""),
                            "yes_price":  float((m.get("tokens") or [{}])[0].get("price") or 0.5),
                            "no_price":   float((m.get("tokens") or [{},{}])[1].get("price") or 0.5),
                            "is_demo":    True,
                        }
                        for m in markets
                    ]
        except Exception as e:
            log.warning(f"Live feed fetch failed: {e}")
        return []

    @staticmethod
    async def fetch_btc_price(session) -> Optional[float]:
        """Fetch current BTC price from public Polymarket markets."""
        import aiohttp
        try:
            async with session.get(
                f"{PolymarketLiveFeed.GAMMA_API}/markets",
                params={"active": "true", "tag": "crypto", "limit": 5},
                timeout=aiohttp.ClientTimeout(total=5)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    for m in data:
                        q = (m.get("question") or "").lower()
                        if "btc" in q and "$" in q:
                            # Extract price from question like "Will BTC > $95,000"
                            import re
                            match = re.search(r'\$([0-9,]+)', q)
                            if match:
                                return float(match.group(1).replace(",", ""))
        except:
            pass
        return None
