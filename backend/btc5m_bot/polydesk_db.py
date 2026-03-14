"""
polydesk_db.py
──────────────────────────────────────────────────────────────────────────────
Shared Supabase client for all Polydesk bots and the orchestrator.

Every bot imports this:
    from polydesk_db import db
    db.insert_trade(...)
    db.upsert_snapshot(...)

Uses supabase-py v2.
Install: pip install supabase

Env vars needed:
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJ...   ← service role key (server-side only)
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger("PolydeskDB")

# Lazy-init so import doesn't crash if supabase isn't installed
_client = None

def get_client():
    global _client
    if _client is None:
        try:
            from supabase import create_client
            url = os.environ.get("SUPABASE_URL", "")
            key = os.environ.get("SUPABASE_SERVICE_KEY", "")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            _client = create_client(url, key)
            log.info("✅ Supabase client connected")
        except Exception as e:
            log.error(f"Supabase init failed: {e}")
            raise
    return _client


class PolydeskDB:
    """
    All database operations for Polydesk.
    Methods are safe — they catch errors and log instead of crashing bots.
    """

    # ── TRADES ────────────────────────────────────────────────────────────────

    def insert_trade(
        self,
        trade_id:     str,
        bot:          str,
        mode:         str,
        market:       str,
        side:         str,
        size_usd:     float,
        entry_price:  float,
        exit_price:   Optional[float] = None,
        pnl:          Optional[float] = None,
        status:       str = "open",
        method:       Optional[str] = None,
        exec_ms:      int = 0,
        market_id:    Optional[str] = None,
    ) -> bool:
        """Insert a new trade. Returns True on success."""
        try:
            get_client().table("trades").upsert({
                "trade_id":    trade_id,
                "bot":         bot,
                "mode":        mode,
                "market":      market[:80],
                "market_id":   market_id,
                "side":        side,
                "size_usd":    round(size_usd, 2),
                "entry_price": round(entry_price, 4),
                "exit_price":  round(exit_price, 4) if exit_price else None,
                "pnl":         round(pnl, 2) if pnl is not None else None,
                "status":      status,
                "method":      method,
                "exec_ms":     exec_ms,
                "closed_at":   datetime.now(timezone.utc).isoformat() if status in ("closed","resolved") else None,
            }, on_conflict="trade_id").execute()
            return True
        except Exception as e:
            log.error(f"insert_trade failed: {e}")
            return False

    def close_trade(self, trade_id: str, exit_price: float, pnl: float, status: str = "resolved") -> bool:
        """Update an existing trade when it closes."""
        try:
            get_client().table("trades").update({
                "exit_price": round(exit_price, 4),
                "pnl":        round(pnl, 2),
                "status":     status,
                "closed_at":  datetime.now(timezone.utc).isoformat(),
            }).eq("trade_id", trade_id).execute()
            return True
        except Exception as e:
            log.error(f"close_trade failed: {e}")
            return False

    def get_recent_trades(self, bot: Optional[str] = None, limit: int = 50, mode: Optional[str] = None) -> list:
        """Fetch recent trades, optionally filtered by bot and mode."""
        try:
            q = get_client().table("trades").select("*").order("created_at", desc=True).limit(limit)
            if bot:
                q = q.eq("bot", bot)
            if mode:
                q = q.eq("mode", mode)
            r = q.execute()
            return r.data or []
        except Exception as e:
            log.error(f"get_recent_trades failed: {e}")
            return []

    def get_trades_summary(self, bot: Optional[str] = None, mode: str = "live") -> dict:
        """Calculate P&L summary from trades table."""
        try:
            q = get_client().table("trades").select("pnl,status,bot").eq("mode", mode)
            if bot:
                q = q.eq("bot", bot)
            r = q.execute()
            rows = r.data or []
            closed = [t for t in rows if t["status"] in ("closed","resolved") and t["pnl"] is not None]
            total_pnl = sum(float(t["pnl"]) for t in closed)
            wins      = sum(1 for t in closed if float(t["pnl"]) > 0)
            win_rate  = (wins / len(closed) * 100) if closed else 0
            return {
                "total_pnl":   round(total_pnl, 2),
                "total_trades": len(closed),
                "win_rate":    round(win_rate, 1),
                "open_count":  sum(1 for t in rows if t["status"] == "open"),
            }
        except Exception as e:
            log.error(f"get_trades_summary failed: {e}")
            return {"total_pnl": 0, "total_trades": 0, "win_rate": 0, "open_count": 0}

    # ── SNAPSHOTS ─────────────────────────────────────────────────────────────

    def upsert_snapshot(
        self,
        bot:              str,
        mode:             str,
        status:           str,
        daily_pnl:        float,
        total_pnl:        float,
        trades_today:     int,
        total_trades:     int,
        win_rate:         float,
        capital_deployed: float,
        open_count:       int = 0,
        total_rebates:    Optional[float] = None,
        extra:            Optional[dict] = None,
    ) -> bool:
        """Write a bot state snapshot. Called every bot cycle."""
        try:
            get_client().table("bot_snapshots").insert({
                "bot":              bot,
                "mode":             mode,
                "status":           status,
                "daily_pnl":        round(daily_pnl, 2),
                "total_pnl":        round(total_pnl, 2),
                "trades_today":     trades_today,
                "total_trades":     total_trades,
                "win_rate":         round(win_rate, 2),
                "capital_deployed": round(capital_deployed, 2),
                "open_count":       open_count,
                "total_rebates":    round(total_rebates, 2) if total_rebates else None,
                "extra":            extra or {},
                "snapped_at":       datetime.now(timezone.utc).isoformat(),
            }).execute()
            return True
        except Exception as e:
            log.error(f"upsert_snapshot failed: {e}")
            return False

    def get_latest_snapshots(self) -> list:
        """Get the most recent snapshot for each bot."""
        try:
            r = get_client().table("portfolio_summary").select("*").execute()
            return r.data or []
        except Exception as e:
            log.error(f"get_latest_snapshots failed: {e}")
            return []

    def get_snapshot_history(self, bot: str, hours: int = 24) -> list:
        """Get snapshot history for charting."""
        try:
            from datetime import timedelta
            since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
            r = (get_client().table("bot_snapshots")
                 .select("snapped_at,total_pnl,daily_pnl,trades_today")
                 .eq("bot", bot)
                 .gte("snapped_at", since)
                 .order("snapped_at")
                 .execute())
            return r.data or []
        except Exception as e:
            log.error(f"get_snapshot_history failed: {e}")
            return []

    # ── POSITIONS ─────────────────────────────────────────────────────────────

    def upsert_position(
        self,
        bot:           str,
        market:        str,
        side:          str,
        size_usd:      float,
        entry_price:   float,
        market_id:     Optional[str] = None,
        current_price: Optional[float] = None,
        wallet:        Optional[str] = None,
    ) -> bool:
        try:
            unreal = None
            if current_price:
                unreal = round(size_usd * (current_price - entry_price) / entry_price, 2)
            get_client().table("positions").upsert({
                "bot":             bot,
                "market":          market[:80],
                "market_id":       market_id or market[:40],
                "side":            side,
                "size_usd":        round(size_usd, 2),
                "entry_price":     round(entry_price, 4),
                "current_price":   round(current_price, 4) if current_price else None,
                "unrealized_pnl":  unreal,
                "status":          "open",
                "wallet":          wallet,
                "updated_at":      datetime.now(timezone.utc).isoformat(),
            }, on_conflict="bot,market_id,side").execute()
            return True
        except Exception as e:
            log.error(f"upsert_position failed: {e}")
            return False

    def close_position(self, bot: str, market_id: str, side: str) -> bool:
        try:
            get_client().table("positions").update({
                "status":     "closed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("bot", bot).eq("market_id", market_id).eq("side", side).execute()
            return True
        except Exception as e:
            log.error(f"close_position failed: {e}")
            return False

    def get_open_positions(self, bot: Optional[str] = None) -> list:
        try:
            q = get_client().table("positions").select("*").eq("status", "open")
            if bot:
                q = q.eq("bot", bot)
            r = q.order("opened_at", desc=True).execute()
            return r.data or []
        except Exception as e:
            log.error(f"get_open_positions failed: {e}")
            return []

    # ── ALLOCATIONS ───────────────────────────────────────────────────────────

    def get_allocations(self) -> dict:
        """Returns {bot_name: amount_usd}"""
        try:
            r = get_client().table("allocations").select("*").execute()
            return {row["bot"]: float(row["amount_usd"]) for row in (r.data or [])}
        except Exception as e:
            log.error(f"get_allocations failed: {e}")
            return {}

    def save_allocations(self, allocations: dict) -> bool:
        """Save allocation from dashboard. {bot_name: amount_usd}"""
        try:
            total = sum(allocations.values())
            rows = [
                {
                    "bot":        bot,
                    "amount_usd": round(amt, 2),
                    "pct":        round((amt / total * 100), 1) if total > 0 else 0,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                for bot, amt in allocations.items()
            ]
            get_client().table("allocations").upsert(rows, on_conflict="bot").execute()
            return True
        except Exception as e:
            log.error(f"save_allocations failed: {e}")
            return False

    # ── WALLET CONFIG ─────────────────────────────────────────────────────────

    def get_wallet_configs(self) -> list:
        try:
            r = get_client().table("wallet_config").select("*").order("added_at").execute()
            return r.data or []
        except Exception as e:
            log.error(f"get_wallet_configs failed: {e}")
            return []

    def save_wallet_config(self, wallet: dict) -> bool:
        try:
            get_client().table("wallet_config").upsert({
                "name":      wallet["name"],
                "address":   wallet["address"],
                "copy":      wallet.get("copy", False),
                "copy_size": wallet.get("copy_size", 0.7),
                "max_usd":   wallet.get("max_usd", 80),
                "strategy":  wallet.get("strategy", ""),
                "notes":     wallet.get("notes", ""),
                "status":    wallet.get("status", "connected"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="address").execute()
            return True
        except Exception as e:
            log.error(f"save_wallet_config failed: {e}")
            return False

    # ── APP STATE ─────────────────────────────────────────────────────────────

    def get_app_state(self, key: str, default=None):
        try:
            r = get_client().table("app_state").select("value").eq("key", key).execute()
            if r.data:
                return r.data[0]["value"]
            return default
        except Exception as e:
            log.error(f"get_app_state({key}) failed: {e}")
            return default

    def set_app_state(self, key: str, value) -> bool:
        try:
            get_client().table("app_state").upsert({
                "key":        key,
                "value":      value,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="key").execute()
            return True
        except Exception as e:
            log.error(f"set_app_state({key}) failed: {e}")
            return False


# Singleton
db = PolydeskDB()
