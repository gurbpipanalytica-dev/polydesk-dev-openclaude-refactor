"""
╔══════════════════════════════════════════════════════════════════╗
║  POLYDESK — MAKER REBATES BOT v2.0                               ║
║                                                                  ║
║  5 Income Streams:                                               ║
║    1. LP_REWARD      — daily USDC just for sitting in the book   ║
║    2. SPREAD_CAPTURE — earn half the spread on round-trip fills  ║
║    3. HOLD_REWARD    — 4% APY on inventory in eligible markets   ║
║    4. MAKER_REBATE   — fee-market rebates (15m crypto / sports)  ║
║    5. SPONSOR_BONUS  — stacks on LP when market is sponsored     ║
║                                                                  ║
║  Key fixes vs v1:                                                ║
║    - Uses clobTokenIds (decimal) NOT conditionId (hex)           ║
║    - YES orders → clobTokenIds[0], NO → clobTokenIds[1]          ║
║    - Spread 0.5% not 4% — tight quotes = higher LP score         ║
║    - Volume filter uses volume24hrClob not all-time              ║
║    - acceptingOrders filter before any order attempt             ║
║    - Income tracker: classifies every dollar by stream           ║
║    - Snapshot throttled to 5 min, not 30s                        ║
║    - State saved to correct path                                 ║
╚══════════════════════════════════════════════════════════════════╝
"""

import asyncio
import logging
import os
import json
import time
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field, asdict
from typing import Optional
import aiohttp

# ── deps ──────────────────────────────────────────────────────────────────────
from polydesk_state_bridge import StateBridge

try:
    from py_clob_client.client import ClobClient
    from py_clob_client.clob_types import OrderArgs
    try:
        from py_clob_client.clob_types import SIDE as _S
        BUY = _S.BUY
        SELL = _S.SELL
    except ImportError:
        BUY = "BUY"
        SELL = "SELL"
    from py_clob_client.constants import POLYGON
    CLOB_AVAILABLE = True
except ImportError:
    CLOB_AVAILABLE = False
    BUY = "BUY"
    SELL = "SELL"
    POLYGON = 137

# ── credentials ───────────────────────────────────────────────────────────────
PRIVATE_KEY    = os.getenv("POLYMARKET_PRIVATE_KEY",  "")
API_KEY        = os.getenv("POLYMARKET_API_KEY",       "")
API_SECRET     = os.getenv("POLYMARKET_API_SECRET",    "")
API_PASSPHRASE = os.getenv("POLYMARKET_PASSPHRASE",    "")
WALLET_ADDRESS = os.getenv("POLYMARKET_WALLET",        "")

# ── strategy parameters ───────────────────────────────────────────────────────
LIVE_MODE           = True
SCAN_INTERVAL       = 75
QUOTE_REFRESH       = 30
SNAPSHOT_INTERVAL   = 300
TARGET_SPREAD_PCT   = 0.005
WIDE_SPREAD_PCT     = 0.015
MAX_ORDER_USD       = 25.0
MIN_ORDER_USD       = 5.0
MIN_VOL_24H         = 50_000
MAX_MARKETS         = 20
INVENTORY_LIMIT     = 0.65
INVENTORY_CANCEL    = 0.85
CANCEL_ON_MOVE_PCT  = 0.04
STATE_PATH          = "/app/state/rebates_bot_state.json"

# ── income stream tags ────────────────────────────────────────────────────────
LP_REWARD      = "LP_REWARD"
SPREAD_CAPTURE = "SPREAD_CAPTURE"
HOLD_REWARD    = "HOLD_REWARD"
MAKER_REBATE   = "MAKER_REBATE"
SPONSOR_BONUS  = "SPONSOR_BONUS"

# ── logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/app/state/rebates_bot.log"),
    ]
)
log = logging.getLogger("polydesk.rebates")


@dataclass
class MarketQuote:
    market_id:       str
    yes_token_id:    str
    no_token_id:     str
    question:        str
    mid_price:       float
    yes_bid_price:   float
    yes_ask_price:   float
    no_bid_price:    float
    no_ask_price:    float
    lp_eligible:     bool = False
    lp_min_size:     float = 0.0
    lp_max_spread:   float = 0.0
    holding_eligible:bool = False
    fee_eligible:    bool = False
    yes_inventory:   float = 0.0
    no_inventory:    float = 0.0
    last_mid_price:  float = 0.0
    fills_today:     int   = 0
    lp_score_est:    float = 0.0
    income_today:    dict  = field(default_factory=lambda: {
        "LP_REWARD": 0.0, "SPREAD_CAPTURE": 0.0,
        "HOLD_REWARD": 0.0, "MAKER_REBATE": 0.0, "SPONSOR_BONUS": 0.0,
    })
    last_updated:    str   = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def active_streams(self):
        s = []
        if self.lp_eligible: s.append(LP_REWARD)
        if self.holding_eligible: s.append(HOLD_REWARD)
        if self.fee_eligible: s.append(MAKER_REBATE)
        return s or [SPREAD_CAPTURE]

    @property
    def inventory_ratio(self):
        total = self.yes_inventory + self.no_inventory
        return self.no_inventory / total if total else 0.5

    @property
    def is_imbalanced(self):
        r = self.inventory_ratio
        return r > INVENTORY_LIMIT or r < (1 - INVENTORY_LIMIT)

    @property
    def needs_cancel(self):
        r = self.inventory_ratio
        return r > INVENTORY_CANCEL or r < (1 - INVENTORY_CANCEL)

    @property
    def moved_too_far(self):
        if not self.last_mid_price:
            return False
        return abs(self.mid_price - self.last_mid_price) / self.last_mid_price > CANCEL_ON_MOVE_PCT


@dataclass
class IncomeEvent:
    stream:        str
    amount_usdc:   float
    market_id:     str
    market_label:  str
    timestamp:     str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    tx_hash:       str = ""
    metadata:      dict = field(default_factory=dict)


@dataclass
class BotStats:
    session_start:      str   = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    total_fills:        int   = 0
    markets_active:     int   = 0
    income: dict = field(default_factory=lambda: {
        "LP_REWARD": 0.0, "SPREAD_CAPTURE": 0.0,
        "HOLD_REWARD": 0.0, "MAKER_REBATE": 0.0, "SPONSOR_BONUS": 0.0,
    })
    open_buys:   list = field(default_factory=list)
    open_sells:  list = field(default_factory=list)
    closed_pairs:list = field(default_factory=list)
    wallet_usdc_before_midnight: float = 0.0
    last_midnight_check:         str   = ""
    income_events:               list  = field(default_factory=list)

    @property
    def total_income(self):
        return sum(self.income.values())

    def record_income(self, event: IncomeEvent):
        self.income[event.stream] = self.income.get(event.stream, 0.0) + event.amount_usdc
        self.income_events.append(asdict(event))

    def save(self):
        os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
        with open(STATE_PATH, "w") as f:
            json.dump(asdict(self), f, indent=2, default=str)

    @classmethod
    def load(cls):
        try:
            with open(STATE_PATH) as f:
                data = json.load(f)
                s = cls()
                for k, v in data.items():
                    if hasattr(s, k):
                        setattr(s, k, v)
                return s
        except Exception:
            return cls()


class MarketScanner:
    GAMMA_URL = "https://gamma-api.polymarket.com"

    def __init__(self):
        self.session = None

    async def start(self):
        self.session = aiohttp.ClientSession()

    async def stop(self):
        if self.session:
            await self.session.close()

    async def get_eligible_markets(self):
        markets = []
        offset  = 0
        limit   = 100

        while len(markets) < MAX_MARKETS * 4:
            url = (f"{self.GAMMA_URL}/markets?active=true&closed=false"
                   f"&limit={limit}&offset={offset}"
                   f"&order=volume24hrClob&ascending=false")
            try:
                async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status != 200:
                        break
                    data = await resp.json()
                    if not data:
                        break
                    markets.extend(data)
                    if len(data) < limit:
                        break
                    offset += limit
            except Exception as e:
                log.error(f"Market fetch error: {e}")
                break

        eligible = []
        for m in markets:
            parsed = self._parse_market(m)
            if parsed:
                eligible.append(parsed)

        eligible.sort(key=lambda m: (m["lp_eligible"], m["vol24h"]), reverse=True)
        top = eligible[:MAX_MARKETS]
        lp_count   = sum(1 for m in top if m["lp_eligible"])
        hold_count = sum(1 for m in top if m["holding_eligible"])
        log.info(f"Selected {len(top)} markets — {lp_count} LP-eligible, {hold_count} hold-eligible")
        return top

    def _parse_market(self, m):
        if not m.get("acceptingOrders"):
            return None

        vol = float(m.get("volume24hrClob") or m.get("volume24hr") or 0)
        if vol < MIN_VOL_24H:
            return None

        end_date = m.get("endDateIso") or m.get("endDate") or ""
        if end_date:
            try:
                ed = end_date.replace("Z", "+00:00")
                edt = datetime.fromisoformat(ed)
                if edt.tzinfo is None:
                    edt = edt.replace(tzinfo=timezone.utc)
                if (edt - datetime.now(timezone.utc)).total_seconds() < 43200:
                    return None
            except Exception:
                pass

        raw_ids = m.get("clobTokenIds", "[]")
        try:
            ids = json.loads(raw_ids) if isinstance(raw_ids, str) else (raw_ids or [])
        except Exception:
            ids = []
        if len(ids) < 2:
            return None
        yes_token_id = str(ids[0])
        no_token_id  = str(ids[1])

        bid = float(m.get("bestBid") or 0)
        ask = float(m.get("bestAsk") or 0)
        if bid > 0 and ask > 0:
            mid = (bid + ask) / 2
        else:
            raw_op = m.get("outcomePrices", "[]")
            try:
                op = json.loads(raw_op) if isinstance(raw_op, str) else (raw_op or [])
            except Exception:
                op = []
            raw_oc = m.get("outcomes", '["Yes","No"]')
            try:
                oc = json.loads(raw_oc) if isinstance(raw_oc, str) else (raw_oc or ["Yes", "No"])
            except Exception:
                oc = ["Yes", "No"]
            mid = 0.5
            for i, name in enumerate(oc):
                if str(name).upper() == "YES" and i < len(op):
                    try:
                        mid = float(op[i])
                    except Exception:
                        pass
                    break
            if mid <= 0.01 or mid >= 0.99:
                for f in ("lastTradePrice", "bestAsk", "bestBid"):
                    v = m.get(f)
                    if v:
                        try:
                            p = float(v)
                            if 0.01 < p < 0.99:
                                mid = p
                                break
                        except Exception:
                            pass

        if mid < 0.05 or mid > 0.95:
            return None

        lp_min_size    = float(m.get("rewardsMinSize") or 0)
        lp_max_spread  = float(m.get("rewardsMaxSpread") or 0)
        lp_eligible    = lp_min_size > 0 and lp_max_spread > 0
        holding_eligible = bool(m.get("holdingRewardsEnabled"))
        fee_eligible   = bool(m.get("feesEnabled"))

        shares   = MAX_ORDER_USD / mid if mid > 0 else 0
        distance = TARGET_SPREAD_PCT
        lp_score = 0.0
        if lp_eligible and lp_max_spread > 0:
            max_s = lp_max_spread / 100
            if distance < max_s:
                lp_score = shares * ((max_s - distance) ** 2)

        return {
            "market_id":        m.get("conditionId") or m.get("id", ""),
            "yes_token_id":     yes_token_id,
            "no_token_id":      no_token_id,
            "question":         m.get("question", ""),
            "mid":              mid,
            "bid":              bid,
            "ask":              ask,
            "vol24h":           vol,
            "lp_eligible":      lp_eligible,
            "lp_min_size":      lp_min_size,
            "lp_max_spread":    lp_max_spread,
            "holding_eligible": holding_eligible,
            "fee_eligible":     fee_eligible,
            "lp_score_est":     lp_score,
        }


class QuoteEngine:

    def build_quote(self, market, existing=None):
        mid    = market["mid"]
        spread = WIDE_SPREAD_PCT if (existing and existing.is_imbalanced) else TARGET_SPREAD_PCT
        half   = spread / 2

        yes_bid = round(max(0.001, min(0.999, mid - half)), 4)
        yes_ask = round(max(0.001, min(0.999, mid + half)), 4)
        no_mid  = 1.0 - mid
        no_bid  = round(max(0.001, min(0.999, no_mid - half)), 4)
        no_ask  = round(max(0.001, min(0.999, no_mid + half)), 4)

        size_usd = MAX_ORDER_USD
        if market["lp_eligible"] and market["lp_min_size"] > 0:
            min_usd = market["lp_min_size"] * mid
            if min_usd > MAX_ORDER_USD:
                size_usd = min_usd

        shares   = size_usd / mid if mid > 0 else 0
        lp_score = 0.0
        if market["lp_eligible"]:
            max_s = market["lp_max_spread"] / 100
            if half < max_s:
                lp_score = shares * ((max_s - half) ** 2)

        return MarketQuote(
            market_id        = market["market_id"],
            yes_token_id     = market["yes_token_id"],
            no_token_id      = market["no_token_id"],
            question         = market["question"],
            mid_price        = mid,
            yes_bid_price    = yes_bid,
            yes_ask_price    = yes_ask,
            no_bid_price     = no_bid,
            no_ask_price     = no_ask,
            lp_eligible      = market["lp_eligible"],
            lp_min_size      = market["lp_min_size"],
            lp_max_spread    = market["lp_max_spread"],
            holding_eligible = market["holding_eligible"],
            fee_eligible     = market["fee_eligible"],
            lp_score_est     = lp_score,
            yes_inventory    = existing.yes_inventory if existing else 0.0,
            no_inventory     = existing.no_inventory  if existing else 0.0,
            last_mid_price   = existing.mid_price     if existing else mid,
            fills_today      = existing.fills_today   if existing else 0,
            income_today     = existing.income_today  if existing else {
                "LP_REWARD":0.0,"SPREAD_CAPTURE":0.0,
                "HOLD_REWARD":0.0,"MAKER_REBATE":0.0,"SPONSOR_BONUS":0.0
            },
        )


class IncomeTracker:
    POLYMARKET_REWARD_CONTRACTS = {
        "0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e": LP_REWARD,
        "0x2c9fe7cc1b11be5dafa465f3f45c4fd7af57d546": LP_REWARD,
    }
    USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

    def __init__(self, stats, active_quotes):
        self.stats         = stats
        self.active_quotes = active_quotes
        self.session       = None
        self._last_snapshot = 0.0

    async def start(self):
        self.session = aiohttp.ClientSession()

    async def stop(self):
        if self.session:
            await self.session.close()

    def on_fill(self, market_id, side, token_id, price, size, fill_id):
        quote = self.active_quotes.get(market_id)
        if not quote:
            return
        now  = datetime.now(timezone.utc).isoformat()
        fill = {"market_id":market_id,"token_id":token_id,"side":side,
                "price":price,"size":size,"fill_id":fill_id,"ts":now}
        if side == BUY:
            if token_id == quote.yes_token_id:
                quote.yes_inventory += size
            else:
                quote.no_inventory  += size
            self.stats.open_buys.append(fill)
        elif side == SELL:
            if token_id == quote.yes_token_id:
                quote.yes_inventory -= size
            else:
                quote.no_inventory  -= size
            quote.fills_today += 1
            self.stats.total_fills += 1
            matched = self._match_fill(fill, self.stats.open_buys)
            if matched:
                pnl = (price - matched["price"]) * size
                if pnl > 0:
                    event = IncomeEvent(
                        stream=SPREAD_CAPTURE, amount_usdc=round(pnl,6),
                        market_id=market_id, market_label=quote.question[:60],
                        metadata={"buy_price":matched["price"],"sell_price":price,"size":size}
                    )
                    self.stats.record_income(event)
                    log.info(f"💰 SPREAD CAPTURE ${pnl:.4f} on {quote.question[:40]}")

    def _match_fill(self, sell_fill, open_buys):
        for i, buy in enumerate(open_buys):
            if buy["market_id"]==sell_fill["market_id"] and buy["token_id"]==sell_fill["token_id"]:
                return open_buys.pop(i)
        return None

    async def check_midnight_rewards(self):
        if not WALLET_ADDRESS:
            log.warning("WALLET_ADDRESS not set — cannot track midnight rewards")
            return
        inflows = await self._fetch_usdc_inflows()
        if not inflows:
            log.info("No USDC inflows detected at midnight")
            return
        for tx in inflows:
            from_addr = tx.get("from","").lower()
            amount    = float(tx.get("amount_usdc",0))
            tx_hash   = tx.get("hash","")
            if amount < 0.001:
                continue
            stream = self.POLYMARKET_REWARD_CONTRACTS.get(from_addr, SPONSOR_BONUS)
            active_lp = [q for q in self.active_quotes.values() if q.lp_eligible]
            if stream == LP_REWARD and active_lp:
                total_score = sum(q.lp_score_est for q in active_lp) or 1
                for q in active_lp:
                    share = (q.lp_score_est / total_score) * amount
                    if share > 0.0001:
                        self.stats.record_income(IncomeEvent(
                            stream=LP_REWARD, amount_usdc=round(share,6),
                            market_id=q.market_id, market_label=q.question[:60],
                            tx_hash=tx_hash
                        ))
                log.info(f"💧 LP REWARD: ${amount:.4f} across {len(active_lp)} markets")
            else:
                self.stats.record_income(IncomeEvent(
                    stream=stream, amount_usdc=round(amount,6),
                    market_id="", market_label="reward", tx_hash=tx_hash
                ))
                log.info(f"🎁 {stream}: ${amount:.4f}")

    async def _fetch_usdc_inflows(self):
        if not self.session or not WALLET_ADDRESS:
            return []
        try:
            url = (f"https://api.polygonscan.com/api"
                   f"?module=account&action=tokentx"
                   f"&address={WALLET_ADDRESS}"
                   f"&contractaddress={self.USDC_CONTRACT}"
                   f"&page=1&offset=20&sort=desc")
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
                if r.status != 200:
                    return []
                data = await r.json()
                txns = data.get("result", [])
                if not isinstance(txns, list):
                    return []
                now_ts  = time.time()
                inflows = []
                for tx in txns:
                    if tx.get("to","").lower() != WALLET_ADDRESS.lower():
                        continue
                    if now_ts - int(tx.get("timeStamp",0)) > 600:
                        continue
                    decimals = int(tx.get("tokenDecimal",6))
                    amount   = int(tx.get("value",0)) / (10**decimals)
                    inflows.append({"from":tx.get("from","").lower(),
                                    "amount_usdc":amount,"hash":tx.get("hash","")})
                return inflows
        except Exception as e:
            log.warning(f"USDC inflow fetch failed: {e}")
            return []

    def should_snapshot(self):
        now = time.time()
        if now - self._last_snapshot >= SNAPSHOT_INTERVAL:
            self._last_snapshot = now
            return True
        return False

    def income_summary(self):
        return {
            "total":        round(self.stats.total_income, 4),
            LP_REWARD:      round(self.stats.income[LP_REWARD], 4),
            SPREAD_CAPTURE: round(self.stats.income[SPREAD_CAPTURE], 4),
            HOLD_REWARD:    round(self.stats.income[HOLD_REWARD], 4),
            MAKER_REBATE:   round(self.stats.income[MAKER_REBATE], 4),
            SPONSOR_BONUS:  round(self.stats.income[SPONSOR_BONUS], 4),
        }


class RebatesExecutor:

    def __init__(self, stats, tracker):
        self.stats   = stats
        self.tracker = tracker
        self.client  = None

    def connect(self):
        if not PRIVATE_KEY or not CLOB_AVAILABLE:
            log.info("📄 PAPER MODE — orders simulated")
            return
        try:
            from py_clob_client.clob_types import ApiCreds
            creds = ApiCreds(
                api_key        = API_KEY,
                api_secret     = API_SECRET,
                api_passphrase = API_PASSPHRASE,
            )
            self.client = ClobClient(
                host     = "https://clob.polymarket.com",
                key      = PRIVATE_KEY,
                chain_id = POLYGON,
                creds    = creds,
            )
            log.info("✅ Connected to Polymarket CLOB")
        except Exception as e:
            log.error(f"CLOB connection failed: {e}")

    async def post_two_sided_quote(self, quote):
        size_usd = max(MIN_ORDER_USD,
                       quote.lp_min_size * quote.mid_price if quote.lp_eligible else MAX_ORDER_USD)
        size_usd = min(size_usd, MAX_ORDER_USD * 2)
        yes_size = size_usd / max(quote.yes_bid_price, 0.001)
        no_size  = size_usd / max(quote.no_bid_price,  0.001)

        orders = [
            (BUY,  quote.yes_token_id, quote.yes_bid_price, yes_size, "YES-BID"),
            (SELL, quote.yes_token_id, quote.yes_ask_price, yes_size, "YES-ASK"),
            (BUY,  quote.no_token_id,  quote.no_bid_price,  no_size,  "NO-BID"),
            (SELL, quote.no_token_id,  quote.no_ask_price,  no_size,  "NO-ASK"),
        ]

        if not self.client or not LIVE_MODE:
            log.debug(f"[PAPER] {quote.question[:40]} YES {quote.yes_bid_price:.4f}/{quote.yes_ask_price:.4f}")
            return

        for side, token_id, price, size, label in orders:
            try:
                order_args = OrderArgs(token_id=token_id, price=price,
                                       size=round(size,2), side=side)
                try:
                    from py_clob_client.clob_types import OrderType
                    signed = self.client.create_order(order_args)
                    self.client.post_order(signed, orderType=OrderType.GTC)
                except ImportError:
                    signed = self.client.create_order(order_args)
                    self.client.post_order(signed)
                log.debug(f"Posted {label} @ {price:.4f} × {size:.1f} on {quote.question[:35]}")
            except Exception as e:
                log.warning(f"Order failed ({label}): {e}")

    async def cancel_all_orders(self, market_id):
        if not self.client or not LIVE_MODE:
            return
        try:
            self.client.cancel_market_orders(market_id=market_id)
        except Exception as e:
            log.warning(f"Cancel failed {market_id[:20]}: {e}")


class Reporter:

    @staticmethod
    def banner():
        mode = "🔴  LIVE" if LIVE_MODE else "📄  PAPER"
        print(f"""
╔══════════════════════════════════════════════════════════════════╗
║           POLYDESK — MAKER REBATES BOT v2.0                      ║
║  Streams: LP | SPREAD | HOLD | REBATE | SPONSOR                  ║
║  Mode: {mode:<56}║
╚══════════════════════════════════════════════════════════════════╝
""")

    @staticmethod
    def snapshot(stats, active, tracker):
        s = tracker.income_summary()
        print(f"""
┌─ REBATES BOT v2 ──────────────────────────────────┐
│  Markets: {active:>3}   Fills: {stats.total_fills:>4}                     │
│  💧 LP Reward      ${s[LP_REWARD]:>8.4f}               │
│  ⚡ Spread Capture ${s[SPREAD_CAPTURE]:>8.4f}               │
│  📈 Hold Reward    ${s[HOLD_REWARD]:>8.4f}               │
│  🏆 Maker Rebate   ${s[MAKER_REBATE]:>8.4f}               │
│  🎁 Sponsor Bonus  ${s[SPONSOR_BONUS]:>8.4f}               │
│  TOTAL:            ${s["total"]:>8.4f}               │
└───────────────────────────────────────────────────┘""")


_bridge = StateBridge("rebates_bot")

def write_bridge(stats, tracker, active_quotes):
    summary = tracker.income_summary()
    recent  = []
    for ev in list(reversed(stats.income_events))[:20]:
        recent.append(_bridge.write_trade(
            market=ev.get("market_label","")[:60],
            side=ev.get("stream","MM"),
            size_usd=ev.get("amount_usdc",0),
            entry_price=ev.get("metadata",{}).get("buy_price",0),
            exit_price=ev.get("metadata",{}).get("sell_price"),
            pnl=ev.get("amount_usdc",0),
            status="closed", exec_ms=0, method=ev.get("stream","MM"),
        ))
    _bridge.write(
        status="live" if LIVE_MODE else "paper",
        daily_pnl=round(summary["total"],4),
        total_pnl=round(summary["total"],4),
        trades_today=stats.total_fills, total_trades=stats.total_fills,
        win_rate=100.0, capital_deployed=len(active_quotes)*MAX_ORDER_USD*2,
        recent_trades=recent,
        extra={
            "active_markets": stats.markets_active,
            "strategy": "Maker LP + Spread Capture",
            "income_breakdown": summary,
            "lp_markets": sum(1 for q in active_quotes.values() if q.lp_eligible),
        }
    )


class MakerRebatesBot:

    def __init__(self):
        self.stats    = BotStats.load()
        self.scanner  = MarketScanner()
        self.quoter   = QuoteEngine()
        self.quotes   = {}
        self.tracker  = IncomeTracker(self.stats, self.quotes)
        self.executor = RebatesExecutor(self.stats, self.tracker)
        self._last_scan  = 0.0
        self._midnight_checked_today = False

    async def run(self):
        Reporter.banner()
        self.executor.connect()
        await self.scanner.start()
        await self.tracker.start()
        log.info(f"Rebates Bot v2 | mode={'LIVE' if LIVE_MODE else 'PAPER'} | markets={MAX_MARKETS}")

        try:
            while True:
                now = time.time()
                utc = datetime.now(timezone.utc)

                if now - self._last_scan > SCAN_INTERVAL:
                    await self._update_markets()
                    self._last_scan = now

                if utc.hour == 0 and 1 <= utc.minute <= 6:
                    if not self._midnight_checked_today:
                        log.info("🕛 Midnight — checking reward inflows...")
                        await self.tracker.check_midnight_rewards()
                        self._midnight_checked_today = True
                elif utc.hour != 0:
                    self._midnight_checked_today = False

                await self._refresh_quotes()

                if self.tracker.should_snapshot():
                    write_bridge(self.stats, self.tracker, self.quotes)
                    self.stats.save()
                    Reporter.snapshot(self.stats, len(self.quotes), self.tracker)

                await asyncio.sleep(QUOTE_REFRESH)

        except KeyboardInterrupt:
            log.info("Stopped.")
        finally:
            await self.scanner.stop()
            await self.tracker.stop()
            self.stats.save()
            write_bridge(self.stats, self.tracker, self.quotes)

    async def _update_markets(self):
        markets = await self.scanner.get_eligible_markets()
        new_ids = {m["market_id"] for m in markets}
        for mid in list(self.quotes):
            if mid not in new_ids:
                await self.executor.cancel_all_orders(mid)
                del self.quotes[mid]
        for m in markets:
            mid = m["market_id"]
            if mid not in self.quotes:
                self.quotes[mid] = self.quoter.build_quote(m)
        self.stats.markets_active = len(self.quotes)
        log.info(f"Markets: {len(self.quotes)} active")

    async def _refresh_quotes(self):
        for mid, q in list(self.quotes.items()):
            if q.needs_cancel:
                await self.executor.cancel_all_orders(mid)
                q.yes_inventory = 0.0
                q.no_inventory  = 0.0
                continue
            if q.moved_too_far:
                await self.executor.cancel_all_orders(mid)
                continue
            await self.executor.post_two_sided_quote(q)


def main():
    bot = MakerRebatesBot()
    asyncio.run(bot.run())


if __name__ == "__main__":
    main()

