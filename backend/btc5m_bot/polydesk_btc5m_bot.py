"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          POLYDESK — BTC 5-MINUTE UP/DOWN BOT  v3.0                         ║
║          Strategy: Binance Order Flow Imbalance + Gabagool Mispricing       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Two income streams, zero market orders, 100% limit/maker execution         ║
║                                                                             ║
║  METHOD 1 — ORDER FLOW IMBALANCE (OFI)                                      ║
║    Connect to Binance WebSocket streams (free, no auth):                    ║
║      • btcusdt@aggTrade  — every real trade, buyer/seller aggressor tagged  ║
║      • btcusdt@forceOrder — futures liquidation cascade alerts              ║
║    Rolling 60s OFI = (buy_vol - sell_vol) / total_vol                       ║
║    Signal fires when:                                                       ║
║      • OFI > +0.65  → strong buy pressure  → bet YES                       ║
║      • OFI < -0.65  → strong sell pressure → bet NO                        ║
║      • Liquidation ≥ $500k in same direction → confidence boost             ║
║    This is a LEADING indicator — fires in first 60s of a 5-min window.     ║
║                                                                             ║
║  METHOD 2 — GABAGOOL MISPRICING                                             ║
║    Never predict direction. Wait for one side to misprice.                  ║
║    If YES < 0.47 in balanced market → buy YES (should be ~0.50)            ║
║    If NO  < 0.47 in balanced market → buy NO                               ║
║    Pure math, zero directional bet. Only fires on liquid markets (>$500).  ║
║                                                                             ║
║  POST-FEB 2026 FEE MODEL                                                    ║
║    ALL orders are limit (maker). Never fire market orders.                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  SETUP                                                                      ║
║    pip install aiohttp websockets                                           ║
║    export POLYMARKET_PRIVATE_KEY="0x..."                                    ║
║    python polydesk_btc5m_bot.py                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import aiohttp
import websockets
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from polydesk_state_bridge import StateBridge
import json
import time
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional
from collections import deque

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
LIVE_MODE                   = False       # ⚠️  Set True only after paper trading 7+ days

# Strategy toggles
USE_OFI                     = True        # Method 1: Binance order flow imbalance
USE_GABAGOOL_MISPRICING     = True        # Method 2: mathematical mispricing

# OFI parameters
OFI_WINDOW_SEC              = 60          # Rolling window for buy/sell volume
OFI_LIMIT_OFFSET            = 0.015       # Post 1.5c inside mid for fast fill
OFI_MAX_ENTRY_SEC_REMAINING = 240         # Only enter if ≥240s left in window (need exit room)
OFI_MIN_ENTRY_SEC_REMAINING = 30          # Don't enter if <30s left
OFI_MIN_VOLUME_USD          = 500_000     # Minimum rolling window volume (filters thin periods)

# ── TIERED SIGNAL SYSTEM ──────────────────────────────────────────────────────
# Tier 1 — HIGH confidence OFI  → full size
OFI_TIER1_THRESHOLD         = 0.65        # Strong directional imbalance
OFI_TIER1_SIZE_USD          = 150

# Tier 2 — MEDIUM confidence OFI → reduced size
OFI_TIER2_THRESHOLD         = 0.40        # Moderate imbalance
OFI_TIER2_SIZE_USD          = 100

# Tier 3 — MOMENTUM fallback → small bet when OFI is flat
MOMENTUM_THRESHOLD_PCT      = 0.0015      # BTC moved ≥0.15% from window open
MOMENTUM_SIZE_USD           = 75
MOMENTUM_MIN_VOLUME_USD     = 1_000       # Market must have some liquidity

# Liquidation boost
LIQ_BOOST_THRESHOLD_USD     = 500_000     # Liquidation ≥ $500k triggers confidence boost
LIQ_BOOST_AMOUNT            = 0.15        # Adds +0.15 to OFI confidence when liq fires
LIQ_WINDOW_SEC              = 20          # Only count liquidations from last 20s

# Gabagool mispricing parameters
GABAGOOL_ENTRY_THRESHOLD    = 0.47        # Enter if side price ≤ this
GABAGOOL_EXIT_TARGET        = 0.52        # Exit when price returns to fair value
GABAGOOL_MAX_HOLD_SEC       = 240         # Max hold time before forced exit
GABAGOOL_MIN_VOLUME_USD     = 500         # Only enter liquid markets

# Risk management
MAX_POSITION_USD            = 150         # Max $ per trade
MAX_CONCURRENT_POSITIONS    = 3           # Max open positions at once
MAX_DAILY_LOSS_USD          = 400         # Kill switch
STOP_LOSS_PCT               = 0.30        # Exit if position drops 30%

# Maker rebate
ESTIMATED_MAKER_REBATE      = 0.0002      # 0.02% per filled order

# Polymarket endpoints
GAMMA_API    = "https://gamma-api.polymarket.com"
CLOB_API     = "https://clob.polymarket.com"

# Binance WebSocket endpoints (free, no auth)
# Each asset gets its own dedicated aggTrade stream for accurate OFI
BINANCE_WS_BTC_TRADE   = "wss://stream.binance.com:9443/ws/btcusdt@aggTrade"
BINANCE_WS_ETH_TRADE   = "wss://stream.binance.com:9443/ws/ethusdt@aggTrade"
BINANCE_WS_SOL_TRADE   = "wss://stream.binance.com:9443/ws/solusdt@aggTrade"
BINANCE_WS_LIQUIDATION = "wss://fstream.binance.com/ws/!forceOrder@arr"  # ALL liquidations

# Binance REST fallback for prices
BINANCE_TICKER_BTC = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
BINANCE_TICKER_ETH = "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"
BINANCE_TICKER_SOL = "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT"

# Scanner configs — each entry maps to its own OFI stream
SCAN_CONFIGS = [
    {"asset": "btc", "interval": 300,  "slug_prefix": "btc-updown-5m"},
    {"asset": "btc", "interval": 900,  "slug_prefix": "btc-updown-15m"},
    {"asset": "eth", "interval": 300,  "slug_prefix": "eth-updown-5m"},
    {"asset": "sol", "interval": 300,  "slug_prefix": "sol-updown-5m"},
]

# ── LOGGING ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("BTC5M")


# ── DATA STRUCTURES ───────────────────────────────────────────────────────────
@dataclass
class Market5m:
    condition_id:   str
    token_yes:      str
    token_no:       str
    question:       str
    start_time:     float
    end_time:       float
    open_price:     float
    current_yes:    float = 0.50
    current_no:     float = 0.50
    volume_usd:     float = 0.0
    is_active:      bool  = True
    asset:          str   = "btc"   # btc | eth | sol — routes to correct OFI stream

    @property
    def seconds_remaining(self) -> float:
        return max(0, self.end_time - time.time())

    @property
    def window_elapsed_pct(self) -> float:
        total   = self.end_time - self.start_time
        elapsed = time.time() - self.start_time
        return min(1.0, elapsed / total) if total > 0 else 0


@dataclass
class Position:
    market_id:      str
    side:           str
    method:         str
    entry_price:    float
    size_usd:       float
    token_id:       str
    open_time:      float = field(default_factory=time.time)
    close_price:    Optional[float] = None
    pnl:            Optional[float] = None
    status:         str = "open"

    @property
    def hold_seconds(self) -> float:
        return time.time() - self.open_time


# ── BINANCE ORDER FLOW ENGINE ─────────────────────────────────────────────────
class BinanceOrderFlow:
    """
    Multi-asset order flow engine.
    Maintains SEPARATE rolling OFI windows for BTC, ETH, and SOL.
    Each Polymarket market is evaluated against its own asset's flow.

    Streams (all free, no auth):
      btcusdt@aggTrade  → BTC OFI  → used for BTC 5m + BTC 15m markets
      ethusdt@aggTrade  → ETH OFI  → used for ETH 5m markets
      solusdt@aggTrade  → SOL OFI  → used for SOL 5m markets
      !forceOrder@arr   → ALL asset liquidations, filtered per symbol
    """

    ASSET_CONFIG = {
        "btc": {
            "ws":      BINANCE_WS_BTC_TRADE,
            "ticker":  BINANCE_TICKER_BTC,
            "liq_sym": "BTCUSDT",
        },
        "eth": {
            "ws":      BINANCE_WS_ETH_TRADE,
            "ticker":  BINANCE_TICKER_ETH,
            "liq_sym": "ETHUSDT",
        },
        "sol": {
            "ws":      BINANCE_WS_SOL_TRADE,
            "ticker":  BINANCE_TICKER_SOL,
            "liq_sym": "SOLUSDT",
        },
    }

    def __init__(self):
        # Per-asset state
        self.prices:  dict[str, float] = {}          # last price per asset
        self._trades: dict[str, deque] = {            # rolling trade buffers
            a: deque() for a in self.ASSET_CONFIG
        }
        self._liqs:   dict[str, deque] = {            # rolling liq buffers
            a: deque() for a in self.ASSET_CONFIG
        }
        self._connected: dict[str, bool] = {a: False for a in self.ASSET_CONFIG}
        self._connected_liq = False

    # ── startup ───────────────────────────────────────────────────────────────
    def start(self, loop: asyncio.AbstractEventLoop):
        for asset in self.ASSET_CONFIG:
            loop.create_task(self._listen_trades(asset))
        loop.create_task(self._listen_liquidations())
        log.info("🔌 Binance WebSocket listeners starting (BTC + ETH + SOL + Liquidations)...")

    # ── WebSocket listeners ───────────────────────────────────────────────────
    async def _listen_trades(self, asset: str):
        ws_url = self.ASSET_CONFIG[asset]["ws"]
        while True:
            try:
                async with websockets.connect(
                    ws_url, ping_interval=20, ping_timeout=10, close_timeout=5
                ) as ws:
                    self._connected[asset] = True
                    log.info(f"✅ {asset.upper()} aggTrade stream connected")
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                            is_buyer_aggressor = not msg["m"]
                            price   = float(msg["p"])
                            qty     = float(msg["q"])
                            usd_vol = price * qty
                            side    = "BUY" if is_buyer_aggressor else "SELL"
                            self.prices[asset] = price
                            self._trades[asset].append((time.time(), side, usd_vol))
                        except Exception:
                            pass
            except Exception as e:
                self._connected[asset] = False
                log.warning(f"{asset.upper()} trade WS dropped: {e} — reconnecting in 3s")
                await asyncio.sleep(3)

    async def _listen_liquidations(self):
        """Single stream for ALL liquidations, sorted into per-asset buckets."""
        while True:
            try:
                async with websockets.connect(
                    BINANCE_WS_LIQUIDATION, ping_interval=20, ping_timeout=10, close_timeout=5
                ) as ws:
                    self._connected_liq = True
                    log.info("✅ All-asset liquidation stream connected")
                    async for raw in ws:
                        try:
                            msg   = json.loads(raw)
                            order = msg.get("o", {})
                            sym   = order.get("s", "")      # e.g. "BTCUSDT"
                            side  = order.get("S", "")      # BUY or SELL
                            price = float(order.get("p", 0))
                            qty   = float(order.get("q", 0))
                            usd   = price * qty
                            # Route to correct asset bucket
                            for asset, cfg in self.ASSET_CONFIG.items():
                                if sym == cfg["liq_sym"]:
                                    if usd >= LIQ_BOOST_THRESHOLD_USD:
                                        log.info(f"💥 {asset.upper()} LIQ: {side} ${usd/1e6:.2f}M @ ${price:,.0f}")
                                    self._liqs[asset].append((time.time(), side, usd))
                                    break
                        except Exception:
                            pass
            except Exception as e:
                self._connected_liq = False
                log.warning(f"Liquidation WS dropped: {e} — reconnecting in 3s")
                await asyncio.sleep(3)

    # ── computed metrics (per asset) ──────────────────────────────────────────
    def _purge(self, asset: str):
        cutoff = time.time() - OFI_WINDOW_SEC
        buf = self._trades[asset]
        while buf and buf[0][0] < cutoff:
            buf.popleft()
        liq_cutoff = time.time() - LIQ_WINDOW_SEC
        lbuf = self._liqs[asset]
        while lbuf and lbuf[0][0] < liq_cutoff:
            lbuf.popleft()

    def ofi(self, asset: str = "btc") -> Optional[float]:
        """OFI for a specific asset. Returns -1..+1 or None if insufficient data."""
        self._purge(asset)
        buf = self._trades[asset]
        if len(buf) < 10:
            return None
        buy_vol  = sum(v for _, s, v in buf if s == "BUY")
        sell_vol = sum(v for _, s, v in buf if s == "SELL")
        total    = buy_vol + sell_vol
        if total < OFI_MIN_VOLUME_USD:
            return None
        return (buy_vol - sell_vol) / total

    def recent_liq(self, asset: str = "btc") -> tuple[str, float]:
        self._purge(asset)
        buf = self._liqs[asset]
        if not buf:
            return ("", 0.0)
        biggest = max(buf, key=lambda x: x[2])
        return (biggest[1], biggest[2])

    def rolling_volume_usd(self, asset: str = "btc") -> float:
        self._purge(asset)
        return sum(v for _, _, v in self._trades[asset])

    async def fetch_price_http(self, session: aiohttp.ClientSession,
                               asset: str = "btc") -> Optional[float]:
        """REST fallback price fetch for a specific asset."""
        url = self.ASSET_CONFIG[asset]["ticker"]
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=3)) as r:
                data  = await r.json()
                price = float(data["price"])
                self.prices[asset] = price
                return price
        except Exception:
            return None

    # ── signal methods (asset-aware) ──────────────────────────────────────────
    def signal(self, market: Market5m) -> Optional[dict]:
        """
        Tiered OFI signal using the market's OWN asset flow.
        BTC markets → BTC OFI. ETH markets → ETH OFI. SOL → SOL OFI.
        """
        asset = market.asset  # set by scanner from SCAN_CONFIGS
        remaining = market.seconds_remaining
        if not (OFI_MIN_ENTRY_SEC_REMAINING <= remaining <= OFI_MAX_ENTRY_SEC_REMAINING):
            return None

        ofi_val = self.ofi(asset)
        if ofi_val is None:
            return None

        # Liquidation boost (asset-specific)
        liq_side, liq_usd = self.recent_liq(asset)
        liq_boost = 0.0
        liq_note  = ""
        if liq_usd >= LIQ_BOOST_THRESHOLD_USD:
            liq_dir = "UP" if liq_side == "BUY" else "DOWN"
            ofi_dir = "UP" if ofi_val > 0 else "DOWN"
            if liq_dir == ofi_dir:
                liq_boost = LIQ_BOOST_AMOUNT
                liq_note  = f" + ${liq_usd/1e6:.1f}M {asset.upper()} liq"

        effective_ofi = abs(ofi_val) + liq_boost
        if effective_ofi < OFI_TIER2_THRESHOLD:
            return None

        tier     = 1 if effective_ofi >= OFI_TIER1_THRESHOLD else 2
        size_usd = OFI_TIER1_SIZE_USD if tier == 1 else OFI_TIER2_SIZE_USD
        tier_tag = "T1-HIGH" if tier == 1 else "T2-MED"

        direction = "UP" if ofi_val > 0 else "DOWN"
        side      = "YES" if direction == "UP" else "NO"
        token_id  = market.token_yes if direction == "UP" else market.token_no
        mid_price = market.current_yes if direction == "UP" else market.current_no
        limit_price = round(min(0.97, mid_price + OFI_LIMIT_OFFSET), 3)
        roll_vol    = self.rolling_volume_usd(asset)

        return {
            "method":       "ofi",
            "tier":         tier,
            "tier_tag":     tier_tag,
            "size_usd":     size_usd,
            "side":         side,
            "token_id":     token_id,
            "limit_price":  limit_price,
            "ofi":          round(ofi_val, 3),
            "effective":    round(effective_ofi, 3),
            "asset":        asset,
            "direction":    direction,
            "seconds_left": remaining,
            "roll_vol_usd": round(roll_vol),
            "reason": (
                f"[{tier_tag}][{asset.upper()}] OFI={ofi_val:+.3f} (eff={effective_ofi:.3f}) "
                f"${roll_vol/1e6:.2f}M/60s | {direction} → {side}{liq_note} | ${size_usd}"
            ),
        }

    def momentum_signal(self, market: Market5m) -> Optional[dict]:
        """
        Tier 3 momentum fallback using asset-specific price.
        ETH markets check ETH price move. SOL markets check SOL price move.
        """
        asset     = market.asset
        remaining = market.seconds_remaining
        if not (OFI_MIN_ENTRY_SEC_REMAINING <= remaining <= OFI_MAX_ENTRY_SEC_REMAINING):
            return None
        if market.volume_usd < MOMENTUM_MIN_VOLUME_USD:
            return None

        current_price = self.prices.get(asset)
        if not current_price or not market.open_price or market.open_price <= 0:
            return None

        pct_move = (current_price - market.open_price) / market.open_price
        if abs(pct_move) < MOMENTUM_THRESHOLD_PCT:
            return None

        direction   = "UP" if pct_move > 0 else "DOWN"
        side        = "YES" if direction == "UP" else "NO"
        token_id    = market.token_yes if direction == "UP" else market.token_no
        mid_price   = market.current_yes if direction == "UP" else market.current_no
        limit_price = round(min(0.97, mid_price + 0.010), 3)

        return {
            "method":      "momentum",
            "tier":        3,
            "tier_tag":    "T3-MOM",
            "size_usd":    MOMENTUM_SIZE_USD,
            "side":        side,
            "token_id":    token_id,
            "limit_price": limit_price,
            "pct_move":    round(pct_move * 100, 3),
            "open_price":  market.open_price,
            "asset_price": current_price,
            "asset":       asset,
            "direction":   direction,
            "seconds_left": remaining,
            "reason": (
                f"[T3-MOM][{asset.upper()}] {pct_move*100:+.3f}% from open "
                f"(${market.open_price:,.2f}→${current_price:,.2f}) "
                f"| {direction} → {side} | ${MOMENTUM_SIZE_USD}"
            ),
        }

class MarketScanner:
    def __init__(self):
        self.active_markets: dict[str, Market5m] = {}
        self._seen_slugs: set = set()

    async def scan(self, session: aiohttp.ClientSession, btc_price: float, asset_prices: dict = None) -> list[Market5m]:
        found  = []
        now    = time.time()
        now_int = int(now)

        for cfg in SCAN_CONFIGS:
            interval = cfg["interval"]
            prefix   = cfg["slug_prefix"]
            current_ts = now_int - (now_int % interval)
            next_ts    = current_ts + interval

            for window_ts in [current_ts, next_ts]:
                slug = f"{prefix}-{window_ts}"

                if slug in self._seen_slugs:
                    existing = self.active_markets.get(slug)
                    if existing and existing.seconds_remaining > 2:
                        yes_p, no_p = await self._fetch_prices(
                            session, existing.token_yes, existing.token_no)
                        if yes_p > 0.01:
                            existing.current_yes = yes_p
                        if no_p > 0.01:
                            existing.current_no  = no_p
                        found.append(existing)
                        continue
                    else:
                        self._seen_slugs.discard(slug)

                try:
                    url = f"{GAMMA_API}/events?slug={slug}"
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as r:
                        if r.status != 200:
                            continue
                        events = await r.json()

                    if not events:
                        continue

                    event = events[0]
                    mkts  = event.get("markets", [])
                    if not mkts:
                        continue

                    m = mkts[0]
                    if not m.get("active"):
                        continue

                    end_ts = self._parse_end_time(m)
                    if not end_ts:
                        continue

                    remaining    = end_ts - now
                    max_remaining = interval + 30
                    if remaining < 3 or remaining > max_remaining:
                        continue

                    outcomes      = m.get("outcomes", [])
                    clob_ids_raw  = m.get("clobTokenIds", "[]")
                    if isinstance(clob_ids_raw, str):
                        try:
                            clob_ids = json.loads(clob_ids_raw)
                        except Exception:
                            clob_ids = []
                    else:
                        clob_ids = clob_ids_raw or []

                    if len(outcomes) < 2 or len(clob_ids) < 2:
                        continue

                    up_idx, down_idx = 0, 1
                    for i, o in enumerate(outcomes):
                        if str(o).lower() == "up":
                            up_idx = i
                        elif str(o).lower() == "down":
                            down_idx = i

                    token_yes = str(clob_ids[up_idx])
                    token_no  = str(clob_ids[down_idx])

                    price_strs = m.get("outcomePrices", [])
                    if isinstance(price_strs, str):
                        try:
                            price_strs = json.loads(price_strs)
                        except Exception:
                            price_strs = ["0.50", "0.50"]

                    yes_price = float(price_strs[up_idx])   if up_idx   < len(price_strs) else 0.50
                    no_price  = float(price_strs[down_idx]) if down_idx < len(price_strs) else 0.50

                    start_ts  = end_ts - interval
                    cid       = m.get("conditionId") or slug
                    volume    = float(m.get("volumeNum", 0) or m.get("volume", 0) or 0)

                    market = Market5m(
                        condition_id = cid,
                        token_yes    = token_yes,
                        token_no     = token_no,
                        question     = m.get("question", event.get("title", slug)),
                        start_time   = start_ts,
                        end_time     = end_ts,
                        open_price   = (asset_prices or {}).get(cfg["asset"], btc_price) if asset_prices else btc_price,
                        current_yes  = yes_price,
                        current_no   = no_price,
                        volume_usd   = volume,
                        asset        = cfg["asset"],
                    )

                    fresh_yes, fresh_no = await self._fetch_prices(session, token_yes, token_no)
                    if fresh_yes > 0.01 and fresh_no > 0.01:
                        market.current_yes = fresh_yes
                        market.current_no  = fresh_no

                    found.append(market)
                    self.active_markets[slug] = market
                    self._seen_slugs.add(slug)

                    log.info(
                        f"📡 Found: {market.question[:55]} | "
                        f"Up={market.current_yes:.3f} Dn={market.current_no:.3f} | "
                        f"{market.seconds_remaining:.0f}s | ${volume/1000:.0f}K vol"
                    )

                except Exception as e:
                    log.debug(f"Slug lookup error [{slug}]: {e}")

        expired = [k for k, v in self.active_markets.items() if v.seconds_remaining <= 0]
        for k in expired:
            del self.active_markets[k]
            self._seen_slugs.discard(k)

        return found

    def _parse_end_time(self, m: dict) -> Optional[float]:
        for key in ["endDate", "endDateIso", "end_date_iso", "end_date"]:
            val = m.get(key)
            if val:
                if isinstance(val, (int, float)):
                    return float(val)
                if isinstance(val, str):
                    try:
                        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                        return dt.timestamp()
                    except Exception:
                        pass
        return None

    async def _fetch_prices(self, session: aiohttp.ClientSession,
                            token_yes: str, token_no: str) -> tuple[float, float]:
        yes_price, no_price = 0.50, 0.50
        try:
            async with session.get(
                f"{CLOB_API}/midpoints",
                params={"token_id": [token_yes, token_no]},
                timeout=aiohttp.ClientTimeout(total=5)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    for item in data:
                        tid = item.get("token_id", "")
                        mid = float(item.get("mid", 0.5) or 0.5)
                        if tid == token_yes:
                            yes_price = mid
                        elif tid == token_no:
                            no_price = mid
        except Exception:
            pass
        return yes_price, no_price


# ── GABAGOOL SIGNAL ENGINE ────────────────────────────────────────────────────
class GabagoolSignal:
    """
    Mathematical mispricing: in a fair BTC up/down market YES ≈ NO ≈ 0.50.
    Only fires on liquid markets (volume > GABAGOOL_MIN_VOLUME_USD).
    """

    def evaluate(self, market: Market5m) -> Optional[dict]:
        if market.seconds_remaining < 60:
            return None
        if market.window_elapsed_pct > 0.70:
            return None
        if market.volume_usd < GABAGOOL_MIN_VOLUME_USD:
            return None

        yes_p = market.current_yes
        no_p  = market.current_no

        if yes_p <= GABAGOOL_ENTRY_THRESHOLD and yes_p > 0.05:
            misprice    = 0.50 - yes_p
            limit_price = round(yes_p + 0.005, 3)
            return {
                "method":      "gabagool",
                "side":        "YES",
                "token_id":    market.token_yes,
                "limit_price": limit_price,
                "misprice":    misprice,
                "reason":      f"YES mispriced at {yes_p:.3f} (fair: 0.50, gap: {misprice:.3f})",
            }

        if no_p <= GABAGOOL_ENTRY_THRESHOLD and no_p > 0.05:
            misprice    = 0.50 - no_p
            limit_price = round(no_p + 0.005, 3)
            return {
                "method":      "gabagool",
                "side":        "NO",
                "token_id":    market.token_no,
                "limit_price": limit_price,
                "misprice":    misprice,
                "reason":      f"NO mispriced at {no_p:.3f} (fair: 0.50, gap: {misprice:.3f})",
            }

        return None


# ── EXECUTOR ──────────────────────────────────────────────────────────────────
class Executor:
    def __init__(self):
        self.open_positions:   list[Position] = []
        self.closed_positions: list[Position] = []
        self.daily_pnl:        float = 0.0
        self.total_fills:      int   = 0
        self.total_rebates:    float = 0.0
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
                host    = CLOB_API,
                key     = os.environ["POLYMARKET_PRIVATE_KEY"],
                chain_id= 137,
                creds   = creds,
            )
            log.info("✅ CLOB client initialized (LIVE MODE)")
        except Exception as e:
            log.error(f"Failed to init CLOB client: {e}")
            self._client = None

    @property
    def can_open_position(self) -> bool:
        open_count = sum(1 for p in self.open_positions if p.status == "open")
        daily_loss = abs(min(0, self.daily_pnl))
        return open_count < MAX_CONCURRENT_POSITIONS and daily_loss < MAX_DAILY_LOSS_USD

    def already_in_market(self, market_id: str) -> bool:
        return any(p.market_id == market_id and p.status == "open"
                   for p in self.open_positions)

    async def enter(self, market: Market5m, signal: dict,
                    session: aiohttp.ClientSession) -> Optional[Position]:
        if not self.can_open_position:
            log.warning("⛔ Position limit or daily loss limit reached — skipping")
            return None
        if self.already_in_market(market.condition_id):
            return None

        size_usd    = signal.get("size_usd", MAX_POSITION_USD)
        side        = signal["side"]
        limit_price = signal["limit_price"]
        token_id    = signal["token_id"]
        method      = signal["method"]

        if LIVE_MODE and self._client:
            try:
                from py_clob_client.clob_types import LimitOrderArgs, OrderType
                args = LimitOrderArgs(
                    token_id   = token_id,
                    price      = limit_price,
                    size       = size_usd / limit_price,
                    side       = side,
                    order_type = OrderType.GTC,
                )
                resp     = self._client.create_and_post_order(args)
                order_id = resp.get("orderID", "unknown")
                log.info(f"📤 LIVE limit: {side} ${size_usd:.0f} @ {limit_price:.3f} | id={order_id}")
            except Exception as e:
                log.error(f"Order post failed: {e}")
                return None
        else:
            log.info(f"📄 PAPER limit: {side} ${size_usd:.0f} @ {limit_price:.3f} | {method}")
            log.info(f"   {signal['reason']}")

        pos = Position(
            market_id   = market.condition_id,
            side        = side,
            method      = method,
            entry_price = limit_price,
            size_usd    = size_usd,
            token_id    = token_id,
        )
        self.open_positions.append(pos)
        self.total_fills  += 1
        rebate             = size_usd * ESTIMATED_MAKER_REBATE
        self.total_rebates += rebate
        log.info(f"   +${rebate:.2f} maker rebate")
        return pos

    async def check_exits(self, markets: dict[str, Market5m],
                          session: aiohttp.ClientSession):
        for pos in list(self.open_positions):
            if pos.status != "open":
                continue

            market = next((m for m in markets.values() if m.condition_id == pos.market_id), None)

            # ── ORPHAN CLEANUP ────────────────────────────────────────────────
            if not market:
                max_window = max(c["interval"] for c in SCAN_CONFIGS)
                if pos.hold_seconds > max_window * 2:
                    log.warning(
                        f"⚠️  ORPHAN: {pos.side} held {pos.hold_seconds:.0f}s, "
                        f"no market found — force-closing flat"
                    )
                    pos.close_price = pos.entry_price
                    pos.pnl         = 0.0
                    pos.status      = "closed"
                    self.open_positions.remove(pos)
                    self.closed_positions.append(pos)
                continue
            # ─────────────────────────────────────────────────────────────────

            current_price = market.current_yes if pos.side == "YES" else market.current_no
            should_exit   = False
            exit_reason   = ""

            # Gabagool: take profit at fair value
            if pos.method == "gabagool":
                if current_price >= GABAGOOL_EXIT_TARGET:
                    should_exit = True
                    exit_reason = f"Gabagool target: {current_price:.3f} ≥ {GABAGOOL_EXIT_TARGET}"
                elif pos.hold_seconds > GABAGOOL_MAX_HOLD_SEC:
                    should_exit = True
                    exit_reason = f"Max hold exceeded ({pos.hold_seconds:.0f}s)"

            # OFI: exit at end of window or if OFI reverses
            if pos.method == "ofi":
                if pos.hold_seconds > GABAGOOL_MAX_HOLD_SEC:
                    should_exit = True
                    exit_reason = f"Max hold exceeded ({pos.hold_seconds:.0f}s)"

            # Stop loss (all methods)
            stop_level = pos.entry_price * (1 - STOP_LOSS_PCT)
            if current_price < stop_level:
                should_exit = True
                exit_reason = f"Stop loss: {current_price:.3f} < {stop_level:.3f}"

            # Market resolving
            if market.seconds_remaining < 5:
                should_exit = True
                exit_reason = "Window closing — forced exit"

            if should_exit:
                await self._exit_position(pos, current_price, exit_reason, session)

    async def _exit_position(self, pos: Position, exit_price: float,
                             reason: str, session: aiohttp.ClientSession):
        if LIVE_MODE and self._client:
            try:
                from py_clob_client.clob_types import LimitOrderArgs, OrderType
                sell_price = round(exit_price - 0.005, 3)
                args = LimitOrderArgs(
                    token_id   = pos.token_id,
                    price      = sell_price,
                    size       = pos.size_usd / pos.entry_price,
                    side       = "SELL",
                    order_type = OrderType.GTC,
                )
                self._client.create_and_post_order(args)
            except Exception as e:
                log.error(f"Exit order failed: {e}")

        pnl = pos.size_usd * (exit_price / pos.entry_price - 1)
        pos.close_price = exit_price
        pos.pnl         = pnl
        pos.status      = "closed"
        self.daily_pnl += pnl
        self.open_positions.remove(pos)
        self.closed_positions.append(pos)

        emoji = "✅" if pnl > 0 else "❌"
        log.info(
            f"{emoji} Closed | {pos.side} {pos.method} | "
            f"entry={pos.entry_price:.3f} exit={exit_price:.3f} | "
            f"P&L=${pnl:+.2f} | {reason}"
        )


# ── REPORTER ──────────────────────────────────────────────────────────────────
class Reporter:
    def __init__(self, ofi: BinanceOrderFlow, executor: Executor):
        self.ofi      = ofi
        self.executor = executor
        self.start    = time.time()

    def print_status(self, markets: list[Market5m]):
        ex         = self.executor
        uptime_min = (time.time() - self.start) / 60
        closed     = ex.closed_positions
        wins       = sum(1 for p in closed if (p.pnl or 0) > 0)
        total      = len(closed)
        win_r      = f"{wins}/{total} ({wins/total*100:.0f}%)" if total else "0/0"
        ofi_val    = self.ofi.ofi()
        roll_vol   = self.ofi.rolling_volume_usd()
        liq_side, liq_usd = self.ofi.recent_liq()

        ofi_str  = f"{ofi_val:+.3f}" if ofi_val is not None else "  n/a"
        ofi_bar  = self._bar(ofi_val) if ofi_val is not None else "no data yet"
        liq_str  = f"{liq_side} ${liq_usd/1e6:.2f}M" if liq_usd > 0 else "none"

        ofi_trades  = sum(1 for p in closed if p.method == "ofi")
        gaba_trades = sum(1 for p in closed if p.method == "gabagool")

        print("\n" + "═" * 72)
        print(f"  POLYDESK — BTC 5-MIN  |  {'🔴 LIVE' if LIVE_MODE else '📄 PAPER'}  |  {datetime.now().strftime('%H:%M:%S')}")
        print("═" * 72)
        btc_p = self.ofi.prices.get("btc")
        eth_p = self.ofi.prices.get("eth")
        sol_p = self.ofi.prices.get("sol")
        print(f"  BTC ${btc_p:,.0f}" if btc_p else "  BTC: connecting...", end="")
        print(f"  ETH ${eth_p:,.0f}" if eth_p else "  ETH: connecting...", end="")
        print(f"  SOL ${sol_p:,.2f}" if sol_p else "  SOL: connecting...")
        ws_btc = '✅' if self.ofi._connected.get('btc') else '🔴'
        ws_eth = '✅' if self.ofi._connected.get('eth') else '🔴'
        ws_sol = '✅' if self.ofi._connected.get('sol') else '🔴'
        ws_liq = '✅' if self.ofi._connected_liq else '🔴'
        print(f"  WS Streams             : BTC{ws_btc} ETH{ws_eth} SOL{ws_sol} LIQ{ws_liq}")
        print(f"  OFI BTC (60s)          : {_fmt_ofi(btc_ofi)}")
        print(f"  OFI ETH (60s)          : {_fmt_ofi(eth_ofi)}")
        print(f"  OFI SOL (60s)          : {_fmt_ofi(sol_ofi)}")
        print(f"  BTC Roll Vol (60s)     : ${roll_vol/1e6:.2f}M")
        print(f"  Last BTC Liquidation   : {liq_str}")
        print(f"  Uptime                 : {uptime_min:.1f} min")
        print(f"  Active Markets         : {len(markets)}")
        print(f"  Open Positions         : {len([p for p in ex.open_positions if p.status=='open'])}/{MAX_CONCURRENT_POSITIONS}")
        print()
        print(f"  ── PERFORMANCE ──────────────────────────────────")
        print(f"  Total Fills            : {ex.total_fills}")
        print(f"  Win Rate               : {win_r}")
        print(f"  Daily P&L              : ${ex.daily_pnl:+.2f}")
        print(f"  Maker Rebates          : ${ex.total_rebates:.2f}")
        print(f"  Net Today              : ${ex.daily_pnl + ex.total_rebates:+.2f}")
        print()
        print(f"  ── BY METHOD ────────────────────────────────────")
        print(f"  OFI trades             : {ofi_trades}")
        print(f"  Gabagool trades        : {gaba_trades}")
        print()

        if markets:
            print(f"  ── ACTIVE MARKETS ───────────────────────────────")
            for m in markets[:6]:
                bar_len  = 20
                filled   = int(bar_len * m.window_elapsed_pct)
                bar      = "█" * filled + "░" * (bar_len - filled)
                liq_flag = " 💧" if m.volume_usd >= GABAGOOL_MIN_VOLUME_USD else " (thin)"
                print(f"  [{bar}] {m.seconds_remaining:4.0f}s | "
                      f"YES={m.current_yes:.3f} NO={m.current_no:.3f} | "
                      f"${m.volume_usd/1000:.0f}K{liq_flag}")

        if ex.open_positions:
            print()
            print(f"  ── OPEN POSITIONS ───────────────────────────────")
            for p in ex.open_positions:
                if p.status == "open":
                    print(f"  {p.side:3s} @ {p.entry_price:.3f} | ${p.size_usd:.0f} | "
                          f"{p.method} | {p.hold_seconds:.0f}s held")
        print("═" * 72)

    @staticmethod
    def _bar(ofi: float, width: int = 20) -> str:
        """Visual bar for OFI: ←——●——→"""
        mid   = width // 2
        pos   = int((ofi + 1) / 2 * width)
        pos   = max(0, min(width - 1, pos))
        bar   = ["-"] * width
        bar[mid] = "│"
        bar[pos] = "●"
        left  = "SELL"
        right = "BUY"
        return f"{left} [{''.join(bar)}] {right}"


# ── MAIN BOT ──────────────────────────────────────────────────────────────────
class BTC5MBot:
    def __init__(self):
        self.ofi      = BinanceOrderFlow()
        self.scanner  = MarketScanner()
        self.gabagool = GabagoolSignal()
        self.executor = Executor()
        self.reporter = Reporter(self.ofi, self.executor)
        self.bridge   = StateBridge("btc5m_bot")

    def _write_bridge_state(self, markets: list):
        ex       = self.executor
        closed   = ex.closed_positions
        win_rate = (sum(1 for p in closed if (p.pnl or 0) > 0) / max(len(closed), 1)) * 100
        recent_trades = [
            self.bridge.write_trade(
                market      = f"BTC 5-min {p.side}",
                side        = p.side,
                size_usd    = p.size_usd,
                entry_price = p.entry_price,
                exit_price  = p.close_price,
                pnl         = p.pnl,
                status      = p.status,
                exec_ms     = 18,
                method      = p.method,
            )
            for p in reversed(closed[-20:])
        ]
        open_pos = [
            {"market": f"BTC 5-min {p.side}", "side": p.side,
             "entry": p.entry_price, "size": p.size_usd, "status": "open"}
            for p in ex.open_positions if p.status == "open"
        ]
        ofi_val = self.ofi.ofi()
        self.bridge.write(
            status           = "live",
            daily_pnl        = round(ex.daily_pnl + ex.total_rebates, 2),
            total_pnl        = round(ex.daily_pnl + ex.total_rebates, 2),
            trades_today     = ex.total_fills,
            total_trades     = ex.total_fills,
            win_rate         = round(win_rate, 1),
            capital_deployed = MAX_POSITION_USD * MAX_CONCURRENT_POSITIONS,
            total_rebates    = round(ex.total_rebates, 2),
            open_positions   = open_pos,
            recent_trades    = recent_trades,
            extra={
                "btc_price":      self.ofi.prices.get("btc"),
                "eth_price":      self.ofi.prices.get("eth"),
                "sol_price":      self.ofi.prices.get("sol"),
                "ofi_btc":        round(btc_ofi, 3) if (btc_ofi := self.ofi.ofi("btc")) is not None else None,
                "ofi_eth":        round(eth_ofi, 3) if (eth_ofi := self.ofi.ofi("eth")) is not None else None,
                "ofi_sol":        round(sol_ofi, 3) if (sol_ofi := self.ofi.ofi("sol")) is not None else None,
                "roll_vol_usd":   round(self.ofi.rolling_volume_usd()),
                "ws_btc":         self.ofi._connected.get("btc", False),
                "ws_eth":         self.ofi._connected.get("eth", False),
                "ws_sol":         self.ofi._connected.get("sol", False),
                "ws_liq":         self.ofi._connected_liq,
                "active_markets": len(markets),
                "strategy":       "OFI + Gabagool",
                "bot_file":       "polydesk_btc5m_bot.py",
            },
        )
        cmd = self.bridge.read_command()
        if cmd and cmd.get("action") == "pause":
            self.bridge.write_paused(cmd.get("reason", ""))
            raise SystemExit("Paused by orchestrator")

    async def run(self):
        log.info("=" * 60)
        log.info("  POLYDESK BTC 5-MIN BOT v3.0 — OFI EDITION")
        log.info(f"  Mode: {'🔴 LIVE' if LIVE_MODE else '📄 PAPER (safe)'}")
        log.info(f"  T1≥{OFI_TIER1_THRESHOLD} ${OFI_TIER1_SIZE_USD} | T2≥{OFI_TIER2_THRESHOLD} ${OFI_TIER2_SIZE_USD} | T3-MOM≥{MOMENTUM_THRESHOLD_PCT*100:.2f}% ${MOMENTUM_SIZE_USD}")
        log.info(f"  Liq boost: ${LIQ_BOOST_THRESHOLD_USD/1e6:.1f}M+ → +{LIQ_BOOST_AMOUNT}")
        log.info(f"  Gabagool: min volume ${GABAGOOL_MIN_VOLUME_USD}")
        log.info(f"  Max position: ${MAX_POSITION_USD} | Slots: {MAX_CONCURRENT_POSITIONS}")
        log.info("=" * 60)

        if LIVE_MODE:
            input("\n⚠️  LIVE MODE. Press ENTER to confirm, Ctrl+C to abort...\n")

        # Start Binance WebSocket listeners
        loop = asyncio.get_event_loop()
        self.ofi.start(loop)

        # Wait briefly for WS to connect before first scan
        log.info("⏳ Waiting 5s for WebSocket connections...")
        await asyncio.sleep(5)

        connector = aiohttp.TCPConnector(limit=20)
        async with aiohttp.ClientSession(connector=connector) as session:
            scan_count = 0
            while True:
                try:
                    # 1. Get BTC price (from WS if available, else REST fallback)
                    btc_price = self.ofi.prices.get("btc")
                    if not btc_price:
                        btc_price = await self.ofi.fetch_price_http(session, "btc")
                    # Warm up ETH and SOL prices if not yet received via WS
                    for _a in ["eth", "sol"]:
                        if not self.ofi.prices.get(_a):
                            await self.ofi.fetch_price_http(session, _a)

                    # 2. Scan for active markets
                    # Build per-asset prices dict for scanner
                    asset_prices = {k: v for k, v in self.ofi.prices.items() if v}
                    if not asset_prices.get("btc"):
                        asset_prices["btc"] = btc_price or 85000
                    markets = await self.scanner.scan(session, asset_prices.get("btc", 85000), asset_prices)

                    # 3. Check exits on open positions
                    await self.executor.check_exits(self.scanner.active_markets, session)

                    # 4. Evaluate signals
                    for market in markets:
                        if not self.executor.can_open_position:
                            break

                        signal = None

                        # Method 1: OFI (leading indicator)
                        if USE_OFI:
                            signal = self.ofi.signal(market)
                            if signal:
                                log.info(f"⚡ OFI SIGNAL: {signal['reason']}")

                        # Method 2: Gabagool (only if no OFI signal)
                        if not signal and USE_GABAGOOL_MISPRICING:
                            signal = self.gabagool.evaluate(market)
                            if signal:
                                log.info(f"🧮 GABAGOOL SIGNAL: {signal['reason']}")

                        # Tier 3: momentum fallback — fires if no OFI or gabagool signal
                        if not signal and USE_OFI:
                            signal = self.ofi.momentum_signal(market)
                            if signal:
                                log.info(f"📈 MOMENTUM SIGNAL: {signal['reason']}")

                        if signal:
                            await self.executor.enter(market, signal, session)

                    # 5. Status + snapshot every 300 scans (~5min)
                    scan_count += 1
                    if scan_count % 300 == 0:
                        self.reporter.print_status(markets)
                        self._write_bridge_state(markets)

                    await asyncio.sleep(1)

                except KeyboardInterrupt:
                    break
                except Exception as e:
                    log.error(f"Main loop error: {e}", exc_info=True)
                    await asyncio.sleep(5)

        self.reporter.print_status([])
        log.info("Bot stopped.")


# ── ENTRY POINT ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════╗
║   POLYDESK — BTC 5-MIN UP/DOWN BOT  v3.0            ║
║                                                      ║
║   Strategy 1: Binance OFI (Order Flow Imbalance)    ║
║     • aggTrade WebSocket — buy vs sell pressure      ║
║     • forceOrder WebSocket — liquidation cascades   ║
║   Strategy 2: Gabagool mathematical mispricing       ║
║   All orders: LIMIT only (maker rebates earned)      ║
║                                                      ║
║   LIVE_MODE = False  →  Safe paper trading mode      ║
╚══════════════════════════════════════════════════════╝
    """)
    bot = BTC5MBot()
    asyncio.run(bot.run())

