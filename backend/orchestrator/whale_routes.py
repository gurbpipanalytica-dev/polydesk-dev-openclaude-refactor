"""
POLYDESK — Whale/Leaderboard proxy routes
Registered into the main Flask app via register_whale_routes(app)
"""

import urllib.request as _urllib
import json as _json
from flask import request, jsonify

# ── LEADERBOARD DATA (scraped from polymarket.com/leaderboard, all-time) ─────
PM_LEADERBOARD = [
    {"rank":1,  "name":"majorexploiter",     "address":"0x019782cab5d844f02bafb71f512758be78579f3c","pnl":2416975,"volume":6949025},
    {"rank":2,  "name":"HorizonSplendidView", "address":"0x02227b8f5a9636e895607edd3185ed6ee5598ff7","pnl":1787559,"volume":5781406},
    {"rank":3,  "name":"0x2a2C...Bc1",        "address":"0x2a2c53bd278c04da9962fcf96490e17f3dfb9bc1","pnl":1512549,"volume":22745650},
    {"rank":4,  "name":"MinorKey4",           "address":"0xb90494d9a5d8f71f1930b2aa4b599f95c344c255","pnl":782822, "volume":2800445},
    {"rank":5,  "name":"gmanas",              "address":"0xe90bec87d9ef430f27f9dcfe72c34b76967d5da2","pnl":735278, "volume":12123037},
    {"rank":6,  "name":"432614799197",        "address":"0xdc876e6873772d38716fda7f2452a78d426d7ab6","pnl":699387, "volume":17201579},
    {"rank":7,  "name":"joosangyoo",          "address":"0x07b8e44b90cc3e91b8d5fe60ea810d2534638e25","pnl":634730, "volume":5233264},
    {"rank":8,  "name":"WoofMaster",          "address":"0x916f7165c2c836aba22edb6453cdbb5f3ea253ba","pnl":571305, "volume":1549559},
    {"rank":9,  "name":"bcda",                "address":"0xb45a797faa52b0fd8adc56d30382022b7b12192c","pnl":568939, "volume":3153175},
    {"rank":10, "name":"jtwyslljy",           "address":"0x9cb990f1862568a63d8601efeebe0304225c32f2","pnl":516776, "volume":1589951},
    {"rank":11, "name":"beachboy4",           "address":"0xc2e7800b5af46e6093872b177b7a5e7f0563be51","pnl":402961, "volume":822553},
    {"rank":12, "name":"gatorr",              "address":"0x93abbc022ce98d6f45d4444b594791cc4b7a9723","pnl":395210, "volume":2021224},
    {"rank":13, "name":"Wannac",              "address":"0xa8e089ade142c95538e06196e09c85681112ad50","pnl":339043, "volume":3456975},
    {"rank":14, "name":"geniusCM",            "address":"0x0b9cae2b0dfe7a71c413e0604eaac1c352f87e44","pnl":325771, "volume":3883438},
    {"rank":15, "name":"ChinesePro",          "address":"0x37e053beabee77acc15e641dfe8e395b2b2d024e","pnl":286161, "volume":1791625},
    {"rank":16, "name":"UAEVALORANTFAN",      "address":"0xc65ca4755436f82d8eb461e65781584b8cadea39","pnl":275615, "volume":734720},
    {"rank":17, "name":"bobe2",               "address":"0xed107a85a4585a381e48c7f7ca4144909e7dd2e5","pnl":240277, "volume":13985968},
    {"rank":18, "name":"bossoskil1",          "address":"0xa5ea13a81d2b7e8e424b182bdc1db08e756bd96a","pnl":217211, "volume":7321216},
    {"rank":19, "name":"Andromeda1",          "address":"0x39932ca2b7a1b8ab6cbf0b8f7419261b950ccded","pnl":211360, "volume":784253},
    {"rank":20, "name":"kingofcoinflips",     "address":"0xe9c6312464b52aa3eff13d822b003282075995c9","pnl":185000, "volume":620000},
]

_DATA_API = "https://data-api.polymarket.com"

def _fetch(url):
    try:
        req = _urllib.Request(url, headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        })
        with _urllib.urlopen(req, timeout=8) as r:
            return _json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}

def register_whale_routes(app):

    @app.route("/leaderboard", methods=["GET"])
    def leaderboard():
        return jsonify(PM_LEADERBOARD)

    @app.route("/whale/activity", methods=["GET"])
    def whale_activity():
        addr  = request.args.get("address", "")
        limit = request.args.get("limit", "20")
        if not addr:
            return jsonify({"error": "address required"}), 400
        return jsonify(_fetch(f"{_DATA_API}/activity?user={addr}&limit={limit}"))

    @app.route("/whale/positions", methods=["GET"])
    def whale_positions():
        addr = request.args.get("address", "")
        if not addr:
            return jsonify({"error": "address required"}), 400
        return jsonify(_fetch(f"{_DATA_API}/positions?user={addr}&limit=30"))

    @app.route("/whale/value", methods=["GET"])
    def whale_value():
        addr = request.args.get("address", "")
        if not addr:
            return jsonify({"error": "address required"}), 400
        return jsonify(_fetch(f"{_DATA_API}/value?user={addr}"))

    @app.route("/whale/add", methods=["POST"])
    def whale_add():
        """One-click: start copying a wallet."""
        body     = request.json or {}
        address  = body.get("address", "").strip().lower()
        name     = body.get("name", address[:12])
        copy     = body.get("copy", True)
        max_usd  = body.get("max_usd", 50)
        copy_size= body.get("copy_size", 0.5)
        if not address:
            return jsonify({"error": "address required"}), 400
        # Write to Supabase wallet_config table so the copier bot picks it up
        import os
        supa_url = os.environ.get("SUPABASE_URL", "")
        supa_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if supa_url and supa_key:
            try:
                from supabase import create_client
                client = create_client(supa_url, supa_key)
                client.table("wallet_config").upsert({
                    "address": address, "name": name, "copy": copy,
                    "copy_size": copy_size, "max_usd": max_usd,
                    "status": "active", "strategy": "leaderboard",
                    "notes": f"Added via dashboard. Rank source: Polymarket leaderboard."
                }).execute()
            except Exception as e:
                return jsonify({"ok": True, "warn": str(e)})
        return jsonify({"ok": True, "address": address, "copy": copy})

    @app.route("/whale/remove", methods=["POST"])
    def whale_remove():
        body    = request.json or {}
        address = body.get("address", "").strip().lower()
        if not address:
            return jsonify({"error": "address required"}), 400
        import os
        supa_url = os.environ.get("SUPABASE_URL", "")
        supa_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if supa_url and supa_key:
            try:
                from supabase import create_client
                client = create_client(supa_url, supa_key)
                client.table("wallet_config").update({"status": "inactive"}).eq("address", address).execute()
            except Exception as e:
                return jsonify({"ok": True, "warn": str(e)})
        return jsonify({"ok": True})

