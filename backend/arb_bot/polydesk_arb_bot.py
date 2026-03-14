"""
╔══════════════════════════════════════════════════════════════════╗
║  POLYDESK — ARBITRAGE BOT v2.0                                   ║
║  Type 1: YES+NO < $0.98 → buy both (WebSocket-triggered)         ║
║  Type 2: Event basket sum < $0.98 (scanned every 2min)           ║
║  v2: VWAP depth, adverse selection, long tail, velocity guard    ║
╚══════════════════════════════════════════════════════════════════╝
"""

import asyncio
import logging
import os
import json
import time
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
import aiohttp
import websockets

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

PRIVATE_KEY    = os.getenv("POLYMARKET_PRIVATE_KEY", "")
API_KEY        = os.getenv("POLYMARKET_API_KEY",     "")
API_SECRET     = os.getenv("POLYMARKET_API_SECRET",  "")
API_PASSPHRASE = os.getenv("POLYMARKET_PASSPHRASE",  "")

LIVE_MODE             = True
T1_MIN_PROFIT_PCT     = 0.005
T1_MAX_POSITION_USD   = 50.0
T1_MIN_POSITION_USD   = 5.0
T2_MIN_PROFIT_PCT     = 0.025
T2_MAX_POSITION_USD   = 30.0
T2_SCAN_INTERVAL      = 120
POLYMARKET_WINNER_FEE = 0.02
MIN_PROFIT_USD        = 0.30
MAX_CONCURRENT_ARBS   = 3
SCAN_INTERVAL         = 60
SNAPSHOT_INTERVAL     = 300
VWAP_ENABLED          = True
VWAP_SLIPPAGE_BUFFER  = 0.002
ADVERSE_GAP_MIN_AGE   = 5.0
ADVERSE_GAP_MAX_AGE   = 300.0
ADVERSE_JUMP_THRESHOLD = 0.015
LONG_TAIL_VOL_MIN     = 10_000
LONG_TAIL_VOL_MAX     = 500_000
VELOCITY_WINDOW_SEC   = 7200
VELOCITY_MAX_MOVE_PCT = 0.08

WS_URL     = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
GAMMA      = "https://gamma-api.polymarket.com"
STATE_PATH = "/app/state/arb_bot_state.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/app/state/arb_bot.log"),
    ]
)
log = logging.getLogger("polydesk.arb")


@dataclass
class MarketState:
    market_id:     str
    condition_id:  str
    question:      str
    yes_token_id:  str
    no_token_id:   str
    yes_bid:       float = 0.0
    yes_ask:       float = 0.0
    no_bid:        float = 0.0
    no_ask:        float = 0.0
    event_id:      str   = ""
    event_slug:    str   = ""
    end_date:      str   = ""
    vol24h:        float = 0.0
    last_updated:  float = 0.0
    gap_opened_at: float = 0.0
    gap_open_sum:  float = 1.0
    gap_prev_sum:  float = 1.0
    price_history: list  = field(default_factory=list)

    @property
    def yes_mid(self):
        if self.yes_bid and self.yes_ask:
            return (self.yes_bid + self.yes_ask) / 2
        return self.yes_ask or self.yes_bid or 0.5

    @property
    def sum_of_bests(self):
        return (self.yes_ask or 1.0) + (self.no_ask or 1.0)

    @property
    def t1_arb_profit_pct(self):
        if not self.yes_ask or not self.no_ask:
            return -1.0
        return (1.0 - POLYMARKET_WINNER_FEE) - self.sum_of_bests

    @property
    def stale(self):
        return time.time() - self.last_updated > 60

    @property
    def gap_age(self):
        if not self.gap_opened_at:
            return 0.0
        return time.time() - self.gap_opened_at

    @property
    def gap_was_jump(self):
        if not self.gap_open_sum or not self.gap_prev_sum:
            return False
        return (self.gap_prev_sum - self.gap_open_sum) >= ADVERSE_JUMP_THRESHOLD

    def track_gap(self, current_sum: float):
        has_gap = current_sum < (1.0 - POLYMARKET_WINNER_FEE - T1_MIN_PROFIT_PCT)
        if has_gap and not self.gap_opened_at:
            self.gap_opened_at = time.time()
            self.gap_open_sum  = current_sum
        elif not has_gap:
            self.gap_opened_at = 0.0
            self.gap_open_sum  = 1.0

    def record_price(self, mid: float):
        now = time.time()
        self.price_history.append([now, mid])
        cutoff = now - VELOCITY_WINDOW_SEC
        self.price_history = [p for p in self.price_history if p[0] >= cutoff]

    @property
    def velocity_pct(self):
        if len(self.price_history) < 2:
            return 0.0
        oldest = self.price_history[0][1]
        latest = self.price_history[-1][1]
        return abs(latest - oldest) / oldest if oldest > 0 else 0.0

    @property
    def is_high_velocity(self):
        return self.velocity_pct > VELOCITY_MAX_MOVE_PCT


@dataclass
class ArbOpportunity:
    arb_type:           str
    legs:               list
    expected_profit_usd: float
    expected_profit_pct: float
    detected_at:        float = field(default_factory=time.time)
    description:        str = ""

    @property
    def is_stale(self):
        return time.time() - self.detected_at > 2.0


@dataclass
class ArbStats:
    session_start:   str   = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    t1_detected:     int   = 0
    t1_executed:     int   = 0
    t1_profit_usd:   float = 0.0
    t2_detected:     int   = 0
    t2_executed:     int   = 0
    t2_profit_usd:   float = 0.0
    partial_fills:   int   = 0
    missed_arbs:     int   = 0
    total_trades:    int   = 0
    recent_arbs:     list  = field(default_factory=list)

    @property
    def total_profit(self):
        return self.t1_profit_usd + self.t2_profit_usd

    def record_arb(self, arb, actual_profit):
        self.total_trades += len(arb.legs)
        if arb.arb_type == "T1_REBALANCE":
            self.t1_executed  += 1
            self.t1_profit_usd += actual_profit
        else:
            self.t2_executed  += 1
            self.t2_profit_usd += actual_profit
        self.recent_arbs.append({
            "type":   arb.arb_type,
            "profit": round(actual_profit, 4),
            "desc":   arb.description,
            "ts":     datetime.now(timezone.utc).isoformat(),
        })
        if len(self.recent_arbs) > 50:
            self.recent_arbs = self.recent_arbs[-50:]

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


class MarketFeed:
    def __init__(self, on_price_update):
        self.markets: dict = {}
        self.token_to_market: dict = {}
        self.on_price_update = on_price_update
        self.session = None
        self._ws_task = None
        self._last_scan_time = 0.0

    async def start(self):
        self.session = aiohttp.ClientSession()
        await self._initial_scan()
        self._ws_task = asyncio.create_task(self._ws_loop())
        log.info(f"MarketFeed started — tracking {len(self.markets)} markets")

    async def stop(self):
        if self._ws_task:
            self._ws_task.cancel()
        if self.session:
            await self.session.close()

    async def _initial_scan(self):
        self._last_scan_time = time.time()
        offset = 0
        limit  = 100
        while True:
            url = (f"{GAMMA}/markets?active=true&closed=false"
                   f"&limit={limit}&offset={offset}"
                   f"&order=volume24hrClob&ascending=false")
            try:
                async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as r:
                    if r.status != 200:
                        break
                    data = await r.json()
                    if not data:
                        break
                    for m in data:
                        self._ingest_market(m)
                    if len(data) < limit:
                        break
                    offset += limit
            except Exception as e:
                log.error(f"Market scan error: {e}")
                break
        log.info(f"Scan: {len(self.markets)} markets, {len(self.token_to_market)} tokens")

    def _ingest_market(self, m):
        cid = m.get("conditionId") or m.get("id", "")
        if not cid:
            return
        raw_ids = m.get("clobTokenIds", "[]")
        try:
            ids = json.loads(raw_ids) if isinstance(raw_ids, str) else (raw_ids or [])
        except Exception:
            ids = []
        if len(ids) < 2:
            return
        yes_id = str(ids[0])
        no_id  = str(ids[1])
        bid = float(m.get("bestBid") or 0)
        ask = float(m.get("bestAsk") or 0)
        mid = (bid + ask) / 2 if bid and ask else 0.5
        events     = m.get("events") or []
        event_id   = str(events[0].get("id", "")) if events else ""
        event_slug = events[0].get("slug", "") if events else ""
        state = MarketState(
            market_id    = cid,
            condition_id = cid,
            question     = m.get("question", ""),
            yes_token_id = yes_id,
            no_token_id  = no_id,
            yes_ask      = ask or mid + 0.01,
            yes_bid      = bid or mid - 0.01,
            no_ask       = round(1.0 - (bid or mid - 0.01), 4),
            no_bid       = round(1.0 - (ask or mid + 0.01), 4),
            event_id     = event_id,
            event_slug   = event_slug,
            end_date     = m.get("endDateIso") or m.get("endDate") or "",
            vol24h       = float(m.get("volume24hrClob") or m.get("volume24hr") or 0),
            last_updated = time.time(),
        )
        state.record_price(mid)
        self.markets[cid] = state
        self.token_to_market[yes_id] = cid
        self.token_to_market[no_id]  = cid

    async def _ws_loop(self):
        while True:
            try:
                await self._ws_connect()
            except Exception as e:
                log.warning(f"WS disconnected: {e} — reconnecting in 5s")
                await asyncio.sleep(5)

    async def _ws_connect(self):
        all_yes_tokens = [s.yes_token_id for s in self.markets.values()][:500]
        async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=10) as ws:
            log.info(f"WS connected — {len(all_yes_tokens)} tokens")
            await ws.send(json.dumps({"assets_ids": all_yes_tokens, "type": "market"}))
            async for raw in ws:
                try:
                    await self._handle_ws_message(json.loads(raw))
                except Exception as e:
                    log.debug(f"WS msg error: {e}")

    async def _handle_ws_message(self, msg):
        event_type = msg.get("event_type")
        if event_type == "price_change":
            for change in msg.get("price_changes", []):
                asset_id = change.get("asset_id") or change.get("market")
                if not asset_id:
                    continue
                cid = self.token_to_market.get(str(asset_id))
                if not cid or cid not in self.markets:
                    continue
                state  = self.markets[cid]
                is_yes = (str(asset_id) == state.yes_token_id)
                new_bid = float(change.get("best_bid") or 0)
                new_ask = float(change.get("best_ask") or 0)
                state.gap_prev_sum = state.sum_of_bests
                if is_yes:
                    if new_bid: state.yes_bid = new_bid; state.no_ask = round(1.0 - new_bid, 4)
                    if new_ask: state.yes_ask = new_ask; state.no_bid = round(1.0 - new_ask, 4)
                else:
                    if new_bid: state.no_bid = new_bid
                    if new_ask: state.no_ask = new_ask
                state.last_updated = time.time()
                state.track_gap(state.sum_of_bests)
                state.record_price(state.yes_mid)
                await self.on_price_update(cid, state)


class ArbDetector:
    def __init__(self, feed, stats):
        self.feed  = feed
        self.stats = stats

    def check_t1(self, state: MarketState):
        if state.stale or not state.yes_ask or not state.no_ask:
            return None
        profit_pct = state.t1_arb_profit_pct
        if profit_pct < T1_MIN_PROFIT_PCT:
            state.track_gap(state.sum_of_bests)
            return None
        if state.is_high_velocity:
            return None
        gap_age = state.gap_age
        if gap_age < ADVERSE_GAP_MIN_AGE or gap_age > ADVERSE_GAP_MAX_AGE:
            return None
        if state.gap_was_jump:
            return None
        if state.vol24h < LONG_TAIL_VOL_MIN:
            return None
        shares = T1_MAX_POSITION_USD / state.sum_of_bests
        if profit_pct * shares < MIN_PROFIT_USD:
            return None
        self.stats.t1_detected += 1
        return ArbOpportunity(
            arb_type = "T1_REBALANCE",
            legs = [
                {"token_id": state.yes_token_id, "side": BUY, "price": state.yes_ask,
                 "size_usd": shares * state.yes_ask, "market_id": state.market_id, "label": "YES-BUY"},
                {"token_id": state.no_token_id,  "side": BUY, "price": state.no_ask,
                 "size_usd": shares * state.no_ask,  "market_id": state.market_id, "label": "NO-BUY"},
            ],
            expected_profit_usd = round(profit_pct * shares, 4),
            expected_profit_pct = round(profit_pct * 100, 3),
            description = (f"T1 [{gap_age:.0f}s | vol ${state.vol24h:,.0f}/day] "
                           f"{state.question[:45]} YES@{state.yes_ask:.4f}+NO@{state.no_ask:.4f}"),
        )

    def scan_t2(self):
        opps   = []
        events = {}
        for state in self.feed.markets.values():
            if not state.event_id or state.stale:
                continue
            events.setdefault(state.event_id, []).append(state)
        for event_id, group in events.items():
            if len(group) < 2:
                continue
            if any(s.is_high_velocity for s in group):
                continue
            opp = self._check_basket_arb(group)
            if opp:
                opps.append(opp)
                self.stats.t2_detected += 1
        return opps

    def _check_basket_arb(self, group):
        valid = [s for s in group if s.yes_ask and 0.01 < s.yes_ask < 0.99]
        if len(valid) < 2:
            return None
        total_cost = sum(s.yes_ask for s in valid)
        profit_pct = (1.0 - POLYMARKET_WINNER_FEE) - total_cost
        if profit_pct < T2_MIN_PROFIT_PCT:
            return None
        sps = T2_MAX_POSITION_USD / total_cost
        legs = [{"token_id": s.yes_token_id, "side": BUY, "price": s.yes_ask,
                 "size_usd": round(sps * s.yes_ask, 2), "market_id": s.market_id,
                 "label": f"YES {s.question[:20]}"} for s in valid]
        expected = profit_pct * sps
        if expected < MIN_PROFIT_USD:
            return None
        return ArbOpportunity(
            arb_type = "T2_COMBINATORIAL",
            legs = legs,
            expected_profit_usd = round(expected, 4),
            expected_profit_pct = round(profit_pct * 100, 3),
            description = (f"T2 {valid[0].event_slug[:30]} | {len(valid)} outcomes | "
                           f"sum={total_cost:.4f} | profit={profit_pct*100:.2f}%"),
        )


class ArbExecutor:
    PRICE_MOVE_ABORT = 0.005

    def __init__(self, feed, stats):
        self.feed          = feed
        self.stats         = stats
        self.client        = None
        self._active_arbs  = set()

    def connect(self):
        if not PRIVATE_KEY or not CLOB_AVAILABLE:
            log.info("📄 PAPER MODE — arb opportunities logged, not executed")
            return
        try:
            from py_clob_client.clob_types import ApiCreds
            creds = ApiCreds(api_key=API_KEY, api_secret=API_SECRET, api_passphrase=API_PASSPHRASE)
            self.client = ClobClient(
                host="https://clob.polymarket.com", key=PRIVATE_KEY,
                chain_id=POLYGON, creds=creds
            )
            log.info("✅ Connected to Polymarket CLOB")
        except Exception as e:
            log.error(f"CLOB connection failed: {e}")

    async def fetch_vwap(self, token_id, size_usd, side=None):
        if not self.feed.session or not VWAP_ENABLED:
            return None
        side = side or BUY
        try:
            url = f"https://clob.polymarket.com/book?token_id={token_id}"
            async with self.feed.session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as r:
                if r.status != 200:
                    return None
                book = await r.json()
            levels = book.get("asks" if side == BUY else "bids", [])
            if not levels:
                return None
            shares_needed = size_usd / float(levels[0]["price"])
            total_cost = total_shares = 0.0
            for level in levels:
                price     = float(level["price"])
                available = float(level["size"])
                take      = min(available, shares_needed - total_shares)
                total_cost   += price * take
                total_shares += take
                if total_shares >= shares_needed:
                    break
            if total_shares < shares_needed * 0.95:
                return None
            return (total_cost / total_shares) + VWAP_SLIPPAGE_BUFFER
        except Exception as e:
            log.debug(f"VWAP fail {token_id[:20]}: {e}")
            return None

    async def vwap_profit_check(self, arb):
        if not VWAP_ENABLED:
            return arb.expected_profit_usd
        total_vwap = 0.0
        for leg in arb.legs:
            vwap = await self.fetch_vwap(leg["token_id"], leg["size_usd"], leg["side"])
            if vwap is None:
                return None
            total_vwap += vwap * (leg["size_usd"] / leg["price"])
        if arb.arb_type == "T1_REBALANCE" and len(arb.legs) == 2:
            shares = arb.legs[0]["size_usd"] / arb.legs[0]["price"]
            profit = shares * (1.0 - POLYMARKET_WINNER_FEE) - total_vwap
        else:
            sps    = arb.legs[0]["size_usd"] / arb.legs[0]["price"]
            profit = sps * (1.0 - POLYMARKET_WINNER_FEE) - total_vwap
        return profit if profit >= MIN_PROFIT_USD else None

    async def execute(self, arb):
        for leg in arb.legs:
            if leg["market_id"] in self._active_arbs:
                return 0.0
        if arb.is_stale:
            self.stats.missed_arbs += 1
            return 0.0
        if not self._prices_still_valid(arb):
            self.stats.missed_arbs += 1
            return 0.0
        actual_profit = await self.vwap_profit_check(arb)
        if actual_profit is None:
            self.stats.missed_arbs += 1
            return 0.0
        for leg in arb.legs:
            self._active_arbs.add(leg["market_id"])
        try:
            if not self.client or not LIVE_MODE:
                return self._paper_execute(arb)
            if arb.arb_type == "T1_REBALANCE":
                return await self._execute_t1(arb)
            return await self._execute_t2_batch(arb)
        finally:
            for leg in arb.legs:
                self._active_arbs.discard(leg["market_id"])

    def _prices_still_valid(self, arb):
        for leg in arb.legs:
            state = self.feed.markets.get(leg["market_id"])
            if not state:
                return False
            is_yes  = (leg["token_id"] == state.yes_token_id)
            current = (state.yes_ask if is_yes else state.no_ask) if leg["side"] == BUY else (state.yes_bid if is_yes else state.no_bid)
            if not current:
                return False
            if abs(current - leg["price"]) / leg["price"] > self.PRICE_MOVE_ABORT:
                return False
        return True

    async def _execute_t1(self, arb):
        results = await asyncio.gather(
            self._place_order(arb.legs[0]),
            self._place_order(arb.legs[1]),
            return_exceptions=True
        )
        filled_yes = not isinstance(results[0], Exception) and results[0]
        filled_no  = not isinstance(results[1], Exception) and results[1]
        if filled_yes and filled_no:
            self.stats.record_arb(arb, arb.expected_profit_usd)
            log.info(f"✅ T1 EXECUTED: ${arb.expected_profit_usd:.4f} | {arb.description}")
            return arb.expected_profit_usd
        elif filled_yes or filled_no:
            self.stats.partial_fills += 1
            log.warning(f"⚠️ PARTIAL FILL T1 | yes={filled_yes} no={filled_no} | {arb.description}")
        return 0.0

    async def _execute_t2_batch(self, arb):
        results = await asyncio.gather(*[self._place_order(leg) for leg in arb.legs], return_exceptions=True)
        filled = sum(1 for r in results if not isinstance(r, Exception) and r)
        if filled == len(results):
            self.stats.record_arb(arb, arb.expected_profit_usd)
            log.info(f"✅ T2 EXECUTED: ${arb.expected_profit_usd:.4f} | {arb.description}")
            return arb.expected_profit_usd
        elif filled > 0:
            self.stats.partial_fills += 1
            log.warning(f"⚠️ PARTIAL FILL T2 | {filled}/{len(results)} legs")
        return 0.0

    async def _place_order(self, leg):
        try:
            size_shares = leg["size_usd"] / leg["price"]
            order_args  = OrderArgs(token_id=leg["token_id"], price=leg["price"],
                                    size=round(size_shares, 2), side=leg["side"])
            try:
                from py_clob_client.clob_types import OrderType
                signed = self.client.create_order(order_args)
                self.client.post_order(signed, orderType=OrderType.FOK)
            except ImportError:
                self.client.post_order(self.client.create_order(order_args))
            return True
        except Exception as e:
            log.warning(f"Order failed ({leg['label']}): {e}")
            return False

    def _paper_execute(self, arb):
        self.stats.record_arb(arb, arb.expected_profit_usd)
        log.info(f"📄 [PAPER] {arb.arb_type} | ${arb.expected_profit_usd:.4f} | {arb.description}")
        return arb.expected_profit_usd


_bridge = StateBridge("arb_bot")
_last_snapshot = 0.0


def write_bridge(stats, markets_tracked):
    global _last_snapshot
    now = time.time()
    if now - _last_snapshot < SNAPSHOT_INTERVAL:
        return
    _last_snapshot = now
    recent = [_bridge.write_trade(
        market=a.get("desc","")[:60], side=a.get("type","ARB"), size_usd=50,
        entry_price=0, exit_price=None, pnl=a.get("profit",0),
        status="closed", exec_ms=50, method=a.get("type","ARB")
    ) for a in list(reversed(stats.recent_arbs))[:20]]
    _bridge.write(
        status="live" if LIVE_MODE else "paper",
        daily_pnl=round(stats.total_profit, 4),
        total_pnl=round(stats.total_profit, 4),
        trades_today=stats.total_trades, total_trades=stats.total_trades,
        win_rate=100.0 if stats.t1_executed + stats.t2_executed > 0 else 0.0,
        capital_deployed=0, recent_trades=recent,
        extra={
            "strategy": "Cross-Market Arbitrage",
            "markets_tracked": markets_tracked,
            "t1_detected": stats.t1_detected, "t1_executed": stats.t1_executed,
            "t2_detected": stats.t2_detected, "t2_executed": stats.t2_executed,
            "partial_fills": stats.partial_fills, "missed_arbs": stats.missed_arbs,
            "t1_profit": round(stats.t1_profit_usd, 4),
            "t2_profit": round(stats.t2_profit_usd, 4),
        }
    )


class ArbBot:
    def __init__(self):
        self.stats    = ArbStats.load()
        self.feed     = MarketFeed(on_price_update=self._on_price_update)
        self.detector = ArbDetector(self.feed, self.stats)
        self.executor = ArbExecutor(self.feed, self.stats)
        self._last_t2_scan  = 0.0
        self._last_snapshot = 0.0

    async def run(self):
        mode = "LIVE" if LIVE_MODE else "PAPER"
        print(f"\n╔══ POLYDESK ARB BOT v2 ══╗\n║ Mode: {mode:<20}║\n╚═══════════════════════════╝\n")
        self.executor.connect()
        await self.feed.start()
        log.info(f"Arb Bot v2 | {mode} | tracking {len(self.feed.markets)} markets")
        try:
            while True:
                now = time.time()
                if now - self.feed._last_scan_time > SCAN_INTERVAL:
                    await self.feed._initial_scan()
                if now - self._last_t2_scan > T2_SCAN_INTERVAL:
                    opps = self.detector.scan_t2()
                    for opp in opps:
                        await self.executor.execute(opp)
                    self._last_t2_scan = now
                if now - self._last_snapshot > SNAPSHOT_INTERVAL:
                    self.stats.save()
                    write_bridge(self.stats, len(self.feed.markets))
                    log.info(f"Snapshot | T1: {self.stats.t1_detected}det/{self.stats.t1_executed}exec "
                             f"${self.stats.t1_profit_usd:.4f} | T2: {self.stats.t2_detected}det/"
                             f"{self.stats.t2_executed}exec ${self.stats.t2_profit_usd:.4f} | "
                             f"TOTAL: ${self.stats.total_profit:.4f}")
                    self._last_snapshot = now
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            log.info("Stopped.")
        finally:
            await self.feed.stop()
            self.stats.save()
            write_bridge(self.stats, len(self.feed.markets))

    async def _on_price_update(self, cid, state):
        opp = self.detector.check_t1(state)
        if opp:
            log.info(f"🎯 T1 DETECTED: {opp.description}")
            await self.executor.execute(opp)


def main():
    bot = ArbBot()
    asyncio.run(bot.run())


if __name__ == "__main__":
    main()

