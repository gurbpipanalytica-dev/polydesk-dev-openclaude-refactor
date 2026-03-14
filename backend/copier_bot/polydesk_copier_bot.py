"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          POLYDESK — COPIER BOT                                              ║
║          Watches whale wallets · Mirrors their trades                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  Wallets tracked (from Strategy Bible):                                     ║
║  • TeemuTeemuTeemu  — Esports lag specialist, 57% win rate                 ║
║  • Account88888     — BTC direction trader, 53.9% win rate                 ║
║  • kingofcoinflips  — BTC direction, 57.3% win rate                        ║
║  • defiance_cr      — MM signal only (study, don't copy)                   ║
║  • gabagool         — Mathematical mispricing (study only)                  ║
║                                                                             ║
║  HOW IT WORKS:                                                              ║
║  1. Poll each wallet's trade history via Polymarket API every 30s          ║
║  2. Detect new trades since last check                                      ║
║  3. Mirror the trade at configured copy_size multiplier                    ║
║  4. Write state to /app/state/copier_state.json for dashboard              ║
║                                                                             ║
║  POST-FEB 2026: All copy orders are LIMIT (maker). Never market orders.    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import aiohttp
import json
import os
import time
import logging
import sys
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from polydesk_state_bridge import StateBridge

# ── CONFIG ────────────────────────────────────────────────────────────────────
LIVE_MODE       = os.environ.get("LIVE_MODE", "false").lower() == "true"
POLL_INTERVAL   = 30          # seconds between wallet polls
MAX_COPY_USD    = 100         # max $ per copied trade
MIN_COPY_USD    = 10          # min $ per copied trade
COPY_DELAY_SEC  = 5           # wait N seconds after detecting trade before copying

# Wallet registry — address, copy config, what we learn from them
WALLETS = [
    {
        "name":        "kingofcoinflips",
        "address":     "0xe9c6312464b52aa3eff13d822b003282075995c9",
        "copy":        True,
        "copy_size":   0.7,
        "max_usd":     70,
        "strategy":    "BTC Direction",
        "notes":       "Consistent BTC calls. Confirmed on leaderboard.",
        "color":       "#8b5cf6",
    },
    {
        "name":        "majorexploiter",
        "address":     "0x019782cab5d844f02bafb71f512758be78579f3c",
        "copy":        True,
        "copy_size":   0.6,
        "max_usd":     60,
        "strategy":    "Multi-Market",
        "notes":       "#1 all-time leaderboard. $2.4M+ profit. Mirror carefully.",
        "color":       "#f59e0b",
    },
    {
        "name":        "HorizonSplendidView",
        "address":     "0x02227b8f5a9636e895607edd3185ed6ee5598ff7",
        "copy":        True,
        "copy_size":   0.5,
        "max_usd":     50,
        "strategy":    "Multi-Market",
        "notes":       "#2 all-time leaderboard. $1.8M+ profit.",
        "color":       "#10b981",
    },
    {
        "name":        "MinorKey4",
        "address":     "0xb90494d9a5d8f71f1930b2aa4b599f95c344c255",
        "copy":        False,
        "copy_size":   0,
        "max_usd":     0,
        "strategy":    "Study Only",
        "notes":       "#4 leaderboard. $782K profit. Studying strategy patterns.",
        "color":       "#3b82f6",
    },
    {
        "name":        "WoofMaster",
        "address":     "0x916f7165c2c836aba22edb6453cdbb5f3ea253ba",
        "copy":        False,
        "copy_size":   0,
        "max_usd":     0,
        "strategy":    "Study Only",
        "notes":       "#8 leaderboard. $571K profit. Studying approach.",
        "color":       "#64748b",
    },
]

GAMMA_API = "https://gamma-api.polymarket.com"
CLOB_API  = "https://clob.polymarket.com"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("CopierBot")


# ── DATA STRUCTURES ───────────────────────────────────────────────────────────
@dataclass
class WalletState:
    name:           str
    address:        str
    last_seen_trade: Optional[str] = None    # ID of last trade we processed
    total_trades:   int   = 0
    copied_trades:  int   = 0
    pnl_from_copy:  float = 0.0
    win_count:      int   = 0
    recent_trades:  list  = field(default_factory=list)


@dataclass
class CopiedTrade:
    wallet_name:  str
    market_id:    str
    market_q:     str
    side:         str
    their_size:   float
    our_size:     float
    entry_price:  float
    token_id:     str
    time:         float = field(default_factory=time.time)
    status:       str   = "open"      # open | closed | resolved
    pnl:          Optional[float] = None


# ── WALLET MONITOR ────────────────────────────────────────────────────────────
class WalletMonitor:
    """Polls Polymarket API for trades from a specific wallet address."""

    def __init__(self):
        self.wallet_states: dict[str, WalletState] = {
            w["name"]: WalletState(name=w["name"], address=w["address"])
            for w in WALLETS
        }

    async def get_recent_trades(
        self,
        session: aiohttp.ClientSession,
        wallet: dict,
    ) -> list[dict]:
        """
        Fetch recent trades for a wallet from Polymarket's trade history API.
        Returns list of trade dicts, newest first.
        """
        address = wallet.get("address", "").strip()
        if not address:
            return []
        try:
            async with session.get(
                f"{GAMMA_API}/trades",
                params={"maker": address, "limit": 10},
                timeout=aiohttp.ClientTimeout(total=8)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data if isinstance(data, list) else data.get("data", [])
        except Exception as e:
            log.debug(f"Trade fetch failed for {wallet['name']}: {e}")
        return []

    def detect_new_trades(self, wallet_name: str, trades: list) -> list:
        """Return trades we haven't seen before."""
        state = self.wallet_states[wallet_name]
        if not trades:
            return []
        new_trades = []
        for t in trades:
            tid = t.get("id") or t.get("transactionHash", "")
            if tid == state.last_seen_trade:
                break
            new_trades.append(t)
        if new_trades and trades:
            state.last_seen_trade = trades[0].get("id") or trades[0].get("transactionHash", "")
        return new_trades


# ── COPY EXECUTOR ─────────────────────────────────────────────────────────────
class CopyExecutor:
    """Mirrors detected wallet trades as limit orders."""

    def __init__(self):
        self.open_copies: list[CopiedTrade] = []
        self.closed_copies: list[CopiedTrade] = []
        self.total_pnl: float = 0.0
        self._client = None

        if LIVE_MODE:
            self._init_live_client()

    def _init_live_client(self):
        try:
            from py_clob_client.client import ClobClient
            from py_clob_client.clob_types import ApiCreds
            creds = ApiCreds(
                api_key        = os.environ["POLYMARKET_API_KEY"],
                api_secret     = os.environ["POLYMARKET_API_SECRET"],
                api_passphrase = os.environ["POLYMARKET_PASSPHRASE"],
            )
            self._client = ClobClient(
                host     = CLOB_API,
                key      = os.environ["POLYMARKET_PRIVATE_KEY"],
                chain_id = 137,
                creds    = creds,
            )
            log.info("✅ CLOB client initialized (LIVE)")
        except Exception as e:
            log.error(f"CLOB init failed: {e}")

    async def mirror_trade(
        self,
        wallet:  dict,
        trade:   dict,
        session: aiohttp.ClientSession,
    ) -> Optional[CopiedTrade]:
        """Mirror a detected wallet trade."""
        # Parse trade
        market_id   = trade.get("conditionId") or trade.get("market", "")
        market_q    = trade.get("title") or trade.get("question", "Unknown market")
        side        = (trade.get("side") or "YES").upper()
        their_size  = float(trade.get("size") or trade.get("amount") or 0)
        their_price = float(trade.get("price") or 0.5)
        token_id    = trade.get("tokenId") or trade.get("token_id", "")

        if their_size < 5 or not market_id:
            log.debug(f"Skipping trade — size too small or no market ID")
            return None

        # Calculate our copy size
        our_size = min(
            wallet["max_usd"],
            max(MIN_COPY_USD, their_size * wallet["copy_size"])
        )
        our_size = min(our_size, MAX_COPY_USD)

        # Limit price — match their price (maker order, no taker)
        limit_price = round(their_price, 3)

        log.info(f"📋 Copying {wallet['name']}: {side} {market_q[:50]}")
        log.info(f"   Their size: ${their_size:.0f} @ {their_price:.3f} → Our size: ${our_size:.0f}")

        # Small delay — let them move the price, then follow
        await asyncio.sleep(COPY_DELAY_SEC)

        if LIVE_MODE and self._client:
            try:
                from py_clob_client.clob_types import LimitOrderArgs, OrderType
                args = LimitOrderArgs(
                    token_id   = token_id,
                    price      = limit_price,
                    size       = our_size / limit_price,
                    side       = side,
                    order_type = OrderType.GTC,
                )
                resp = self._client.create_and_post_order(args)
                log.info(f"✅ LIVE copy order: {resp.get('orderID','?')}")
            except Exception as e:
                log.error(f"Copy order failed: {e}")
                return None
        else:
            log.info(f"📄 PAPER copy: {side} ${our_size:.0f} @ {limit_price:.3f}")

        copy = CopiedTrade(
            wallet_name  = wallet["name"],
            market_id    = market_id,
            market_q     = market_q[:60],
            side         = side,
            their_size   = their_size,
            our_size     = our_size,
            entry_price  = limit_price,
            token_id     = token_id,
        )
        self.open_copies.append(copy)
        return copy


# ── COPIER BOT ────────────────────────────────────────────────────────────────
class CopierBot:

    def __init__(self):
        self.monitor  = WalletMonitor()
        self.executor = CopyExecutor()
        self.bridge   = StateBridge("copier_bot")
        self.stats    = {w["name"]: {"pnl": 0.0, "copies": 0, "wins": 0} for w in WALLETS}

    async def run(self):
        log.info("═" * 60)
        log.info("  POLYDESK COPIER BOT")
        log.info(f"  Mode: {'🔴 LIVE' if LIVE_MODE else '📄 PAPER'}")
        log.info(f"  Tracking: {len(WALLETS)} wallets")
        log.info(f"  Copying:  {sum(1 for w in WALLETS if w['copy'])} wallets")
        log.info(f"  Polling every {POLL_INTERVAL}s")
        log.info("═" * 60)

        # Warn about empty addresses
        missing = [w["name"] for w in WALLETS if not w["address"]]
        if missing:
            log.warning(f"⚠️  No addresses configured for: {missing}")
            log.warning("   Add wallet addresses to WALLETS config in copier_bot.py")
            log.warning("   Bot will run but won't detect any trades until addresses are set")

        connector = aiohttp.TCPConnector(limit=10)
        async with aiohttp.ClientSession(connector=connector) as session:
            cycle = 0
            while True:
                try:
                    await self._poll_cycle(session)
                    cycle += 1
                    if cycle % 10 == 0:
                        self._write_bridge_state()
                    await asyncio.sleep(POLL_INTERVAL)
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    log.error(f"Poll cycle error: {e}", exc_info=True)
                    await asyncio.sleep(10)

        self._write_bridge_state()
        log.info("Copier bot stopped.")

    async def _poll_cycle(self, session: aiohttp.ClientSession):
        """Poll all wallets and mirror any new trades."""
        log.debug(f"Polling {len(WALLETS)} wallets...")
        for wallet in WALLETS:
            if not wallet.get("address"):
                continue
            trades = await self.monitor.get_recent_trades(session, wallet)
            new    = self.monitor.detect_new_trades(wallet["name"], trades)

            if not new:
                continue

            log.info(f"🎯 {wallet['name']}: {len(new)} new trade(s) detected")

            for trade in new:
                ws = self.monitor.wallet_states[wallet["name"]]
                ws.total_trades += 1

                if wallet["copy"]:
                    copy = await self.executor.mirror_trade(wallet, trade, session)
                    if copy:
                        ws.copied_trades  += 1
                        self.stats[wallet["name"]]["copies"] += 1
                        log.info(f"✅ Copied: {copy.market_q[:50]}")
                else:
                    log.info(f"📚 Studying {wallet['name']}: {trade.get('title','?')[:50]}")

        # Update open copy P&L estimates
        await self._update_copy_pnl(session)

    async def _update_copy_pnl(self, session: aiohttp.ClientSession):
        """Check if any open copies have resolved."""
        for copy in list(self.executor.open_copies):
            if copy.status != "open":
                continue
            try:
                async with session.get(
                    f"{GAMMA_API}/markets/{copy.market_id}",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as r:
                    if r.status == 200:
                        m = await r.json()
                        if m.get("closed") or m.get("resolved"):
                            resolved_yes = m.get("resolutionYes", False)
                            won = (copy.side == "YES" and resolved_yes) or \
                                  (copy.side == "NO" and not resolved_yes)
                            copy.pnl = copy.our_size * (1.0 / copy.entry_price - 1) if won else -copy.our_size
                            copy.status = "resolved"
                            self.executor.total_pnl += copy.pnl
                            self.executor.closed_copies.append(copy)
                            self.executor.open_copies.remove(copy)
                            ws = self.monitor.wallet_states.get(copy.wallet_name)
                            if ws:
                                ws.pnl_from_copy += copy.pnl
                                if copy.pnl > 0:
                                    ws.win_count += 1
                            emoji = "✅" if copy.pnl > 0 else "❌"
                            log.info(f"{emoji} Copy resolved: {copy.market_q[:50]} | P&L: ${copy.pnl:+.2f}")
            except:
                pass

    def _write_bridge_state(self):
        """Write standardised state for dashboard."""
        all_closed = self.executor.closed_copies
        wins       = sum(1 for c in all_closed if (c.pnl or 0) > 0)
        win_rate   = (wins / max(len(all_closed), 1)) * 100

        recent_trades = [
            self.bridge.write_trade(
                market      = c.market_q,
                side        = c.side,
                size_usd    = c.our_size,
                entry_price = c.entry_price,
                exit_price  = None if c.status == "open" else (1.0 if (c.pnl or 0) > 0 else 0.0),
                pnl         = c.pnl,
                status      = c.status,
                exec_ms     = 35,
                method      = f"copy_{c.wallet_name}",
            )
            for c in reversed((self.executor.open_copies + all_closed)[-20:])
        ]

        wallet_summary = {
            w["name"]: {
                "copy":     w["copy"],
                "strategy": w["strategy"],
                "copies":   self.monitor.wallet_states[w["name"]].copied_trades,
                "pnl":      round(self.monitor.wallet_states[w["name"]].pnl_from_copy, 2),
                "wins":     self.monitor.wallet_states[w["name"]].win_count,
                "has_address": bool(w["address"]),
            }
            for w in WALLETS
        }

        self.bridge.write(
            status           = "live",
            daily_pnl        = round(self.executor.total_pnl, 2),
            total_pnl        = round(self.executor.total_pnl, 2),
            trades_today     = len(all_closed),
            total_trades     = len(all_closed) + len(self.executor.open_copies),
            win_rate         = round(win_rate, 1),
            capital_deployed = MAX_COPY_USD * len([w for w in WALLETS if w["copy"]]),
            open_positions   = [
                {"market": c.market_q, "side": c.side, "entry": c.entry_price,
                 "size": c.our_size, "wallet": c.wallet_name, "status": "open"}
                for c in self.executor.open_copies
            ],
            recent_trades    = recent_trades,
            extra            = {
                "wallets_tracked":  len(WALLETS),
                "wallets_copying":  sum(1 for w in WALLETS if w["copy"]),
                "wallet_summary":   wallet_summary,
                "strategy":         "Wallet Copy Trading",
                "bot_file":         "polydesk_copier_bot.py",
            }
        )

        cmd = self.bridge.read_command()
        if cmd and cmd.get("action") == "pause":
            self.bridge.write_paused(cmd.get("reason", ""))
            raise SystemExit("Paused by orchestrator")


# ── ENTRY POINT ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════╗
║   POLYDESK — COPIER BOT                          ║
║                                                  ║
║   Tracking 5 wallets · Copying 3 · Studying 2   ║
║   LIVE_MODE = False → paper copy mode            ║
║                                                  ║
║   ⚠️  Add wallet addresses before going live!    ║
╚══════════════════════════════════════════════════╝
    """)
    bot = CopierBot()
    asyncio.run(bot.run())
