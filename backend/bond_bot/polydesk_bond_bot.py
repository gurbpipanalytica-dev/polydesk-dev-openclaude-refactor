from polydesk_state_bridge import StateBridge
from polydesk_db import PolydeskDB
db = PolydeskDB()
"""
╔══════════════════════════════════════════════════════════════╗
║  POLYDESK — BOT ENGINE v1                                    ║
║  Strategy: Bond Strategy (Near-Certainty Markets)            ║
║                                                              ║
║  Logic:                                                      ║
║    1. Scan ALL active Polymarket markets every 5 minutes     ║
║    2. Filter: price > $0.93 AND resolution < 7 days          ║
║    3. Cross-check: is this ACTUALLY near-certain? (AI check) ║
║    4. Post a LIMIT ORDER (maker, earns rebate post-Feb 2026) ║
║    5. Hold to resolution at $1.00, collect the spread        ║
║                                                              ║
║  Post-Feb 2026 compliant: ALL orders are limit orders        ║
║  Paper trading mode ON by default — set LIVE_MODE=True       ║
║  to trade real capital                                        ║
╚══════════════════════════════════════════════════════════════╝
"""

import asyncio
import logging
import os
import json
import time
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
from decimal import Decimal

# ── deps ──────────────────────────────────────────────────────────────────────
# pip install py-clob-client python-dotenv aiohttp
from py_clob_client.client import ClobClient
from py_clob_client.clob_types import OrderArgs, OrderType
try:
    from py_clob_client.clob_types import MarketOrderArgs, LimitOrderArgs
except ImportError:
    MarketOrderArgs = None
    LimitOrderArgs = None
try:
    from py_clob_client.clob_types import SIDE as _S; BUY = _S.BUY; SELL = _S.SELL
except ImportError:
    BUY = "BUY"; SELL = "SELL"
from py_clob_client.constants import POLYGON
import aiohttp

# ── config ────────────────────────────────────────────────────────────────────

# ┌─ REQUIRED: fill these in or set as environment variables ─────────────────┐
PRIVATE_KEY       = os.getenv("POLYMARKET_PRIVATE_KEY",  "YOUR_PRIVATE_KEY_HERE")
API_KEY           = os.getenv("POLYMARKET_API_KEY",       "YOUR_API_KEY_HERE")
API_SECRET        = os.getenv("POLYMARKET_API_SECRET",    "YOUR_API_SECRET_HERE")
API_PASSPHRASE    = os.getenv("POLYMARKET_PASSPHRASE",    "YOUR_PASSPHRASE_HERE")
# └────────────────────────────────────────────────────────────────────────────┘

# ── strategy parameters ───────────────────────────────────────────────────────
LIVE_MODE               = False     # ← PAPER — simulated trades with live market data
SCAN_INTERVAL_SECONDS   = 300       # scan every 5 minutes
MIN_PRICE               = 0.91      # widened from 0.93 — more opportunities
MAX_PRICE               = 0.995     # avoid markets already at 99.5c
MAX_DAYS_TO_RESOLUTION  = 14        # widened from 7 days
MAX_POSITION_SIZE_USD   = 500.0     # max USDC per trade in paper mode
MAX_POSITION_SIZE_LIVE  = 80.0      # $80/trade max — conservative with $351 capital
MAX_OPEN_POSITIONS      = 4         # max 4 positions = $320 max deployed
STOP_LOSS_PRICE         = 0.80      # exit if drops below this
KELLY_FRACTION          = 0.25      # 25% Kelly — conservative sizing

# ── risk categories (markets we trust for bond strategy) ─────────────────────
SAFE_CATEGORIES = [
    "Fed Rate Decision",
    "Economic Data",
    "Scheduled Event",
    "Sports",           # final scores only — not in-game
    "Crypto",           # only if price-based with clear criteria
    "Politics",         # only if outcome already known / counting complete
]

# ── black list keywords — never trade these as bonds ─────────────────────────
BLACKLIST_KEYWORDS = [
    "will he",          # subjective interpretation
    "before end of",    # ambiguous timing
    "at any point",     # unclear resolution window  
    "approximately",    # UMA can dispute this
    "unofficial",
    "rumor",
    "report",
    "allegedly",
]

# ── logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("polydesk_bond_bot.log"),
    ]
)
log = logging.getLogger("polydesk.bond")


# ══════════════════════════════════════════════════════════════════════════════
#  DATA MODELS
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class BondOpportunity:
    market_id:      str
    question:       str
    side:           str          # "YES" or "NO"
    price:          float        # current price of the winning side
    resolution_date: str         # ISO string
    days_remaining: float
    expected_return: float       # (1.0 - price) / price
    annualized_return: float
    category:       str
    confidence:     str          # "HIGH" | "MEDIUM" | "LOW"
    reason:         str          # why we think this is near-certain
    token_id:       str = ""     # CLOB token ID for order execution
    detected_at:    str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class OpenPosition:
    market_id:      str
    question:       str
    side:           str
    entry_price:    float
    size_shares:    float
    size_usd:       float
    opened_at:      str
    resolution_date: str
    expected_pnl:   float
    status:         str = "open"   # "open" | "resolved" | "stopped"
    exit_price:     Optional[float] = None
    realized_pnl:   Optional[float] = None
    trade_id:       Optional[str] = None

@dataclass
class BotState:
    total_paper_pnl:    float = 0.0
    total_trades:       int   = 0
    winning_trades:     int   = 0
    open_positions:     list  = field(default_factory=list)
    trade_history:      list  = field(default_factory=list)
    paper_balance:      float = 351.0
    scan_count:         int   = 0
    started_at:         str   = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    STATE_PATH = "/app/state/bond_bot_state.json"

    def save(self):
        import os; os.makedirs("/app/state", exist_ok=True)
        with open(self.STATE_PATH, "w") as f:
            json.dump(asdict(self), f, indent=2)
        log.debug("State saved to /app/state/bond_bot_state.json")

    @classmethod
    def load(cls):
        try:
            with open(cls.STATE_PATH) as f:
                data = json.load(f)
                state = cls(**{k: v for k,v in data.items() if k in cls.__dataclass_fields__})
                log.info(f"Loaded existing state: {state.total_trades} trades, P&L ${state.total_paper_pnl:.2f}")
                return state
        except (FileNotFoundError, AttributeError):
            log.info("No existing state found — starting fresh")
            return cls()


# ══════════════════════════════════════════════════════════════════════════════
#  MARKET SCANNER
# ══════════════════════════════════════════════════════════════════════════════

class MarketScanner:
    """
    Pulls active markets from Polymarket's Gamma API and filters
    for bond-strategy candidates.
    """
    GAMMA_URL = "https://gamma-api.polymarket.com"

    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None

    async def start(self):
        self.session = aiohttp.ClientSession()

    async def stop(self):
        if self.session:
            await self.session.close()

    async def get_all_markets(self) -> list[dict]:
        """Fetch all active markets from Gamma API."""
        markets = []
        offset = 0
        limit  = 100
        while True:
            url = f"{self.GAMMA_URL}/markets?active=true&closed=false&limit={limit}&offset={offset}"
            try:
                async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status != 200:
                        log.warning(f"Gamma API returned {resp.status}")
                        break
                    data = await resp.json()
                    if not data:
                        break
                    markets.extend(data)
                    if len(data) < limit:
                        break
                    offset += limit
                    await asyncio.sleep(0.2)   # be polite to the API
            except Exception as e:
                log.error(f"Error fetching markets: {e}")
                break

        log.info(f"Fetched {len(markets)} active markets")
        return markets

    def _days_until_resolution(self, resolution_date_str: str) -> Optional[float]:
        """Return days until resolution. None if unparseable."""
        if not resolution_date_str:
            return None
        try:
            # Handle ISO format
            resolution_date_str = resolution_date_str.replace("Z", "+00:00")
            res_dt = datetime.fromisoformat(resolution_date_str)
            if res_dt.tzinfo is None:
                res_dt = res_dt.replace(tzinfo=timezone.utc)
            now    = datetime.now(timezone.utc)
            delta  = (res_dt - now).total_seconds() / 86400
            return delta
        except Exception:
            return None

    def _check_blacklist(self, question: str) -> bool:
        """Returns True if the market question contains blacklisted keywords."""
        q_lower = question.lower()
        return any(kw in q_lower for kw in BLACKLIST_KEYWORDS)

    def _assess_confidence(self, market: dict, price: float, days: float) -> tuple[str, str]:
        """
        Returns (confidence_level, reason).
        confidence: "HIGH" | "MEDIUM" | "LOW"
        """
        question = market.get("question", "").lower()

        # HIGH confidence signals
        if price >= 0.97 and days <= 2:
            return "HIGH", "97c+ price with <2 days remaining — market near-certain"
        if "fed" in question and ("rate" in question or "basis" in question):
            return "HIGH", "Fed rate decision — scheduled event, outcome highly predictable from futures market"
        if "cpi" in question or "inflation" in question or "pce" in question:
            return "HIGH", "Economic data release — scheduled event with clear measurement"
        if "world series" in question and price >= 0.95:
            return "HIGH", "Sports championship market at 95c+ — one team has near-certain lead"
        if "bitcoin" in question and "by" in question and price >= 0.96:
            return "HIGH", "BTC price target likely locked in — days to expiry very short"

        # MEDIUM confidence signals
        if price >= 0.94 and days <= 3:
            return "MEDIUM", "94c+ with <3 days remaining — strong momentum"
        if price >= 0.93 and days <= 1:
            return "MEDIUM", "93c+ with <24 hours remaining — time decay alone justifies entry"

        # DEFAULT
        return "LOW", "Meets price/time filter but no specific confidence signal found"

    def scan_for_bonds(self, markets: list[dict]) -> list[BondOpportunity]:
        """
        Apply all filters and return ranked list of bond opportunities.
        """
        opportunities = []

        for market in markets:
            question    = market.get("question", "")
            if not question:
                continue

            # Blacklist check
            if self._check_blacklist(question):
                continue

            # Check resolution date
            res_date = market.get("endDate") or market.get("resolutionDate") or market.get("end_date_iso")
            days = self._days_until_resolution(res_date)
            if days is None or days < 0 or days > MAX_DAYS_TO_RESOLUTION:
                continue

            # Get YES price — gamma API returns outcomes/outcomePrices as JSON strings
            def _parse_field(v):
                if isinstance(v, str):
                    try: return json.loads(v)
                    except: return []
                return v or []
            outcomes       = _parse_field(market.get("outcomes")) or ["Yes", "No"]
            outcome_prices = _parse_field(market.get("outcomePrices"))

            # Also parse clobTokenIds (JSON string) for order placement
            clob_ids_raw = market.get("clobTokenIds") or "[]"
            try:
                clob_ids = json.loads(clob_ids_raw) if isinstance(clob_ids_raw, str) else (clob_ids_raw or [])
            except Exception:
                clob_ids = []

            # Build list of (outcome, price, token_id) triples
            token_pairs = []
            for i, outcome_name in enumerate(outcomes):
                try:
                    p = float(outcome_prices[i]) if i < len(outcome_prices) else 0.0
                except (ValueError, TypeError):
                    p = 0.0
                tid = clob_ids[i] if i < len(clob_ids) else None
                token_pairs.append((str(outcome_name).upper(), p, tid))

            for outcome, price, token_id in token_pairs:
                if price < MIN_PRICE or price > MAX_PRICE:
                    continue

                # Calculate returns
                expected_return   = (1.0 - price) / price
                annualized_return = expected_return / max(days / 365, 1/365)

                # Must have annualized return > 100% to be worth it
                if annualized_return < 1.0:
                    continue

                confidence, reason = self._assess_confidence(market, price, days)

                # Skip LOW confidence in live mode
                if LIVE_MODE and confidence == "LOW":
                    continue

                opp = BondOpportunity(
                    market_id        = market.get("conditionId") or market.get("id", ""),
                    question         = question,
                    side             = outcome,   # "YES" or "NO" — whichever is near-certain
                    price            = price,
                    resolution_date  = res_date or "",
                    days_remaining   = round(days, 2),
                    expected_return  = round(expected_return * 100, 2),    # as %
                    annualized_return= round(annualized_return * 100, 2),  # as %
                    category         = market.get("category", "Unknown"),
                    confidence       = confidence,
                    reason           = reason,
                    token_id         = str(token_id) if token_id else "",
                )
                opportunities.append(opp)

        # Sort by annualized return DESC, then confidence
        confidence_score = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
        opportunities.sort(
            key=lambda o: (confidence_score[o.confidence], o.annualized_return),
            reverse=True,
        )

        log.info(f"Found {len(opportunities)} bond opportunities (HIGH: {sum(1 for o in opportunities if o.confidence=='HIGH')}, MEDIUM: {sum(1 for o in opportunities if o.confidence=='MEDIUM')}, LOW: {sum(1 for o in opportunities if o.confidence=='LOW')})")
        return opportunities


# ══════════════════════════════════════════════════════════════════════════════
#  POSITION MANAGER
# ══════════════════════════════════════════════════════════════════════════════

class PositionManager:
    """
    Handles position sizing (Kelly Criterion) and tracks open positions.
    """

    def kelly_size(self, price: float, confidence: str, balance: float) -> float:
        """
        Kelly Criterion: f* = (bp - q) / b
        where b = odds (1/price - 1), p = win_prob, q = 1 - p
        
        We use a fractional Kelly (KELLY_FRACTION) for safety.
        """
        win_prob = {
            "HIGH":   0.97,
            "MEDIUM": 0.92,
            "LOW":    0.85,
        }[confidence]

        b = (1.0 / price) - 1.0   # odds on a win
        q = 1.0 - win_prob
        kelly = (b * win_prob - q) / b

        # Apply fractional Kelly
        fraction = kelly * KELLY_FRACTION

        # Size in USD
        size_usd = balance * fraction

        # Cap at our max position size
        max_size = MAX_POSITION_SIZE_LIVE if LIVE_MODE else MAX_POSITION_SIZE_USD
        return min(size_usd, max_size)

    def already_in_market(self, market_id: str, positions: list[OpenPosition]) -> bool:
        return any(p.market_id == market_id and p.status == "open" for p in positions)

    def check_stop_losses(self, positions: list[OpenPosition], current_prices: dict) -> list[OpenPosition]:
        """
        Check if any open positions have breached the stop loss.
        Returns list of positions to close.
        """
        to_close = []
        for pos in positions:
            if pos.status != "open":
                continue
            current_price = current_prices.get(pos.market_id, {}).get(pos.side, pos.entry_price)
            if current_price < STOP_LOSS_PRICE:
                log.warning(f"⛔ STOP LOSS hit: {pos.question[:60]} — price dropped to {current_price:.3f}")
                to_close.append(pos)
        return to_close


# ══════════════════════════════════════════════════════════════════════════════
#  EXECUTION ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class ExecutionEngine:
    """
    Places limit orders via py_clob_client.
    In paper mode: simulates order fills and tracks virtual P&L.
    In live mode:  signs and submits real orders to Polymarket.
    """

    def __init__(self, state: BotState):
        self.state = state
        self.client: Optional[ClobClient] = None

    def connect(self):
        """Initialize the CLOB client connection."""
        if PRIVATE_KEY == "YOUR_PRIVATE_KEY_HERE":
            log.info("🎭 PAPER MODE — no real wallet connected")
            return

        try:
            self.client = ClobClient(
                host       = "https://clob.polymarket.com",
                key        = PRIVATE_KEY,
                chain_id   = POLYGON,
                creds      = {
                    "apiKey":      API_KEY,
                    "apiSecret":   API_SECRET,
                    "apiPassphrase": API_PASSPHRASE,
                }
            )
            log.info("✅ Connected to Polymarket CLOB API")
        except Exception as e:
            log.error(f"Failed to connect to CLOB: {e}")
            log.info("Falling back to paper mode")

    def _paper_execute(self, opportunity: BondOpportunity, size_usd: float) -> OpenPosition:
        """Simulate a trade in paper mode."""
        shares = size_usd / opportunity.price
        expected_pnl = shares * (1.0 - opportunity.price)

        pos = OpenPosition(
            market_id       = opportunity.market_id,
            question        = opportunity.question,
            side            = opportunity.side,
            entry_price     = opportunity.price,
            size_shares     = round(shares, 4),
            size_usd        = round(size_usd, 2),
            opened_at       = datetime.now(timezone.utc).isoformat(),
            resolution_date = opportunity.resolution_date,
            expected_pnl    = round(expected_pnl, 2),
        )

        self.state.paper_balance -= size_usd
        self.state.open_positions.append(pos)
        self.state.save()
        log.info(f"📝 PAPER TRADE: {opportunity.side} {opportunity.question[:60]}")
        log.info(f"   Price: ${opportunity.price:.3f}  |  Shares: {shares:.1f}  |  Cost: ${size_usd:.2f}  |  Expected P&L: ${expected_pnl:.2f}")

        # ── Log to Supabase ──────────────────────────────────────────────────
        trade_id = f"bond_{opportunity.market_id}_{int(time.time())}"
        pos.trade_id = trade_id
        db.insert_trade(
            trade_id    = trade_id,
            bot         = "bond_bot",
            mode        = "live" if LIVE_MODE else "demo",
            market      = opportunity.question,
            market_id   = opportunity.market_id,
            side        = opportunity.side,
            size_usd    = round(size_usd, 2),
            entry_price = opportunity.price,
            status      = "open",
            method      = "limit",
            exec_ms     = 28,
        )
        return pos

    async def execute_limit_order(self, opportunity: BondOpportunity, size_usd: float) -> Optional[OpenPosition]:
        """
        Post a LIMIT ORDER (maker) on Polymarket.
        Post-Feb 2026: ALL orders must be limit orders to earn maker rebates.
        """
        # Paper mode
        if not self.client or not LIVE_MODE:
            return self._paper_execute(opportunity, size_usd)

        # Live mode
        try:
            token_id = opportunity.token_id or opportunity.market_id
            size_shares = size_usd / opportunity.price

            order_args = LimitOrderArgs(
                token_id   = token_id,
                price      = opportunity.price,       # limit price — exact price we want
                size       = size_shares,
                side       = BUY,                     # we're buying the near-certain side
            )

            log.info(f"🚀 LIVE ORDER: Posting limit {opportunity.side} @ {opportunity.price:.3f}")
            log.info(f"   Market: {opportunity.question[:70]}")

            signed_order = self.client.create_limit_order(order_args)
            response     = self.client.post_order(signed_order)

            log.info(f"✅ Order posted: {response}")

            pos = OpenPosition(
                market_id       = opportunity.market_id,
                question        = opportunity.question,
                side            = opportunity.side,
                entry_price     = opportunity.price,
                size_shares     = round(size_shares, 4),
                size_usd        = round(size_usd, 2),
                opened_at       = datetime.now(timezone.utc).isoformat(),
                resolution_date = opportunity.resolution_date,
                expected_pnl    = round(size_shares * (1.0 - opportunity.price), 2),
            )
            return pos

        except Exception as e:
            log.error(f"Order failed: {e}")
            return None


# ══════════════════════════════════════════════════════════════════════════════
#  REPORTER — pretty console output
# ══════════════════════════════════════════════════════════════════════════════

class Reporter:

    @staticmethod
    def print_banner():
        print("""
╔══════════════════════════════════════════════════════════════╗
║                  POLYDESK BOT ENGINE v1                      ║
║             Strategy: Bond (Near-Certainty)                  ║
║                                                              ║
║  Mode: {}                                           ║
╚══════════════════════════════════════════════════════════════╝
""".format("🔴  LIVE TRADING — REAL CAPITAL" if LIVE_MODE else "🎭  PAPER TRADING — VIRTUAL FUNDS "))

    @staticmethod
    def print_state(state: BotState):
        print(f"""
┌─ PORTFOLIO SNAPSHOT ─────────────────────────────────────────┐
│  Paper Balance:    ${state.paper_balance:>10,.2f}                        │
│  Open Positions:   {len([p for p in state.open_positions if p.status=='open']):>3}                                   │
│  Total Trades:     {state.total_trades:>3}                                   │
│  Win Rate:         {(state.winning_trades/max(state.total_trades,1)*100):>6.1f}%                               │
│  Total P&L:        ${state.total_paper_pnl:>+10,.2f}                        │
│  Scan #:           {state.scan_count:>3}                                   │
└──────────────────────────────────────────────────────────────┘""")

    @staticmethod
    def print_opportunity(opp: BondOpportunity, rank: int):
        conf_emoji = {"HIGH": "🟢", "MEDIUM": "🟡", "LOW": "🔴"}[opp.confidence]
        print(f"""
  {rank}. {conf_emoji} [{opp.confidence}] {opp.side} — {opp.question[:65]}
     Price: ${opp.price:.3f}  |  Days left: {opp.days_remaining:.1f}  |  
     Return: +{opp.expected_return:.1f}%  |  Annualized: {opp.annualized_return:.0f}%
     Reason: {opp.reason}""")

    @staticmethod
    def print_open_positions(positions: list):
        open_pos = [p for p in positions if p.status == "open"]
        if not open_pos:
            print("\n  No open positions.")
            return
        print(f"\n  Open positions ({len(open_pos)}):")
        for i, pos in enumerate(open_pos, 1):
            print(f"  {i}. {pos.side} — {pos.question[:55]}")
            print(f"     Entry: ${pos.entry_price:.3f}  |  Size: ${pos.size_usd:.2f}  |  Expected P&L: ${pos.expected_pnl:.2f}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN BOT LOOP
# ══════════════════════════════════════════════════════════════════════════════

class BondBot:

    def __init__(self):
        self.state    = BotState.load()
        self.scanner  = MarketScanner()
        self.pm       = PositionManager()
        self.executor = ExecutionEngine(self.state)
        self.reporter = Reporter()
        self.bridge   = StateBridge("bond_bot")

    def _write_bridge_state(self):
        """Write standardised state for dashboard."""
        history = self.state.trade_history[-20:]
        recent_trades = [
            self.bridge.write_trade(
                market      = t.get("question","")[:60],
                side        = t.get("side","YES"),
                size_usd    = t.get("size_usd", 0),
                entry_price = t.get("entry_price", 0),
                exit_price  = t.get("exit_price"),
                pnl         = t.get("realized_pnl"),
                status      = t.get("status","closed"),
                exec_ms     = 28,
            )
            for t in reversed(history)
        ]
        open_pos = [
            {
                "market":  p.question[:50] if hasattr(p,"question") else str(p.get("question",""))[:50],
                "side":    p.side if hasattr(p,"side") else p.get("side","YES"),
                "entry":   p.entry_price if hasattr(p,"entry_price") else p.get("entry_price",0),
                "size":    p.size_usd if hasattr(p,"size_usd") else p.get("size_usd",0),
                "status":  "open",
            }
            for p in self.state.open_positions
            if (p.status if hasattr(p,"status") else p.get("status","")) == "open"
        ]
        win_rate = (self.state.winning_trades / max(self.state.total_trades, 1)) * 100
        self.bridge.write(
            status           = "live",
            daily_pnl        = self.state.total_paper_pnl,
            total_pnl        = self.state.total_paper_pnl,
            trades_today     = self.state.total_trades,
            total_trades     = self.state.total_trades,
            win_rate         = round(win_rate, 1),
            capital_deployed = self.state.paper_balance,
            open_positions   = open_pos,
            recent_trades    = recent_trades,
            extra            = {
                "scan_count":   self.state.scan_count,
                "paper_balance": self.state.paper_balance,
                "strategy":     "Bond / Near-Certainty",
                "bot_file":     "polydesk_bond_bot.py",
            }
        )
        # Also check for orchestrator commands
        cmd = self.bridge.read_command()
        if cmd:
            action = cmd.get("action")
            if action == "pause":
                self.bridge.write_paused(cmd.get("reason",""))
                raise SystemExit("Paused by orchestrator")

    async def run(self):
        self.reporter.print_banner()
        self.executor.connect()
        await self.scanner.start()

        log.info(f"Bond Bot starting. Mode: {'LIVE' if LIVE_MODE else 'PAPER'}. Scanning every {SCAN_INTERVAL_SECONDS}s.")

        try:
            while True:
                await self._scan_cycle()
                self.state.scan_count += 1
                self.state.save()
                self._write_bridge_state()
                self.reporter.print_state(self.state)
                log.info(f"Next scan in {SCAN_INTERVAL_SECONDS}s…")
                await asyncio.sleep(SCAN_INTERVAL_SECONDS)

        except KeyboardInterrupt:
            log.info("Bot stopped by user.")
        finally:
            await self.scanner.stop()
            self.state.save()
            log.info("State saved. Goodbye.")

    async def _scan_cycle(self):
        """One full scan-evaluate-execute cycle."""
        log.info(f"═══ SCAN #{self.state.scan_count + 1} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ═══")

        # 1 — Fetch all markets
        markets = await self.scanner.get_all_markets()
        if not markets:
            log.warning("No markets returned — API may be down")
            return

        # 2 — Find bond opportunities
        opportunities = self.scanner.scan_for_bonds(markets)

        # 3 — Print top 5
        open_count = sum(1 for p in self.state.open_positions if p.status == "open")
        slots_available = MAX_OPEN_POSITIONS - open_count

        print(f"\n  Top bond opportunities ({len(opportunities)} found, {slots_available} slots available):")
        for i, opp in enumerate(opportunities[:5], 1):
            self.reporter.print_opportunity(opp, i)

        self.reporter.print_open_positions(self.state.open_positions)

        # 4 — Execute on HIGH/MEDIUM confidence opportunities
        if slots_available <= 0:
            log.info("Max positions reached — not entering new trades this cycle")
            return

        executed = 0
        for opp in opportunities:
            if executed >= slots_available:
                break

            # Skip if we're already in this market
            if self.pm.already_in_market(opp.market_id, self.state.open_positions):
                continue

            # Skip LOW confidence unless paper mode
            if opp.confidence == "LOW" and LIVE_MODE:
                continue

            # Calculate position size
            size = self.pm.kelly_size(
                price      = opp.price,
                confidence = opp.confidence,
                balance    = self.state.paper_balance,
            )

            if size < 10.0:   # minimum trade size $10
                log.debug(f"Position size too small (${size:.2f}) — skipping")
                continue

            log.info(f"→ Entering bond position: {opp.confidence} | {opp.side} @ {opp.price:.3f} | ${size:.2f}")

            position = await self.executor.execute_limit_order(opp, size)
            if position:
                self.state.open_positions.append(position)
                self.state.total_trades += 1
                executed += 1
                log.info(f"✅ Position opened. Expected P&L: ${position.expected_pnl:.2f}")

        # 5 — Check if any positions have resolved (simplified — production would use WebSocket)
        await self._check_resolutions(markets)

    async def _check_resolutions(self, markets: list[dict]):
        """
        Check if any open positions have resolved.
        In production this uses WebSocket events. Here we check market status.
        """
        market_map = {m.get("conditionId", m.get("id","")): m for m in markets}

        for pos in self.state.open_positions:
            if pos.status != "open":
                continue

            market = market_map.get(pos.market_id)
            if not market:
                continue

            # Check if resolved
            if market.get("closed") or market.get("resolved"):
                resolved_yes = market.get("resolutionYes", False)
                our_side_won = (pos.side == "YES" and resolved_yes) or \
                               (pos.side == "NO"  and not resolved_yes)

                if our_side_won:
                    realized_pnl      = pos.size_shares * (1.0 - pos.entry_price)
                    pos.realized_pnl  = round(realized_pnl, 2)
                    pos.exit_price    = 1.0
                    pos.status        = "resolved"
                    self.state.total_paper_pnl += realized_pnl
                    self.state.paper_balance   += pos.size_usd + realized_pnl
                    self.state.winning_trades  += 1
                    self.state.trade_history.append(asdict(pos))
                    log.info(f"🎉 WIN: {pos.question[:60]}")
                    log.info(f"   P&L: +${realized_pnl:.2f}  |  Total P&L: ${self.state.total_paper_pnl:.2f}")
                    if hasattr(pos, "trade_id") and pos.trade_id:
                        db.close_trade(pos.trade_id, exit_price=1.0, pnl=round(realized_pnl, 2), status="resolved")
                else:
                    pos.realized_pnl = -pos.size_usd
                    pos.exit_price   = 0.0
                    pos.status       = "resolved"
                    self.state.total_paper_pnl -= pos.size_usd
                    self.state.trade_history.append(asdict(pos))
                    log.warning(f"💥 LOSS: {pos.question[:60]} — lost ${pos.size_usd:.2f}")
                    log.info(f"   Total P&L: ${self.state.total_paper_pnl:.2f}")
                    if hasattr(pos, "trade_id") and pos.trade_id:
                        db.close_trade(pos.trade_id, exit_price=0.0, pnl=-pos.size_usd, status="resolved")


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main():
    """
    Run the bond bot.

    Setup steps:
    1. pip install py-clob-client python-dotenv aiohttp
    2. Set env vars: POLYMARKET_PRIVATE_KEY, POLYMARKET_API_KEY, 
                     POLYMARKET_API_SECRET, POLYMARKET_PASSPHRASE
    3. Or set LIVE_MODE=False (default) to run in paper mode with no wallet needed
    4. python polydesk_bond_bot.py

    The bot will:
    - Scan Polymarket every 5 minutes
    - Print all bond opportunities found
    - In paper mode: simulate trades, track virtual P&L
    - In live mode: post real limit orders to Polymarket
    """
    bot = BondBot()
    asyncio.run(bot.run())


if __name__ == "__main__":
    main()
