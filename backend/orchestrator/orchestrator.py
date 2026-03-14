"""
POLYDESK ORCHESTRATOR v2 — Clean, minimal, reliable
Serves API endpoints for dashboard. Runs AI supervision cycle.
"""

import os
import json
import time
import logging
import threading
import requests
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, request, jsonify

# ── CONFIG ────────────────────────────────────────────────────────────────────
ORCHESTRATOR_INTERVAL = 300
TOTAL_CAPITAL_USD     = float(os.environ.get("TOTAL_CAPITAL_USD", 450))
API_PORT              = 8765
STATE_DIR             = Path("/app/state")
COMMANDS_DIR          = Path("/app/commands")

CAPITAL_ALLOCATION = {
    "bond_bot":    351.0,
    "rebates_bot": 99.0,
    "btc5m_bot":   0.0,
}

BOT_STATE_FILES = {
    "bond_bot":    STATE_DIR / "bond_bot_state.json",
    "rebates_bot": STATE_DIR / "rebates_bot_state.json",
    "btc5m_bot":   STATE_DIR / "btc5m_bot_state.json",
}

# ── LOGGING ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("Orchestrator")

# ── FLASK APP ─────────────────────────────────────────────────────────────────
app = Flask(__name__)

# ── STATE ─────────────────────────────────────────────────────────────────────
decision_store = []
chat_history   = []

# ── SUPABASE (optional) ───────────────────────────────────────────────────────
_db = None
_SUPABASE_OK = False
try:
    from polydesk_db import PolydeskDB
    _db = PolydeskDB()
    _SUPABASE_OK = True
    log.info("Supabase connected")
except Exception as e:
    log.warning(f"Supabase unavailable: {e}")

# ── AI CLIENT (optional) ──────────────────────────────────────────────────────
_claude = None
try:
    import anthropic
    _api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if _api_key:
        _claude = anthropic.Anthropic(api_key=_api_key)
        log.info("Anthropic client ready")
except Exception as e:
    log.warning(f"Anthropic unavailable: {e}")

# ── HELPERS ───────────────────────────────────────────────────────────────────
def read_bot_states() -> dict:
    states = {}
    for bot, path in BOT_STATE_FILES.items():
        try:
            if path.exists():
                with open(path) as f:
                    states[bot] = json.load(f)
            else:
                states[bot] = {"status": "no_state_file", "pnl": 0, "trades": 0}
        except Exception as e:
            states[bot] = {"status": "error", "error": str(e), "pnl": 0, "trades": 0}
    return states


def get_portfolio_summary() -> dict:
    states = read_bot_states()
    total_pnl     = sum((s.get("daily_pnl") or 0) for s in states.values())
    total_trades  = sum((s.get("trades_today") or s.get("total_trades") or 0) for s in states.values())
    total_rebates = sum((s.get("total_rebates") or 0) for s in states.values())
    return {
        "bot_states":        states,
        "capital_allocation": CAPITAL_ALLOCATION,
        "deployed_capital":  TOTAL_CAPITAL_USD,
        "total_capital":     TOTAL_CAPITAL_USD,
        "total_daily_pnl":   total_pnl,
        "total_trades_today": total_trades,
        "total_rebates":     total_rebates,
        "recent_trades":     [],
        "timestamp":         datetime.now(timezone.utc).isoformat(),
    }


def fetch_markets() -> list:
    try:
        r = requests.get(
            "https://gamma-api.polymarket.com/markets",
            params={"active": "true", "limit": "20", "order": "volume24hr", "ascending": "false"},
            timeout=8
        )
        return r.json() if r.ok else []
    except Exception:
        return []


def write_command(bot: str, command: dict):
    try:
        COMMANDS_DIR.mkdir(parents=True, exist_ok=True)
        path = COMMANDS_DIR / f"{bot}_command.json"
        with open(path, "w") as f:
            json.dump({**command, "timestamp": datetime.now(timezone.utc).isoformat()}, f)
    except Exception as e:
        log.error(f"write_command failed: {e}")


def log_decision(decision: dict):
    decision["id"] = f"D-{int(time.time())}"
    decision_store.insert(0, decision)
    if len(decision_store) > 50:
        decision_store.pop()

# ── AI SUPERVISION CYCLE ──────────────────────────────────────────────────────
def run_ai_cycle():
    if not _claude:
        log.warning("No AI key — skipping supervision cycle")
        return

    portfolio = get_portfolio_summary()
    markets   = fetch_markets()

    system = """You are the Polydesk AI orchestrator managing a Polymarket trading operation.
Capital: $450 total. Bond Bot (78%), Rebates Bot (22%), BTC5M (paper only).
Respond ONLY in valid JSON with keys: assessment, risk_level, decisions, opportunities, alert."""

    user_msg = f"""Portfolio: {json.dumps(portfolio, indent=2)}
Top markets: {json.dumps(markets[:5], indent=2)}
Time: {datetime.now(timezone.utc).strftime('%H:%M UTC')}
Make your assessment."""

    try:
        resp = _claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system,
            messages=[{"role": "user", "content": user_msg}]
        )
        raw = resp.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(raw)
        log.info(f"AI: {result.get('assessment', '')[:100]}")
        log.info(f"Risk: {result.get('risk_level')}")

        for d in result.get("decisions", []):
            bot = d.get("bot")
            if bot in BOT_STATE_FILES or bot == "all":
                targets = list(BOT_STATE_FILES.keys()) if bot == "all" else [bot]
                for t in targets:
                    write_command(t, {"action": d.get("action"), "params": d.get("params", {})})

        log_decision({
            "type":          "orchestration_cycle",
            "assessment":    result.get("assessment"),
            "risk_level":    result.get("risk_level"),
            "decisions":     result.get("decisions", []),
            "opportunities": result.get("opportunities", []),
            "alert":         result.get("alert"),
            "portfolio_pnl": portfolio["total_daily_pnl"],
            "timestamp":     datetime.now(timezone.utc).isoformat(),
        })

        if _SUPABASE_OK and _db:
            for bot, state in portfolio["bot_states"].items():
                if state.get("status") not in ["no_state_file", "error"]:
                    try:
                        _db.upsert_snapshot(bot, state)
                    except Exception:
                        pass

    except Exception as e:
        if "credit" in str(e).lower() or "balance" in str(e).lower() or "overloaded" in str(e).lower():
            log.warning("AI unavailable — skipping cycle")
        elif "invalid_request_error" in str(e).lower() or "400" in str(e):
            log.error(f"AI request error (bad model/key?): {e}")
        else:
            log.error(f"AI cycle error: {e}")


def orchestration_loop():
    log.info("Orchestrator starting — first cycle in 30s")
    time.sleep(30)
    while True:
        try:
            run_ai_cycle()
        except Exception as e:
            log.error(f"Loop error: {e}")
        time.sleep(ORCHESTRATOR_INTERVAL)

# ── API ENDPOINTS ─────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "time": datetime.now(timezone.utc).isoformat()})


@app.route("/status", methods=["GET"])
def status():
    portfolio = get_portfolio_summary()
    return jsonify({
        "orchestrator_ok":  True,
        "portfolio":        portfolio,
        "capital_plan":     CAPITAL_ALLOCATION,
        "decisions":        decision_store[:10],
        "last_cycle":       decision_store[0].get("timestamp") if decision_store else None,
    })


@app.route("/trades", methods=["GET"])
def get_trades():
    bot   = request.args.get("bot")
    limit = int(request.args.get("limit", 100))
    mode  = request.args.get("mode")
    if _SUPABASE_OK and _db:
        try:
            trades = _db.get_recent_trades(bot=bot, limit=limit, mode=mode)
            for t in trades:
                t["size"]   = t.get("size_usd")
                t["entry"]  = t.get("entry_price")
                t["exit"]   = t.get("exit_price")
                t["execMs"] = t.get("exec_ms")
                t["time"]   = (t.get("created_at") or "")[:19].replace("T"," ")
            return jsonify({"trades": trades, "source": "supabase"})
        except Exception as e:
            log.error(f"get_trades error: {e}")
    return jsonify({"trades": [], "source": "unavailable"})


@app.route("/positions", methods=["GET"])
def get_positions():
    bot = request.args.get("bot")
    if _SUPABASE_OK and _db:
        try:
            positions = _db.get_open_positions(bot=bot)
            return jsonify({"positions": positions, "source": "supabase"})
        except Exception as e:
            log.error(f"get_positions error: {e}")
    return jsonify({"positions": [], "source": "unavailable"})


@app.route("/allocations", methods=["GET", "POST"])
def allocations():
    if request.method == "POST":
        data = request.json or {}
        for bot, pct in data.items():
            if bot in CAPITAL_ALLOCATION:
                CAPITAL_ALLOCATION[bot] = float(pct)
        if _SUPABASE_OK and _db:
            try:
                _db.save_allocations(CAPITAL_ALLOCATION)
            except Exception:
                pass
        return jsonify({"ok": True, "allocations": CAPITAL_ALLOCATION})
    return jsonify({"allocations": CAPITAL_ALLOCATION})


@app.route("/markets", methods=["GET"])
def get_markets():
    markets = fetch_markets()
    return jsonify(markets)


@app.route("/command", methods=["POST"])
def send_command():
    data = request.json or {}
    bot  = data.get("bot")
    cmd  = data.get("command")
    if not bot or not cmd:
        return jsonify({"error": "bot and command required"}), 400
    write_command(bot, {"action": cmd, "params": data.get("params", {})})
    return jsonify({"ok": True})


@app.route("/chat", methods=["POST"])
def chat():
    data    = request.json or {}
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "No message"}), 400

    portfolio = get_portfolio_summary()
    system = f"""You are Polydesk AI — a trading assistant for a Polymarket operation.
Portfolio: ${portfolio['total_capital']} total, ${portfolio['total_daily_pnl']:+.2f} today.
Be direct, specific, and concise."""

    chat_history.append({"role": "user", "content": message})

    if not _claude:
        return jsonify({"reply": "AI offline — add ANTHROPIC_API_KEY to .env", "model": "none"})

    try:
        resp = _claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=system,
            messages=chat_history[-10:]
        )
        reply = resp.content[0].text
        chat_history.append({"role": "assistant", "content": reply})
        return jsonify({"reply": reply, "model": "claude-sonnet-4-20250514",
                        "timestamp": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        if "credit" in str(e).lower():
            return jsonify({"reply": "AI credits depleted. Top up at console.anthropic.com", "model": "none"})
        return jsonify({"reply": f"AI error: {e}", "model": "none"}), 500


@app.route("/pnl-chart", methods=["GET"])
def pnl_chart():
    bot   = request.args.get("bot")
    hours = int(request.args.get("hours", 24))
    if _SUPABASE_OK and _db:
        try:
            history = _db.get_snapshot_history(bot=bot, hours=hours)
            return jsonify({"history": history, "source": "supabase"})
        except Exception:
            pass
    return jsonify({"history": [], "source": "unavailable"})



@app.route("/config", methods=["POST"])
def save_config():
    data = request.json or {}
    saved = {}
    for key in ["polymarket_api_key","polymarket_secret","polymarket_passphrase","risk_controls","risk_limits"]:
        if key in data:
            if _SUPABASE_OK and _db:
                try:
                    _db.set_app_state(f"config_{key}", data[key])
                    saved[key] = True
                except Exception: saved[key] = False
    log.info(f"Config saved: {list(saved.keys())}")
    return jsonify({"ok": True, "saved": saved})

@app.route("/api/status", methods=["GET"])
def api_status():
    portfolio = get_portfolio_summary()
    return jsonify({"orchestrator_ok":True,"portfolio":portfolio,"decisions":decision_store[:10],"signals":decision_store[:5],"last_cycle":decision_store[0].get("timestamp") if decision_store else None})

@app.route("/app-state", methods=["GET", "POST"])
def app_state():
    key = request.args.get("key", "app_state")
    if request.method == "POST":
        data = request.json or {}
        if _SUPABASE_OK and _db:
            try:
                _db.set_app_state(key, data)
            except Exception:
                pass
        return jsonify({"ok": True})
    if _SUPABASE_OK and _db:
        try:
            val = _db.get_app_state(key)
            return jsonify({"value": val})
        except Exception:
            pass
    return jsonify({"value": None})


# ── POLYMARKET WHALE PROXY ────────────────────────────────────────────────────
import urllib.request as _urllib_req

_PM_LEADERBOARD = [
    {"rank":1,  "name":"majorexploiter",    "address":"0x019782cab5d844f02bafb71f512758be78579f3c","pnl":2416975,"volume":6949025},
    {"rank":2,  "name":"HorizonSplendidView","address":"0x02227b8f5a9636e895607edd3185ed6ee5598ff7","pnl":1787559,"volume":5781406},
    {"rank":3,  "name":"BigVolTrader",      "address":"0x2a2c53bd278c04da9962fcf96490e17f3dfb9bc1","pnl":1512549,"volume":22745650},
    {"rank":4,  "name":"MinorKey4",         "address":"0xb90494d9a5d8f71f1930b2aa4b599f95c344c255","pnl":782822, "volume":2800445},
    {"rank":5,  "name":"gmanas",            "address":"0xe90bec87d9ef430f27f9dcfe72c34b76967d5da2","pnl":735278, "volume":12123037},
    {"rank":6,  "name":"432614799197",      "address":"0xdc876e6873772d38716fda7f2452a78d426d7ab6","pnl":699387, "volume":17201579},
    {"rank":7,  "name":"joosangyoo",        "address":"0x07b8e44b90cc3e91b8d5fe60ea810d2534638e25","pnl":634730, "volume":5233264},
    {"rank":8,  "name":"WoofMaster",        "address":"0x916f7165c2c836aba22edb6453cdbb5f3ea253ba","pnl":571305, "volume":1549559},
    {"rank":9,  "name":"bcda",              "address":"0xb45a797faa52b0fd8adc56d30382022b7b12192c","pnl":568939, "volume":3153175},
    {"rank":10, "name":"jtwyslljy",         "address":"0x9cb990f1862568a63d8601efeebe0304225c32f2","pnl":516776, "volume":1589951},
    {"rank":11, "name":"beachboy4",         "address":"0xc2e7800b5af46e6093872b177b7a5e7f0563be51","pnl":402961, "volume":822553},
    {"rank":12, "name":"gatorr",            "address":"0x93abbc022ce98d6f45d4444b594791cc4b7a9723","pnl":395210, "volume":2021224},
    {"rank":13, "name":"Wannac",            "address":"0xa8e089ade142c95538e06196e09c85681112ad50","pnl":339043, "volume":3456975},
    {"rank":14, "name":"geniusCM",          "address":"0x0b9cae2b0dfe7a71c413e0604eaac1c352f87e44","pnl":325771, "volume":3883438},
    {"rank":15, "name":"ChinesePro",        "address":"0x37e053beabee77acc15e641dfe8e395b2b2d024e","pnl":286161, "volume":1791625},
    {"rank":16, "name":"UAEVALORANTFAN",    "address":"0xc65ca4755436f82d8eb461e65781584b8cadea39","pnl":275615, "volume":734720},
    {"rank":17, "name":"bobe2",             "address":"0xed107a85a4585a381e48c7f7ca4144909e7dd2e5","pnl":240277, "volume":13985968},
    {"rank":18, "name":"bossoskil1",        "address":"0xa5ea13a81d2b7e8e424b182bdc1db08e756bd96a","pnl":217211, "volume":7321216},
    {"rank":19, "name":"Andromeda1",        "address":"0x39932ca2b7a1b8ab6cbf0b8f7419261b950ccded","pnl":211360, "volume":784253},
    {"rank":20, "name":"kingofcoinflips",   "address":"0xe9c6312464b52aa3eff13d822b003282075995c9","pnl":185000, "volume":620000},
]

def _pm_fetch(url):
    try:
        req = _urllib_req.Request(url, headers={"User-Agent":"polydesk/1.0","Accept":"application/json"})
        with _urllib_req.urlopen(req, timeout=8) as res:
            import json as _j
            return _j.loads(res.read())
    except Exception as e:
        return {"error": str(e)}

@app.route("/leaderboard", methods=["GET"])
def leaderboard():
    try:
        data = _pm_fetch("https://data-api.polymarket.com/leaderboard?window=all&limit=20&offset=0")
        if isinstance(data, list) and len(data) > 0:
            return jsonify([{"rank":i+1,"name":t.get("username","")[:20],"address":t.get("proxyWallet",""),"pnl":t.get("pnl",0),"volume":t.get("volume",0),"pnl_usd":t.get("pnl",0),"num_trades":t.get("numTrades",0),"win_rate":t.get("winRate")} for i,t in enumerate(data[:20])])
    except Exception: pass
    return jsonify(_PM_LEADERBOARD)

@app.route("/whale/activity", methods=["GET"])
def whale_activity():
    addr  = request.args.get("address", "")
    limit = request.args.get("limit", "20")
    if not addr:
        return jsonify({"error": "address required"}), 400
    data = _pm_fetch(f"https://data-api.polymarket.com/activity?user={addr}&limit={limit}")
    return jsonify(data)

@app.route("/whale/positions", methods=["GET"])
def whale_positions():
    addr = request.args.get("address", "")
    if not addr:
        return jsonify({"error": "address required"}), 400
    data = _pm_fetch(f"https://data-api.polymarket.com/positions?user={addr}&limit=20")
    return jsonify(data)

@app.route("/whale/value", methods=["GET"])
def whale_value():
    addr = request.args.get("address", "")
    if not addr:
        return jsonify({"error": "address required"}), 400
    data = _pm_fetch(f"https://data-api.polymarket.com/value?user={addr}")
    return jsonify(data)

@app.route("/whale/add", methods=["POST"])
def whale_add():
    body    = request.json or {}
    address = body.get("address", "").strip().lower()
    name    = body.get("name", address[:12])
    if not address:
        return jsonify({"error": "address required"}), 400
    wallet = {"name":name,"address":address,"copy":body.get("copy",True),"copy_size":body.get("copy_size",0.7),"max_usd":body.get("max_usd",80),"strategy":body.get("strategy","proportional"),"notes":"","status":"connected"}
    if _SUPABASE_OK and _db:
        try: _db.save_wallet_config(wallet); log.info(f"Whale added: {name}")
        except Exception as e: log.error(f"whale_add: {e}")
    write_command("copier_bot", {"action":"add_wallet","params":wallet})
    return jsonify({"ok": True, "address": address, "name": name})

@app.route("/whale/remove", methods=["POST"])
def whale_remove():
    body    = request.json or {}
    address = body.get("address", "").strip().lower()
    if not address:
        return jsonify({"error": "address required"}), 400
    if _SUPABASE_OK and _db:
        try:
            from polydesk_db import get_client
            get_client().table("wallet_config").delete().eq("address", address).execute()
        except Exception: pass
    write_command("copier_bot", {"action":"remove_wallet","params":{"address":address}})
    return jsonify({"ok": True, "removed": address})


# ── ENTRY POINT ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    COMMANDS_DIR.mkdir(parents=True, exist_ok=True)

    t = threading.Thread(target=orchestration_loop, daemon=True)
    t.start()

    log.info(f"Polydesk Orchestrator v2 — port {API_PORT}")
    app.run(host="0.0.0.0", port=API_PORT, debug=False)


