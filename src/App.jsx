import { useState, useEffect, useRef } from "react";
import React from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart,
  Radar, PolarGrid, PolarAngleAxis
} from "recharts";

// ── GLOBAL CONSTANTS ─────────────────────────────────────────────────────────
const TOTAL_CAPITAL_USD   = 450;
const SUPABASE_URL        = "https://dwpqvhmdiaimfphdzmpc.supabase.co";
const SUPABASE_ANON_KEY   = "sb_publishable_uY0g2jvzpE9xwAsaOEDjmw_A9y_de-6";
const ORCHESTRATOR_BASE   = "https://api.gurbcapital.com";
const POLYGON_RPC         = "https://polygon-rpc.com";
const USDC_CONTRACT       = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// ── NUMBER FORMAT UTILITIES ───────────────────────────────────────────────────
const fmt = {
  usd:    (v, dec=2) => v == null ? "—" : `$${Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec})}`,
  pnl:    (v, dec=2) => v == null ? "—" : `${v>=0?"+":"-"}$${Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec})}`,
  pct:    (v, dec=1) => v == null ? "—" : `${v>=0?"+":""}${v.toFixed(dec)}%`,
  num:    (v)        => v == null ? "—" : v.toLocaleString("en-US"),
  dec:    (v, dec=4) => v == null ? "—" : v.toFixed(dec),
  ms:     (v)        => v == null ? "—" : `${v}ms`,
  short:  (v)        => v == null ? "—" : v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(1)}K` : fmt.usd(v),
};

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const DARK = {
  bg:"#080C14", surf:"#0D1320", surf2:"#111827", surf3:"#16202E",
  border:"rgba(255,255,255,0.06)", borderHover:"rgba(255,255,255,0.12)",
  text:"#E8EAF0", subtext:"#8892A4", muted:"#4E5A6E", dim:"#2D3748",
  green:"#00C87A", greenSoft:"rgba(0,200,122,0.1)", greenBorder:"rgba(0,200,122,0.25)",
  red:"#F05C5C", redSoft:"rgba(240,92,92,0.1)",
  amber:"#F5A623", amberSoft:"rgba(245,166,35,0.1)",
  blue:"#4C9EEB", blueSoft:"rgba(76,158,235,0.1)",
  purple:"#9B87F5", purpleSoft:"rgba(155,135,245,0.1)",
};
const LIGHT = {
  bg:"#F0EDE6", surf:"#FFFFFF", surf2:"#F7F5F0", surf3:"#EDE9E0",
  border:"rgba(0,0,0,0.07)", borderHover:"rgba(0,0,0,0.14)",
  text:"#0F1623", subtext:"#4A5568", muted:"#718096", dim:"#A0AEC0",
  green:"#009A5E", greenSoft:"rgba(0,154,94,0.08)", greenBorder:"rgba(0,154,94,0.2)",
  red:"#D63B3B", redSoft:"rgba(214,59,59,0.08)",
  amber:"#C47F00", amberSoft:"rgba(196,127,0,0.08)",
  blue:"#2B7CE0", blueSoft:"rgba(43,124,224,0.08)",
  purple:"#6B52D6", purpleSoft:"rgba(107,82,214,0.08)",
};

// ── TRADE MODE THEMES ────────────────────────────────────────────────────────
const THEMES = {
  demo: {
    accent:"#4C9EEB", accentSoft:"rgba(76,158,235,0.1)", accentBorder:"rgba(76,158,235,0.25)",
    accentText:"#6FB3F5", accentGlow:"rgba(76,158,235,0.15)",
    logoGrad:"linear-gradient(135deg,#4C9EEB 0%,#6B52D6 100%)",
    lineColor:"#4C9EEB", headerBorder:"rgba(76,158,235,0.12)",
    label:"DEMO", balanceLabel:"Paper Balance", balance:null, pnlLabel:"Simulated P&L",
  },
  live: {
    accent:"#00C87A", accentSoft:"rgba(0,200,122,0.1)", accentBorder:"rgba(0,200,122,0.25)",
    accentText:"#00E88A", accentGlow:"rgba(0,200,122,0.15)",
    logoGrad:"linear-gradient(135deg,#00C87A 0%,#0096D6 100%)",
    lineColor:"#00C87A", headerBorder:"rgba(0,200,122,0.12)",
    label:"LIVE", balanceLabel:"USDC Balance", balance:null, pnlLabel:"Realized P&L",
  },
};

// ── PNL DATASETS BY PERIOD ────────────────────────────────────────────────────
const PNL_SETS = {
  "1D": [
    {d:"00:00",v:0,c:0},{d:"02:00",v:120,c:120},{d:"04:00",v:-40,c:80},
    {d:"06:00",v:310,c:390},{d:"08:00",v:-80,c:310},{d:"10:00",v:520,c:830},
    {d:"12:00",v:180,c:1010},{d:"14:00",v:640,c:1650},{d:"16:00",v:-120,c:1530},
    {d:"18:00",v:290,c:1820},{d:"20:00",v:380,c:2200},{d:"Now",v:0,c:2200},
  ],
  "7D": [
    {d:"Mon",v:1200,c:1200},{d:"Tue",v:-300,c:900},{d:"Wed",v:2800,c:3700},
    {d:"Thu",v:1100,c:4800},{d:"Fri",v:-600,c:4200},{d:"Sat",v:1800,c:6000},{d:"Sun",v:2100,c:8100},
  ],
  "1M": [
    {d:"Feb 1",v:1200,c:1200},{d:"Feb 3",v:-300,c:900},{d:"Feb 5",v:2800,c:3700},
    {d:"Feb 7",v:1100,c:4800},{d:"Feb 9",v:-600,c:4200},{d:"Feb 11",v:3400,c:7600},
    {d:"Feb 13",v:2100,c:9700},{d:"Feb 15",v:-900,c:8800},{d:"Feb 17",v:4200,c:13000},
    {d:"Feb 19",v:1800,c:14800},{d:"Feb 21",v:3100,c:17900},{d:"Feb 22",v:2200,c:20100},
  ],
  "3M": [
    {d:"Dec 1",v:800,c:800},{d:"Dec 15",v:2100,c:2900},{d:"Jan 1",v:-400,c:2500},
    {d:"Jan 8",v:3200,c:5700},{d:"Jan 15",v:1800,c:7500},{d:"Jan 22",v:-800,c:6700},
    {d:"Feb 1",v:4100,c:10800},{d:"Feb 8",v:2800,c:13600},{d:"Feb 15",v:-900,c:12700},
    {d:"Feb 22",v:7400,c:20100},
  ],
  "ALL": [
    {d:"Sep",v:1200,c:1200},{d:"Oct",v:3400,c:4600},{d:"Nov",v:-800,c:3800},
    {d:"Dec",v:4200,c:8000},{d:"Jan",v:6100,c:14100},{d:"Feb",v:6000,c:20100},
  ],
};

const PNL_META = {
  "1D":  {total:"+$2,200",  pct:"+8.8%",   sharpe:"1.84", drawdown:"-3.6%", streak:7},
  "7D":  {total:"+$8,100",  pct:"+32.4%",  sharpe:"2.11", drawdown:"-7.1%", streak:7},
  "1M":  {total:"+$20,100", pct:"+80.4%",  sharpe:"2.43", drawdown:"-9.2%", streak:7},
  "3M":  {total:"+$20,100", pct:"+100.5%", sharpe:"2.18", drawdown:"-12.4%",streak:14},
  "ALL": {total:"+$20,100", pct:"+201.0%", sharpe:"1.97", drawdown:"-15.8%",streak:14},
};

const LATENCY = [
  {t:"00:00",ms:12},{t:"03:00",ms:9},{t:"06:00",ms:11},
  {t:"09:00",ms:38},{t:"12:00",ms:44},{t:"15:00",ms:29},
  {t:"18:00",ms:18},{t:"21:00",ms:10},{t:"Now",ms:8},
];

// ── HEATMAP DATA (hour x day, profit intensity) ───────────────────────────────
const HEATMAP = {
  days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  hours:["00","02","04","06","08","10","12","14","16","18","20","22"],
  data: [
    [0,0,10,20,80,120,200,340,180,90,40,10],
    [0,0,0, 30,90,210,280,420,310,140,60,20],
    [10,0,20,10,70,180,320,280,190,80,30,0],
    [0,0,0, 40,110,160,240,390,260,110,50,10],
    [0,10,0,20,60,190,310,450,280,130,70,20],
    [0,0,0, 0, 20,80, 140,200,160,90, 40,10],
    [0,0,0, 0, 10,40, 90, 130,100,50, 20,0 ],
  ],
};

// ── MARKET CATEGORY DATA ──────────────────────────────────────────────────────
const CATEGORIES = [
  {name:"Crypto",      trades:2840, pnl:12400, winRate:87, color:"#f59e0b"},
  {name:"Politics",    trades:1102, pnl:5800,  winRate:71, color:"#8b5cf6"},
  {name:"Esports",     trades:291,  pnl:3890,  winRate:88, color:"#3b82f6"},
  {name:"Finance",     trades:488,  pnl:1800,  winRate:63, color:"#10b981"},
  {name:"Other",       trades:121,  pnl:-1790, winRate:38, color:"#ef4444"},
];

// ── BOT COMPARISON ────────────────────────────────────────────────────────────
const BOT_COMPARE = [
  {bot:"Bond Bot",      pnl:9840, winRate:98.1, trades:284,  sharpe:3.4, drawdown:1.2},
  {bot:"Maker Rebates", pnl:5110, winRate:81.7, trades:3204, sharpe:2.1, drawdown:8.4},
  {bot:"BTC 5-Min",     pnl:3240, winRate:71.4, trades:147,  sharpe:1.9, drawdown:9.8},
  {bot:"Whale Mirror",  pnl:4280, winRate:67.3, trades:412,  sharpe:1.7, drawdown:11.2},
  {bot:"Esports Oracle",pnl:0,    winRate:0,    trades:0,    sharpe:0,   drawdown:0},
];

const COPIER_COMPARE = [
  {wallet:"TeemuTeemuTeemu", pnl:0, winRate:57.0, trades:0, method:"Esports Lag",    copySize:0, color:"#10b981", confirmed:false},
  {wallet:"Account88888",    pnl:0, winRate:53.9, trades:0, method:"BTC Direction",  copySize:0, color:"#3b82f6", confirmed:false},
  {wallet:"kingofcoinflips", pnl:0, winRate:57.3, trades:0, method:"BTC Direction",  copySize:0.7, color:"#8b5cf6", confirmed:true},
  {wallet:"defiance_cr",     pnl:0, winRate:null, trades:0, method:"MM Signal Only", copySize:0, color:"#f59e0b", confirmed:false},
  {wallet:"gabagool",        pnl:0, winRate:null, trades:0, method:"Study Only",     copySize:0, color:"#64748b", confirmed:false},
];

const BOTS = [
  {id:1,name:"Bond Bot",       file:"polydesk_bond_bot.py",    strategy:"Bond / Near-Certainty", status:"live",  pnl:9840, pct:49.2,win:98.1,trades:284, ping:9, exec:28,rate:42,color:"#10b981"},
  {id:2,name:"Maker Rebates",  file:"polydesk_maker_rebates_bot.py", strategy:"Market Making",  status:"live",  pnl:5110, pct:25.6,win:81.7,trades:3204,ping:12,exec:38,rate:88,color:"#3b82f6"},
  {id:3,name:"BTC 5-Min Bot",  file:"polydesk_btc5m_bot.py",   strategy:"Chainlink Lag + Gabagool",status:"live", pnl:3240, pct:16.2,win:71.4,trades:147, ping:7, exec:22,rate:61,color:"#8b5cf6"},
  {id:4,name:"Whale Mirror",   file:"copier_tab",               strategy:"Copy Trading",          status:"paused",pnl:4280, pct:21.4,win:67.3,trades:412, ping:14,exec:44,rate:0, color:"#f59e0b"},
  {id:5,name:"Esports Oracle", file:"—",                        strategy:"Live Data Lag",         status:"planned",pnl:0,   pct:0,   win:0,   trades:0,   ping:0, exec:0, rate:0, color:"#64748b"},
];

const TRADE_LOGS = {
  1:[
    {id:"T-284", time:"Feb 26 09:14",market:"BTC resolution > 99c",       side:"YES",size:5000,entry:0.97,exit:1.00,pnl:+150, execMs:28,status:"closed"},
    {id:"T-283", time:"Feb 26 06:31",market:"Fed rate hold — near certain", side:"YES",size:4800,entry:0.96,exit:1.00,pnl:+192, execMs:31,status:"closed"},
    {id:"T-282", time:"Feb 25 22:10",market:"ETH > $3k — high prob",        side:"YES",size:3200,entry:0.94,exit:1.00,pnl:+192, execMs:29,status:"closed"},
    {id:"T-LIVE",time:"Feb 26 14:58",market:"BTC > $88k by Feb 28",         side:"YES",size:5000,entry:0.97,exit:null, pnl:null, execMs:28,status:"open"},
  ],
  2:[
    {id:"R-3204",time:"Feb 26 14:55",market:"BTC dominance > 60%",       side:"MM", size:200,entry:0.48,exit:0.52,pnl:+28, execMs:38,status:"closed"},
    {id:"R-3203",time:"Feb 26 14:47",market:"CPI < 3% in Feb",            side:"MM", size:200,entry:0.50,exit:0.50,pnl:+4,  execMs:41,status:"closed"},
    {id:"R-3202",time:"Feb 26 14:31",market:"Fed rate cut in March",       side:"MM", size:200,entry:0.34,exit:0.34,pnl:+4,  execMs:36,status:"closed"},
    {id:"R-LIVE",time:"Feb 26 15:03",market:"ETH > $3k by Mar 10",         side:"MM", size:200,entry:0.50,exit:null, pnl:null, execMs:38,status:"open"},
  ],
  3:[
    {id:"B-147", time:"Feb 26 14:48",market:"BTC 5-min UP — 14:45 window",side:"YES",size:150,entry:0.62,exit:1.00,pnl:+57, execMs:22,status:"closed"},
    {id:"B-146", time:"Feb 26 14:33",market:"BTC 5-min UP — 14:30 window",side:"YES",size:150,entry:0.55,exit:0.52,pnl:-5,  execMs:19,status:"closed"},
    {id:"B-145", time:"Feb 26 14:18",market:"BTC 5-min DN — 14:15 window",side:"NO", size:150,entry:0.58,exit:1.00,pnl:+63, execMs:24,status:"closed"},
    {id:"B-LIVE",time:"Feb 26 15:01",market:"BTC 5-min UP — 15:00 window",side:"YES",size:150,entry:0.61,exit:null, pnl:null, execMs:22,status:"open"},
  ],
  4:[
    {id:"T-291", time:"Feb 18 21:10",market:"Team Liquid wins ESL",   side:"YES",size:3000,entry:0.34,exit:0.98,pnl:+1920,execMs:52,status:"closed"},
    {id:"T-290", time:"Feb 17 18:45",market:"G2 beats NaVi",          side:"NO", size:2500,entry:0.41,exit:0.08,pnl:+825, execMs:55,status:"closed"},
  ],
  5:[
    {id:"T-88",  time:"Feb 22 10:00",market:"Trump signs EO on crypto",side:"YES",size:3000,entry:0.45,exit:0.22,pnl:-690,execMs:67,status:"closed"},
    {id:"T-LIVE",time:"Feb 22 15:00",market:"Inflation < 3% in Feb",   side:"YES",size:1200,entry:0.51,exit:null, pnl:null, execMs:67,status:"open"},
  ],
};

const TXNS = [
  {id:"TX-009",type:"profit",  desc:"Arb Alpha — trade T-1847",  amount:+1584,time:"Feb 22 14:33",status:"confirmed"},
  {id:"TX-008",type:"profit",  desc:"MM Reaper — trade T-3204",  amount:+72,  time:"Feb 22 14:56",status:"confirmed"},
  {id:"TX-007",type:"withdraw",desc:"Withdrawal to 0x8f...3a2e", amount:-2000,time:"Feb 22 10:00",status:"confirmed"},
  {id:"TX-006",type:"profit",  desc:"Arb Alpha — trade T-1846",  amount:+928, time:"Feb 22 11:19",status:"confirmed"},
  {id:"TX-005",type:"deposit", desc:"Deposit from 0x3d...91ff",  amount:+5000,time:"Feb 21 09:00",status:"confirmed"},
  {id:"TX-004",type:"loss",    desc:"AI Ensemble — trade T-88",  amount:-690, time:"Feb 22 10:01",status:"confirmed"},
  {id:"TX-003",type:"profit",  desc:"Whale Mirror — trade T-412",amount:+2800,time:"Feb 22 13:45",status:"confirmed"},
  {id:"TX-002",type:"deposit", desc:"Deposit from 0x3d...91ff",  amount:+10000,time:"Feb 20 08:00",status:"confirmed"},
];

// ── STRATEGY ROADMAP DATA ─────────────────────────────────────────────────────
const STRATEGY_TIERS = [
  {
    tier:"TIER 1 — Structural Edge",
    color:"#10b981",
    strategies:[
      {name:"Bond Strategy",         desc:"Buy near-certain markets at 93–99c, hold to $1.00 resolution",        status:"built",   return:"1,800% ann.", botName:"polydesk_bond_bot.py",   difficulty:"Easy"},
      {name:"LP Farming (New Mkts)", desc:"Deploy two-sided liquidity on new markets in the first 2 hours",      status:"built",   return:"80–200% APY", botName:"warproxxx/poly-maker",   difficulty:"Easy"},
      {name:"Combinatorial Arb",     desc:"YES + NO sum mispricing in multi-outcome NegRisk markets",             status:"built",   return:"15–40%/mo",   botName:"polydesk_bond_bot.py",   difficulty:"Medium"},
      {name:"Maker Rebates Only",    desc:"Post limit orders across 100+ markets, collect rebates on every fill", status:"built",   return:"$300–1.5K/d", botName:"maker_rebates_bot.py",   difficulty:"Easy"},
    ]
  },
  {
    tier:"TIER 2 — High Confidence",
    color:"#4f6ef7",
    strategies:[
      {name:"Sports Market Making",  desc:"Quote spreads around Pinnacle vig-free odds, earn the middle",         status:"in_dev",  return:"$60K+/mo",    botName:"ent0n29/polybot",        difficulty:"Medium"},
      {name:"Sportsbook Arb",        desc:"Buy cheap side on Polymarket, hedge on Pinnacle, lock guaranteed spread",status:"in_dev", return:"12–20%/mo",  botName:"ent0n29/polybot",        difficulty:"Medium"},
      {name:"5-Min BTC Chainlink",   desc:"Read Chainlink oracle 2–15 seconds before Polymarket reprices",        status:"built",   return:"15–30%/mo",   botName:"polydesk_btc5m_bot.py",  difficulty:"Med-High"},
      {name:"Correlated/Logical Arb",desc:"Trump wins (35%) floors Republican wins — scan relationship violations",status:"in_dev",  return:"2–5%/mo",     botName:"dylanpersonguy/bot",     difficulty:"Medium"},
      {name:"Esports Live-Data Lag", desc:"Riot Games API kills/objectives 5–30s before Polymarket updates",      status:"in_dev",  return:"$90K/event",  botName:"Custom (STRATZ+Riot)",  difficulty:"Med-High"},
    ]
  },
  {
    tier:"TIER 3 — Specialist Alpha",
    color:"#8b5cf6",
    strategies:[
      {name:"Flash Crash Entry",     desc:"Detect sudden probability drops, enter mean-reversion trade <100ms",   status:"in_dev",  return:"Situational", botName:"discountry/polybot",     difficulty:"Medium"},
      {name:"Spike Detection",       desc:"2% spike → enter, +3% exit / -2.5% stop / 1hr timeout",               status:"in_dev",  return:"+3%/trade",   botName:"Trust412/spike-bot",    difficulty:"Low-Med"},
      {name:"Whale Copy Trading",    desc:"Mirror 90-day consistent wallets via PolyTrack + Stand.trade",         status:"built",   return:"Variable",    botName:"Whale Mirror (live)",   difficulty:"Low"},
      {name:"Whale Cluster Detect",  desc:"3+ high-quality whales converge same market = strong buy signal",      status:"in_dev",  return:"High",        botName:"dylanpersonguy/bot",     difficulty:"High"},
      {name:"News Speed (AI)",       desc:"Ensemble AI reads breaking news 90s before market reprices",           status:"in_dev",  return:"2–8%/mo",     botName:"Polymarket/agents",     difficulty:"High"},
      {name:"Insider Detection",     desc:"New wallet + single market + large position = insider flag",           status:"in_dev",  return:"Variable",    botName:"Custom (Hashdive API)", difficulty:"Medium"},
      {name:"Cross-Platform Arb",    desc:"Polymarket vs Kalshi price divergence — buy cheap, hedge other side",  status:"in_dev",  return:"1.5–7.5%",    botName:"ArbBets20 reference",   difficulty:"Medium"},
    ]
  },
  {
    tier:"TIER 4 — Supporting Plays",
    color:"#f59e0b",
    strategies:[
      {name:"Correlated Asset Lag",  desc:"Trump wins → immediately trade cabinet/policy downstream markets",      status:"planned", return:"Situational", botName:"—",                     difficulty:"Med-High"},
      {name:"Resolution Criteria",   desc:"Know the exact oracle trigger better than everyone else",               status:"planned", return:"Situational", botName:"—",                     difficulty:"Low"},
      {name:"Domain Expertise",      desc:"Go 1 category deeper than anyone — fengdubiying made $3.2M on LoL",    status:"planned", return:"Uncapped",    botName:"—",                     difficulty:"Low"},
      {name:"Scalping / Early Exit", desc:"Buy at sentiment extreme, sell the correction, never hold to resolution",status:"planned",return:"Situational", botName:"—",                     difficulty:"Medium"},
      {name:"Fade the Crowd",        desc:"Sell YES when Twitter hype pushes market to 45% when reality = 8%",    status:"planned", return:"Situational", botName:"—",                     difficulty:"Med-High"},
      {name:"General Market Making", desc:"Post 100+ two-sided markets, collect spread + midnight LP rewards",     status:"built",   return:"$200–800/d",  botName:"MM Reaper (live)",      difficulty:"Medium"},
      {name:"Term Structure Arb",    desc:"Compare BTC $95K by Sep vs Nov, trade mispriced date probabilities",   status:"planned", return:"3–8%/mo",     botName:"—",                     difficulty:"High"},
      {name:"POLY Airdrop Farming",  desc:"Volume + profitability + LP + market count = max airdrop eligibility", status:"built",   return:"Bonus",       botName:"All bots contribute",   difficulty:"Easy"},
      {name:"Mispriced Market Entry",desc:"NO opens at 25% on fundamentally impossible outcome — enter early",     status:"planned", return:"10–50x",      botName:"—",                     difficulty:"Medium"},
      {name:"Group Wallet Pools",    desc:"Multi-user pools, split research, shared returns (FedWatchers: +34%)",  status:"planned", return:"34% example", botName:"—",                     difficulty:"Low"},
      {name:"Tout Service Fade",     desc:"Monitor Discord tip services, fade their line movements, take other side",status:"planned",return:"Situational", botName:"—",                     difficulty:"Low"},
      {name:"In-Game Live MM",       desc:"Market make NBA/NFL in-game during quarters, earn spread from panic traders",status:"planned",return:"$80K/event",botName:"—",                 difficulty:"High"},
      {name:"Real-World Hedging",    desc:"Buy 'Gov shutdown' when you own an outdoor events company — insurance", status:"planned", return:"Risk offset",  botName:"—",                     difficulty:"Easy"},
      {name:"Sports Futures Discount",desc:"Futures markets trade 40% below sharp sportsbook fair value — buy cheap",status:"planned",return:"10–40% disc",botName:"—",                   difficulty:"Low"},
      {name:"AI Ensemble Model",     desc:"$2.2M bot: continuously retrain on Polymarket data, 65–75% win rate",  status:"planned", return:"$2M+ if built",botName:"Polymarket/agents",   difficulty:"Very High"},
      {name:"Price Lag (15-min BTC)",desc:"Watch BTC spot on Binance/Coinbase, bet before PM reprices — needs sub-100ms VPS",status:"in_dev", return:"15–30%/mo",   botName:"discountry/polybot",   difficulty:"High"},
    ]
  },
];

// ── COPIER: TRACKED WALLETS ───────────────────────────────────────────────────
const TRACKED_WALLETS = [
  {id:"w1", handle:"TeemuTeemuTeemu", allTimePnl:230312, winRate:57.0, biggestWin:89032,
   focus:"Dota2 / LoL Esports", trades:412, copyable:true, confidence:"HIGH",
   pattern:"Enters esports markets 5–30s after major in-game events via live data feed. High win rate on team fight outcomes and baron/dragon spawns.",
   recentTrades:[
     {market:"Liquid vs NaVi ESL map 3",side:"YES",entry:0.34,current:0.91,pnl:2860,status:"open"},
     {market:"G2 wins IEM Katowice",    side:"NO", entry:0.58,current:0.09,pnl:1610,status:"closed"},
     {market:"EG beats Fnatic",         side:"YES",entry:0.41,current:1.00,pnl:2115,status:"resolved"},
   ],
   color:"#10b981"},
  {id:"w2", handle:"Account88888", allTimePnl:645489, winRate:53.9, biggestWin:null,
   focus:"BTC / ETH Price Markets", trades:8841, copyable:true, confidence:"MEDIUM",
   pattern:"Trades BTC/ETH direction markets heavily. Most likely a professional crypto trader using technical analysis. Consistent 53.9% win rate over 8,000+ trades — not luck.",
   recentTrades:[
     {market:"BTC > $97k by Mar 1",   side:"NO", entry:0.62,current:0.71,pnl:-180,status:"open"},
     {market:"BTC > $95k by Feb 28",  side:"YES",entry:0.74,current:1.00,pnl:1040,status:"resolved"},
     {market:"ETH > $3.2k by Feb 28", side:"NO", entry:0.44,current:0.08,pnl:900, status:"resolved"},
   ],
   color:"#3b82f6"},
  {id:"w3", handle:"kingofcoinflips", address:"0xe9c6312464b52aa3eff13d822b003282075995c9", allTimePnl:697083, winRate:57.3, biggestWin:null,
   focus:"BTC / ETH Price Markets", trades:6120, copyable:true, confidence:"MEDIUM",
   pattern:"Similar to Account88888 but slightly higher win rate. Likely uses on-chain flow data to detect large BTC purchases before price moves. Often enters 2–5 minutes before large moves.",
   recentTrades:[
     {market:"BTC > $96k by Mar 5",   side:"YES",entry:0.58,current:0.67,pnl:310, status:"open"},
     {market:"ETH > $3k by Feb 28",   side:"YES",entry:0.71,current:1.00,pnl:1160,status:"resolved"},
   ],
   color:"#8b5cf6"},
  {id:"w4", handle:"defiance_cr", allTimePnl:null, winRate:null, biggestWin:null,
   focus:"Market Making", trades:null, copyable:false, confidence:"SIGNAL",
   pattern:"Open-source market maker (warproxxx/poly-maker). Doesn't trade direction — posts two-sided limit orders. Follow for WHICH markets are liquid enough to MM profitably, not for directional signals.",
   recentTrades:[
     {market:"BTC dominance > 60%",   side:"MM",entry:0.48,current:null,pnl:180,status:"open"},
     {market:"Fed rate cut in March",  side:"MM",entry:0.50,current:null,pnl:240,status:"open"},
   ],
   color:"#f59e0b"},
  {id:"w5", handle:"gabagool (arb bot)", allTimePnl:null, winRate:99.1, biggestWin:null,
   focus:"Combinatorial Arb", trades:47000, copyable:false, confidence:"STUDY",
   pattern:"Pure math bot — buys YES+NO mispricings in multi-outcome markets. $40M+ in arb profits. NOT copyable (HFT speed required) but study which markets it targets to find arb-friendly markets.",
   recentTrades:[
     {market:"2028 election NegRisk",  side:"ARB",entry:0.97,current:1.00,pnl:58, status:"resolved"},
   ],
   color:"#ef4444"},
];

// ── MAKER REBATES DATA ─────────────────────────────────────────────────────────
const REBATE_MARKETS = [
  {market:"BTC > $95k by Mar 15",  spread:0.04, volume:142000, myOrders:2, dailyRebate:28, status:"active"},
  {market:"ETH > $3k by Mar 10",   spread:0.03, volume:98000,  myOrders:2, dailyRebate:19, status:"active"},
  {market:"Fed rate cut in March",  spread:0.05, volume:211000, myOrders:2, dailyRebate:42, status:"active"},
  {market:"BTC dominance > 60%",   spread:0.04, volume:87000,  myOrders:2, dailyRebate:17, status:"active"},
  {market:"Trump signs EO crypto",  spread:0.06, volume:64000,  myOrders:2, dailyRebate:15, status:"paused"},
  {market:"CPI < 3% in Feb",       spread:0.05, volume:178000, myOrders:2, dailyRebate:35, status:"active"},
];

const ALLOC_LIVE = [
  {bot:"Arb Alpha",    alloc:4000,color:"#10b981"},
  {bot:"MM Reaper",    alloc:3000,color:"#3b82f6"},
  {bot:"Whale Mirror", alloc:2500,color:"#8b5cf6"},
  {bot:"Esports Oracle",alloc:1500,color:"#f59e0b"},
  {bot:"AI Ensemble",  alloc:1440,color:"#ef4444"},
];

const PIE_C = ["#00C87A","#4C9EEB","#9B87F5","#F5A623","#F05C5C"];

// ── THEME CONTEXT ─────────────────────────────────────────────────────────────
const ThemeCtx = React.createContext({B:DARK, T:THEMES.demo});
const useTheme = () => React.useContext(ThemeCtx);

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
const ChartTip = ({active,payload,label}) => {
  const {B} = useTheme();
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:B.surf,border:`1px solid ${B.border}`,borderRadius:8,padding:"10px 14px",fontSize:12,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
      <div style={{color:B.muted,marginBottom:4,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||B.text,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>
          {p.name}: {typeof p.value==="number"?fmt.usd(p.value):p.value}
        </div>
      ))}
    </div>
  );
};

const StatusBadge = ({status}) => {
  const {B} = useTheme();
  const map={
    live:    {bg:B.greenSoft, color:B.green,  label:"Live"},
    paper:   {bg:B.blueSoft,  color:B.blue,   label:"Paper"},
    paused:  {bg:B.amberSoft, color:B.amber,  label:"Paused"},
    error:   {bg:B.redSoft,   color:B.red,    label:"Error"},
    open:    {bg:B.blueSoft,  color:B.blue,   label:"Open"},
    closed:  {bg:`rgba(100,116,139,0.1)`, color:B.muted, label:"Closed"},
    planned: {bg:`rgba(100,116,139,0.1)`, color:B.muted, label:"Planned"},
  };
  const c=map[status]||{bg:`rgba(100,116,139,0.1)`,color:B.muted,label:status||"—"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,color:c.color,fontSize:10,fontWeight:700,letterSpacing:"0.06em",padding:"3px 9px",borderRadius:20,textTransform:"uppercase",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
    {(status==="live"||status==="open")&&<span style={{width:5,height:5,borderRadius:"50%",background:c.color,display:"inline-block",animation:"pulse 2s infinite",flexShrink:0}}/>}
    {c.label}
  </span>;
};

const Sparkline = ({positive=true}) => {
  const {B} = useTheme();
  const d=positive?[3,5,4,7,6,8,9,8,11,10,13,12,15,14,17,20]:[15,13,14,11,12,9,10,8,7,9,6,5,7,4,3,2];
  const max=Math.max(...d),min=Math.min(...d);
  const pts=d.map((v,i)=>`${(i/(d.length-1))*56},${18-((v-min)/(max-min))*16}`).join(" ");
  const color = positive ? B.green : B.red;
  return <svg width={58} height={20}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.9}/></svg>;
};

const Card = ({children, style={}}) => {
  const {B} = useTheme();
  return (
    <div style={{background:B.surf,border:`1px solid ${B.border}`,borderRadius:14,boxShadow:B===DARK?"0 2px 8px rgba(0,0,0,0.4)":"0 1px 4px rgba(0,0,0,0.08)",...style}}>
      {children}
    </div>
  );
};

const CardHeader = ({title, sub, right}) => {
  const {B} = useTheme();
  return (
    <div style={{padding:"18px 20px 0",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:B.text,letterSpacing:"-0.01em"}}>{title}</div>
        {sub && <div style={{fontSize:11,color:B.muted,marginTop:3}}>{sub}</div>}
      </div>
      {right}
    </div>
  );
};

// ── PERIOD SELECTOR ───────────────────────────────────────────────────────────
const PERIODS = ["1D","7D","1M","3M","ALL","Custom"];

const PeriodSelector = ({period, setPeriod, customRange, setCustomRange}) => {
  const {B,T} = useTheme();
  const [showCustom, setShowCustom] = useState(false);
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
      <div style={{display:"flex",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,overflow:"hidden"}}>
        {PERIODS.filter(p=>p!=="Custom").map(p=>(
          <button key={p} onClick={()=>{setPeriod(p);setShowCustom(false);}} style={{
            padding:"5px 12px",fontSize:11,fontWeight:period===p?700:400,
            background:period===p?T.accentSoft:"transparent",
            color:period===p?T.accentText:B.muted,
            border:"none",borderRight:`1px solid ${B.border}`,
            transition:"all 0.15s",cursor:"pointer",letterSpacing:"0.06em",
            fontFamily:"'Plus Jakarta Sans',sans-serif",
          }}>{p}</button>
        ))}
        <button onClick={()=>{setPeriod("Custom");setShowCustom(s=>!s);}} style={{
          padding:"5px 12px",fontSize:11,fontWeight:period==="Custom"?700:400,
          background:period==="Custom"?T.accentSoft:"transparent",
          color:period==="Custom"?T.accentText:B.muted,
          border:"none",transition:"all 0.15s",cursor:"pointer",letterSpacing:"0.06em",
          display:"flex",alignItems:"center",gap:4,fontFamily:"'Plus Jakarta Sans',sans-serif",
        }}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={4} width={18} height={18} rx={2}/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          Custom
        </button>
      </div>
      {showCustom && (
        <div style={{display:"flex",alignItems:"center",gap:8,background:B.surf2,border:`1px solid ${T.accentBorder}`,borderRadius:8,padding:"5px 10px"}}>
          <input type="date" value={customRange.from} onChange={e=>setCustomRange(r=>({...r,from:e.target.value}))}
            style={{background:"transparent",border:"none",color:B.text,fontSize:11,fontFamily:"'JetBrains Mono',monospace",outline:"none",colorScheme:B===DARK?"dark":"light"}}/>
          <span style={{color:B.muted,fontSize:11}}>→</span>
          <input type="date" value={customRange.to} onChange={e=>setCustomRange(r=>({...r,to:e.target.value}))}
            style={{background:"transparent",border:"none",color:B.text,fontSize:11,fontFamily:"'JetBrains Mono',monospace",outline:"none",colorScheme:B===DARK?"dark":"light"}}/>
          <button style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,color:T.accentText,cursor:"pointer"}}>Apply</button>
        </div>
      )}
    </div>
  );
};

// ── HEATMAP COMPONENT ─────────────────────────────────────────────────────────
const TradeHeatmap = () => {
  const {B,T} = useTheme();
  const maxVal = Math.max(...HEATMAP.data.flat());
  return (
    <Card style={{padding:"18px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:13,fontWeight:600}}>Profit Heatmap</div>
          <div style={{fontSize:11,color:B.muted}}>Best hours & days to trade</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:B.muted}}>
          <span>Low</span>
          {[0.1,0.3,0.5,0.7,0.9].map((o,i)=>(
            <div key={i} style={{width:14,height:14,borderRadius:3,background:T.accentText,opacity:o}}/>
          ))}
          <span>High</span>
        </div>
      </div>
      {/* Hour labels */}
      <div style={{display:"grid",gridTemplateColumns:"40px repeat(12,1fr)",gap:3,marginBottom:3}}>
        <div/>
        {HEATMAP.hours.map(h=>(
          <div key={h} style={{fontSize:9,color:B.dim,textAlign:"center",letterSpacing:"0.04em"}}>{h}h</div>
        ))}
      </div>
      {/* Rows */}
      {HEATMAP.days.map((day,di)=>(
        <div key={day} style={{display:"grid",gridTemplateColumns:"40px repeat(12,1fr)",gap:3,marginBottom:3}}>
          <div style={{fontSize:10,color:B.muted,display:"flex",alignItems:"center",paddingRight:6}}>{day}</div>
          {HEATMAP.data[di].map((val,hi)=>{
            const intensity = val/maxVal;
            return (
              <div key={hi} title={`${day} ${HEATMAP.hours[hi]}:00 — $${val}`} style={{
                height:18,borderRadius:3,
                background: val===0 ? B.surf2 : T.accentText,
                opacity: val===0 ? 0.3 : 0.15 + intensity * 0.85,
                transition:"opacity 0.2s",cursor:"default",
              }}/>
            );
          })}
        </div>
      ))}
    </Card>
  );
};

// ── MODE SWITCH ───────────────────────────────────────────────────────────────
const ModeSwitch = ({mode,onChange}) => {
  const {B,T} = useTheme();
  const isLive = mode==="live";
  return (
    <div onClick={()=>onChange(isLive?"demo":"live")} style={{display:"flex",alignItems:"center",gap:0,background:B.surf2,border:`1px solid ${T.accentBorder}`,borderRadius:10,padding:3,cursor:"pointer",transition:"all 0.4s",userSelect:"none"}}>
      <div style={{padding:"5px 14px",borderRadius:7,fontSize:10,fontWeight:700,letterSpacing:"0.08em",transition:"all 0.3s",background:!isLive?T.accentSoft:"transparent",color:!isLive?T.accentText:B.muted,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>DEMO</div>
      <div style={{width:34,height:18,borderRadius:10,margin:"0 3px",background:isLive?`linear-gradient(135deg,${DARK.green},#00A864)`:`linear-gradient(135deg,${DARK.blue},${DARK.purple})`,position:"relative",transition:"background 0.4s",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:isLive?16:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.3s cubic-bezier(.68,-.55,.27,1.55)",boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}}/>
      </div>
      <div style={{padding:"5px 14px",borderRadius:7,fontSize:10,fontWeight:700,letterSpacing:"0.08em",transition:"all 0.3s",background:isLive?T.accentSoft:"transparent",color:isLive?T.accentText:B.muted,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>LIVE</div>
    </div>
  );
};

// ── TRADE DRAWER ──────────────────────────────────────────────────────────────
const TradeDrawer = ({bot, onClose, mode}) => {
  const {B,T} = useTheme();
  const [trades, setTrades]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [stats, setStats]       = useState(null);

  // Derive botKey from bot object
  const botKey = bot.file
    ? bot.file.replace("polydesk_","").replace(".py","")
    : bot.id === 1 ? "bond_bot"
    : bot.id === 2 ? "rebates_bot"
    : bot.id === 3 ? "btc5m_bot"
    : null;

  useEffect(()=>{
    const fetchTrades = async () => {
      setLoading(true);
      // Try real trades first
      try {
        const url = botKey
          ? `${ORCHESTRATOR_BASE}/trades?bot=${botKey}&limit=50`
          : `${ORCHESTRATOR_BASE}/trades?limit=50`;
        const r = await fetch(url);
        if(r.ok){
          const d = await r.json();
          const t = d?.trades || [];
          setTrades(t);
          // Calculate stats from real data
          if(t.length > 0){
            const closed = t.filter(x => x.status === "closed" || x.pnl != null);
            const wins   = closed.filter(x => (x.pnl||0) > 0).length;
            setStats({
              pnl:     closed.reduce((s,x)=>s+(x.pnl||0),0),
              winRate: closed.length > 0 ? (wins/closed.length*100).toFixed(1) : 0,
              total:   t.length,
              open:    t.filter(x=>x.status==="open").length,
            });
          }
          if(t.length > 0) { setLoading(false); return; }
        }
      } catch(e){}
      // No real trades — leave empty, show empty state
      setLoading(false);
    };
    fetchTrades();
  },[bot.id, botKey, mode]);

  // Use real stats if available, else bot-level props
  const displayPnl     = stats?.pnl     ?? bot.pnl   ?? 0;
  const displayWin     = stats?.winRate  ?? bot.win   ?? 0;
  const displayTrades  = stats?.total    ?? bot.trades ?? 0;
  const displayOpen    = stats?.open     ?? 0;

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",zIndex:200}}/>
      <div style={{position:"fixed",right:0,top:0,bottom:0,width:620,background:B.surf,borderLeft:`1px solid ${B.border}`,zIndex:201,display:"flex",flexDirection:"column",boxShadow:"-20px 0 60px rgba(0,0,0,0.5)",animation:"slidein 0.3s cubic-bezier(.16,1,.3,1)"}}>

        {/* Header */}
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${B.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:38,height:38,borderRadius:11,background:`${bot.color}18`,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${bot.color}30`,flexShrink:0}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:bot.color,boxShadow:`0 0 8px ${bot.color}`}}/>
              </div>
              <div>
                <div className="head" style={{fontWeight:700,fontSize:16,color:B.text}}>{bot.name}</div>
                <div style={{fontSize:11,color:B.muted,marginTop:2}}>{bot.strategy}</div>
              </div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:8,background:B.surf2,border:`1px solid ${B.border}`,color:B.muted,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",lineHeight:1}}>×</button>
          </div>

          {/* Stats grid — real data */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {label:"Total P&L",  val:fmt.pnl(displayPnl),   color:displayPnl>=0?B.green:B.red},
              {label:"Win Rate",   val:fmt.pct(parseFloat(displayWin),1), color:parseFloat(displayWin)>70?B.green:parseFloat(displayWin)>50?B.amber:B.red},
              {label:"Trades",     val:fmt.num(displayTrades), color:B.text},
              {label:"Open Now",   val:fmt.num(displayOpen),   color:displayOpen>0?T.accentText:B.muted},
            ].map((s,i)=>(
              <div key={i} style={{background:B.surf2,borderRadius:8,padding:"10px 12px",border:`1px solid ${B.border}`}}>
                <div style={{fontSize:9,color:B.muted,letterSpacing:"0.1em",marginBottom:4,textTransform:"uppercase",fontWeight:600}}>{s.label}</div>
                <div className="num" style={{fontSize:15,fontWeight:700,color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Source indicator */}
          <div style={{marginTop:10,fontSize:10,color:B.muted,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:stats?.total>0?B.green:B.muted,display:"inline-block"}}/>
            {loading ? "Fetching trades..." : stats?.total>0 ? `${stats.total} trades from orchestrator` : "No trades yet — bot will populate this"}
          </div>
        </div>

        {/* Trade list */}
        <div style={{flex:1,overflowY:"auto"}}>
          {loading?(
            <div style={{padding:"40px",textAlign:"center",color:B.muted}}>
              <div style={{fontSize:20,marginBottom:12,animation:"pulse 1s infinite"}}>⟳</div>
              <div style={{fontSize:12}}>Loading trades...</div>
            </div>
          ):trades.length===0?(
            <div style={{padding:"48px 24px",textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:12}}>📭</div>
              <div style={{fontSize:13,fontWeight:500,color:B.subtext,marginBottom:6}}>{bot.name} hasn't traded yet</div>
              <div style={{fontSize:11,color:B.muted,lineHeight:1.6}}>
                {mode==="live"
                  ? "Trades will appear here once the bot starts executing"
                  : "Switch to Live mode or the bot needs to run a cycle"}
              </div>
            </div>
          ):trades.map((t,i)=>{
            const isOpen = t.status==="open";
            const pnl    = t.pnl ?? t.profit ?? null;
            const side   = t.side || t.outcome || "—";
            const sideColor = side==="YES"||side==="BUY" ? B.green : side==="NO"||side==="SELL" ? B.red : B.purple;
            return (
              <div key={t.id||i} style={{padding:"14px 24px",borderBottom:`1px solid ${B.border}`,background:isOpen?T.accentSoft:"transparent",transition:"background 0.15s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:`${sideColor}18`,color:sideColor,flexShrink:0}}>{side}</span>
                    <span style={{fontSize:13,fontWeight:500,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.market||t.question||t.market_question||"Trade"}</span>
                  </div>
                  <StatusBadge status={t.status||"closed"}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                  {[
                    {label:"Size",  val: t.size!=null ? fmt.usd(t.size,0) : "—",           color:B.subtext},
                    {label:"Entry", val: t.entry!=null ? fmt.dec(t.entry,2) : "—",          color:B.subtext},
                    {label:"Exit",  val: isOpen ? "Live" : t.exit!=null ? fmt.dec(t.exit,2) : "—", color:isOpen?T.accentText:B.subtext},
                    {label:"Exec",  val: t.execMs!=null ? fmt.ms(t.execMs) : "—",           color:t.execMs<40?B.green:t.execMs<60?B.amber:B.red},
                    {label:"P&L",   val: isOpen ? "Open" : pnl!=null ? fmt.pnl(pnl) : "—", color:isOpen?T.accentText:pnl>0?B.green:pnl<0?B.red:B.muted, bold:true},
                  ].map((col,j)=>(
                    <div key={j}>
                      <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:3,textTransform:"uppercase"}}>{col.label}</div>
                      <div className={col.bold?"num":""} style={{fontSize:12,fontWeight:col.bold?700:500,color:col.color}}>{col.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:8,fontSize:10,color:B.dim,fontFamily:"'JetBrains Mono',monospace"}}>
                  {t.time||t.created_at?.slice(0,16)||"—"} · {(t.id||"").toString().slice(-10)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};


// ── FUNDS TAB ─────────────────────────────────────────────────────────────────

// ── ALLOCATE TAB ──────────────────────────────────────────────────────────────
const AllocateTab = ({balance, available, totalAllocated, isDemo, botsRegistry=[], botAllocations={}, setBotAllocations=()=>{}}) => {
  const {B,T} = useTheme();

  // Build dynamic BOTS_CONFIG from botsRegistry with recommended fractions for known bots
  const REC_FRACTIONS = {1: 0.78, 2: 0.22, 3: 0.00, 4: 0.00, 5: 0.00};
  const BOTS_CONFIG = botsRegistry.length > 0 ? botsRegistry.map(bot => ({
    id: bot.id,
    name: bot.name,
    file: bot.file || "—",
    color: bot.color || "#10b981",
    recommended: REC_FRACTIONS[bot.id] ?? 0.00,
    description: bot.strategy || "Custom strategy",
  })) : [
    {id:1, name:"Bond Bot",          file:"polydesk_bond_bot.py",         color:"#10b981", recommended:0.78, description:"Near-certainty markets · 98% win rate"},
    {id:2, name:"Maker Rebates Bot", file:"polydesk_maker_rebates_bot.py",color:"#3b82f6", recommended:0.22, description:"50 markets · earns rebates on every fill"},
    {id:3, name:"BTC 5-Min Bot",     file:"polydesk_btc5m_bot.py",        color:"#8b5cf6", recommended:0.00, description:"Paper only until 50+ trade track record"},
    {id:4, name:"Copier Bot",         file:"polydesk_copier_bot.py",       color:"#f59e0b", recommended:0.00, description:"Mirror whale wallets · configure in Copier tab"},
  ];

  const recAmounts  = BOTS_CONFIG.map(b => Math.round(balance * b.recommended));
  const [allocs, setAllocs] = useState(() => BOTS_CONFIG.map((b,i) => ({
    ...b,
    amount: botAllocations[b.id] ?? recAmounts[i],
  })));
  const [saved,  setSaved]  = useState(false);
  const [editing, setEditing] = useState(null);  // which bot id is being manually edited
  const [inputVal, setInputVal] = useState("");
  const [addBotOpen, setAddBotOpen] = useState(false);

  // Sync allocs when botsRegistry changes (new bot added)
  React.useEffect(() => {
    setAllocs(prev => {
      const existIds = prev.map(a=>a.id);
      const newBots = BOTS_CONFIG.filter(b => !existIds.includes(b.id));
      return [...prev, ...newBots.map(b=>({...b, amount: 0}))];
    });
  }, [botsRegistry.length]);

  const totalAlloc  = allocs.reduce((s,a) => s + a.amount, 0);
  const remaining   = balance - totalAlloc;
  const isOver      = remaining < 0;
  const isExact     = remaining === 0;

  const setAmount = (id, val) => {
    const num = Math.max(0, Math.min(balance, parseFloat(val) || 0));
    setAllocs(prev => prev.map(a => a.id === id ? {...a, amount: num} : a));
    setSaved(false);
  };

  const removeAlloc = (id) => {
    setAllocs(prev => prev.filter(a => a.id !== id));
    setSaved(false);
  };

  const applyRecommended = () => {
    setAllocs(prev => prev.map((a, i) => ({...a, amount: recAmounts[i] ?? 0})));
    setSaved(false);
  };

  const saveToBackend = async (allocData) => {
    try {
      const payload = Object.fromEntries(allocData.map(a=>[a.id, a.amount]));
      // Update parent allocations state
      setBotAllocations(payload);
      await fetch(`${ORCHESTRATOR_BASE}/allocations`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({allocations: payload})
      });
    } catch(e) { /* non-fatal — saved locally */ }
  };

  const distributeRemaining = () => {
    // Add remaining to first bot (highest priority)
    if(remaining <= 0 || allocs.length === 0) return;
    setAllocs(prev => {
      const first = prev[0];
      return prev.map((a,i) => i===0 ? {...a, amount: a.amount + remaining} : a);
    });
    setSaved(false);
  };

  const clearAll = () => {
    setAllocs(prev => prev.map(a => ({...a, amount: 0})));
    setSaved(false);
  };

  // Bots not yet in allocs list (can be added)
  const allocIds = allocs.map(a=>a.id);
  const unallocatedBots = BOTS_CONFIG.filter(b => !allocIds.includes(b.id));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* ── CAPITAL OVERVIEW ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          {label:"Total Balance",   val:`$${balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`, color:T.accentText, sub:"your full balance"},
          {label:"Allocating Now",  val:`$${totalAlloc.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`, color:isOver?B.red:B.subtext, sub:`${((totalAlloc/Math.max(balance,1))*100).toFixed(0)}% of balance`},
          {label:"Unallocated",     val:`$${Math.abs(remaining).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`, color:isOver?B.red:remaining===0?B.green:B.amber, sub:isOver?"OVER BUDGET":remaining===0?"fully allocated":"sitting idle"},
          {label:"Currently in Bots",val:`$${totalAllocated.toLocaleString()}`, color:B.muted, sub:"before this save"},
        ].map((s,i)=>(
          <Card key={i} style={{padding:"16px 18px"}}>
            <div style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>{s.label}</div>
            <div style={{fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif",color:s.color,letterSpacing:"-0.02em",lineHeight:1,marginBottom:3}}>{s.val}</div>
            <div style={{fontSize:10,color:B.dim}}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* ── BUDGET BAR ── */}
      <Card style={{padding:"16px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:12,fontWeight:600}}>Budget Used</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {isOver && <span style={{fontSize:11,color:B.red,fontWeight:600}}>⚠ Over by ${Math.abs(remaining).toLocaleString()}</span>}
            {!isOver && remaining > 0 && <span style={{fontSize:11,color:B.amber,fontWeight:600}}>${remaining.toLocaleString()} unallocated</span>}
            {isExact && <span style={{fontSize:11,color:B.green,fontWeight:600}}>✓ Fully allocated</span>}
            <span style={{fontSize:11,color:B.muted}}>{((totalAlloc/Math.max(balance,1))*100).toFixed(1)}%</span>
          </div>
        </div>
        {/* Stacked bar */}
        <div style={{height:12,background:B.surf2,borderRadius:6,overflow:"hidden",display:"flex"}}>
          {allocs.map((a,i) => {
            const w = (a.amount / Math.max(balance,1)) * 100;
            return w > 0 ? (
              <div key={i} title={`${a.name}: $${a.amount}`}
                style={{width:`${Math.min(w, 100)}%`,height:"100%",background:a.color,opacity:0.85,transition:"width 0.4s",borderRight:i<allocs.length-1?"1px solid rgba(0,0,0,0.2)":""}}/>
            ) : null;
          })}
          {remaining > 0 && (
            <div style={{flex:1,height:"100%",background:B.border,opacity:0.4}}/>
          )}
        </div>
        {/* Legend */}
        <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:10}}>
          {allocs.filter(a=>a.amount>0).map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:8,height:8,borderRadius:2,background:a.color}}/>
              <span style={{fontSize:10,color:B.muted}}>{a.name.replace(" Bot","")}: ${a.amount.toLocaleString()}</span>
            </div>
          ))}
          {remaining > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:8,height:8,borderRadius:2,background:B.border}}/>
              <span style={{fontSize:10,color:B.dim}}>Unallocated: ${remaining.toLocaleString()}</span>
            </div>
          )}
        </div>
      </Card>

      {/* ── BOT ALLOCATION CONTROLS ── */}
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:13,fontWeight:600}}>Allocate Per Bot</div>
            <div style={{fontSize:11,color:B.muted}}>Drag slider or type exact amount · add/remove bots from Bots tab</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {/* Add bot to allocation dropdown */}
            {unallocatedBots.length > 0 && (
              <div style={{display:"flex",alignItems:"center",gap:6,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:7,padding:"2px 8px 2px 6px"}}>
                <span style={{fontSize:10,color:B.muted}}>+ Add bot:</span>
                <select onChange={e=>{
                  const id = Number(e.target.value);
                  if(!id) return;
                  const bot = BOTS_CONFIG.find(b=>b.id===id);
                  if(bot) { setAllocs(prev=>[...prev,{...bot,amount:0}]); e.target.value=""; }
                }} defaultValue="" style={{background:"transparent",border:"none",color:B.text,fontSize:11,outline:"none",cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                  <option value="">Select…</option>
                  {unallocatedBots.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={applyRecommended} style={{padding:"6px 12px",fontSize:11,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:7,color:T.accentText,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
              ✦ Recommended
            </button>
            {remaining > 0 && (
              <button onClick={distributeRemaining} style={{padding:"6px 12px",fontSize:11,fontWeight:600,background:`${B.green}12`,border:`1px solid ${B.green}30`,borderRadius:7,color:B.green,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                + Add Remainder to #{allocs[0]?.name?.split(" ")[0]}
              </button>
            )}
            <button onClick={clearAll} style={{padding:"6px 12px",fontSize:11,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:7,color:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
              Clear
            </button>
          </div>
        </div>

        {allocs.map((a,i) => {
          const pct = balance > 0 ? (a.amount / balance) * 100 : 0;
          const recAmt = recAmounts[i];
          const isRec  = a.amount === recAmt;
          return (
            <div key={a.id} style={{padding:"18px 20px",borderBottom:i<allocs.length-1?`1px solid ${B.border}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:a.color,flexShrink:0,boxShadow:`0 0 6px ${a.color}80`}}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:B.text}}>{a.name}</div>
                    <div style={{fontSize:10,color:B.dim,marginTop:1}}>{a.description}</div>
                  </div>
                  {isRec && recAmt > 0 && <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:`${B.green}15`,color:B.green,fontWeight:600,marginLeft:4}}>REC</span>}
                  {a.amount === 0 && <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:B.surf2,color:B.dim,fontWeight:600,marginLeft:4}}>OFF</span>}
                </div>

                {/* Amount display / input + remove */}
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {recAmt > 0 && (
                    <span style={{fontSize:10,color:B.dim}}>rec: ${recAmt.toLocaleString()}</span>
                  )}
                  {editing === a.id ? (
                    <input
                      autoFocus
                      type="number"
                      value={inputVal}
                      onChange={e=>setInputVal(e.target.value)}
                      onBlur={()=>{setAmount(a.id, inputVal); setEditing(null);}}
                      onKeyDown={e=>{if(e.key==="Enter"){setAmount(a.id,inputVal);setEditing(null);}if(e.key==="Escape")setEditing(null);}}
                      style={{width:90,background:B.surf2,border:`1px solid ${T.accentBorder}`,borderRadius:6,padding:"5px 10px",fontSize:13,fontWeight:700,color:T.accentText,outline:"none",fontFamily:"'Syne',sans-serif",textAlign:"right"}}
                    />
                  ) : (
                    <div onClick={()=>{setEditing(a.id);setInputVal(a.amount.toString());}}
                      title="Click to type exact amount"
                      style={{fontSize:16,fontWeight:800,fontFamily:"'Syne',sans-serif",color:a.amount>0?a.color:B.dim,cursor:"text",minWidth:70,textAlign:"right",borderBottom:`1px dashed ${B.border}`,paddingBottom:1}}>
                      ${a.amount.toLocaleString()}
                    </div>
                  )}
                  <span style={{fontSize:11,color:B.muted,minWidth:32,textAlign:"right"}}>{pct.toFixed(0)}%</span>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={0}
                max={balance}
                step={10}
                value={a.amount}
                onChange={e => setAmount(a.id, e.target.value)}
                style={{width:"100%",accentColor:a.color,cursor:"pointer"}}
              />

              {/* Quick amounts */}
              <div style={{display:"flex",gap:6,marginTop:8}}>
                {[0, 50, 100, 150, 200, Math.round(balance*0.25), Math.round(balance*0.5)].filter((v,i,a)=>a.indexOf(v)===i&&v<=balance).map(quick=>(
                  <button key={quick} onClick={()=>setAmount(a.id, quick)}
                    style={{padding:"3px 9px",fontSize:10,borderRadius:20,cursor:"pointer",fontFamily:"'Outfit',sans-serif",
                      background:a.amount===quick?`${a.color}20`:B.surf2,
                      border:`1px solid ${a.amount===quick?a.color+"50":B.border}`,
                      color:a.amount===quick?a.color:B.dim,
                      fontWeight:a.amount===quick?700:400,
                    }}>
                    {quick===0?"OFF":`$${quick}`}
                  </button>
                ))}
                {/* Remove this bot from allocation */}
                <button onClick={()=>removeAlloc(a.id)}
                  style={{padding:"3px 9px",fontSize:10,borderRadius:20,cursor:"pointer",fontFamily:"'Outfit',sans-serif",background:`${B.red}10`,border:`1px solid ${B.red}25`,color:B.red,fontWeight:600,marginLeft:"auto"}}>
                  − Remove
                </button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── SAVE ── */}
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <button
          disabled={isOver}
          onClick={()=>{setSaved(true); saveToBackend(allocs);}}
          style={{flex:1,padding:"13px",borderRadius:10,fontSize:13,fontWeight:700,
            background:isOver?B.surf2:saved?`${B.green}15`:T.accentSoft,
            border:`1px solid ${isOver?B.border:saved?`${B.green}40`:T.accentBorder}`,
            color:isOver?B.dim:saved?B.green:T.accentText,
            cursor:isOver?"not-allowed":"pointer",
            fontFamily:"'Outfit',sans-serif",transition:"all 0.3s"
          }}>
          {isOver ? `⚠ Over budget by $${Math.abs(remaining).toLocaleString()} — reduce allocations` : saved ? "✓ Allocation Saved" : `Save Allocation — $${totalAlloc.toLocaleString()} across ${allocs.filter(a=>a.amount>0).length} bots`}
        </button>
        {!isDemo && saved && (
          <div style={{fontSize:11,color:B.muted}}>Changes applied on next bot cycle (~60s)</div>
        )}
        {isDemo && saved && (
          <div style={{fontSize:11,color:B.muted}}>Simulated — go Live to deploy real capital</div>
        )}
      </div>
    </div>
  );
};

const FundsTab = ({mode, demoBalance, setDemoBalance, demoTxns, setDemoTxns, demoAllocated, walletBalance, walletAddress, liveData, botsRegistry=[], botAllocations={}, setBotAllocations=()=>{}}) => {
  const {B,T} = useTheme();
  const [tab,setTab]           = useState("overview");
  const [withdrawAddr,setWA]   = useState("");
  const [withdrawAmt,setWAmt]  = useState("");
  const [submitted,setSubmit]  = useState(false);
  const [customAmt,setCustom]  = useState("");
  const [topupAnim,setAnim]    = useState(null);
  const [realTxns,setRealTxns] = useState([]);
  const [txLoading,setTxLoad]  = useState(false);
  const [copied,setCopied]     = useState(false);

  const isDemo = mode==="demo";

  // ── REAL VALUES ──────────────────────────────────────────────────────────────
  const balance        = isDemo ? (demoBalance||0) : (walletBalance??0);
  const botStates      = liveData?.portfolio?.bot_states || {};
  const totalAllocated = isDemo
    ? (demoAllocated||0)
    : Object.values(botStates).reduce((s,b)=>s+(b.allocated_capital||0), 0);
  const available = Math.max(0, balance - totalAllocated);

  // P&L: demo = gains above total deposited; live = from orchestrator
  const totalDeposited = (demoTxns||[]).filter(t=>t.type==="deposit").reduce((s,t)=>s+t.amount, 0);
  const realPnl = isDemo
    ? Math.max(0, balance - totalDeposited)
    : (liveData?.portfolio?.total_pnl || 0);

  // Balance health
  const isCritical = !isDemo && balance < 20;
  const isLow      = !isDemo && balance >= 20 && balance < 50;
  const isWarning  = !isDemo && balance >= 50 && balance < 100;

  // ── FETCH REAL TRADES FROM ORCHESTRATOR ─────────────────────────────────────
  useEffect(()=>{
    if(isDemo) return;
    setTxLoad(true);
    fetch(`${ORCHESTRATOR_BASE}/trades?limit=50`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{ if(d?.trades) setRealTxns(d.trades); })
      .catch(()=>{})
      .finally(()=>setTxLoad(false));
  },[isDemo]);

  // ── PERSIST DEMO STATE ───────────────────────────────────────────────────────
  const persistDemo = async (bal, txns) => {
    try {
      await fetch(`${ORCHESTRATOR_BASE}/app-state`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:"demo_balance",value:bal})});
      await fetch(`${ORCHESTRATOR_BASE}/app-state`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:"demo_txns",value:txns.slice(0,50)})});
    } catch(e){}
  };

  useEffect(()=>{
    if(!isDemo) return;
    fetch(`${ORCHESTRATOR_BASE}/app-state?key=demo_balance`).then(r=>r.ok?r.json():null).then(d=>{if(d?.value!=null)setDemoBalance(parseFloat(d.value));}).catch(()=>{});
    fetch(`${ORCHESTRATOR_BASE}/app-state?key=demo_txns`).then(r=>r.ok?r.json():null).then(d=>{if(d?.value?.length>0)setDemoTxns(d.value);}).catch(()=>{});
  },[isDemo]);

  const addDemoFunds = (amt) => {
    if(!amt||amt<=0) return;
    const newBal  = (demoBalance||0) + parseFloat(amt);
    const newTx   = {id:`DX-${Date.now()}`,type:"deposit",desc:"Paper top-up",amount:parseFloat(amt),time:new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),status:"confirmed"};
    const newTxns = [newTx,...(demoTxns||[])];
    setDemoBalance(newBal); setDemoTxns(newTxns);
    setAnim(amt); setTimeout(()=>setAnim(null),1400);
    persistDemo(newBal, newTxns);
  };

  const simulateWithdraw = (amt) => {
    const a = parseFloat(amt);
    if(!a||a<=0||a>available) return;
    const newBal  = demoBalance - a;
    const newTx   = {id:`DX-${Date.now()}`,type:"withdraw",desc:"Paper withdrawal",amount:-a,time:new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),status:"simulated"};
    const newTxns = [newTx,...(demoTxns||[])];
    setDemoBalance(newBal); setDemoTxns(newTxns);
    setSubmit(true); setTimeout(()=>setSubmit(false),3000);
    persistDemo(newBal, newTxns);
  };

  const displayTxns  = isDemo ? (demoTxns||[]) : realTxns;
  const utilPct      = balance>0 ? Math.min(100,Math.round((totalAllocated/balance)*100)) : 0;

  const txStyle = {
    deposit: {bg:B.blueSoft,  color:B.blue,   icon:"⊕"},
    withdraw:{bg:B.amberSoft, color:B.amber,  icon:"↗"},
    profit:  {bg:B.greenSoft, color:B.green,  icon:"↑"},
    loss:    {bg:B.redSoft,   color:B.red,    icon:"↓"},
    fill:    {bg:B.purpleSoft,color:B.purple, icon:"⚡"},
  };

  return (
    <div>

      {/* ── BALANCE HERO ─────────────────────────────────────────────────────── */}
      <div style={{background:B.surf,border:`1px solid ${isCritical?B.red:isLow||isWarning?B.amber:T.accentBorder}`,borderRadius:14,padding:"24px 28px",marginBottom:20,position:"relative",overflow:"hidden",transition:"border-color 0.3s"}}>
        <div style={{position:"absolute",top:-60,right:-60,width:220,height:220,borderRadius:"50%",background:isCritical?B.redSoft:T.accentGlow,filter:"blur(70px)",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>

          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
            <div>
              <div style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10,fontWeight:600}}>
                {isDemo ? "Paper Balance" : "USDC Balance · Polygon"}
              </div>
              <div className="num" style={{fontSize:42,fontWeight:700,letterSpacing:"-0.03em",lineHeight:1,color:isCritical?B.red:isLow?B.amber:B.text}}>
                {fmt.usd(balance)}
              </div>
              <div style={{fontSize:12,marginTop:10,display:"flex",alignItems:"center",gap:6}}>
                <span className="num" style={{fontWeight:700,color:realPnl>=0?B.green:B.red}}>{fmt.pnl(realPnl)}</span>
                <span style={{color:B.muted}}>{isDemo?"paper P&L since start":"total realized P&L"}</span>
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
              {isDemo&&<div style={{background:B.blueSoft,border:`1px solid ${B.blue}30`,borderRadius:8,padding:"8px 14px",fontSize:11,color:B.blue,fontWeight:700,letterSpacing:"0.06em"}}>📋 PAPER MODE</div>}
              {!isDemo&&walletAddress&&<div style={{background:B.greenSoft,border:`1px solid ${B.greenBorder}`,borderRadius:8,padding:"8px 14px",fontSize:10,color:B.green,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>● {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</div>}
              {!isDemo&&!walletAddress&&<div style={{background:B.amberSoft,border:`1px solid ${B.amber}30`,borderRadius:8,padding:"8px 14px",fontSize:11,color:B.amber,fontWeight:600}}>⚠ No wallet — go to Settings</div>}
              {isCritical&&<div style={{background:B.redSoft,border:`1px solid ${B.red}30`,borderRadius:8,padding:"6px 12px",fontSize:11,color:B.red,fontWeight:700}}>🚨 Critical — bots will pause at $10</div>}
              {isLow&&<div style={{background:B.amberSoft,border:`1px solid ${B.amber}30`,borderRadius:8,padding:"6px 12px",fontSize:11,color:B.amber,fontWeight:600}}>⚠ Very low balance</div>}
              {isWarning&&<div style={{background:B.amberSoft,border:`1px solid ${B.amber}20`,borderRadius:8,padding:"6px 12px",fontSize:11,color:B.amber}}>↓ Consider topping up</div>}
              {isDemo&&balance===0&&<div style={{background:B.blueSoft,border:`1px solid ${B.blue}20`,borderRadius:8,padding:"6px 12px",fontSize:11,color:B.blue}}>Add paper funds to start</div>}
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            {[
              {label:"Available",  val:fmt.usd(available),     color:isCritical?B.red:isLow?B.amber:B.text},
              {label:"In Bots",    val:fmt.usd(totalAllocated), color:T.accentText},
              {label:"Total P&L",  val:fmt.pnl(realPnl),       color:realPnl>=0?B.green:B.red},
              {label:"Utilisation",val:`${utilPct}%`,           color:utilPct>90?B.red:utilPct>70?B.amber:B.subtext},
            ].map((s,i)=>(
              <div key={i} style={{background:B.surf2,borderRadius:10,padding:"12px 14px",border:`1px solid ${B.border}`}}>
                <div style={{fontSize:9,color:B.muted,letterSpacing:"0.08em",marginBottom:5,textTransform:"uppercase",fontWeight:600}}>{s.label}</div>
                <div className="num" style={{fontSize:15,fontWeight:700,color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Utilisation bar */}
          {balance>0&&(
            <div style={{height:4,background:B.surf2,borderRadius:2,overflow:"hidden",border:`1px solid ${B.border}`}}>
              <div style={{height:"100%",width:`${utilPct}%`,background:`linear-gradient(90deg,${T.accent},${T.accentText})`,borderRadius:2,transition:"width 0.6s ease"}}/>
            </div>
          )}
        </div>
      </div>

      {/* ── SUB-TABS ─────────────────────────────────────────────────────────── */}
      <div style={{display:"flex",gap:2,marginBottom:20,borderBottom:`1px solid ${B.border}`}}>
        {["overview","deposit","withdraw","allocate"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"8px 16px",fontSize:11,letterSpacing:"0.06em",textTransform:"uppercase",
            fontWeight:tab===t?700:400,color:tab===t?T.accentText:B.muted,
            background:"transparent",border:"none",cursor:"pointer",
            borderBottom:`2px solid ${tab===t?T.accent:"transparent"}`,
            marginBottom:-1,transition:"all 0.15s",
            fontFamily:"'Plus Jakarta Sans',sans-serif",
          }}>{t}</button>
        ))}
      </div>

      {/* ── OVERVIEW: TRANSACTION HISTORY ────────────────────────────────────── */}
      {tab==="overview"&&(
        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div className="head" style={{fontSize:13,fontWeight:600,color:B.text}}>Transaction History</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {txLoading&&<span style={{fontSize:10,color:B.amber,animation:"pulse 1s infinite"}}>Loading...</span>}
              <span style={{fontSize:11,color:B.muted}}>{displayTxns.length} {isDemo?"paper":"real"} records</span>
            </div>
          </div>
          {displayTxns.length===0?(
            <div style={{padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:12}}>📭</div>
              <div style={{fontSize:13,fontWeight:500,color:B.subtext,marginBottom:6}}>
                {isDemo?"No transactions yet":"No trades yet — bots will populate this"}
              </div>
              <div style={{fontSize:11,color:B.muted,marginBottom:16}}>
                {isDemo?"Add paper funds to begin testing your strategies":"Switch to Live mode and connect your wallet"}
              </div>
              {isDemo&&(
                <button onClick={()=>setTab("deposit")} style={{padding:"8px 20px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  Add Paper Funds →
                </button>
              )}
            </div>
          ):displayTxns.map((tx,i)=>{
            const st  = txStyle[tx.type]||txStyle.fill;
            const amt = tx.amount??tx.pnl??0;
            return (
              <div key={tx.id||i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",borderBottom:i<displayTxns.length-1?`1px solid ${B.border}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:34,height:34,borderRadius:9,background:st.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:st.color,flexShrink:0,fontWeight:700}}>{st.icon}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:500,color:B.text}}>{tx.desc||tx.market||tx.question||"Trade"}</div>
                    <div style={{fontSize:10,color:B.muted,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>
                      {tx.time||tx.created_at?.slice(0,16)||"—"} · {(tx.id||"").toString().slice(-8)||"—"}
                    </div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="num" style={{fontSize:14,fontWeight:700,color:amt>=0?B.green:B.red}}>{fmt.pnl(amt)}</div>
                  <div style={{fontSize:10,color:amt>=0?B.green:B.muted,marginTop:2}}>✓ {tx.status||"confirmed"}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* ── DEPOSIT ──────────────────────────────────────────────────────────── */}
      {tab==="deposit"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <Card style={{padding:"24px"}}>
            <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:4,color:B.text}}>{isDemo?"Add Paper Funds":"Deposit USDC"}</div>
            <div style={{fontSize:11,color:B.muted,marginBottom:20}}>{isDemo?"Top up your paper balance instantly — no real money":"Send USDC to your Polygon wallet address below"}</div>
            {isDemo?(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                  {[1000,5000,10000,25000].map(amt=>(
                    <button key={amt} onClick={()=>addDemoFunds(amt)} style={{
                      padding:"14px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s",
                      background:topupAnim===amt?B.greenSoft:T.accentSoft,
                      border:`1px solid ${topupAnim===amt?B.greenBorder:T.accentBorder}`,
                      color:topupAnim===amt?B.green:T.accentText,
                      transform:topupAnim===amt?"scale(0.97)":"scale(1)",
                    }}>{topupAnim===amt?"✓ Added!": `+ ${fmt.usd(amt,0)}`}</button>
                  ))}
                </div>
                <div style={{borderTop:`1px solid ${B.border}`,paddingTop:14}}>
                  <div style={{fontSize:10,color:B.muted,marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600}}>Custom Amount</div>
                  <div style={{display:"flex",gap:8}}>
                    <input type="number" placeholder="e.g. 15000" value={customAmt}
                      onChange={e=>setCustom(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&parseFloat(customAmt)>0&&(addDemoFunds(parseFloat(customAmt)),setCustom(""))}
                      style={{flex:1,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,fontFamily:"'JetBrains Mono',monospace"}}/>
                    <button onClick={()=>{if(parseFloat(customAmt)>0){addDemoFunds(parseFloat(customAmt));setCustom("");}}}
                      disabled={!customAmt||parseFloat(customAmt)<=0}
                      style={{padding:"9px 18px",background:parseFloat(customAmt)>0?T.accentSoft:B.surf2,border:`1px solid ${parseFloat(customAmt)>0?T.accentBorder:B.border}`,borderRadius:8,color:parseFloat(customAmt)>0?T.accentText:B.dim,fontSize:12,fontWeight:600}}>
                      Add →
                    </button>
                  </div>
                </div>
              </div>
            ):(
              <div>
                {walletAddress?(
                  <div>
                    <div style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",marginBottom:8,textTransform:"uppercase",fontWeight:600}}>Your Deposit Address</div>
                    <div className="num" onClick={()=>{navigator.clipboard.writeText(walletAddress);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                      style={{fontSize:11,color:T.accentText,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,padding:"12px 14px",wordBreak:"break-all",cursor:"pointer",marginBottom:12,userSelect:"all"}}>
                      {walletAddress}
                    </div>
                    <div style={{fontSize:11,color:B.muted,textAlign:"center",marginBottom:14}}>{copied?"✅ Copied to clipboard":"Click address to copy"}</div>
                    <div style={{background:B.amberSoft,border:`1px solid ${B.amber}30`,borderRadius:8,padding:"10px 14px",fontSize:11,color:B.amber,lineHeight:1.6}}>
                      ⚠ Send <strong>USDC only</strong> on <strong>Polygon (MATIC)</strong> network only. Sending other assets or on wrong network will result in permanent loss.
                    </div>
                  </div>
                ):(
                  <div style={{textAlign:"center",padding:"30px 0"}}>
                    <div style={{fontSize:28,marginBottom:12}}>🔗</div>
                    <div style={{fontSize:13,color:B.muted,marginBottom:8}}>No wallet connected</div>
                    <div style={{fontSize:11,color:B.blue}}>Go to Settings → Wallet Connection</div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card style={{padding:"24px"}}>
            <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:16,color:B.text}}>Recent Deposits</div>
            {displayTxns.filter(t=>t.type==="deposit").length===0?(
              <div style={{padding:"20px 0",textAlign:"center",fontSize:12,color:B.muted}}>No deposits yet</div>
            ):displayTxns.filter(t=>t.type==="deposit").slice(0,8).map((tx,i,arr)=>(
              <div key={tx.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<arr.length-1?`1px solid ${B.border}`:"none"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:B.text}}>{tx.desc||"Deposit"}</div>
                  <div style={{fontSize:10,color:B.muted,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>{tx.time||"—"}</div>
                </div>
                <div className="num" style={{fontSize:14,fontWeight:700,color:B.green}}>{fmt.pnl(tx.amount)}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── WITHDRAW ─────────────────────────────────────────────────────────── */}
      {tab==="withdraw"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <Card style={{padding:"24px"}}>
            <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:4,color:B.text}}>{isDemo?"Simulate Withdrawal":"Withdraw USDC"}</div>
            <div style={{fontSize:11,color:B.muted,marginBottom:20}}>{isDemo?"Test the withdrawal flow — balance will decrease":"Sends USDC on Polygon to destination"}</div>
            {!isDemo&&!walletAddress&&(
              <div style={{background:B.amberSoft,border:`1px solid ${B.amber}30`,borderRadius:8,padding:"12px",marginBottom:14,fontSize:11,color:B.amber}}>⚠ Connect your wallet in Settings first</div>
            )}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",display:"block",marginBottom:6,textTransform:"uppercase",fontWeight:600}}>Destination Address</label>
              <input type="text" placeholder="0x..." value={withdrawAddr} onChange={e=>setWA(e.target.value)}
                style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,fontFamily:"'JetBrains Mono',monospace"}}/>
            </div>
            <div style={{marginBottom:6}}>
              <label style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",display:"block",marginBottom:6,textTransform:"uppercase",fontWeight:600}}>Amount (USDC)</label>
              <input type="number" placeholder="0.00" value={withdrawAmt} onChange={e=>setWAmt(e.target.value)}
                style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,fontFamily:"'JetBrains Mono',monospace"}}/>
            </div>
            <div style={{fontSize:10,color:B.muted,marginBottom:16}}>Available: <span className="num" style={{color:T.accentText,fontWeight:600}}>{fmt.usd(available)}</span></div>
            {submitted?(
              <div style={{textAlign:"center",padding:"14px",background:B.greenSoft,border:`1px solid ${B.greenBorder}`,borderRadius:8,color:B.green,fontSize:13,fontWeight:600}}>
                ✓ {isDemo?"Simulated — balance updated":"Transaction submitted"}
              </div>
            ):(
              <button
                onClick={()=>isDemo?simulateWithdraw(withdrawAmt):null}
                disabled={parseFloat(withdrawAmt||0)<=0||parseFloat(withdrawAmt||0)>available}
                style={{width:"100%",padding:"11px",borderRadius:8,fontSize:13,fontWeight:600,
                  background:parseFloat(withdrawAmt||0)>0&&parseFloat(withdrawAmt||0)<=available?T.accentSoft:B.surf2,
                  border:`1px solid ${parseFloat(withdrawAmt||0)>0&&parseFloat(withdrawAmt||0)<=available?T.accentBorder:B.border}`,
                  color:parseFloat(withdrawAmt||0)>0&&parseFloat(withdrawAmt||0)<=available?T.accentText:B.dim,
                  cursor:parseFloat(withdrawAmt||0)>0&&parseFloat(withdrawAmt||0)<=available?"pointer":"not-allowed"}}>
                {isDemo?"Simulate Withdraw →":"Withdraw →"}
              </button>
            )}
          </Card>

          <Card style={{padding:"24px"}}>
            <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:16,color:B.text}}>Recent Withdrawals</div>
            {displayTxns.filter(t=>t.type==="withdraw").length===0?(
              <div style={{padding:"20px 0",textAlign:"center",fontSize:12,color:B.muted}}>No withdrawals yet</div>
            ):displayTxns.filter(t=>t.type==="withdraw").slice(0,8).map((tx,i,arr)=>(
              <div key={tx.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<arr.length-1?`1px solid ${B.border}`:"none"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:B.text}}>{tx.desc||"Withdrawal"}</div>
                  <div style={{fontSize:10,color:B.muted,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>{tx.time||"—"}</div>
                </div>
                <div className="num" style={{fontSize:14,fontWeight:700,color:B.amber}}>{fmt.usd(Math.abs(tx.amount||0))}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── ALLOCATE ─────────────────────────────────────────────────────────── */}
      {tab==="allocate"&&(
        <AllocateTab balance={balance} available={available} totalAllocated={totalAllocated} isDemo={isDemo} botsRegistry={botsRegistry} botAllocations={botAllocations} setBotAllocations={setBotAllocations}/>
      )}

    </div>
  );
};


// ── ROOT ──────────────────────────────────────────────────────────────────────
// ── STRATEGY DETAIL DRAWER (V12) ─────────────────────────────────────────────
const PIPELINE_STAGES = ["Research","Backtest","Paper Trade","Risk Review","Live"];

const StrategyDrawer = ({strategy, onClose, allTrades, liveData, botsRegistry, B, T, mode}) => {
  const [tab, setTab]               = React.useState("performance");
  const [backtestRange, setBtRange] = React.useState("30d");
  const [backtestResult, setBtResult] = React.useState(null);
  const [btRunning, setBtRunning]   = React.useState(false);
  const [signals, setSignals]       = React.useState([]);
  const [sigLoading, setSigLoading] = React.useState(false);
  const [pipelineNotes, setPipelineNotes] = React.useState({});
  const [pipelineStage, setPipelineStage] = React.useState(
    strategy.status==="built"?4:strategy.status==="in_dev"?2:strategy.status==="planned"?0:0
  );

  const ORCH = "https://api.gurbcapital.com";

  // Filter trades attributed to this strategy's bot
  const stratTrades = React.useMemo(()=>{
    if(!allTrades?.length) return [];
    const botKey = strategy.botName?.toLowerCase().replace(/[^a-z0-9]/g,"_");
    return allTrades.filter(t =>
      t.bot?.toLowerCase().includes(botKey) ||
      t.strategy?.toLowerCase().includes(strategy.name?.toLowerCase()) ||
      (strategy.name?.includes("Bond") && t.bot?.includes("bond")) ||
      (strategy.name?.includes("Rebate") && t.bot?.includes("rebate")) ||
      (strategy.name?.includes("BTC") && t.bot?.includes("btc")) ||
      (strategy.name?.includes("Whale") && t.bot?.includes("cop"))
    );
  }, [allTrades, strategy]);

  // Performance metrics from real trades
  const perf = React.useMemo(()=>{
    if(!stratTrades.length) return null;
    const wins = stratTrades.filter(t=>(t.pnl||0)>0).length;
    const totalPnl = stratTrades.reduce((s,t)=>s+(t.pnl||0),0);
    const avgSize  = stratTrades.reduce((s,t)=>s+(t.size||0),0) / stratTrades.length;
    const best = Math.max(...stratTrades.map(t=>t.pnl||0));
    const worst = Math.min(...stratTrades.map(t=>t.pnl||0));
    // Equity curve: running sum
    let running = 0;
    const curve = stratTrades.slice().reverse().map(t=>{running+=(t.pnl||0); return {v:running};});
    // Max drawdown
    let peak=0, maxDD=0;
    curve.forEach(p=>{if(p.v>peak)peak=p.v; const dd=peak-p.v; if(dd>maxDD)maxDD=dd;});
    return { wins, total:stratTrades.length, wr:((wins/stratTrades.length)*100).toFixed(1),
             totalPnl, avgSize, best, worst, curve, maxDD };
  }, [stratTrades]);

  // Fetch live signals from orchestrator
  const fetchSignals = React.useCallback(async()=>{
    setSigLoading(true);
    try {
      const r = await fetch(`${ORCH}/api/status`);
      if(r.ok){
        const d = await r.json();
        const raw = d?.signals || d?.decisions || d?.recent_signals || [];
        const botKey = (strategy.botName||"").toLowerCase();
        const filtered = raw.filter(s=>
          !botKey || s.bot?.toLowerCase().includes(botKey) ||
          s.strategy?.toLowerCase().includes((strategy.name||"").toLowerCase())
        );
        setSignals(filtered.slice(0,15));
      }
    } catch(e){}
    setSigLoading(false);
  }, [strategy]);

  React.useEffect(()=>{ if(tab==="signals") fetchSignals(); }, [tab]);

  // Run backtest against real allTrades data
  const runBacktest = ()=>{
    if(!stratTrades.length){ setBtResult({error:"No trade data for this strategy"}); return; }
    setBtRunning(true);
    setTimeout(()=>{
      const days = backtestRange==="7d"?7:backtestRange==="30d"?30:backtestRange==="90d"?90:180;
      const cutoff = Date.now() - days*86400000;
      const window = stratTrades.filter(t=> !t.timestamp || new Date(t.timestamp).getTime()>cutoff);
      if(!window.length){ setBtResult({error:`No trades in last ${days} days`}); setBtRunning(false); return; }
      const wins = window.filter(t=>(t.pnl||0)>0).length;
      const totalPnl = window.reduce((s,t)=>s+(t.pnl||0),0);
      const avgPnl   = totalPnl/window.length;
      const stdDev   = Math.sqrt(window.reduce((s,t)=>s+Math.pow((t.pnl||0)-avgPnl,2),0)/window.length);
      const sharpe   = stdDev>0 ? (avgPnl/stdDev*Math.sqrt(252)).toFixed(2) : "—";
      let peak=0, maxDD=0, running=0;
      const curve = window.slice().reverse().map(t=>{
        running+=(t.pnl||0);
        if(running>peak) peak=running;
        const dd=peak-running; if(dd>maxDD) maxDD=dd;
        return {v:+running.toFixed(2)};
      });
      setBtResult({ trades:window.length, wins, wr:((wins/window.length)*100).toFixed(1),
        totalPnl, sharpe, maxDD, curve, best:Math.max(...window.map(t=>t.pnl||0)),
        worst:Math.min(...window.map(t=>t.pnl||0)) });
      setBtRunning(false);
    }, 600);
  };

  const statusConf = {
    built:   {label:"✅ Built & Live",  color:B.green,  bg:B.greenSoft},
    in_dev:  {label:"🔧 In Development",color:B.amber,  bg:B.amberSoft},
    planned: {label:"📋 Planned",       color:B.muted,  bg:B.surf2},
  }[strategy.status] || {label:strategy.status, color:B.muted, bg:B.surf2};

  const botStates  = liveData?.portfolio?.bot_states || {};
  const BOT_KEY_MAP = {"polydesk_bond_bot.py":"bond_bot","maker_rebates_bot.py":"rebates_bot","polydesk_btc5m_bot.py":"btc5m_bot"};
  const vpsKey     = BOT_KEY_MAP[strategy.botName];
  const vpsState   = vpsKey ? botStates[vpsKey] : null;
  const isRunning  = vpsState?.status==="paper"||vpsState?.status==="live";

  const TABS = [
    {id:"performance", label:"📈 Performance"},
    {id:"controls",    label:"⚙ Controls"},
    {id:"signals",     label:"⚡ Live Signals"},
    {id:"backtest",    label:"🔬 Backtest"},
    {id:"pipeline",    label:"🚦 Pipeline"},
  ];

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(3px)",zIndex:900}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:560,background:B.surf,borderLeft:`1px solid ${B.border}`,zIndex:901,display:"flex",flexDirection:"column",fontFamily:"'Outfit',sans-serif",overflowY:"auto"}}>

        {/* Header */}
        <div style={{padding:"20px 24px 0",borderBottom:`1px solid ${B.border}`,flexShrink:0}}>
          {/* Market condition strip */}
          {isRunning && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:`${B.green}08`,border:`1px solid ${B.green}20`,borderRadius:7,marginBottom:14,fontSize:10}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:B.green,animation:"pulse 1.5s infinite",flexShrink:0}}/>
              <span style={{color:B.green,fontWeight:700}}>VPS RUNNING</span>
              <span style={{color:B.muted}}>·</span>
              <span style={{color:B.muted}}>scans: {vpsState?.scan_count||0}</span>
              {vpsState?.last_trade && <><span style={{color:B.muted}}>·</span><span style={{color:B.muted}}>last trade: {vpsState.last_trade}</span></>}
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{width:12,height:12,borderRadius:3,background:strategy.tierColor,flexShrink:0}}/>
                <span style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>{strategy.tierName}</span>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:B.text,letterSpacing:"-0.02em",marginBottom:4}}>{strategy.name}</div>
              <div style={{fontSize:12,color:B.muted,lineHeight:1.5,marginBottom:10}}>{strategy.desc}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:statusConf.bg,color:statusConf.color,fontWeight:600}}>{statusConf.label}</span>
                <span style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:B.surf2,color:B.muted,border:`1px solid ${B.border}`}}>🎯 {strategy.return}</span>
                <span style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:B.surf2,color:B.muted,border:`1px solid ${B.border}`}}>⚡ {strategy.difficulty}</span>
                {strategy.botName&&strategy.botName!=="—"&&<span style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:B.surf2,color:B.muted,border:`1px solid ${B.border}`,fontFamily:"'JetBrains Mono',monospace"}}>{strategy.botName}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",color:B.muted,fontSize:20,cursor:"pointer",padding:"4px 8px",flexShrink:0,marginLeft:8}}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:0,borderTop:`1px solid ${B.border}`,marginTop:12,overflowX:"auto"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{padding:"10px 14px",fontSize:11,fontWeight:tab===t.id?700:400,background:"transparent",border:"none",borderBottom:`2px solid ${tab===t.id?strategy.tierColor:"transparent"}`,color:tab===t.id?B.text:B.muted,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Outfit',sans-serif",transition:"all 0.15s"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{flex:1,padding:"20px 24px",overflowY:"auto"}}>

          {/* ── PERFORMANCE TAB ── */}
          {tab==="performance"&&(
            <div>
              {perf ? (
                <>
                  {/* KPI row */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
                    {[
                      {label:"Total P&L",   val:`${perf.totalPnl>=0?"+":""}$${Math.abs(perf.totalPnl).toLocaleString(undefined,{maximumFractionDigits:2})}`, color:perf.totalPnl>=0?B.green:B.red},
                      {label:"Win Rate",    val:`${perf.wr}%`, color:perf.wr>60?B.green:perf.wr>50?B.amber:B.red},
                      {label:"Total Trades",val:perf.total, color:B.subtext},
                      {label:"Avg Size",    val:`$${perf.avgSize.toFixed(2)}`, color:B.muted},
                      {label:"Best Trade",  val:`+$${perf.best.toFixed(2)}`, color:B.green},
                      {label:"Worst Trade", val:`-$${Math.abs(perf.worst).toFixed(2)}`, color:B.red},
                    ].map((s,i)=>(
                      <div key={i} style={{background:B.surf2,border:`1px solid ${B.border}`,borderRadius:9,padding:"12px 14px"}}>
                        <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{s.label}</div>
                        <div style={{fontSize:15,fontWeight:800,color:s.color,fontFamily:"'Syne',sans-serif"}}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Equity curve */}
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:11,fontWeight:600,color:B.subtext,marginBottom:8}}>Equity Curve</div>
                    <div style={{height:120,background:B.surf2,borderRadius:8,border:`1px solid ${B.border}`,overflow:"hidden"}}>
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart data={perf.curve} margin={{top:8,right:8,bottom:0,left:0}}>
                          <defs>
                            <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={strategy.tierColor} stopOpacity={0.3}/>
                              <stop offset="100%" stopColor={strategy.tierColor} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false}/>
                          <YAxis tick={{fill:B.dim,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`} width={40}/>
                          <Tooltip content={({active,payload})=>{ if(!active||!payload||!payload.length) return null; return <div style={{background:B.surf,border:`1px solid ${B.border}`,borderRadius:6,padding:"6px 10px",fontSize:11}}>${(payload[0].value||0).toFixed(2)}</div>; }}/>
                          <Area type="monotone" dataKey="v" stroke={strategy.tierColor} strokeWidth={2} fill="url(#stratGrad)"/>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* P&L by category */}
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:B.subtext,marginBottom:8}}>Recent Trade Log</div>
                    <div style={{border:`1px solid ${B.border}`,borderRadius:8,overflow:"hidden"}}>
                      {stratTrades.slice(0,8).map((t,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:i<7?`1px solid ${B.border}`:"none",background:i%2===0?"transparent":`${B.surf2}50`}}>
                          <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:(t.side==="YES"||t.side==="BUY")?`${B.green}15`:`${B.red}15`,color:(t.side==="YES"||t.side==="BUY")?B.green:B.red,fontWeight:700,flexShrink:0}}>{t.side||"?"}</span>
                          <div style={{flex:1,fontSize:11,color:B.subtext,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.market||t.title||"—"}</div>
                          <span style={{fontSize:12,fontWeight:700,color:(t.pnl||0)>=0?B.green:B.red,flexShrink:0,fontFamily:"'Syne',sans-serif"}}>{(t.pnl||0)>=0?"+":""}{(t.pnl||0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{padding:"48px 0",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>📊</div>
                  <div style={{fontSize:13,fontWeight:600,color:B.subtext,marginBottom:6}}>No trade data yet</div>
                  <div style={{fontSize:11,color:B.muted}}>
                    {strategy.status==="built"?"Orchestrator offline or no trades logged yet.":strategy.status==="in_dev"?"This strategy is still in development.":"This strategy is planned — not yet deployed."}
                  </div>
                  {strategy.status==="planned"&&(
                    <button onClick={()=>setTab("pipeline")} style={{marginTop:14,padding:"8px 18px",fontSize:11,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                      View Development Pipeline →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── CONTROLS TAB ── */}
          {tab==="controls"&&(
            <div>
              {/* Bot assignment */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:600,color:B.subtext,marginBottom:10}}>Bot Assignment</div>
                <div style={{background:B.surf2,border:`1px solid ${B.border}`,borderRadius:9,padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:B.dim,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Currently running on</div>
                  <div style={{fontSize:13,fontWeight:700,color:isRunning?B.green:B.subtext,fontFamily:"'JetBrains Mono',monospace",marginBottom:8}}>
                    {strategy.botName||"—"}
                    {isRunning&&<span style={{marginLeft:8,fontSize:10,background:B.greenSoft,color:B.green,padding:"2px 7px",borderRadius:10,fontFamily:"'Outfit',sans-serif"}}>● Live</span>}
                  </div>
                  {vpsState&&(
                    <div style={{display:"flex",gap:12,fontSize:10,color:B.muted}}>
                      {vpsState.pnl!=null&&<span>P&L: <span style={{color:vpsState.pnl>=0?B.green:B.red,fontWeight:600}}>${vpsState.pnl?.toFixed(2)}</span></span>}
                      {vpsState.scan_count!=null&&<span>Scans: {vpsState.scan_count}</span>}
                      {vpsState.ping!=null&&<span>Ping: {vpsState.ping}ms</span>}
                    </div>
                  )}
                  {!isRunning&&strategy.status==="built"&&(
                    <div style={{fontSize:11,color:B.amber,marginTop:6}}>⚠ Not detected on VPS — check orchestrator connection</div>
                  )}
                </div>
              </div>

              {/* Strategy parameters — contextual per strategy */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:600,color:B.subtext,marginBottom:10}}>Parameters</div>
                {strategy.name?.includes("Bond")&&(
                  <StrategyParams params={[
                    {label:"Min confidence (buy threshold)", key:"min_conf",   min:0.90, max:0.99, step:0.01, def:0.95, fmt:v=>`${(v*100).toFixed(0)}¢`},
                    {label:"Max position size (USDC)",       key:"max_pos",    min:10,   max:500,  step:10,   def:80,   fmt:v=>`$${v}`},
                    {label:"Hold until resolution",          key:"hold_full",  type:"toggle", def:true},
                  ]} strategy={strategy} B={B} T={T}/>
                )}
                {strategy.name?.includes("Rebate")&&(
                  <StrategyParams params={[
                    {label:"Markets to quote simultaneously", key:"n_markets", min:10,  max:200, step:10,  def:100, fmt:v=>`${v}`},
                    {label:"Spread width (ticks)",            key:"spread",    min:1,   max:10,  step:1,   def:3,   fmt:v=>`${v}`},
                    {label:"Max per-market exposure (USDC)",  key:"max_exp",   min:5,   max:100, step:5,   def:20,  fmt:v=>`$${v}`},
                  ]} strategy={strategy} B={B} T={T}/>
                )}
                {strategy.name?.includes("BTC")&&(
                  <StrategyParams params={[
                    {label:"Entry momentum threshold",        key:"threshold", min:0.1,  max:2.0,  step:0.1,  def:0.5,  fmt:v=>`${v}%`},
                    {label:"Max position size (USDC)",        key:"max_pos",   min:10,   max:300,  step:10,   def:50,   fmt:v=>`$${v}`},
                    {label:"Stop loss %",                     key:"stop_loss", min:0.5,  max:5.0,  step:0.5,  def:2.0,  fmt:v=>`${v}%`},
                    {label:"Max concurrent trades",           key:"max_conc",  min:1,    max:10,   step:1,    def:3,    fmt:v=>`${v}`},
                  ]} strategy={strategy} B={B} T={T}/>
                )}
                {strategy.name?.includes("Whale")&&(
                  <StrategyParams params={[
                    {label:"Copy size (% of whale trade)",    key:"copy_pct",  min:10,  max:100, step:10,  def:70,  fmt:v=>`${v}%`},
                    {label:"Max capital per whale (USDC)",    key:"max_usd",   min:10,  max:500, step:10,  def:80,  fmt:v=>`$${v}`},
                    {label:"Min whale win rate",              key:"min_wr",    min:50,  max:90,  step:5,   def:60,  fmt:v=>`${v}%`},
                  ]} strategy={strategy} B={B} T={T}/>
                )}
                {!["Bond","Rebate","BTC","Whale"].some(k=>strategy.name?.includes(k))&&(
                  <div style={{padding:"24px",background:B.surf2,borderRadius:8,border:`1px solid ${B.border}`,textAlign:"center"}}>
                    <div style={{fontSize:11,color:B.muted}}>
                      {strategy.status==="built"?"Parameters available once bot is live on orchestrator.":"Configure parameters when development is complete."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LIVE SIGNALS TAB ── */}
          {tab==="signals"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:B.subtext}}>Last 15 Signals</div>
                <button onClick={fetchSignals} style={{padding:"5px 12px",fontSize:10,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:6,color:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                  {sigLoading?"↻ loading...":"↻ Refresh"}
                </button>
              </div>
              {signals.length>0?(
                <div style={{border:`1px solid ${B.border}`,borderRadius:8,overflow:"hidden"}}>
                  {signals.map((sig,i)=>{
                    const action = sig.action||sig.decision||sig.signal||"Signal";
                    const conf   = sig.confidence||sig.conf||null;
                    const placed = sig.placed||sig.executed||true;
                    const actionColor = action==="BUY"||action==="YES"?B.green:action==="SELL"||action==="NO"?B.red:B.amber;
                    return (
                      <div key={i} style={{padding:"10px 14px",borderBottom:i<signals.length-1?`1px solid ${B.border}`:"none",display:"flex",alignItems:"center",gap:10,background:i%2===0?"transparent":`${B.surf2}40`}}>
                        <span style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:`${actionColor}15`,color:actionColor,fontWeight:700,flexShrink:0}}>{action}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,color:B.subtext,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sig.market||sig.title||"—"}</div>
                          {sig.reason&&<div style={{fontSize:10,color:B.dim,marginTop:1}}>{sig.reason}</div>}
                        </div>
                        <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
                          {conf!=null&&<span style={{fontSize:10,color:B.muted}}>{(conf*100).toFixed(0)}% conf</span>}
                          <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:placed?B.greenSoft:B.surf2,color:placed?B.green:B.muted}}>{placed?"placed":"skipped"}</span>
                          <span style={{fontSize:10,color:B.dim}}>{sig.timestamp||sig.time||"—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ):(
                <div style={{padding:"48px",textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:10,opacity:0.3}}>⚡</div>
                  <div style={{fontSize:13,fontWeight:600,color:B.subtext,marginBottom:6}}>
                    {sigLoading?"Fetching signals…":"No signals available"}
                  </div>
                  <div style={{fontSize:11,color:B.muted}}>
                    {strategy.status!=="built"?"This strategy isn't deployed yet.":"Orchestrator must be online to stream signals."}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BACKTEST TAB ── */}
          {tab==="backtest"&&(
            <div>
              <div style={{fontSize:11,color:B.muted,marginBottom:16,lineHeight:1.5}}>
                Replays your actual logged trades for this strategy over the selected window. Not simulation — real data only.
              </div>
              <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
                {["7d","30d","90d","180d"].map(r=>(
                  <button key={r} onClick={()=>setBtRange(r)} style={{padding:"6px 14px",fontSize:11,fontWeight:backtestRange===r?700:400,background:backtestRange===r?T.accentSoft:B.surf2,border:`1px solid ${backtestRange===r?T.accentBorder:B.border}`,borderRadius:7,color:backtestRange===r?T.accentText:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                    {r}
                  </button>
                ))}
                <button onClick={runBacktest} disabled={btRunning}
                  style={{marginLeft:"auto",padding:"7px 18px",fontSize:11,fontWeight:700,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,cursor:btRunning?"not-allowed":"pointer",fontFamily:"'Outfit',sans-serif",opacity:btRunning?0.6:1}}>
                  {btRunning?"Running…":"▶ Run Backtest"}
                </button>
              </div>

              {backtestResult?.error&&(
                <div style={{padding:"16px",background:`${B.amber}10`,border:`1px solid ${B.amber}25`,borderRadius:8,fontSize:11,color:B.amber}}>{backtestResult.error}</div>
              )}

              {backtestResult&&!backtestResult.error&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                    {[
                      {label:"Total Return",  val:`${backtestResult.totalPnl>=0?"+":""}$${Math.abs(backtestResult.totalPnl).toFixed(2)}`, color:backtestResult.totalPnl>=0?B.green:B.red},
                      {label:"Win Rate",      val:`${backtestResult.wr}%`,   color:backtestResult.wr>60?B.green:backtestResult.wr>50?B.amber:B.red},
                      {label:"Sharpe Ratio",  val:backtestResult.sharpe,     color:B.subtext},
                      {label:"Total Trades",  val:backtestResult.trades,     color:B.muted},
                      {label:"Max Drawdown",  val:`$${backtestResult.maxDD.toFixed(2)}`, color:B.red},
                      {label:"Best Trade",    val:`+$${backtestResult.best.toFixed(2)}`, color:B.green},
                    ].map((s,i)=>(
                      <div key={i} style={{background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{s.label}</div>
                        <div style={{fontSize:14,fontWeight:800,color:s.color,fontFamily:"'Syne',sans-serif"}}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{height:110,background:B.surf2,borderRadius:8,border:`1px solid ${B.border}`,overflow:"hidden"}}>
                    <ResponsiveContainer width="100%" height={110}>
                      <AreaChart data={backtestResult.curve} margin={{top:8,right:8,bottom:0,left:0}}>
                        <defs>
                          <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={strategy.tierColor} stopOpacity={0.4}/>
                            <stop offset="100%" stopColor={strategy.tierColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <YAxis tick={{fill:B.dim,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`} width={40}/>
                        <Tooltip content={({active,payload})=>{ if(!active||!payload||!payload.length) return null; return <div style={{background:B.surf,border:`1px solid ${B.border}`,borderRadius:6,padding:"6px 10px",fontSize:11}}>${(payload[0].value||0).toFixed(2)}</div>; }}/>
                        <Area type="monotone" dataKey="v" stroke={strategy.tierColor} strokeWidth={2} fill="url(#btGrad)"/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {!backtestResult&&(
                <div style={{padding:"48px",textAlign:"center",color:B.muted}}>
                  <div style={{fontSize:28,marginBottom:10,opacity:0.3}}>🔬</div>
                  <div style={{fontSize:12}}>Select a window and hit Run to replay your trade history</div>
                </div>
              )}
            </div>
          )}

          {/* ── PIPELINE TAB ── */}
          {tab==="pipeline"&&(
            <div>
              <div style={{fontSize:11,color:B.muted,marginBottom:20,lineHeight:1.5}}>
                Track this strategy's progress from idea to live deployment.
              </div>

              {/* Pipeline stages */}
              <div style={{position:"relative",marginBottom:28}}>
                {/* Connector line */}
                <div style={{position:"absolute",top:20,left:20,right:20,height:2,background:B.border,zIndex:0}}/>
                <div style={{position:"absolute",top:20,left:20,width:`${(pipelineStage/4)*100}%`,height:2,background:strategy.tierColor,zIndex:1,transition:"width 0.4s"}}/>
                <div style={{display:"flex",justifyContent:"space-between",position:"relative",zIndex:2}}>
                  {PIPELINE_STAGES.map((stage,i)=>{
                    const done = i < pipelineStage;
                    const current = i === pipelineStage;
                    const future = i > pipelineStage;
                    return (
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:future?"pointer":"default",flex:1}}
                        onClick={()=>{if(!future||i===pipelineStage+1) setPipelineStage(i);}}>
                        <div style={{width:40,height:40,borderRadius:"50%",border:`2px solid ${done||current?strategy.tierColor:B.border}`,background:done?strategy.tierColor:current?`${strategy.tierColor}20`:B.surf2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?14:11,color:done?"#fff":current?strategy.tierColor:B.muted,fontWeight:700,transition:"all 0.3s"}}>
                          {done?"✓":i+1}
                        </div>
                        <div style={{fontSize:9,fontWeight:current?700:400,color:current?strategy.tierColor:done?B.subtext:B.dim,textAlign:"center",letterSpacing:"0.03em"}}>{stage}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stage notes */}
              {PIPELINE_STAGES.map((stage,i)=>(
                <div key={i} style={{marginBottom:12,opacity:i>pipelineStage?0.4:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:i<pipelineStage?strategy.tierColor:i===pipelineStage?strategy.tierColor:B.border,flexShrink:0}}/>
                    <span style={{fontSize:11,fontWeight:600,color:i<=pipelineStage?B.subtext:B.dim}}>{stage}</span>
                    {i<pipelineStage&&<span style={{fontSize:9,color:B.green,marginLeft:"auto"}}>✓ Complete</span>}
                    {i===pipelineStage&&<span style={{fontSize:9,color:strategy.tierColor,marginLeft:"auto",fontWeight:700}}>← Current stage</span>}
                  </div>
                  <textarea
                    placeholder={`Notes for ${stage}…`}
                    value={pipelineNotes[i]||""}
                    onChange={e=>setPipelineNotes(p=>({...p,[i]:e.target.value}))}
                    disabled={i>pipelineStage}
                    style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:7,padding:"8px 12px",fontSize:11,color:B.subtext,resize:"vertical",minHeight:48,fontFamily:"'Outfit',sans-serif",outline:"none",boxSizing:"border-box",opacity:i>pipelineStage?0.4:1}}
                  />
                </div>
              ))}

              {/* Promote button */}
              {pipelineStage < 4 && (
                <button onClick={()=>setPipelineStage(s=>Math.min(4,s+1))}
                  style={{width:"100%",marginTop:8,padding:"11px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                  ✓ Mark "{PIPELINE_STAGES[pipelineStage]}" Complete → Advance to {PIPELINE_STAGES[Math.min(4,pipelineStage+1)]}
                </button>
              )}
              {pipelineStage === 4 && (
                <div style={{padding:"12px 16px",background:B.greenSoft,border:`1px solid ${B.green}30`,borderRadius:8,fontSize:12,fontWeight:600,color:B.green,textAlign:"center"}}>
                  ✅ Strategy is fully deployed and live
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

// ── STRATEGY PARAM SLIDERS (V12) ──────────────────────────────────────────────
const StrategyParams = ({params, strategy, B, T}) => {
  const [vals, setVals] = React.useState(()=>{
    const init={};
    params.forEach(p=>{ if(p.type!=="toggle") init[p.key]=p.def; else init[p.key]=p.def; });
    return init;
  });
  const [saved, setSaved] = React.useState(false);

  const save = async () => {
    try {
      await fetch("https://api.gurbcapital.com/command", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({bot:strategy.botName, action:"set_params", params:vals})
      });
      setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch(e){ setSaved(false); }
  };

  return (
    <div>
      <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:14}}>
        {params.map((p,i)=>(
          <div key={i}>
            {p.type==="toggle" ? (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8}}>
                <span style={{fontSize:11,color:B.subtext}}>{p.label}</span>
                <div onClick={()=>setVals(v=>({...v,[p.key]:!v[p.key]}))}
                  style={{width:36,height:20,borderRadius:10,background:vals[p.key]?T.accentText:B.border,cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                  <div style={{position:"absolute",top:3,left:vals[p.key]?17:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                </div>
              </div>
            ) : (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:B.muted}}>{p.label}</span>
                  <span style={{fontSize:12,fontWeight:700,color:T.accentText}}>{p.fmt(vals[p.key])}</span>
                </div>
                <input type="range" min={p.min} max={p.max} step={p.step} value={vals[p.key]}
                  onChange={e=>setVals(v=>({...v,[p.key]:parseFloat(e.target.value)}))}
                  style={{width:"100%",accentColor:T.accentText,cursor:"pointer"}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:B.dim,marginTop:2}}>
                  <span>{p.fmt(p.min)}</span><span>{p.fmt(p.max)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={save} style={{width:"100%",padding:"10px",background:saved?B.greenSoft:T.accentSoft,border:`1px solid ${saved?B.green:T.accentBorder}`,borderRadius:8,color:saved?B.green:T.accentText,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.3s"}}>
        {saved?"✓ Saved to Bot":"💾 Save & Push to Bot"}
      </button>
    </div>
  );
};

// ── COPY CONFIG MODAL (V12) ───────────────────────────────────────────────────
const CopyConfigModal = ({trader, onConfirm, onClose, B, T, availableBalance=0, isDemo=false}) => {
  const hardMax  = Math.floor(availableBalance);            // never exceed what's in wallet
  const safeSugg = Math.min(80, Math.floor(hardMax * 0.2)); // suggest 20% of balance by default
  const [maxUsd,    setMaxUsd]    = React.useState(Math.max(5, safeSugg));
  const [copyPct,   setCopyPct]   = React.useState(70);
  const [minTrade,  setMinTrade]  = React.useState(5);
  const [maxTrades, setMaxTrades] = React.useState(10);
  const [stopLoss,  setStopLoss]  = React.useState(20);
  const [strategy,  setStrategy]  = React.useState("proportional");

  const addr = trader?.proxy_wallet || trader?.address || "";
  const pnl  = trader?.pnl_usd || 0;
  const insufficient = hardMax < 5;

  const STRATEGIES = [
    {id:"proportional", label:"Proportional", desc:"Copy exact % of their position size"},
    {id:"fixed",        label:"Fixed Size",   desc:"Same dollar amount per trade"},
    {id:"scaled",       label:"Kelly Scaled", desc:"Scale by win rate confidence"},
  ];

  const estimatedPerTrade = strategy==="fixed" ? minTrade : (maxUsd * copyPct/100 / Math.max(maxTrades,1));

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:999}}/>
      {/* Modal */}
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:480,maxHeight:"90vh",overflowY:"auto",background:B.surf,border:`1px solid ${T.accentBorder}`,borderRadius:16,zIndex:1000,fontFamily:"'Outfit',sans-serif",boxShadow:`0 24px 80px rgba(0,0,0,0.5)`}}>

        {/* Header */}
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🐋</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:B.text}}>{trader?.name || addr.slice(0,12)}</div>
              <div style={{fontSize:11,color:B.muted}}>Configure copy settings</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:B.muted,fontSize:18,cursor:"pointer",padding:"4px 8px"}}>✕</button>
        </div>

        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:20}}>

          {/* Balance banner */}
          <div style={{borderRadius:9,background:insufficient?`${B.red}10`:`${B.green}08`,border:`1px solid ${insufficient?`${B.red}30`:`${B.green}25`}`,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px"}}>
              <div>
                <div style={{fontSize:10,color:B.muted,marginBottom:2}}>{isDemo?"DEMO BALANCE":"LIVE WALLET BALANCE"}</div>
                <div style={{fontSize:15,fontWeight:700,color:insufficient?B.red:B.green,fontFamily:"'Syne',sans-serif"}}>
                  {availableBalance>0?`$${availableBalance.toFixed(2)} USDC`:"Not connected"}
                </div>
              </div>
              <div style={{fontSize:11,color:B.muted,textAlign:"right"}}>
                Max allocatable<br/><span style={{fontWeight:700,color:insufficient?B.red:B.text}}>{insufficient?"—":`$${hardMax}`}</span>
              </div>
            </div>
            {insufficient&&(
              <div style={{padding:"8px 14px",background:`${B.red}15`,borderTop:`1px solid ${B.red}20`,fontSize:11,color:B.red,display:"flex",alignItems:"center",gap:6}}>
                <span>⚠</span>
                <span>{isDemo?"Add funds in the Funds tab first — you need at least $5 to copy.":"Connect your wallet and deposit USDC to start copying."}</span>
              </div>
            )}
          </div>

          {/* Trader summary strip */}
          <div style={{display:"flex",gap:10}}>
            {[
              {label:"All-time P&L", val:pnl>=1e6?`$${(pnl/1e6).toFixed(2)}M`:pnl>=1e3?`$${(pnl/1e3).toFixed(0)}K`:"—", color:B.green},
              {label:"Win Rate",     val:trader?.win_rate?`${trader.win_rate}%`:"—", color:trader?.win_rate>60?B.green:B.amber},
              {label:"Trades",       val:trader?.num_trades?.toLocaleString()||"—", color:B.subtext},
            ].map((s,i)=>(
              <div key={i} style={{flex:1,background:B.surf2,borderRadius:8,padding:"10px 12px",border:`1px solid ${B.border}`}}>
                <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{s.label}</div>
                <div style={{fontSize:14,fontWeight:700,color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Copy Strategy */}
          <div>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:B.subtext}}>Copy Strategy</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {STRATEGIES.map(s=>(
                <div key={s.id} onClick={()=>setStrategy(s.id)}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,border:`1px solid ${strategy===s.id?T.accentBorder:B.border}`,background:strategy===s.id?T.accentSoft:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${strategy===s.id?T.accentText:B.border}`,background:strategy===s.id?T.accentText:"transparent",flexShrink:0,transition:"all 0.15s"}}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:strategy===s.id?T.accentText:B.text}}>{s.label}</div>
                    <div style={{fontSize:10,color:B.muted,marginTop:1}}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Capital Controls */}
          <div>
            <div style={{fontSize:12,fontWeight:600,marginBottom:12,color:B.subtext}}>Capital & Position Sizing</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* Max allocation */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,color:B.muted}}>Max allocation (total capital at risk)</span>
                  <span style={{fontSize:13,fontWeight:700,color:maxUsd>hardMax*0.5?B.amber:T.accentText,fontFamily:"'Syne',sans-serif"}}>${maxUsd}</span>
                </div>
                <input type="range" min={5} max={Math.max(5,hardMax)} step={5} value={Math.min(maxUsd,Math.max(5,hardMax))} onChange={e=>setMaxUsd(+e.target.value)}
                  disabled={insufficient}
                  style={{width:"100%",accentColor:T.accentText,cursor:insufficient?"not-allowed":"pointer",opacity:insufficient?0.4:1}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:B.dim,marginTop:3}}>
                  <span>$5</span>
                  <span style={{color:hardMax<80?B.amber:B.dim}}>max ${hardMax} available</span>
                </div>
              </div>

              {/* Copy % of their size */}
              {strategy==="proportional"&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:B.muted}}>Copy size (% of their position)</span>
                    <span style={{fontSize:13,fontWeight:700,color:T.accentText,fontFamily:"'Syne',sans-serif"}}>{copyPct}%</span>
                  </div>
                  <input type="range" min={10} max={100} step={5} value={copyPct} onChange={e=>setCopyPct(+e.target.value)}
                    style={{width:"100%",accentColor:T.accentText,cursor:"pointer"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:B.dim,marginTop:3}}>
                    <span>10%</span><span>100%</span>
                  </div>
                </div>
              )}

              {/* Fixed min trade */}
              {strategy==="fixed"&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:B.muted}}>Fixed trade size (USDC per trade)</span>
                    <span style={{fontSize:13,fontWeight:700,color:T.accentText,fontFamily:"'Syne',sans-serif"}}>${minTrade}</span>
                  </div>
                  <input type="range" min={1} max={100} step={1} value={minTrade} onChange={e=>setMinTrade(+e.target.value)}
                    style={{width:"100%",accentColor:T.accentText,cursor:"pointer"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:B.dim,marginTop:3}}>
                    <span>$1</span><span>$100</span>
                  </div>
                </div>
              )}

              {/* Max open trades */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,color:B.muted}}>Max open positions at once</span>
                  <span style={{fontSize:13,fontWeight:700,color:T.accentText,fontFamily:"'Syne',sans-serif"}}>{maxTrades}</span>
                </div>
                <input type="range" min={1} max={30} step={1} value={maxTrades} onChange={e=>setMaxTrades(+e.target.value)}
                  style={{width:"100%",accentColor:T.accentText,cursor:"pointer"}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:B.dim,marginTop:3}}>
                  <span>1</span><span>30</span>
                </div>
              </div>

              {/* Stop loss */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,color:B.muted}}>Stop loss (halt if down this %)</span>
                  <span style={{fontSize:13,fontWeight:700,color:B.red,fontFamily:"'Syne',sans-serif"}}>{stopLoss}%</span>
                </div>
                <input type="range" min={5} max={100} step={5} value={stopLoss} onChange={e=>setStopLoss(+e.target.value)}
                  style={{width:"100%",accentColor:B.red,cursor:"pointer"}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:B.dim,marginTop:3}}>
                  <span>5%</span><span>100% (off)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{background:B.surf2,border:`1px solid ${B.border}`,borderRadius:10,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:600,color:B.subtext,marginBottom:10}}>Order Summary</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {label:"Max capital deployed",   val:`$${maxUsd} USDC`},
                {label:"Strategy",               val:STRATEGIES.find(s=>s.id===strategy)?.label},
                {label:"Est. per-trade size",    val:`~$${estimatedPerTrade.toFixed(1)}`},
                {label:"Max concurrent trades",  val:maxTrades},
                {label:"Stop loss trigger",      val:stopLoss<100?`-${stopLoss}% ($${(maxUsd*stopLoss/100).toFixed(0)})` :"Off"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                  <span style={{color:B.muted}}>{r.label}</span>
                  <span style={{fontWeight:600,color:B.text}}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{flex:1,padding:"11px 0",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,color:B.muted,fontSize:12,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>onConfirm({maxUsd,copyPct,minTrade,maxTrades,stopLoss,strategy})}
              disabled={insufficient}
              style={{flex:2,padding:"11px 0",background:insufficient?B.surf2:T.accentSoft,border:`1px solid ${insufficient?B.border:T.accentBorder}`,borderRadius:8,color:insufficient?B.dim:T.accentText,fontSize:13,fontWeight:700,cursor:insufficient?"not-allowed":"pointer",letterSpacing:"0.02em",opacity:insufficient?0.5:1}}>
              {insufficient?"Insufficient Balance":`▶ Start Copying — $${maxUsd} max`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ── LEADERBOARD ANALYTICS CARD (V12) ─────────────────────────────────────────
// Renders a rich analytics card for each top trader
const LeaderboardCard = ({trader, rank, selected, onSelect, onCopy, copying, isLive, B, T}) => {
  const addr   = trader.proxy_wallet || trader.address || "";
  const pnl    = trader.pnl_usd || trader.pnl || 0;
  const wr     = trader.win_rate ?? trader.winRate ?? null;
  const trades = trader.num_trades ?? trader.trades ?? null;
  const avgSz  = trader.avg_size_usd || trader.average_position_size || null;

  // Tier classification
  const tier = rank===1?"👑 Elite":rank<=3?"🔥 Top 3":rank<=10?"⚡ Top 10":"📈 Top 20";
  const tierColor = rank===1?"#f59e0b":rank<=3?"#ef4444":rank<=10?"#8b5cf6":"#4C9EEB";

  // Edge score: composite of win rate + P&L magnitude + trade volume
  const edgeScore = wr != null
    ? Math.min(99, Math.round((wr * 0.5) + (Math.log10(Math.max(pnl,1)) * 5) + (trades ? Math.min(20, trades/200) : 0)))
    : null;

  // Mini bar chart: simulated win/loss breakdown from win rate
  const W = 40; const H = 20;
  const bars = 12;
  const miniBarsSvg = wr != null ? Array.from({length:bars},(_,i)=>{
    const h = 4 + Math.random()*12;
    const isWin = Math.random() < wr/100;
    return `<rect x="${i*(W/bars)+1}" y="${H-h}" width="${W/bars-2}" height="${h}" fill="${isWin?"#10b981":"#ef4444"}" opacity="0.7" rx="1"/>`;
  }).join("") : "";

  return (
    <div onClick={onSelect}
      style={{padding:"16px 18px",borderBottom:`1px solid ${B.border}`,borderRight:`1px solid ${B.border}`,cursor:"pointer",background:selected?`${tierColor}08`:"transparent",transition:"background 0.15s",position:"relative"}}>

      {/* Live badge */}
      {isLive&&(
        <div style={{position:"absolute",top:10,right:10,display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:B.green,boxShadow:`0 0 5px ${B.green}`}}/>
          <span style={{fontSize:9,color:B.green,fontWeight:700,letterSpacing:"0.06em"}}>LIVE</span>
        </div>
      )}

      {/* Rank + tier */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <div style={{width:26,height:26,borderRadius:8,background:`${tierColor}18`,border:`1px solid ${tierColor}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:tierColor,fontFamily:"'Syne',sans-serif",flexShrink:0}}>
          {rank}
        </div>
        <span style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:`${tierColor}12`,color:tierColor,fontWeight:700,letterSpacing:"0.05em"}}>{tier}</span>
      </div>

      {/* Name */}
      <div style={{fontSize:13,fontWeight:700,color:selected?tierColor:B.text,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"calc(100% - 60px)"}}>
        {trader.name || addr.slice(0,12)+"…"}
      </div>
      <div style={{fontSize:9,color:B.dim,fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>
        {addr.slice(0,16)}{addr.length>16?"…":""}
      </div>

      {/* Core stats row */}
      <div style={{display:"flex",gap:0,marginBottom:12}}>
        <div style={{flex:1,paddingRight:10,borderRight:`1px solid ${B.border}`}}>
          <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>All-Time P&L</div>
          <div style={{fontSize:14,fontWeight:800,color:B.green,fontFamily:"'Syne',sans-serif",letterSpacing:"-0.01em"}}>
            {pnl>=1e6?`$${(pnl/1e6).toFixed(2)}M`:pnl>=1e3?`$${(pnl/1e3).toFixed(0)}K`:`$${Math.round(pnl)}`}
          </div>
        </div>
        {wr!=null&&(
          <div style={{flex:1,paddingLeft:10,paddingRight:10,borderRight:`1px solid ${B.border}`}}>
            <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>Win Rate</div>
            <div style={{fontSize:14,fontWeight:800,color:wr>65?B.green:wr>50?B.amber:B.red,fontFamily:"'Syne',sans-serif"}}>
              {wr.toFixed(1)}%
            </div>
          </div>
        )}
        {edgeScore!=null&&(
          <div style={{flex:1,paddingLeft:10}}>
            <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>Edge Score</div>
            <div style={{fontSize:14,fontWeight:800,color:edgeScore>75?B.green:edgeScore>50?B.amber:B.muted,fontFamily:"'Syne',sans-serif"}}>
              {edgeScore}<span style={{fontSize:9,color:B.dim}}>/99</span>
            </div>
          </div>
        )}
      </div>

      {/* Mini win/loss bars + trade count */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div>
          <div style={{fontSize:9,color:B.dim,marginBottom:4}}>W/L pattern</div>
          <svg width={W} height={H} dangerouslySetInnerHTML={{__html:miniBarsSvg||`<text x="2" y="14" fill="${B.dim}" font-size="8">—</text>`}}/>
        </div>
        {trades!=null&&(
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:B.dim,marginBottom:2}}>Total Trades</div>
            <div style={{fontSize:12,fontWeight:700,color:B.subtext}}>{trades>=1000?`${(trades/1000).toFixed(1)}K`:trades}</div>
          </div>
        )}
        {avgSz&&(
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:B.dim,marginBottom:2}}>Avg Size</div>
            <div style={{fontSize:12,fontWeight:700,color:B.subtext}}>${typeof avgSz==="number"?avgSz.toFixed(0):avgSz}</div>
          </div>
        )}
      </div>

      {/* Win rate progress bar */}
      {wr!=null&&(
        <div style={{marginBottom:12}}>
          <div style={{height:4,background:B.surf2,borderRadius:4,overflow:"hidden"}}>
            <div style={{width:`${wr}%`,height:"100%",background:`linear-gradient(90deg,${B.green},${tierColor})`,borderRadius:4,transition:"width 0.5s"}}/>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{display:"flex",gap:8}}>
        <button onClick={e=>{e.stopPropagation();onSelect();}}
          style={{flex:1,padding:"7px 0",fontSize:11,background:selected?`${tierColor}15`:B.surf2,border:`1px solid ${selected?tierColor:B.border}`,borderRadius:7,color:selected?tierColor:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:selected?700:400}}>
          {selected?"▾ Viewing":"View"}
        </button>
        <button onClick={e=>{e.stopPropagation();if(!isLive&&!copying)onCopy();}}
          disabled={copying||isLive}
          style={{flex:1,padding:"7px 0",fontSize:11,fontWeight:700,background:isLive?B.greenSoft:copying?B.surf2:T.accentSoft,border:`1px solid ${isLive?B.green:copying?B.border:T.accentBorder}`,borderRadius:7,color:isLive?B.green:copying?B.muted:T.accentText,cursor:copying||isLive?"default":"pointer",fontFamily:"'Outfit',sans-serif"}}>
          {isLive?"✓ Copying":copying?"…":"Copy"}
        </button>
      </div>
    </div>
  );
};

// ── LEADERBOARD ROW COMPONENT (V12) ──────────────────────────────────────────
const LeaderboardRow = ({trader, rank, selected, onSelect, onCopy, copying, B, T, wallets=[]}) => {
  const addr = trader.proxy_wallet || trader.address || "";
  const isAlreadyCopying = wallets.some(w => w.address === addr && w.connectionStatus === "live");
  const pnl = trader.pnl_usd || trader.pnl || 0;
  const wr  = trader.win_rate || trader.winRate || null;
  const trades = trader.num_trades || trader.trades || null;
  const MEDAL = rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":null;
  const TIER_COLOR = rank<=3?"#f59e0b":rank<=10?"#8b5cf6":rank<=20?"#4C9EEB":"#4E5A6E";

  return (
    <div onClick={onSelect}
      style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",borderBottom:`1px solid ${B.border}`,cursor:"pointer",background:selected?`${T.accentSoft}`:"transparent",transition:"background 0.15s"}}>
      {/* Rank */}
      <div style={{width:32,textAlign:"center",flexShrink:0}}>
        {MEDAL ? <span style={{fontSize:16}}>{MEDAL}</span> :
          <span style={{fontSize:12,fontWeight:700,color:TIER_COLOR,fontFamily:"'Syne',sans-serif"}}>#{rank}</span>}
      </div>
      {/* Avatar */}
      <div style={{width:34,height:34,borderRadius:10,background:`${TIER_COLOR}18`,border:`1px solid ${TIER_COLOR}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13}}>
        🐋
      </div>
      {/* Name + address */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {trader.name || addr.slice(0,10)+"..."}
        </div>
        <div style={{fontSize:10,color:B.dim,fontFamily:"'JetBrains Mono',monospace",marginTop:1}}>
          {addr.slice(0,14)}{addr.length>14?"...":""}
        </div>
      </div>
      {/* Stats */}
      <div style={{display:"flex",gap:20,alignItems:"center",flexShrink:0}}>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:13,fontWeight:700,color:B.green,fontFamily:"'Syne',sans-serif"}}>
            {pnl>=1e6?`$${(pnl/1e6).toFixed(2)}M`:pnl>=1e3?`$${(pnl/1e3).toFixed(0)}K`:`$${Math.round(pnl)}`}
          </div>
          <div style={{fontSize:9,color:B.muted,letterSpacing:"0.06em"}}>ALL-TIME P&L</div>
        </div>
        {wr!=null&&(
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13,fontWeight:700,color:wr>60?B.green:wr>50?B.amber:B.muted}}>{wr.toFixed(1)}%</div>
            <div style={{fontSize:9,color:B.muted,letterSpacing:"0.06em"}}>WIN RATE</div>
          </div>
        )}
        {trades!=null&&(
          <div style={{textAlign:"right",minWidth:48}}>
            <div style={{fontSize:12,fontWeight:600,color:B.subtext}}>{trades>=1000?`${(trades/1000).toFixed(1)}K`:trades}</div>
            <div style={{fontSize:9,color:B.muted,letterSpacing:"0.06em"}}>TRADES</div>
          </div>
        )}
      </div>
      {/* Copy button */}
      <button onClick={e=>{e.stopPropagation();onCopy();}} disabled={copying||isAlreadyCopying}
        style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:7,border:`1px solid ${isAlreadyCopying?`${B.green}40`:copying?B.border:T.accentBorder}`,background:isAlreadyCopying?B.greenSoft:copying?B.surf2:T.accentSoft,color:isAlreadyCopying?B.green:copying?B.muted:T.accentText,cursor:copying||isAlreadyCopying?"default":"pointer",fontFamily:"'Outfit',sans-serif",flexShrink:0,transition:"all 0.2s"}}>
        {isAlreadyCopying?"✓ Live":copying?"…":"Copy"}
      </button>
    </div>
  );
};

// ── ADD BOT MODAL (V12) ───────────────────────────────────────────────────────
const BOT_COLORS = ["#10b981","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16"];
const BOT_STATUSES = ["live","paper","paused","planned"];

const AddBotModal = ({onAdd, onClose, existingIds}) => {
  const {B,T} = useTheme();
  const [name,     setName]     = useState("");
  const [strategy, setStrategy] = useState("");
  const [file,     setFile]     = useState("");
  const [status,   setStatus]   = useState("paper");
  const [color,    setColor]    = useState(BOT_COLORS[0]);

  const handleAdd = () => {
    if(!name.trim()) return;
    const newBot = {
      id:       Date.now(),
      name:     name.trim(),
      strategy: strategy.trim() || "Custom Strategy",
      file:     file.trim() || "—",
      status,
      pnl:0, pct:0, win:0, trades:0, ping:0, exec:0, rate:0,
      color,
    };
    onAdd(newBot);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",zIndex:300}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:460,background:B.surf,border:`1px solid ${B.border}`,borderRadius:16,padding:"28px 28px",zIndex:301,boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:B.text}}>Add New Bot</div>
            <div style={{fontSize:11,color:B.muted,marginTop:3}}>Create a new strategy slot and configure it below</div>
          </div>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:B.surf2,border:`1px solid ${B.border}`,color:B.muted,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Name */}
          <div>
            <label style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:6}}>Bot Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Esports Oracle Bot"
              style={{width:"100%",background:B.surf2,border:`1px solid ${name?T.accentBorder:B.border}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif",boxSizing:"border-box"}}/>
          </div>

          {/* Strategy */}
          <div>
            <label style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:6}}>Strategy Description</label>
            <input value={strategy} onChange={e=>setStrategy(e.target.value)} placeholder="e.g. Live data lag arbitrage"
              style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif",boxSizing:"border-box"}}/>
          </div>

          {/* File */}
          <div>
            <label style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:6}}>Python File</label>
            <input value={file} onChange={e=>setFile(e.target.value)} placeholder="e.g. polydesk_esports_bot.py"
              style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:B.text,outline:"none",fontFamily:"'JetBrains Mono',monospace",boxSizing:"border-box"}}/>
          </div>

          {/* Status + Color */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:6}}>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)}
                style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif",cursor:"pointer"}}>
                {BOT_STATUSES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600,display:"block",marginBottom:6}}>Color</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:4}}>
                {BOT_COLORS.map(c=>(
                  <div key={c} onClick={()=>setColor(c)}
                    style={{width:22,height:22,borderRadius:6,background:c,cursor:"pointer",border:`2px solid ${color===c?"#fff":"transparent"}`,boxShadow:color===c?`0 0 8px ${c}`:"none",transition:"all 0.15s"}}/>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{background:B.surf2,borderRadius:10,padding:"12px 14px",border:`3px solid ${color}`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${color}`,flexShrink:0}}/>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:B.text}}>{name||"New Bot"}</div>
              <div style={{fontSize:10,color:B.muted}}>{strategy||"Strategy TBD"} · {status}</div>
            </div>
          </div>

          <button onClick={handleAdd} disabled={!name.trim()}
            style={{padding:"11px",borderRadius:8,fontSize:12,fontWeight:700,background:name.trim()?T.accentSoft:B.surf2,border:`1px solid ${name.trim()?T.accentBorder:B.border}`,color:name.trim()?T.accentText:B.dim,cursor:name.trim()?"pointer":"not-allowed",fontFamily:"'Outfit',sans-serif",transition:"all 0.2s"}}>
            ✦ Add Bot to Registry
          </button>
        </div>
      </div>
    </>
  );
};

export default function PolydeskV12() {
  const [mode,setMode]         = useState("demo");
  const [page,setPage]         = useState("overview");
  const [period,setPeriod]     = useState("1M");
  const [customRange,setCR]    = useState({from:"2026-01-01",to:"2026-02-22"});
  const [selectedBot,setBot]   = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null); // strategy detail drawer
  const [saved,setSaved]       = useState(false);
  const [time,setTime]         = useState(new Date());
  const [rate,setRate]         = useState(342);
  const [toggles,setToggles]   = useState({autoRestart:true,slipGuard:true,rateAlert:true,webhooks:false});
  const [darkMode,setDarkMode] = useState(true);
  const [toasts,setToasts]     = useState([]);

  // ── V12: DYNAMIC BOTS REGISTRY ──────────────────────────────────────────────
  const [botsRegistry, setBotsRegistry] = useState([...BOTS]);
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [botAllocations, setBotAllocations] = useState({
    1: 351, 2: 99, 3: 0, 4: 0, 5: 0,
  }); // botId -> allocated amount

  // Color tokens based on dark/light mode
  const B = darkMode ? DARK : LIGHT;
  const T = THEMES[mode];
  // ── ALL TRADES STATE — fetched once, used everywhere ─────────────────────────
  const [allTrades, setAllTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  // Fetch all real trades from orchestrator
  const fetchAllTrades = async () => {
    setTradesLoading(true);
    try {
      const r = await fetch(`${ORCHESTRATOR_BASE}/trades?limit=200`);
      if(r.ok){
        const d = await r.json();
        if(d?.trades) setAllTrades(d.trades);
      }
    } catch(e) {}
    setTradesLoading(false);
  };

  useEffect(()=>{
    fetchAllTrades();
    const iv = setInterval(fetchAllTrades, 60000);
    return ()=>clearInterval(iv);
  },[]);

  // Calculate real stats for a bot from trade array
  const calcBotStats = (botKey, trades) => {
    const botTrades = trades.filter(t =>
      t.bot === botKey ||
      t.bot_key === botKey ||
      (t.bot||"").includes(botKey.replace("_bot",""))
    );
    if(botTrades.length === 0) return null;
    const closedTrades = botTrades.filter(t => t.status === "closed" || t.pnl != null);
    const totalPnl   = closedTrades.reduce((s,t) => s + (t.pnl||0), 0);
    const wins       = closedTrades.filter(t => (t.pnl||0) > 0).length;
    const winRate    = closedTrades.length > 0 ? (wins / closedTrades.length * 100) : 0;
    const today      = new Date().toDateString();
    const todayTrades = botTrades.filter(t => new Date(t.time||t.created_at||0).toDateString() === today);
    return {
      pnl:       parseFloat(totalPnl.toFixed(2)),
      win:       parseFloat(winRate.toFixed(1)),
      trades:    botTrades.length,
      tradesToday: todayTrades.length,
      openTrades:  botTrades.filter(t => t.status === "open").length,
    };
  };

  const BOT_KEY_MAP = ["bond_bot","rebates_bot","btc5m_bot","copier_bot"];

  // ── REAL CHART DATA — built from allTrades ──────────────────────────────────
  const buildChartData = (trades, per) => {
    if(!trades || trades.length === 0) return null;
    const closed = trades.filter(t => t.pnl != null && t.status !== "open");
    if(closed.length === 0) return null;

    // Sort by time
    const sorted = [...closed].sort((a,b) =>
      new Date(a.time||a.created_at||0) - new Date(b.time||b.created_at||0)
    );

    // Filter by period
    const now  = new Date();
    const cutoff = {
      "1D": new Date(now - 86400000),
      "7D": new Date(now - 7*86400000),
      "1M": new Date(now - 30*86400000),
      "3M": new Date(now - 90*86400000),
      "ALL": new Date(0),
    }[per] || new Date(0);

    const filtered = sorted.filter(t => new Date(t.time||t.created_at||0) >= cutoff);
    if(filtered.length === 0) return null;

    // Build cumulative
    let cum = 0;
    return filtered.map(t => {
      cum += (t.pnl||0);
      const dt = new Date(t.time||t.created_at||0);
      const d = per==="1D"
        ? dt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
        : per==="ALL"
        ? dt.toLocaleDateString([],{month:"short",year:"2-digit"})
        : dt.toLocaleDateString([],{month:"short",day:"numeric"});
      return {d, v: parseFloat((t.pnl||0).toFixed(2)), c: parseFloat(cum.toFixed(2))};
    });
  };

  const buildMeta = (trades, per) => {
    if(!trades || trades.length === 0) return null;
    const closed = trades.filter(t => t.pnl != null && t.status !== "open");
    if(closed.length === 0) return null;

    const now = new Date();
    const cutoff = {"1D":86400000,"7D":7*86400000,"1M":30*86400000,"3M":90*86400000,"ALL":Infinity}[per]||Infinity;
    const filtered = closed.filter(t => (now - new Date(t.time||t.created_at||0)) <= cutoff);
    if(filtered.length === 0) return null;

    const totalPnl = filtered.reduce((s,t) => s+(t.pnl||0), 0);
    const wins     = filtered.filter(t=>(t.pnl||0)>0).length;
    const winRate  = filtered.length > 0 ? (wins/filtered.length*100) : 0;

    // Sharpe: mean daily pnl / std dev of daily pnl
    const byDay = {};
    filtered.forEach(t => {
      const day = new Date(t.time||t.created_at||0).toDateString();
      byDay[day] = (byDay[day]||0) + (t.pnl||0);
    });
    const dailyPnls = Object.values(byDay);
    const mean  = dailyPnls.reduce((s,v)=>s+v,0) / Math.max(dailyPnls.length,1);
    const std   = Math.sqrt(dailyPnls.reduce((s,v)=>s+(v-mean)**2,0) / Math.max(dailyPnls.length,1));
    const sharpe = std > 0 ? (mean / std * Math.sqrt(252)).toFixed(2) : "—";

    // Max drawdown
    let peak = 0, cum2 = 0, maxDD = 0;
    filtered.forEach(t => {
      cum2 += (t.pnl||0);
      if(cum2 > peak) peak = cum2;
      const dd = peak > 0 ? ((peak - cum2) / peak * 100) : 0;
      if(dd > maxDD) maxDD = dd;
    });

    // Win streak
    let streak = 0, maxStreak = 0;
    [...filtered].sort((a,b)=>new Date(a.time||a.created_at||0)-new Date(b.time||b.created_at||0))
      .forEach(t => {
        if((t.pnl||0) > 0) { streak++; maxStreak = Math.max(maxStreak,streak); }
        else streak = 0;
      });

    const pct = TOTAL_CAPITAL_USD > 0 ? (totalPnl/TOTAL_CAPITAL_USD*100) : 0;
    return {
      total: fmt.pnl(totalPnl),
      pct:   fmt.pct(pct),
      sharpe: sharpe.toString(),
      drawdown: `-${maxDD.toFixed(1)}%`,
      streak: maxStreak,
      totalPnl,
      winRate: winRate.toFixed(1),
    };
  };

  const buildCategories = (trades) => {
    if(!trades || trades.length === 0) return null;
    const closed = trades.filter(t => t.pnl != null);
    if(closed.length === 0) return null;

    const CAT_COLORS = {
      crypto:"#f59e0b", politics:"#8b5cf6", esports:"#3b82f6",
      sports:"#06b6d4", finance:"#10b981", other:"#ef4444",
    };

    const groups = {};
    closed.forEach(t => {
      const q = (t.market||t.question||"").toLowerCase();
      const cat =
        q.includes("btc")||q.includes("eth")||q.includes("crypto")||q.includes("bitcoin")||q.includes("price") ? "crypto"
        : q.includes("election")||q.includes("trump")||q.includes("president")||q.includes("congress")||q.includes("vote") ? "politics"
        : q.includes("esport")||q.includes("dota")||q.includes("league")||q.includes("valorant")||q.includes("cs2") ? "esports"
        : q.includes("nba")||q.includes("nfl")||q.includes("mlb")||q.includes("nhl")||q.includes("soccer")||q.includes("goal") ? "sports"
        : q.includes("fed")||q.includes("rate")||q.includes("cpi")||q.includes("inflation")||q.includes("gdp") ? "finance"
        : "other";
      if(!groups[cat]) groups[cat] = {name:cat.charAt(0).toUpperCase()+cat.slice(1),trades:0,pnl:0,wins:0};
      groups[cat].trades++;
      groups[cat].pnl += (t.pnl||0);
      if((t.pnl||0)>0) groups[cat].wins++;
    });

    return Object.entries(groups)
      .map(([k,v])=>({...v,pnl:parseFloat(v.pnl.toFixed(2)),winRate:v.trades>0?Math.round(v.wins/v.trades*100):0,color:CAT_COLORS[k]||"#64748b"}))
      .sort((a,b)=>b.pnl-a.pnl);
  };

  // ── TOAST NOTIFICATIONS ──────────────────────────────────────────────────────
  const toast = (msg, type="info") => {
    const id = Date.now();
    setToasts(p=>[...p, {id, msg, type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)), 4000);
  };

  // ── WALLET CONFIG STATE ──────────────────────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletChecking, setWalletChecking] = useState(false);
  const [polymarketKeys, setPolymarketKeys] = useState({apiKey:"", secret:"", passphrase:""});
  const [riskLimits, setRiskLimits] = useState({maxPosition:5000, dailyLoss:1000});

  // Fetch real USDC balance from Polygon RPC
  const fetchWalletBalance = async (addr) => {
    if(!addr || !addr.startsWith("0x")) return;
    setWalletChecking(true);
    try {
      const data = "0x70a08231" + addr.slice(2).padStart(64,"0");
      const res = await fetch(POLYGON_RPC, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({jsonrpc:"2.0",method:"eth_call",params:[{to:USDC_CONTRACT,data},"latest"],id:1})
      });
      const json = await res.json();
      const hex = json.result;
      if(hex && hex !== "0x") {
        const balance = parseInt(hex,16) / 1e6;
        setWalletBalance(balance);
        toast(`✅ Wallet connected — ${fmt.usd(balance)} USDC found`, "success");
      } else {
        setWalletBalance(0);
        toast("Wallet found but 0 USDC on Polygon", "warning");
      }
    } catch(e) {
      toast(`Wallet check failed: ${e.message}`, "error");
    }
    setWalletChecking(false);
  };

  // Save config to orchestrator
  const saveConfig = async (config) => {
    try {
      const r = await fetch(`${ORCHESTRATOR_BASE}/config`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(config)
      });
      if(r.ok) toast("✅ Configuration saved", "success");
      else toast("Save failed — check VPS", "error");
    } catch(e) {
      toast("Orchestrator offline", "error");
    }
  };

  useEffect(()=>{
    const t=setInterval(()=>{
      setTime(new Date());
      setRate(r=>Math.max(200,Math.min(480,r+Math.floor(Math.random()*9)-4)));
    },1000);
    return ()=>clearInterval(t);
  },[]);

  // totalPnl, activeBots, totalTrades derived after portfolio is declared below

  const [selectedWallet, setSelectedWallet] = useState(null);
  const [copyToggles, setCopyToggles] = useState({w1:false,w2:false,w3:false,w4:false,w5:false});

  // ── WALLET MANAGEMENT (smart add/configure from dashboard) ───────────────────
  const [wallets, setWallets] = useState(TRACKED_WALLETS.map(w=>({...w, address:w.address||"", connectionStatus:w.address?"confirmed":"not_added", copySize:0.7, maxUsd:80, liveStatus:null})));
  const [addWalletInput, setAddWalletInput] = useState("");
  const [addWalletLoading, setAddWalletLoading] = useState(false);
  const [addWalletResult, setAddWalletResult]   = useState(null);
  const [editingWallet, setEditingWallet]       = useState(null);

  // ── V12: LEADERBOARD STATE ───────────────────────────────────────────────────
  const [lbTraders, setLbTraders]           = useState([]);
  const [lbLoading, setLbLoading]           = useState(false);
  const [lbSelected, setLbSelected]         = useState(null);   // selected trader for detail view
  const [lbActivity, setLbActivity]         = useState([]);     // activity feed for selected trader
  const [lbActivityLoading, setLbActivityLoading] = useState(false);
  const [lbView, setLbView]                 = useState("leaderboard"); // "leaderboard" | "wallets"
  const [lbCopyingId, setLbCopyingId]       = useState(null);   // trader being started
  const [lbCopyModal, setLbCopyModal]       = useState(null);   // trader pending copy config

  // Fetch leaderboard from orchestrator
  const fetchLeaderboard = async () => {
    setLbLoading(true);
    try {
      const r = await fetch(`${ORCHESTRATOR_BASE}/leaderboard`);
      if(r.ok) {
        const d = await r.json();
        const traders = d?.leaderboard || d?.traders || d || [];
        if(Array.isArray(traders) && traders.length > 0) setLbTraders(traders);
      }
    } catch(e) {}
    setLbLoading(false);
  };

  // Fetch activity for a selected trader
  const fetchTraderActivity = async (address) => {
    if(!address) return;
    setLbActivityLoading(true);
    setLbActivity([]);
    try {
      const r = await fetch(`${ORCHESTRATOR_BASE}/whale/activity?address=${address}&limit=20`);
      if(r.ok) {
        const d = await r.json();
        setLbActivity(d?.activity || d?.data || d || []);
      }
    } catch(e) {}
    setLbActivityLoading(false);
  };

  // Open copy config modal for a trader
  const openCopyModal = (trader) => setLbCopyModal(trader);

  // Execute copy with full config from modal
  const startCopyingTrader = async (trader, cfg) => {
    const addr = trader.address || trader.proxy_wallet;
    setLbCopyingId(addr);
    setLbCopyModal(null);
    try {
      await fetch(`${ORCHESTRATOR_BASE}/whale/add`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          address: addr,
          name: trader.name || addr?.slice(0,8),
          copy: true,
          max_usd:    cfg.maxUsd,
          copy_size:  cfg.copyPct / 100,
          min_trade:  cfg.minTrade,
          max_trades: cfg.maxTrades,
          stop_loss:  cfg.stopLoss,
          strategy:   cfg.strategy,
        })
      });
      setWallets(prev => {
        if(prev.find(w=>w.address===addr)) return prev.map(w=>w.address===addr?{...w,connectionStatus:"live",copySize:cfg.copyPct/100,maxUsd:cfg.maxUsd}:w);
        return [...prev, {
          id: `lb-${Date.now()}`,
          handle: trader.name || addr?.slice(0,10),
          address: addr,
          allTimePnl: trader.pnl_usd || null,
          winRate: trader.win_rate || null,
          focus: "Polymarket Whale",
          trades: trader.num_trades || null,
          copyable: true,
          confidence: "HIGH",
          pattern: `Top-${trader.rank||"?"} leaderboard trader. Max $${cfg.maxUsd} · ${cfg.copyPct}% copy size.`,
          recentTrades: [],
          color: BOT_COLORS[(prev.length) % BOT_COLORS.length],
          connectionStatus: "live",
          copySize: cfg.copyPct / 100,
          maxUsd: cfg.maxUsd,
        }];
      });
    } catch(e) {}
    setLbCopyingId(null);
  };

  useEffect(() => { fetchLeaderboard(); }, []);
  const [stratFilter, setStratFilter] = useState("all");
  const [aiChat, setAiChat]       = useState([]);
  const [aiInput, setAiInput]     = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDecisions, setAiDecisions] = useState([]);

  // ── LIVE DATA STATE — declared here so useEffect below can reference it ──────
  const [liveData,    setLiveData]   = useState(null);
  const [dataLoading, setDataLoading]= useState(false);
  const [lastFetch,   setLastFetch]  = useState(null);
  const [fetchError,  setFetchError] = useState(null);
  const [liveMarkets, setLiveMarkets]= useState([]);

  // ── DEMO BALANCE ──────────────────────────────────────────────────────────────
  const [demoBalance,    setDemoBalance]    = useState(0);
  const [demoTxns,       setDemoTxns]       = useState([]);
  const [demoAllocated,  setDemoAllocated]  = useState(0);

  // Load real AI decisions from orchestrator
  useEffect(()=>{
    if(liveData?.decisions?.length > 0){
      const mapped = liveData.decisions.map(d=>({
        ...d,
        time: d.timestamp ? new Date(d.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—",
      }));
      setAiDecisions(mapped);
    }
  },[liveData, mode]);

  // ── MULTI-AGENT MODEL REGISTRY ──────────────────────────────────────────────
  const [models, setModels] = useState([
    {id:"gemini",  name:"Gemini 1.5 Flash", provider:"google",    role:"supervisor", status:"live",    latency:142, rpm:60,   cost:"$0.075/1M", key:"", lastUsed:"2h ago",  checks:{auth:true,  rate:true,  ping:true},  color:"#10b981"},
    {id:"claude",  name:"Claude Sonnet",     provider:"anthropic", role:"chat",       status:"live",    latency:891, rpm:5,    cost:"$3/1M",     key:"", lastUsed:"on demand",checks:{auth:true,  rate:true,  ping:true},  color:"#a78bfa"},
    {id:"gpt4mini",name:"GPT-4o Mini",       provider:"openai",    role:"standby",    status:"offline", latency:null,rpm:null, cost:"$0.15/1M",  key:"", lastUsed:"never",    checks:{auth:false, rate:false, ping:false}, color:"#3b82f6"},
  ]);
  const [addModelProvider, setAddModelProvider] = useState("openai");
  const [addModelKey, setAddModelKey]           = useState("");
  const [addModelName, setAddModelName]         = useState("");
  const [testingModel, setTestingModel]         = useState(null);
  const [testResults, setTestResults]           = useState(null);

  // Use real data if available, fall back to mock
  const realChartData = buildChartData(allTrades, period);
  const realMeta      = buildMeta(allTrades, period);
  const realCategories = buildCategories(allTrades);

  const data = realChartData;       // null = no trades yet → show empty state
  const meta = realMeta;             // null = no stats yet
  const categories = realCategories; // null = no category data



  // ── LIVE DATA FETCHER ────────────────────────────────────────────────────────
  const fetchLiveData = async () => {
    if(dataLoading) return;
    setDataLoading(true);
    setFetchError(null);
    try {
      // Fetch bot states from orchestrator (reads Supabase)
      const [statusR, pmR] = await Promise.allSettled([
        fetch(`${ORCHESTRATOR_BASE}/status`, {signal: AbortSignal.timeout(8000)}),
        fetch(`${ORCHESTRATOR_BASE}/markets`, {signal: AbortSignal.timeout(8000)}),
      ]);

      if(statusR.status==="fulfilled" && statusR.value.ok){
        const d = await statusR.value.json();
        setLiveData(d);
        setLastFetch(new Date().toLocaleTimeString());
      }
      if(pmR.status==="fulfilled" && pmR.value.ok){
        const markets = await pmR.value.json();
        setLiveMarkets(markets.slice(0,20));
      }

      // Fetch real trades from Supabase (via orchestrator)
      const tradesR = await fetch(`${ORCHESTRATOR_BASE}/trades?limit=50&mode=live`,
        {signal: AbortSignal.timeout(8000)});
      if(tradesR.ok){
        const td = await tradesR.json();
        setLiveData(prev => prev ? {...prev, real_trades: td.trades} : {real_trades: td.trades});
      }
    } catch(e) {
      setFetchError(e.message);
    }
    setDataLoading(false);
  };

  // Also fetch Polymarket markets even in demo mode (free public data)
  useEffect(()=>{
    const fetchMarkets = async () => {
      try {
        const r = await fetch(`${ORCHESTRATOR_BASE}/markets`);
        if(r.ok){ const d = await r.json(); setLiveMarkets(Array.isArray(d)?d.slice(0,20):[]); }
      } catch(e) {}
    };
    fetchMarkets();  // always fetch markets regardless of mode
    const iv = setInterval(fetchMarkets, 60000);
    return () => clearInterval(iv);
  }, []);

  // Fetch on mount in ALL modes — demo mode shows real bot activity, just with simulated capital
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000);
    return () => clearInterval(interval);
  }, [mode]);

  // Helper: get bot data — live from API or mock from BOTS array
    const botKeyMap = ["bond_bot","rebates_bot","btc5m_bot","copier_bot"];
  const getBotData = (botIndex) => {
    const key  = BOT_KEY_MAP[botIndex];
    const base = BOTS[botIndex];
    const realStats = allTrades.length > 0 ? calcBotStats(key, allTrades) : null;

    if(mode === "live") {
      const s = liveData?.portfolio?.bot_states?.[key];
      return {
        ...base,
        pnl:        realStats?.pnl         ?? s?.daily_pnl    ?? 0,
        win:        realStats?.win         ?? parseFloat((s?.win_rate||0).toFixed(1)),
        trades:     realStats?.trades      ?? s?.total_trades  ?? 0,
        tradesToday: realStats?.tradesToday ?? s?.trades_today ?? 0,
        openTrades:  realStats?.openTrades  ?? 0,
        status:     s?.status === "paper"   ? "paper" : (s?.status || (dataLoading?"live":"no_state_file")),
        ping:       base?.ping || 12,
        exec:       base?.exec || 35,
        updatedAt:  s?.updated_at,
        scanCount:  s?.scan_count || 0,
        pct: realStats?.pnl != null && TOTAL_CAPITAL_USD > 0
          ? parseFloat(((realStats.pnl / TOTAL_CAPITAL_USD) * 100).toFixed(1))
          : base.pct,
      };
    }
    // Demo mode — same real data, capital is simulated
    const s = liveData?.portfolio?.bot_states?.[key];
    return {
      ...base,
      pnl:         realStats?.pnl         ?? s?.daily_pnl    ?? 0,
      win:         realStats?.win         ?? parseFloat((s?.win_rate||0).toFixed(1)),
      trades:      realStats?.trades      ?? s?.total_trades  ?? 0,
      tradesToday: realStats?.tradesToday ?? s?.trades_today  ?? 0,
      openTrades:  realStats?.openTrades  ?? 0,
      status:      s?.status || "paper",
      ping:        base?.ping || 12,
      exec:        base?.exec || 35,
      scanCount:   s?.scan_count || 0,
      pct: realStats?.pnl != null && TOTAL_CAPITAL_USD > 0
        ? parseFloat(((realStats.pnl / TOTAL_CAPITAL_USD) * 100).toFixed(1))
        : 0,
    };
  };
  // Helper: get portfolio totals — live or mock
  const getPortfolioTotals = () => {
    if(mode === "live") {
      const p = liveData?.portfolio;
      if(p) return {
        totalPnl:    p.total_daily_pnl || 0,
        activeBots:  Object.values(p.bot_states||{}).filter(b=>b.status==="paper"||b.status==="live").length,
        totalTrades: p.total_trades_today || 0,
        capital:     p.total_capital || TOTAL_CAPITAL_USD,
        totalRebates: p.total_rebates || 0,
      };
      // Live mode no data yet
      return { totalPnl:0, activeBots:0, totalTrades:0, capital:TOTAL_CAPITAL_USD, totalRebates:0 };
    }
    // Demo mode — use real bot activity data, just with simulated capital
    const p = liveData?.portfolio;
    if(p) return {
      totalPnl:    allTrades.filter(t=>t.pnl!=null).reduce((s,t)=>s+(t.pnl||0),0),
      activeBots:  Object.values(p.bot_states||{}).filter(b=>b.status==="paper"||b.status==="live").length,
      totalTrades: allTrades.length,
      capital:     TOTAL_CAPITAL_USD,
      totalRebates: 0,
    };
    // No data fetched yet — genuine zeros, not mock
    return {
      totalPnl:    allTrades.filter(t=>t.pnl!=null).reduce((s,t)=>s+(t.pnl||0),0),
      activeBots:  0,
      totalTrades: allTrades.length,
      capital:     TOTAL_CAPITAL_USD,
      totalRebates: 0,
    };
  };

  const portfolio   = getPortfolioTotals();
  const totalPnl    = portfolio.totalPnl;
  const activeBots  = portfolio.activeBots;
  const totalTrades = portfolio.totalTrades;
  // Real avg ping from orchestrator bot_states, fallback to BOTS mock
  const realBotStates = liveData?.portfolio?.bot_states || {};
  const avgPing = (()=>{
    const botKeys = ["bond_bot","rebates_bot","btc5m_bot","copier_bot"];
    const pings = botKeys.map(k => realBotStates[k]?.ping_ms).filter(v => v != null);
    if(pings.length > 0) return Math.round(pings.reduce((s,v)=>s+v,0)/pings.length);
    return Math.round(BOTS.reduce((s,b)=>s+b.ping,0)/BOTS.length);
  })();

  // Real execution stats from allTrades
  const execStats = (()=>{
    const withExec = allTrades.filter(t => t.execMs != null && t.execMs > 0);
    if(withExec.length === 0) return null;
    const sorted = withExec.map(t=>t.execMs).sort((a,b)=>a-b);
    return {
      avg:     Math.round(sorted.reduce((s,v)=>s+v,0)/sorted.length),
      fastest: sorted[0],
      slowest: sorted[sorted.length-1],
      p95:     sorted[Math.floor(sorted.length*0.95)],
      failed:  allTrades.filter(t => t.status==="failed"||t.error!=null).length,
      total:   allTrades.length,
    };
  })();

  // Real latency history — last 10 trades bucketed by hour, or mock
  const latencyData = (()=>{
    const withExec = allTrades.filter(t => t.execMs != null && t.execMs > 0);
    if(withExec.length < 3) return [];
    const sorted = [...withExec].sort((a,b) => new Date(a.time||a.created_at||0) - new Date(b.time||b.created_at||0));
    const step = Math.max(1, Math.floor(sorted.length / 9));
    return sorted.filter((_,i) => i % step === 0).slice(0,9).map(t => ({
      t: new Date(t.time||t.created_at||0).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
      ms: t.execMs,
    }));
  })();

  // Real API rate from liveData portfolio or keep simulated
  const apiRate = liveData?.portfolio?.api_rate ?? rate;

  // Real copy P&L — filter allTrades by bot=copier_bot, group by wallet address
  const copyPnlByWallet = (()=>{
    const copierTrades = allTrades.filter(t =>
      t.bot === "copier_bot" || (t.bot||"").includes("copier")
    );
    const byWallet = {};
    copierTrades.forEach(t => {
      const addr = t.wallet_address || t.wallet || t.source_wallet || null;
      if(!addr) return;
      if(!byWallet[addr]) byWallet[addr] = {pnl:0, trades:0, wins:0};
      byWallet[addr].pnl    += (t.pnl||0);
      byWallet[addr].trades += 1;
      if((t.pnl||0)>0) byWallet[addr].wins++;
    });
    return byWallet;
  })();

  // Total copy P&L
  const totalCopyPnl = Object.values(copyPnlByWallet).reduce((s,v)=>s+v.pnl, 0);
  const winRateOverall = (()=>{
    const closed = allTrades.filter(t=>t.pnl!=null&&t.status!=="open");
    if(closed.length===0) return 0;
    return closed.filter(t=>(t.pnl||0)>0).length / closed.length * 100;
  })();

  // Live copying count from copier bot state
  const copierBotState = liveData?.portfolio?.bot_states?.copier_bot;
  const liveCopyCount  = copierBotState?.active_wallets ?? wallets.filter(w=>w.connectionStatus==="live").length;

  // Real last update time from API data
  const realLastUpdate = liveData?.portfolio?.timestamp
    ? new Date(liveData.portfolio.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})
    : lastFetch;

  const navItems = [
    {id:"overview",   label:"Overview",   icon:"▦"},
    {id:"bots",       label:"Bots",       icon:"⚡"},
    {id:"strategies", label:"Strategies", icon:"◈"},
    {id:"copier",     label:"Copier",     icon:"⊕"},
    {id:"exec",       label:"Execution",  icon:"⌬"},
    {id:"funds",      label:"Funds",      icon:"◎"},
    {id:"ai",         label:"AI Brain",   icon:"✦"},
    {id:"settings",   label:"Settings",   icon:"⚙"},
  ];

  return (
    <ThemeCtx.Provider value={{B,T}}>
    <div style={{display:"flex",minHeight:"100vh",background:B.bg,color:B.text,fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"background 0.3s,color 0.3s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${B.dim};border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:${B.muted}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes toastin{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
        .in{animation:in 0.3s cubic-bezier(.16,1,.3,1) both}
        .bot-row:hover{background:${B.surf2}!important;cursor:pointer}
        .bot-card:hover{border-color:${B.borderHover}!important;transform:translateY(-1px)}
        .bot-card,.nav-btn{transition:all 0.15s}
        .nav-btn:hover{background:${B.surf2}!important}
        input:focus{outline:none;}
        button{cursor:pointer;font-family:inherit;}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:${darkMode?"invert(0.5)":"none"};}
        .num{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;}
        .head{font-family:'Space Grotesk',sans-serif;letter-spacing:-0.02em;}
      `}</style>

      {/* ── TOAST NOTIFICATIONS ── */}
      <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
        {toasts.map(t=>(
          <div key={t.id} style={{
            animation:"toastin 0.3s cubic-bezier(.16,1,.3,1)",
            background:t.type==="success"?B.greenSoft:t.type==="error"?B.redSoft:t.type==="warning"?B.amberSoft:B.surf,
            border:`1px solid ${t.type==="success"?B.greenBorder:t.type==="error"?B.redSoft:t.type==="warning"?B.amberSoft:B.border}`,
            borderRadius:10,padding:"10px 16px",fontSize:12,fontWeight:500,
            color:t.type==="success"?B.green:t.type==="error"?B.red:t.type==="warning"?B.amber:B.text,
            boxShadow:"0 4px 20px rgba(0,0,0,0.2)",maxWidth:340,pointerEvents:"all",
          }}>{t.msg}</div>
        ))}
      </div>

      {/* ── SIDEBAR ── */}
      <aside style={{width:212,flexShrink:0,background:B.surf,borderRight:`1px solid ${B.border}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",transition:"background 0.3s"}}>
        <div style={{padding:"18px 14px 14px",borderBottom:`1px solid ${B.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:T.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 14px ${T.accentGlow}`}}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <div className="head" style={{fontWeight:700,fontSize:14,color:B.text}}>POLYDESK</div>
              <div style={{fontSize:10,color:B.muted,marginTop:3,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:liveData?B.green:B.muted,display:"inline-block",animation:liveData?"pulse 2s infinite":"none"}}/>
                <span style={{fontFamily:"'JetBrains Mono',monospace"}}>v11.0</span>
              </div>
            </div>
          </div>
        </div>
        <nav style={{padding:"8px 6px",flex:1,overflowY:"auto"}}>
          {navItems.map(item=>{
            const active=page===item.id;
            return (
              <button key={item.id} className="nav-btn" onClick={()=>setPage(item.id)} style={{
                display:"flex",alignItems:"center",gap:9,width:"100%",
                padding:"8px 10px",borderRadius:8,border:"none",
                background:active?T.accentSoft:"transparent",
                color:active?T.accentText:B.subtext,
                fontSize:13,fontWeight:active?600:400,textAlign:"left",
                marginBottom:1,fontFamily:"'Plus Jakarta Sans',sans-serif",
              }}>
                <span style={{fontSize:13,width:18,textAlign:"center",flexShrink:0,filter:active?"none":"opacity(0.55)"}}>{item.icon}</span>
                {item.label}
                {item.id==="bots"&&activeBots>0&&<span style={{marginLeft:"auto",fontSize:9,background:B.greenSoft,color:B.green,borderRadius:8,padding:"2px 6px",fontWeight:700}}>{activeBots}</span>}
                {item.id==="ai"&&<span style={{marginLeft:"auto",fontSize:9,background:T.accentSoft,color:T.accentText,borderRadius:8,padding:"2px 6px",fontWeight:700}}>ON</span>}
              </button>
            );
          })}
        </nav>
        <div style={{padding:"10px 14px",borderTop:`1px solid ${B.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:10,color:B.muted}}>Theme</span>
            <button onClick={()=>setDarkMode(d=>!d)} style={{
              padding:"3px 9px",borderRadius:20,border:`1px solid ${B.border}`,
              background:B.surf2,color:B.subtext,fontSize:10,fontWeight:600,
            }}>{darkMode?"☀ Light":"◑ Dark"}</button>
          </div>
          <div style={{fontSize:10,color:B.dim,fontFamily:"'JetBrains Mono',monospace"}}>{time.toUTCString().slice(17,25)} UTC</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,background:B.bg,transition:"background 0.3s"}}>
        <header style={{
          height:54,borderBottom:`1px solid ${B.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"0 22px",background:B.surf,
          position:"sticky",top:0,zIndex:50,flexShrink:0,transition:"background 0.3s",
        }}>
          <div>
            <div className="head" style={{fontSize:14,fontWeight:600,color:B.text}}>{navItems.find(n=>n.id===page)?.label}</div>
            <div style={{fontSize:10,color:B.muted,marginTop:1}}>{mode==="demo"?"Paper trading · live market data":"Live trading · real capital deployed"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:7,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,padding:"5px 11px"}}>
              <span style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:500}}>{T.balanceLabel}</span>
              <span className="num" style={{fontSize:13,fontWeight:700,color:T.accentText}}>
                {mode==="live" ? fmt.usd(walletBalance??liveData?.portfolio?.total_capital??0) : fmt.usd(demoBalance)}
              </span>
              {mode==="demo"&&<span style={{fontSize:9,background:B.blueSoft,color:B.blue,borderRadius:4,padding:"1px 5px",fontWeight:700,letterSpacing:"0.05em"}}>PAPER</span>}
              {mode==="live"&&dataLoading&&<span style={{fontSize:10,color:B.amber,animation:"pulse 1s infinite"}}>↻</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"5px 10px"}}>
              <span style={{fontSize:10,color:B.muted}}>Rate</span>
              <span className="num" style={{fontSize:12,fontWeight:600,color:rate>420?B.red:rate>320?B.amber:B.green}}>{rate}<span style={{color:B.dim,fontWeight:400}}>/500</span></span>
            </div>
            <ModeSwitch mode={mode} onChange={setMode}/>
          </div>
        </header>

        <main style={{flex:1,padding:"22px",overflowY:"auto"}}>

          {/* ── OVERVIEW ── */}
          {page==="overview"&&(
            <div className="in">

              {/* Live mode banner showing real bot activity */}
              {liveData&&(
                <div style={{background:mode==="demo"?`${B.amber}06`:`${B.green}08`,border:`1px solid ${mode==="demo"?B.amber+"25":B.green+"20"}`,borderRadius:10,padding:"10px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:mode==="demo"?B.amber:B.green,animation:"pulse 2s infinite",display:"inline-block",flexShrink:0}}/>
                  <span style={{fontSize:12,color:mode==="demo"?B.amber:B.green,fontWeight:600}}>
                    {mode==="demo"?"Paper Mode — Real Bot Activity":"Live Data Connected"}
                  </span>
                  <span style={{fontSize:11,color:B.muted}}>
                    Bond Bot: scan #{liveData?.portfolio?.bot_states?.bond_bot?.scan_count||0} ·
                    Last update: {realLastUpdate||"—"} ·
                    {totalTrades===0?" No trades yet (paper mode scanning)":` ${totalTrades} trades`}
                    {mode==="demo"&&" · capital simulated"}
                  </span>
                  {fetchError&&<span style={{fontSize:11,color:B.red,marginLeft:"auto"}}>⚠ {fetchError}</span>}
                </div>
              )}

              {/* KPI Row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
                {[
                  {label:"Total P&L",    value: fmt.pnl(totalPnl),
                                         sub: mode==="live" ? `Today · ${activeBots} bots active` : `${meta?.pct||"—"} · ${period==="1D"?"today":period==="7D"?"this week":period==="1M"?"this month":"this period"}`,
                                         color: totalPnl>=0?B.green:B.red, spark:true},
                  {label:"Active Bots",  value:`${activeBots}/4`,
                                         sub: mode==="demo" ? "Running in paper mode" : "Running live",
                                         color: activeBots>0?B.green:B.muted, spark:false},
                  {label:"Total Trades", value: totalTrades.toString(),
                                         sub: mode==="demo" ? "Paper trades executed" : "Executed this session",
                                         color: B.amber, spark:false},
                  {label:"Capital",
                   value: mode==="live" ? `$${(portfolio.capital||TOTAL_CAPITAL_USD).toLocaleString()}` : `$${TOTAL_CAPITAL_USD.toLocaleString()} sim`,
                   sub: mode==="live" ? "Deployed capital" : "Simulated · not at risk",
                   color: mode==="demo" ? B.amber : T.accentText, spark:false},
                ].map((k,i)=>(
                  <Card key={i} style={{padding:"18px 20px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <span style={{fontSize:11,color:B.muted,letterSpacing:"0.04em",fontWeight:500}}>{k.label}</span>
                      {k.spark&&<Sparkline positive={true}/>}
                    </div>
                    <div style={{fontSize:26,fontWeight:700,color:k.color,letterSpacing:"-0.03em",lineHeight:1,marginBottom:6}} className="num">{k.value}</div>
                    <div style={{fontSize:11,color:B.muted}}>{k.sub}</div>
                  </Card>
                ))}
              </div>

              {/* P&L Chart with period selector */}
              <Card style={{padding:"20px 20px 12px",marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>Cumulative Return</div>
                    <div style={{fontSize:11,color:B.muted}}>
                      {period==="Custom"?`${customRange.from} → ${customRange.to}`:
                       period==="1D"?`Today, ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}`:
                       period==="7D"?"Last 7 days":
                       period==="1M"?"Last 30 days":
                       period==="3M"?"Last 90 days":"All time"}
                      {data&&<span style={{marginLeft:8,fontSize:10,color:B.green,fontWeight:600}}>● real</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <span className="num" style={{fontSize:15,fontWeight:700,color:meta?T.accentText:B.muted}}>
                      {meta?.total||"—"}
                    </span>
                    <PeriodSelector period={period} setPeriod={setPeriod} T={T} customRange={customRange} setCustomRange={setCR}/>
                  </div>
                </div>
                {data?(
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data} margin={{top:4,right:4,bottom:0,left:-20}}>
                      <defs>
                        <linearGradient id="pnlg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.lineColor} stopOpacity={0.22}/>
                          <stop offset="100%" stopColor={T.lineColor} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false}/>
                      <XAxis dataKey="d" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Area type="monotone" dataKey="c" stroke={T.lineColor} strokeWidth={2.5} fill="url(#pnlg)" dot={false} name="Cumulative P&L"/>
                    </AreaChart>
                  </ResponsiveContainer>
                ):(
                  <div style={{height:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:B.muted}}>
                    <div style={{fontSize:28}}>📈</div>
                    <div style={{fontSize:12,fontWeight:500}}>No trades yet</div>
                    <div style={{fontSize:11}}>Chart will populate once bots start executing</div>
                  </div>
                )}
              </Card>

              {/* Row: Daily P&L + Category Breakdown */}
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:20,marginBottom:20}}>
                <Card style={{padding:"20px 20px 12px"}}>
                  <CardHeader title="Daily P&L" sub="Per-session result"/>
                  {data?(
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data} barSize={period==="1D"?12:period==="ALL"?28:18} margin={{top:0,right:4,bottom:0,left:-20}}>
                        <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false}/>
                        <XAxis dataKey="d" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                        <YAxis tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Bar dataKey="v" name="Daily P&L" radius={[3,3,0,0]}>
                          {data.map((e,i)=><Cell key={i} fill={e.v>=0?B.green:B.red} fillOpacity={0.75}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ):(
                    <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:B.muted,fontSize:12}}>No sessions recorded yet</div>
                  )}
                </Card>

                {/* Market Category Breakdown */}
                <Card style={{padding:"18px 20px"}}>
                  <CardHeader title="Alpha by Category" sub="Where profit comes from"/>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
                    {categories&&categories.length>0?categories.map((cat,i)=>(
                      <div key={i}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{width:8,height:8,borderRadius:2,background:cat.color,display:"inline-block"}}/>
                            <span style={{fontSize:12,color:B.subtext}}>{cat.name}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:11,color:B.muted}}>{cat.trades} trades</span>
                            <span style={{fontSize:12,fontWeight:600,color:cat.pnl>0?B.green:B.red,minWidth:64,textAlign:"right"}}>{cat.pnl>0?"+":""} ${cat.pnl.toLocaleString()}</span>
                          </div>
                        </div>
                        <div style={{height:5,background:B.surf2,borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:`${(Math.abs(cat.pnl)/12400)*100}%`,height:"100%",borderRadius:3,background:cat.color,opacity:cat.pnl>0?0.8:0.4}}/>
                        </div>
                      </div>
                    )):(<div style={{height:120,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,color:B.muted}}>
                        <div style={{fontSize:20}}>🏷️</div>
                        <div style={{fontSize:12}}>No trades to categorise yet</div>
                      </div>)}
                  </div>
                </Card>
              </div>

              {/* Row: Bot Head-to-Head + Risk Stats */}
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:20,marginBottom:20}}>
                {/* Bot comparison */}
                <Card style={{padding:"20px 20px 12px"}}>
                  <CardHeader title="Bot Comparison" sub="P&L across all strategies" right={
                    <span style={{fontSize:11,color:B.muted}}>Click bot to see trades →</span>
                  }/>
                  {(()=>{
                    const realBotCompare = [0,1,2,3].map(idx=>{
                      const b = getBotData(idx);
                      return {bot:b.name, pnl:b.pnl||0, color:b.color||B.green};
                    });
                    const hasData = realBotCompare.some(b=>b.pnl!==0);
                    return hasData?(
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={realBotCompare} layout="vertical" margin={{top:0,right:20,bottom:0,left:0}}>
                          <CartesianGrid strokeDasharray="2 4" stroke={B.border} horizontal={false}/>
                          <XAxis type="number" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v.toFixed(0)}`}/>
                          <YAxis type="category" dataKey="bot" tick={{fill:B.subtext,fontSize:11}} axisLine={false} tickLine={false} width={90}/>
                          <Tooltip content={<ChartTip/>}/>
                          <Bar dataKey="pnl" name="P&L" radius={[0,4,4,0]}>
                            {realBotCompare.map((e,i)=><Cell key={i} fill={e.pnl>=0?e.color:B.red} fillOpacity={0.8}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ):(
                      <div style={{height:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,color:B.muted}}>
                        <div style={{fontSize:20}}>⚡</div>
                        <div style={{fontSize:12}}>No bot P&L yet</div>
                      </div>
                    );
                  })()}
                </Card>

                {/* Risk stats */}
                <Card style={{padding:"18px 20px"}}>
                  <CardHeader title="Risk Dashboard" sub="Portfolio-wide metrics"/>
                  <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:4}}>
                    {meta?[
                      {label:"Sharpe Ratio", val:meta.sharpe,   good:parseFloat(meta.sharpe)>2,  desc:"Above 2 = excellent"},
                      {label:"Max Drawdown", val:meta.drawdown, good:false,                       desc:"Worst loss from peak"},
                      {label:"Win Rate",     val:`${winRateOverall.toFixed(1)}%`, good:winRateOverall>60, desc:"Trades closed in profit"},
                      {label:"Total Trades", val:meta.trades||allTrades.length, good:true,        desc:"All time"},
                      {label:"Win Streak",   val:`${meta.streak}x`,             good:meta.streak>3,     desc:"Consecutive wins"},
                    ].map((s,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<4?`1px solid ${B.border}`:"none"}}>
                        <div>
                          <div style={{fontSize:12,color:B.subtext}}>{s.label}</div>
                          <div style={{fontSize:10,color:B.dim}}>{s.desc}</div>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",color:s.good?B.green:B.red}}>{s.val}</div>
                      </div>
                    )):(
                      <div style={{padding:"24px 0",textAlign:"center",color:B.muted,fontSize:12}}>
                        <div style={{fontSize:20,marginBottom:8}}>📊</div>
                        Stats available after first closed trades
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Trade Heatmap */}
              <TradeHeatmap/>

              {/* Live Market Feed — real Polymarket data in both demo and live mode */}
              {liveMarkets.length>0&&(
                <Card style={{padding:"20px 24px",marginBottom:20}}>
                  <CardHeader title={mode==="demo"?"📡 Live Polymarket Feed (Demo — Real Data)":"📡 Live Polymarket Markets"} sub="Real prices · Real volumes · No auth needed" right={
                    <span style={{fontSize:10,color:B.green,fontWeight:600}}>● LIVE FEED</span>
                  }/>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{borderBottom:`1px solid ${B.border}`}}>
                          {["Market","YES","NO","24h Vol","Ends"].map(h=>(
                            <th key={h} style={{padding:"6px 12px",fontSize:10,color:B.muted,fontWeight:600,textAlign:h==="Market"?"left":"right",letterSpacing:"0.06em"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liveMarkets.slice(0,8).map((m,i)=>{
                          const tokens = m.tokens||[];
                          const yesP = parseFloat(tokens[0]?.price||0.5);
                          const noP  = parseFloat(tokens[1]?.price||0.5);
                          const vol  = parseFloat(m.volume24hr||0);
                          return (
                            <tr key={i} style={{borderBottom:`1px solid ${B.border}40`}}>
                              <td style={{padding:"10px 12px",fontSize:11,color:B.text,maxWidth:280}}>{(m.question||"").slice(0,60)}{(m.question||"").length>60?"...":""}</td>
                              <td style={{padding:"10px 12px",fontSize:12,fontWeight:700,color:yesP>0.7?B.green:yesP<0.3?B.red:B.subtext,textAlign:"right",fontFamily:"'Syne',sans-serif"}}>{(yesP*100).toFixed(0)}¢</td>
                              <td style={{padding:"10px 12px",fontSize:12,fontWeight:700,color:noP>0.7?B.green:noP<0.3?B.red:B.subtext,textAlign:"right",fontFamily:"'Syne',sans-serif"}}>{(noP*100).toFixed(0)}¢</td>
                              <td style={{padding:"10px 12px",fontSize:11,color:B.muted,textAlign:"right"}}>${vol>1000?`${(vol/1000).toFixed(0)}K`:vol.toFixed(0)}</td>
                              <td style={{padding:"10px 12px",fontSize:10,color:B.dim,textAlign:"right"}}>{m.endDate?(new Date(m.endDate)).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{marginTop:10,fontSize:10,color:B.dim,textAlign:"right"}}>
                    Data from Polymarket public API · Updates every 30s · {liveMarkets.length} markets fetched
                  </div>
                </Card>
              )}

              {/* Copier Comparison */}
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:20,marginTop:20}}>
                <Card style={{padding:"20px 20px 12px"}}>
                  <CardHeader title="Copier Performance" sub="Your P&L from each copied wallet" right={
                    <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:`${T.accentSoft}`,color:T.accentText,fontWeight:600}}>{liveCopyCount} Active {liveCopyCount===1?"Copy":"Copies"}</span>
                  }/>
                  {wallets.filter(w=>w.connectionStatus==="live").length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={wallets.filter(w=>w.connectionStatus==="live").map(w=>({
                        wallet: w.handle?.slice(0,14)||w.address?.slice(0,10),
                        pnl: copyPnlByWallet[w.address]?.pnl || 0,
                        color: w.color||"#10b981",
                        copySize: w.copySize||0,
                      }))} layout="vertical" margin={{top:0,right:20,bottom:0,left:0}}>
                        <CartesianGrid strokeDasharray="2 4" stroke={B.border} horizontal={false}/>
                        <XAxis type="number" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v.toLocaleString()}`}/>
                        <YAxis type="category" dataKey="wallet" tick={{fill:B.subtext,fontSize:10}} axisLine={false} tickLine={false} width={110}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Bar dataKey="pnl" name="Copy P&L" radius={[0,4,4,0]}>
                          {wallets.filter(w=>w.connectionStatus==="live").map((w,i)=><Cell key={i} fill={copyPnlByWallet[w.address]?.pnl>0?B.green:B.border} fillOpacity={0.85}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{height:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:B.muted}}>
                      <div style={{fontSize:24,opacity:0.3}}>📊</div>
                      <div style={{fontSize:12,fontWeight:600}}>No active copies yet</div>
                      <div style={{fontSize:11}}>Go to Copier → Leaderboard to start copying traders</div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:16,marginTop:12,paddingTop:10,borderTop:`1px solid ${B.border}`}}>
                    {[
                      {l:"Copying",       v:`${liveCopyCount} wallet${liveCopyCount!==1?"s":""}`, c:liveCopyCount>0?B.green:B.muted},
                      {l:"Monitoring",    v:`${wallets.filter(w=>w.connectionStatus==="connected").length} wallets`,  c:B.muted},
                      {l:"Total Copy P&L",v:totalCopyPnl!==0?fmt.pnl(totalCopyPnl):wallets.filter(w=>w.connectionStatus==="live").length>0?"$0.00":"—", c:totalCopyPnl>=0?B.green:B.red},
                    ].map((s,i)=>(
                      <div key={i}>
                        <div style={{fontSize:10,color:B.dim,letterSpacing:"0.06em",textTransform:"uppercase"}}>{s.l}</div>
                        <div style={{fontSize:13,fontWeight:700,color:s.c,fontFamily:"'Syne',sans-serif"}}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card style={{padding:"18px 20px"}}>
                  <CardHeader title="Copier Intelligence" sub={wallets.filter(w=>w.connectionStatus==="live").length>0?"Live copy analytics":"Start copying to see analytics"}/>
                  <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:4}}>
                    {wallets.filter(w=>w.connectionStatus==="live").length > 0 ? (
                      wallets.filter(w=>w.connectionStatus==="live").map((w,i,arr)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<arr.length-1?`1px solid ${B.border}`:"none"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:w.color||B.green,flexShrink:0}}/>
                            <div>
                              <div style={{fontSize:11,color:B.subtext,fontWeight:600}}>{w.handle||w.address?.slice(0,12)}</div>
                              <div style={{fontSize:10,color:B.dim}}>{(w.copySize*100).toFixed(0)}% copy · max ${w.maxUsd}</div>
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            {copyPnlByWallet[w.address]!=null?(
                              <div style={{fontSize:12,fontWeight:700,color:copyPnlByWallet[w.address].pnl>0?B.green:copyPnlByWallet[w.address].pnl===0?B.muted:B.red,fontFamily:"'Syne',sans-serif"}}>
                                {copyPnlByWallet[w.address].pnl>0?"+":""}{fmt.usd(copyPnlByWallet[w.address].pnl)}
                              </div>
                            ):(
                              <div style={{fontSize:11,color:B.dim}}>No trades yet</div>
                            )}
                            <div style={{fontSize:10,color:B.dim}}>{w.winRate?`${w.winRate}% win`:"—"}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{padding:"32px 0",textAlign:"center",color:B.muted}}>
                        <div style={{fontSize:22,marginBottom:8,opacity:0.3}}>🤖</div>
                        <div style={{fontSize:11}}>No active copies</div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

            </div>
          )}

          {/* ── BOTS ── */}
          {page==="bots"&&(
            <div className="in">

              {/* Header row with Add Bot button */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
                <div style={{fontSize:11,color:B.muted,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:allTrades.length>0?B.green:B.muted,display:"inline-block"}}/>
                  {tradesLoading?"Fetching trade data..." : allTrades.length>0 ? `${allTrades.length} real trades loaded · click any bot to view log` : "No trades yet — click a bot to see its log"}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {tradesLoading&&<span style={{fontSize:10,color:B.amber,animation:"pulse 1s infinite"}}>↻ syncing</span>}
                  <button onClick={()=>setShowAddBotModal(true)}
                    style={{padding:"7px 14px",fontSize:11,fontWeight:700,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,cursor:"pointer",fontFamily:"'Outfit',sans-serif",display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:14,lineHeight:1}}>+</span> Add Bot
                  </button>
                </div>
              </div>

              {/* Bot cards — real data + dynamic registry */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
                {botsRegistry.slice(0,Math.min(botsRegistry.length, 6)).map((base, idx)=>{
                  const b = idx < 4 ? getBotData(Math.min(idx, 3)) : base;
                  const hasAlloc = (botAllocations[base.id]||0) > 0;
                  return (
                    <div key={base.id} style={{position:"relative"}}>
                      <div className="bot-card" onClick={()=>setBot({...b,...base})}
                        style={{background:B.surf,border:`1px solid ${!hasAlloc&&base.status!=="planned"?`${B.amber}40`:B.border}`,borderRadius:14,padding:0,borderTop:`3px solid ${base.color}`,cursor:"pointer",position:"relative",overflow:"hidden"}}>

                        {/* No-allocation warning — strip inside card */}
                        {!hasAlloc && base.status !== "planned" && (
                          <div style={{background:`${B.amber}12`,borderBottom:`1px solid ${B.amber}25`,padding:"5px 16px",display:"flex",alignItems:"center",gap:5}}>
                            <span style={{fontSize:9,color:B.amber,fontWeight:700,letterSpacing:"0.04em"}}>⚠ NO FUNDS ALLOCATED</span>
                          </div>
                        )}
                        <div style={{padding:"18px 20px"}}>

                        {/* Remove button */}
                        <button onClick={e=>{e.stopPropagation(); if(window.confirm(`Remove "${base.name}" from registry?`)){setBotsRegistry(prev=>prev.filter(bot=>bot.id!==base.id));setBotAllocations(prev=>{const n={...prev};delete n[base.id];return n;});}}}
                          style={{position:"absolute",top:10,right:10,width:22,height:22,borderRadius:6,background:`${B.red}15`,border:`1px solid ${B.red}30`,color:B.red,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5,lineHeight:1,fontWeight:700}}
                          title="Remove bot">×</button>

                        {/* Live pulse */}
                        {(base.status==="live"||base.status==="paper")&&(
                          <div style={{position:"absolute",top:12,right:38,width:7,height:7,borderRadius:"50%",background:B.green,animation:"pulse 2s infinite"}}/>
                        )}

                        <div style={{marginBottom:12,paddingRight:24}}>
                          <div className="head" style={{fontWeight:700,fontSize:14,color:B.text,marginBottom:3}}>{base.name}</div>
                          <div style={{fontSize:11,color:B.muted}}>{base.strategy}</div>
                        </div>

                        <StatusBadge status={base.status}/>

                        <div style={{marginTop:14,marginBottom:4}}>
                          <div className="num" style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:(b.pnl||0)>=0?B.green:B.red}}>{fmt.pnl(b.pnl||0)}</div>
                          <div style={{fontSize:11,color:B.muted,marginTop:2}}>{fmt.pct(b.pct||0)} return · {fmt.num(b.tradesToday||0)} today</div>
                        </div>

                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:14}}>
                          {[
                            ["Win",    `${b.win||0}%`,   (b.win||0)>70?B.green:(b.win||0)>50?B.amber:B.red],
                            ["Trades", fmt.num(b.trades||0), B.subtext],
                            ["Ping",   fmt.ms(b.ping||0), (b.ping||0)<20?B.green:(b.ping||0)<50?B.amber:B.red],
                          ].map(([l,v,c])=>(
                            <div key={l} style={{background:B.surf2,borderRadius:8,padding:"8px 10px",border:`1px solid ${B.border}`}}>
                              <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:3,textTransform:"uppercase",fontWeight:600}}>{l}</div>
                              <div className="num" style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                            </div>
                          ))}
                        </div>

                        {hasAlloc && (
                          <div style={{marginTop:10,fontSize:10,color:B.green,display:"flex",alignItems:"center",gap:4}}>
                            <span style={{width:5,height:5,borderRadius:"50%",background:B.green,display:"inline-block"}}/>
                            ${(botAllocations[base.id]||0).toLocaleString()} allocated
                          </div>
                        )}

                        <div style={{marginTop:10,fontSize:11,color:T.accentText,display:"flex",alignItems:"center",gap:5}}>
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M9 18l6-6-6-6"/></svg>
                          View trade log
                        </div>
                        </div>{/* end inner padding div */}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All bots table — real data */}
              <Card style={{overflow:"hidden"}}>
                <div style={{padding:"16px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div className="head" style={{fontSize:13,fontWeight:600,color:B.text}}>All Bots</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:11,color:B.muted}}>{botsRegistry.length} strategies</span>
                    {allTrades.length>0&&<span style={{fontSize:10,background:B.greenSoft,color:B.green,borderRadius:6,padding:"2px 8px",fontWeight:700}}>Real data</span>}
                  </div>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${B.border}`}}>
                      {["Strategy","Status","P&L","Win Rate","Trades","Alloc",""].map(h=>(
                        <th key={h} style={{padding:"10px 18px",textAlign:"left",fontSize:10,color:B.muted,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {botsRegistry.map((base,idx)=>{
                      const b = idx < 4 ? getBotData(Math.min(idx,3)) : base;
                      const hasAlloc = (botAllocations[base.id]||0) > 0;
                      return (
                        <tr key={base.id} className="bot-row" onClick={()=>setBot({...b,...base})}
                          style={{borderBottom:idx<botsRegistry.length-1?`1px solid ${B.border}`:"none",background:!hasAlloc&&base.status!=="planned"?`${B.amber}04`:"transparent"}}>
                          <td style={{padding:"13px 18px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:30,height:30,borderRadius:8,background:`${base.color}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${base.color}25`}}>
                                <div style={{width:8,height:8,borderRadius:"50%",background:base.color}}/>
                              </div>
                              <div>
                                <div style={{fontWeight:600,fontSize:13,color:B.text}}>{base.name}</div>
                                <div style={{fontSize:10,color:B.muted,marginTop:1}}>{base.strategy}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:"13px 18px"}}><StatusBadge status={base.status}/></td>
                          <td style={{padding:"13px 18px"}}>
                            <div className="num" style={{fontWeight:700,fontSize:13,color:(b.pnl||0)>=0?B.green:B.red}}>{fmt.pnl(b.pnl||0)}</div>
                            <div style={{fontSize:10,color:B.muted,marginTop:1}}>{fmt.pct(b.pct||0)}</div>
                          </td>
                          <td style={{padding:"13px 18px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:56,height:4,background:B.surf2,borderRadius:2,overflow:"hidden"}}>
                                <div style={{width:`${Math.min(100,b.win||0)}%`,height:"100%",borderRadius:2,background:(b.win||0)>70?B.green:(b.win||0)>50?B.amber:B.red,transition:"width 0.5s"}}/>
                              </div>
                              <span className="num" style={{fontSize:12,color:B.subtext,fontWeight:600}}>{fmt.pct(b.win||0,1)}</span>
                            </div>
                          </td>
                          <td style={{padding:"13px 18px"}}>
                            <div className="num" style={{fontSize:13,color:B.subtext,fontWeight:600}}>{fmt.num(b.trades||0)}</div>
                            {(b.tradesToday||0)>0&&<div style={{fontSize:10,color:T.accentText,marginTop:1}}>{b.tradesToday} today</div>}
                          </td>
                          <td style={{padding:"13px 18px"}}>
                            {(botAllocations[base.id]||0) > 0
                              ? <span className="num" style={{fontSize:12,color:B.green,fontWeight:700}}>${(botAllocations[base.id]).toLocaleString()}</span>
                              : <span style={{fontSize:11,color:B.amber}}>⚠ None</span>}
                          </td>
                          <td style={{padding:"13px 18px"}}>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:11,color:T.accentText,display:"flex",alignItems:"center",gap:3}}>→ Log</span>
                              <button onClick={e=>{e.stopPropagation();if(window.confirm(`Remove "${base.name}"?`)){setBotsRegistry(prev=>prev.filter(bot=>bot.id!==base.id));setBotAllocations(prev=>{const n={...prev};delete n[base.id];return n;});}}}
                                style={{padding:"2px 7px",background:`${B.red}12`,border:`1px solid ${B.red}25`,borderRadius:5,color:B.red,fontSize:10,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>Remove</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}


          {/* ── EXECUTION ── */}
          {page==="exec"&&(
            <div className="in">

              {/* Data source badge */}
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:18,fontSize:11,color:B.muted}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:execStats?B.green:B.muted,display:"inline-block"}}/>
                {execStats
                  ? `${execStats.total} real trades · exec stats from orchestrator`
                  : "No trade data yet — showing simulated latency"}
              </div>

              {/* KPI row — real stats */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:24}}>
                {[
                  {label:"Avg Ping",     val:fmt.ms(avgPing),                                          good:avgPing<20},
                  {label:"Avg Exec",     val:execStats ? fmt.ms(execStats.avg)    : "—",               good:execStats ? execStats.avg<50 : true},
                  {label:"API Rate",     val:`${apiRate}/500`,                                          good:apiRate<420},
                  {label:"Fastest",      val:execStats ? fmt.ms(execStats.fastest) : "—",              good:true},
                  {label:"Failed",       val:execStats ? fmt.num(execStats.failed) : "0",              good:execStats ? execStats.failed===0 : true},
                ].map((k,i)=>(
                  <Card key={i} style={{padding:"16px 18px"}}>
                    <div style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",marginBottom:10,textTransform:"uppercase",fontWeight:600}}>{k.label}</div>
                    <div className="num" style={{fontSize:22,fontWeight:700,color:k.good?B.text:B.red,letterSpacing:"-0.02em"}}>{k.val}</div>
                  </Card>
                ))}
              </div>

              {/* Charts row */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
                {[
                  {title:"Execution Speed (ms)",    color:T.lineColor,   dataKey:"ms", data:latencyData||[]},
                  {title:"Exec Distribution (ms)",  color:T.accentText,  dataKey:"ms", data:latencyData||[]},
                ].map((ch,ci)=>(
                  <Card key={ci} style={{padding:"20px 20px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontSize:13,fontWeight:600}}>{ch.title}</div>
                      {execStats&&<span style={{fontSize:10,color:B.green,fontWeight:600}}>● real</span>}
                    </div>
                    {ch.data.length===0?(
                      <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:B.muted,fontSize:12}}>No execution data yet</div>
                    ):(
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={ch.data} margin={{top:4,right:4,bottom:0,left:-20}}>
                        <defs>
                          <linearGradient id={`eg${ci}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ch.color} stopOpacity={0.18}/>
                            <stop offset="100%" stopColor={ch.color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false}/>
                        <XAxis dataKey="t" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Area type="monotone" dataKey={ch.dataKey} stroke={ch.color} strokeWidth={2} fill={`url(#eg${ci})`} dot={false} name={ch.title}/>
                      </AreaChart>
                    </ResponsiveContainer>
                    )}
                    {execStats&&(
                      <div style={{display:"flex",gap:16,marginTop:10,paddingTop:8,borderTop:`1px solid ${B.border}`}}>
                        {[
                          {l:"P50", v:fmt.ms(execStats.avg)},
                          {l:"P95", v:fmt.ms(execStats.p95||execStats.avg)},
                          {l:"Max", v:fmt.ms(execStats.slowest)},
                        ].map((s,i)=>(
                          <div key={i}>
                            <div style={{fontSize:9,color:B.dim,letterSpacing:"0.06em",textTransform:"uppercase"}}>{s.l}</div>
                            <div className="num" style={{fontSize:12,fontWeight:700,color:B.subtext}}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* API Rate + Trade log */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:20}}>
                <Card style={{padding:"20px 24px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>API Rate Limit</div>
                      <div style={{fontSize:11,color:B.muted}}>Polymarket CLOB{liveData?` · live`:" · simulated"}</div>
                    </div>
                    <span className="num" style={{fontSize:20,fontWeight:700,color:apiRate>420?B.red:apiRate>320?B.amber:B.green}}>
                      {apiRate}<span style={{fontSize:13,color:B.muted,fontWeight:400}}>/500</span>
                    </span>
                  </div>
                  <div style={{height:8,background:B.surf2,borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:4,transition:"width 0.8s ease",width:`${(apiRate/500)*100}%`,
                      background:apiRate>420?`linear-gradient(90deg,${B.amber},${B.red})`:apiRate>320?`linear-gradient(90deg,${B.green},${B.amber})`:`linear-gradient(90deg,${T.accent},${B.green})`}}/>
                  </div>
                  <div style={{marginTop:8,fontSize:11,color:apiRate>420?B.amber:B.muted}}>
                    {apiRate>420?"⚠ High utilization":`${500-apiRate} requests available this minute`}
                  </div>
                  {execStats&&(
                    <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[
                        {l:"Total Trades",  v:fmt.num(execStats.total),  c:B.text},
                        {l:"Failed",        v:fmt.num(execStats.failed), c:execStats.failed>0?B.red:B.green},
                        {l:"Avg Exec",      v:fmt.ms(execStats.avg),     c:execStats.avg<50?B.green:B.amber},
                        {l:"Fastest",       v:fmt.ms(execStats.fastest), c:B.green},
                      ].map((s,i)=>(
                        <div key={i} style={{background:B.surf2,borderRadius:6,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{s.l}</div>
                          <div className="num" style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Recent trade execution log */}
                <Card style={{padding:"20px",overflow:"hidden"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontSize:13,fontWeight:600}}>Recent Executions</div>
                    {allTrades.length>0
                      ? <span style={{fontSize:10,background:B.greenSoft,color:B.green,borderRadius:6,padding:"2px 8px",fontWeight:700}}>● real</span>
                      : <span style={{fontSize:10,color:B.muted}}>no data yet</span>}
                  </div>
                  <div style={{overflowY:"auto",maxHeight:200}}>
                    {allTrades.length===0?(
                      <div style={{padding:"24px",textAlign:"center",color:B.muted,fontSize:12}}>
                        No executions yet — trades will appear here once bots are live
                      </div>
                    ):allTrades.slice(0,8).map((t,i)=>{
                      const ms = t.execMs;
                      const msColor = !ms ? B.muted : ms<30?B.green:ms<60?B.amber:B.red;
                      return (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<7?`1px solid ${B.border}`:"none"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,color:B.subtext,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(t.market||t.question||"Trade").slice(0,40)}</div>
                            <div style={{fontSize:10,color:B.dim,marginTop:1,fontFamily:"'JetBrains Mono',monospace"}}>
                              {t.bot||"bot"} · {(t.time||t.created_at||"").toString().slice(0,16)}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0,marginLeft:10}}>
                            <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,
                              background:(t.side||"")=="YES"?B.greenSoft:B.redSoft,
                              color:(t.side||"")=="YES"?B.green:B.red,fontWeight:700}}>
                              {t.side||"—"}
                            </span>
                            <span className="num" style={{fontSize:12,fontWeight:700,color:msColor,minWidth:44,textAlign:"right"}}>
                              {ms ? fmt.ms(ms) : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

            </div>
          )}

          {/* ── FUNDS ── */}
          {page==="funds"&&(<div className="in"><FundsTab mode={mode} demoBalance={demoBalance} setDemoBalance={setDemoBalance} demoTxns={demoTxns} setDemoTxns={setDemoTxns} demoAllocated={demoAllocated} walletBalance={walletBalance} walletAddress={walletAddress} liveData={liveData} botsRegistry={botsRegistry} botAllocations={botAllocations} setBotAllocations={setBotAllocations}/></div>)}

          {/* ── STRATEGIES ── */}
          {page==="strategies"&&(
            <div className="in">
              {/* Header stats — dynamic */}
              {(()=>{
                const allS=STRATEGY_TIERS.flatMap(t=>t.strategies);
                const nBuilt=allS.filter(s=>s.status==="built").length;
                const nDev=allS.filter(s=>s.status==="in_dev").length;
                const nPlan=allS.filter(s=>s.status==="planned").length;
                return (
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
                {[
                  {label:"Total Strategies", val:allS.length, sub:"In the strategy bible",     color:T.accentText},
                  {label:"Bots Built",        val:nBuilt,      sub:"Live or paper trading",     color:B.green},
                  {label:"In Development",    val:nDev,        sub:"Being built now",           color:B.amber},
                  {label:"On the Roadmap",    val:nPlan,       sub:"Planned for future phases", color:B.muted},
                ].map((k,i)=>(
                  <Card key={i} style={{padding:"18px 20px"}}>
                    <div style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",marginBottom:10,textTransform:"uppercase"}}>{k.label}</div>
                    <div style={{fontSize:28,fontWeight:700,fontFamily:"'Syne',sans-serif",color:k.color,letterSpacing:"-0.02em",lineHeight:1,marginBottom:6}}>{k.val}</div>
                    <div style={{fontSize:11,color:B.muted}}>{k.sub}</div>
                  </Card>
                ))}
                </div>
                );
              })()}

              {/* Filter pills */}
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                {["all","built","in_dev","planned"].map(f=>(
                  <button key={f} onClick={()=>setStratFilter(f)} style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:600,border:`1px solid`,cursor:"pointer",
                    borderColor:stratFilter===f?T.accentBorder:B.border,
                    background:stratFilter===f?T.accentSoft:"transparent",
                    color:stratFilter===f?T.accentText:B.muted,
                    letterSpacing:"0.04em",textTransform:"capitalize",transition:"all 0.2s"
                  }}>
                    {{all:"All Strategies",built:"✅ Built",in_dev:"🔧 In Dev",planned:"📋 Planned"}[f]}
                  </button>
                ))}
              </div>

              {/* Tier sections */}
              {STRATEGY_TIERS.map((tier,ti)=>{
                const filtered = tier.strategies.filter(s=> stratFilter==="all" || s.status===stratFilter);
                if(filtered.length===0) return null;
                return (
                  <div key={ti} style={{marginBottom:28}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <div style={{width:4,height:20,borderRadius:2,background:tier.color}}/>
                      <div style={{fontSize:12,fontWeight:700,color:tier.color,letterSpacing:"0.06em",textTransform:"uppercase"}}>{tier.tier}</div>
                      <div style={{flex:1,height:1,background:B.border}}/>
                      <div style={{fontSize:11,color:B.muted}}>{filtered.length} strategies</div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
                      {filtered.map((s,si)=>{
                        const isBuilt   = s.status==="built";
                        const isInDev   = s.status==="in_dev";
                        const isPlanned = s.status==="planned";
                        const statusConf = {
                          built:   {label:"✅ Built",   bg:B.greenSoft, color:B.green, border:B.greenBorder},
                          in_dev:  {label:"🔧 In Dev",  bg:B.amberSoft, color:B.amber, border:`${B.amber}30`},
                          planned: {label:"📋 Planned", bg:B.surf2,     color:B.dim,   border:B.border},
                        }[s.status] || {label:s.status, bg:B.surf2, color:B.muted, border:B.border};

                        // Check if this strategy's bot is actually live on VPS
                        const botStates  = liveData?.portfolio?.bot_states || {};
                        const botKeyLookup = {
                          "polydesk_bond_bot.py":          "bond_bot",
                          "polydesk_maker_rebates_bot.py": "rebates_bot",
                          "maker_rebates_bot.py":          "rebates_bot",
                          "polydesk_btc5m_bot.py":         "btc5m_bot",
                        };
                        const vpsKey     = botKeyLookup[s.botName];
                        const vpsState   = vpsKey ? botStates[vpsKey] : null;
                        const isRunning  = vpsState?.status === "paper" || vpsState?.status === "live";
                        const scanCount  = vpsState?.scan_count || 0;
                        return (
                          <div key={si} onClick={()=>setSelectedStrategy({...s, tierColor:tier.color, tierName:tier.tier})}
                            style={{
                            background:isBuilt?`rgba(16,185,129,0.04)`:B.surf,
                            border:`1px solid ${isBuilt?`${tier.color}45`:isInDev?"rgba(245,158,11,0.1)":B.border}`,
                            borderRadius:10,padding:"14px 16px",
                            opacity:isPlanned?0.45:isInDev?0.65:1,
                            filter:isPlanned?"grayscale(0.5)":isInDev?"grayscale(0.2)":"none",
                            boxShadow:isBuilt?`0 0 18px rgba(16,185,129,0.08)`:"none",
                            transition:"all 0.2s",cursor:"pointer",
                            position:"relative",overflow:"hidden",
                          }}>
                            {isBuilt&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${tier.color},transparent)`}}/>}
                            {isBuilt&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:`linear-gradient(180deg,${tier.color},transparent)`}}/>}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                              <div style={{fontSize:13,fontWeight:isBuilt?700:600,color:isBuilt?B.text:isInDev?"rgba(148,163,184,0.7)":"rgba(100,116,139,0.5)",paddingRight:8}}>{s.name}</div>
                              <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
                                <span style={{fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:20,background:statusConf.bg,color:statusConf.color,border:`1px solid ${statusConf.border}`}}>{statusConf.label}</span>
                                {isRunning&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,background:B.greenSoft,color:B.green,border:`1px solid ${B.greenBorder}`,display:"flex",alignItems:"center",gap:4}}>
                                  <span style={{width:4,height:4,borderRadius:"50%",background:B.green,display:"inline-block",animation:"pulse 2s infinite"}}/>VPS LIVE{scanCount>0?` · #${scanCount}`:""}
                                </span>}
                              </div>
                            </div>
                            <div style={{fontSize:11,color:isBuilt?B.muted:isInDev?"rgba(100,116,139,0.6)":"rgba(71,85,105,0.5)",marginBottom:10,lineHeight:1.5}}>{s.desc}</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                              <div style={{background:B.bg,borderRadius:6,padding:"6px 8px"}}>
                                <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:2,textTransform:"uppercase"}}>Return</div>
                                <div style={{fontSize:11,fontWeight:600,color:isBuilt?B.green:isInDev?"rgba(100,116,139,0.5)":B.dim}}>{s.return}</div>
                              </div>
                              <div style={{background:B.bg,borderRadius:6,padding:"6px 8px"}}>
                                <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:2,textTransform:"uppercase"}}>Bot / Ref</div>
                                <div style={{fontSize:10,fontWeight:500,color:isBuilt?T.accentText:"rgba(71,85,105,0.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.botName}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Maker Rebates deep-dive card */}
              <Card style={{padding:"22px 24px",marginTop:8,border:`1px solid rgba(245,158,11,0.2)`,background:"rgba(245,158,11,0.03)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:B.amber}}>🔧 Maker Rebates Bot — Preview</div>
                    <div style={{fontSize:11,color:B.muted,marginTop:2}}>Zero directional risk · Post limit orders only · Earn rebates on every fill</div>
                  </div>
                  <span style={{fontSize:11,padding:"4px 10px",background:"rgba(245,158,11,0.1)",color:B.amber,borderRadius:20,border:"1px solid rgba(245,158,11,0.25)",fontWeight:600}}>In Development</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
                  {[{l:"Target Markets",v:"100+",c:B.text},{l:"Est. Daily Rebates",v:"$300–1,500",c:B.green},{l:"Directional Risk",v:"ZERO",c:B.green}].map((s,i)=>(
                    <div key={i} style={{background:B.bg,borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:4,textTransform:"uppercase"}}>{s.l}</div>
                      <div style={{fontSize:14,fontWeight:700,color:s.c,fontFamily:"'Syne',sans-serif"}}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{borderBottom:`1px solid ${B.border}`}}>
                      {["Market","Spread","Daily Vol","Orders","Daily Rebate","Status"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:B.muted,fontWeight:500,letterSpacing:"0.04em"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {REBATE_MARKETS.map((m,i)=>(
                        <tr key={i} style={{borderBottom:i<REBATE_MARKETS.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
                          <td style={{padding:"10px 12px",color:B.subtext,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.market}</td>
                          <td style={{padding:"10px 12px",color:B.green,fontWeight:600}}>{(m.spread*100).toFixed(0)}¢</td>
                          <td style={{padding:"10px 12px",color:B.muted}}>${(m.volume/1000).toFixed(0)}K</td>
                          <td style={{padding:"10px 12px",color:B.muted}}>{m.myOrders} sides</td>
                          <td style={{padding:"10px 12px",color:B.green,fontWeight:600}}>+${m.dailyRebate}</td>
                          <td style={{padding:"10px 12px"}}><StatusBadge status={m.status}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:12,fontSize:11,color:B.dim,padding:"8px 12px",background:B.bg,borderRadius:6}}>
                  💡 Projected daily total: <span style={{color:B.green,fontWeight:700}}>$156 in rebates</span> + <span style={{color:T.accentText,fontWeight:700}}>$0 in fees</span>. Scale to 200 markets = $300–600/day with zero directional exposure.
                </div>
              </Card>
            </div>
          )}

          {/* ── COPIER ── */}
          {page==="copier"&&(
            <div className="in">

              {/* Header with view toggle */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                <div>
                  <div style={{fontSize:20,fontWeight:700,fontFamily:"'Syne',sans-serif",letterSpacing:"-0.02em"}}>Wallet Intelligence</div>
                  <div style={{fontSize:12,color:B.muted,marginTop:4}}>Browse top traders · click to copy · or add any wallet address</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:B.green,boxShadow:`0 0 6px ${B.green}`}}/>
                  <span style={{fontSize:11,color:B.green,fontWeight:600}}>{liveCopyCount} COPYING LIVE</span>
                  {/* View toggle */}
                  <div style={{display:"flex",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,overflow:"hidden",marginLeft:8}}>
                    {[{id:"leaderboard",label:"🏆 Leaderboard"},{id:"wallets",label:"👛 My Wallets"}].map(v=>(
                      <button key={v.id} onClick={()=>setLbView(v.id)} style={{padding:"6px 14px",fontSize:11,fontWeight:lbView===v.id?700:400,background:lbView===v.id?T.accentSoft:"transparent",color:lbView===v.id?T.accentText:B.muted,border:"none",cursor:"pointer",borderRight:`1px solid ${B.border}`,fontFamily:"'Outfit',sans-serif",transition:"all 0.15s"}}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── LEADERBOARD VIEW ── */}
              {lbView==="leaderboard"&&(
                <div>
                  {/* Top Traders Grid */}
                  <Card style={{padding:0,marginBottom:20,overflow:"hidden"}}>
                    <div style={{padding:"16px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600}}>Top 20 Traders</div>
                        <div style={{fontSize:11,color:B.muted,marginTop:2}}>Live from Polymarket leaderboard · click any trader to view details</div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {lbLoading&&<span style={{fontSize:10,color:B.amber,animation:"pulse 1s infinite"}}>↻ fetching</span>}
                        <button onClick={fetchLeaderboard} style={{padding:"5px 12px",fontSize:11,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:6,color:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>↻ Refresh</button>
                      </div>
                    </div>

                    {lbLoading ? (
                      <div style={{padding:"48px",textAlign:"center"}}>
                        <div style={{fontSize:24,marginBottom:12,animation:"pulse 1s infinite"}}>⟳</div>
                        <div style={{fontSize:13,color:B.muted}}>Fetching live leaderboard from Polymarket…</div>
                      </div>
                    ) : lbTraders.length === 0 ? (
                      <div style={{padding:"56px 32px",textAlign:"center"}}>
                        <div style={{fontSize:36,marginBottom:14,opacity:0.4}}>📡</div>
                        <div style={{fontSize:14,fontWeight:600,color:B.subtext,marginBottom:8}}>Leaderboard Unavailable</div>
                        <div style={{fontSize:12,color:B.muted,maxWidth:320,margin:"0 auto 20px"}}>
                          Connect your orchestrator at <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.accentText}}>api.gurbcapital.com</span> to see live Polymarket top traders.
                        </div>
                        <button onClick={fetchLeaderboard} style={{padding:"9px 20px",fontSize:12,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                          ↻ Retry Connection
                        </button>
                      </div>
                    ) : (
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:0}}>
                        {lbTraders.slice(0,20).map((trader,i)=>(
                          <LeaderboardCard key={i} trader={trader} rank={i+1}
                            selected={lbSelected?.proxy_wallet===trader.proxy_wallet||lbSelected?.name===trader.name}
                            onSelect={()=>{ setLbSelected(trader); fetchTraderActivity(trader.proxy_wallet||trader.address); }}
                            onCopy={()=>openCopyModal(trader)}
                            copying={lbCopyingId===(trader.proxy_wallet||trader.address)}
                            isLive={wallets.some(w=>w.address===(trader.proxy_wallet||trader.address)&&w.connectionStatus==="live")}
                            B={B} T={T}/>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Trader Detail Panel */}
                  {lbSelected&&(
                    <Card style={{padding:"20px 24px",marginBottom:20,border:`1px solid ${T.accentBorder}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
                        <div style={{display:"flex",alignItems:"center",gap:14}}>
                          <div style={{width:42,height:42,borderRadius:12,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🐋</div>
                          <div>
                            <div style={{fontSize:15,fontWeight:700,color:B.text}}>{lbSelected.name||lbSelected.proxy_wallet?.slice(0,12)}</div>
                            <div style={{fontSize:10,color:B.muted,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{(lbSelected.proxy_wallet||"").slice(0,18)}...</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>openCopyModal(lbSelected)}
                            disabled={lbCopyingId!=null || wallets.some(w=>w.address===(lbSelected.proxy_wallet||lbSelected.address)&&w.connectionStatus==="live")}
                            style={{padding:"9px 18px",fontSize:12,fontWeight:700,background:wallets.some(w=>w.address===(lbSelected.proxy_wallet||lbSelected.address)&&w.connectionStatus==="live")?B.greenSoft:T.accentSoft,border:`1px solid ${wallets.some(w=>w.address===(lbSelected.proxy_wallet||lbSelected.address)&&w.connectionStatus==="live")?B.green:T.accentBorder}`,borderRadius:8,color:wallets.some(w=>w.address===(lbSelected.proxy_wallet||lbSelected.address)&&w.connectionStatus==="live")?B.green:T.accentText,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                            {wallets.some(w=>w.address===(lbSelected.proxy_wallet||lbSelected.address)&&w.connectionStatus==="live")?"✓ Copying Live":lbCopyingId?"Starting...":"▶ Start Copying"}
                          </button>
                          <button onClick={()=>setLbSelected(null)} style={{padding:"9px 14px",fontSize:12,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,color:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>✕</button>
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:20}}>
                        {[
                          {label:"All-time P&L", val:lbSelected.pnl_usd!=null?`$${(lbSelected.pnl_usd/1000).toFixed(0)}K`:"—", color:B.green},
                          {label:"Win Rate",     val:lbSelected.win_rate!=null?`${lbSelected.win_rate}%`:"—", color:(lbSelected.win_rate||0)>60?B.green:B.amber},
                          {label:"Total Trades", val:lbSelected.num_trades!=null?lbSelected.num_trades.toLocaleString():"—", color:B.subtext},
                          {label:"Rank",         val:`#${lbSelected.rank||"—"}`, color:T.accentText},
                          {label:"Avg Size",     val:lbSelected.avg_size_usd?`$${lbSelected.avg_size_usd}`:lbSelected.average_position_size||"—", color:B.muted},
                        ].map((s,i)=>(
                          <div key={i} style={{background:B.surf2,borderRadius:8,padding:"12px 14px",border:`1px solid ${B.border}`}}>
                            <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:4,textTransform:"uppercase",fontWeight:600}}>{s.label}</div>
                            <div style={{fontSize:15,fontWeight:700,color:s.color,fontFamily:"'Syne',sans-serif"}}>{s.val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Live Activity Feed */}
                      <div>
                        <div style={{fontSize:12,fontWeight:600,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                          Live Activity Feed
                          {lbActivityLoading&&<span style={{fontSize:10,color:B.amber,animation:"pulse 1s infinite"}}>↻ fetching</span>}
                          {!lbActivityLoading&&<span style={{fontSize:10,color:B.muted}}>{lbActivity.length} recent trades</span>}
                          <button onClick={()=>fetchTraderActivity(lbSelected.proxy_wallet||lbSelected.address)} style={{padding:"2px 8px",fontSize:10,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:5,color:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif",marginLeft:"auto"}}>Refresh</button>
                        </div>
                        {lbActivity.length===0&&!lbActivityLoading?(
                          <div style={{padding:"28px",textAlign:"center",color:B.muted,fontSize:11,background:B.surf2,borderRadius:8}}>
                            <div style={{fontSize:22,marginBottom:8,opacity:0.4}}>📭</div>
                            <div style={{fontWeight:600,marginBottom:4}}>No activity data available</div>
                            <div style={{fontSize:10}}>Orchestrator must be online to pull live trade history</div>
                          </div>
                        ):(
                          <div style={{display:"flex",flexDirection:"column",gap:0,maxHeight:280,overflowY:"auto",border:`1px solid ${B.border}`,borderRadius:8,overflow:"hidden"}}>
                            {lbActivity.slice(0,12).map((act,i)=>{
                              const side = act.outcome||act.side||act.type||"YES";
                              const sideColor = side==="YES"||side==="BUY"?B.green:side==="NO"||side==="SELL"?B.red:B.purple;
                              const market = act.title||act.market||act.market_slug||"Trade";
                              const price = act.price!=null?parseFloat(act.price):null;
                              const size = act.size||act.amount||act.usdc_amount||null;
                              return (
                                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderBottom:i<11?`1px solid ${B.border}`:"none",background:i%2===0?"transparent":`${B.surf2}40`}}>
                                  <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:`${sideColor}15`,color:sideColor,fontWeight:700,flexShrink:0}}>{side}</span>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:11,color:B.subtext,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{market.slice(0,55)}{market.length>55?"...":""}</div>
                                  </div>
                                  <div style={{display:"flex",gap:10,flexShrink:0,alignItems:"center"}}>
                                    {price!=null&&<span style={{fontSize:11,fontWeight:600,color:B.subtext,fontFamily:"'JetBrains Mono',monospace"}}>{(price*100).toFixed(0)}¢</span>}
                                    {size!=null&&<span style={{fontSize:11,color:B.muted}}>${parseFloat(size).toLocaleString()}</span>}
                                    <span style={{fontSize:10,color:B.dim}}>{act.timestamp||act.created_at?.slice(11,16)||"—"}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ── MY WALLETS VIEW ── */}
              {lbView==="wallets"&&(
                <div>
              <Card style={{padding:"20px 24px",marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Add a Wallet</div>
                <div style={{fontSize:11,color:B.muted,marginBottom:16}}>
                  Paste any Polymarket wallet address or username. We'll fetch their history, detect their strategy, and configure copy settings automatically.
                </div>

                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <input
                      value={addWalletInput}
                      onChange={e=>setAddWalletInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&!addWalletLoading&&addWalletInput.trim()&&handleAddWallet()}
                      placeholder="0x... wallet address or Polymarket username"
                      style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"11px 14px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif",boxSizing:"border-box"}}
                    />
                    {addWalletResult&&(
                      <div style={{marginTop:10,padding:"12px 16px",borderRadius:8,background:addWalletResult.ok?`${B.green}08`:`${B.red}08`,border:`1px solid ${addWalletResult.ok?`${B.green}25`:`${B.red}25`}`}}>
                        {addWalletResult.ok?(
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                              <span style={{fontSize:16}}>✅</span>
                              <span style={{fontSize:12,fontWeight:600,color:B.green}}>Wallet found — {addWalletResult.handle}</span>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                              {[
                                {label:"All-time P&L",  val:addWalletResult.pnl!=null?`$${(addWalletResult.pnl/1000).toFixed(0)}K`:"Unknown"},
                                {label:"Win Rate",      val:addWalletResult.winRate!=null?`${addWalletResult.winRate}%`:"Unknown"},
                                {label:"Total Trades",  val:addWalletResult.trades!=null?addWalletResult.trades.toLocaleString():"Unknown"},
                                {label:"Focus",         val:addWalletResult.focus||"Mixed"},
                              ].map((s,i)=>(
                                <div key={i} style={{background:B.bg,borderRadius:6,padding:"8px 10px"}}>
                                  <div style={{fontSize:9,color:B.dim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{s.label}</div>
                                  <div style={{fontSize:12,fontWeight:700,color:B.text,fontFamily:"'Syne',sans-serif"}}>{s.val}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{marginTop:10,fontSize:11,color:B.subtext,background:B.bg,borderRadius:6,padding:"8px 12px"}}>
                              <span style={{color:"#a78bfa",fontWeight:600}}>🤖 AI Analysis: </span>
                              {addWalletResult.pattern||"Analyzing trading pattern..."}
                            </div>
                            <div style={{display:"flex",gap:8,marginTop:10}}>
                              <button onClick={()=>{
                                const newW = {
                                  id: `w${Date.now()}`,
                                  handle: addWalletResult.handle,
                                  address: addWalletInput.trim(),
                                  allTimePnl: addWalletResult.pnl,
                                  winRate: addWalletResult.winRate,
                                  biggestWin: null,
                                  focus: addWalletResult.focus||"Mixed",
                                  trades: addWalletResult.trades,
                                  copyable: addWalletResult.copyable!==false,
                                  confidence: addWalletResult.winRate>55?"HIGH":addWalletResult.winRate>50?"MEDIUM":"LOW",
                                  pattern: addWalletResult.pattern||"",
                                  recentTrades: addWalletResult.recentTrades||[],
                                  color: ["#10b981","#3b82f6","#8b5cf6","#f59e0b","#ef4444"][wallets.length%5],
                                  connectionStatus: "connected",
                                  copySize: addWalletResult.winRate>55?0.8:0.6,
                                  maxUsd: addWalletResult.winRate>55?80:60,
                                  liveStatus: null,
                                };
                                setWallets(prev=>[...prev, newW]);
                                setAddWalletInput("");
                                setAddWalletResult(null);
                              }} style={{flex:1,padding:"8px 0",background:`${B.green}15`,border:`1px solid ${B.green}40`,borderRadius:8,color:B.green,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                                ✅ Add to Copier
                              </button>
                              <button onClick={()=>{setAddWalletResult(null);setAddWalletInput("");}} style={{padding:"8px 16px",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,color:B.muted,fontSize:11,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ):(
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:16}}>❌</span>
                            <span style={{fontSize:12,color:B.red}}>{addWalletResult.error||"Wallet not found or no trading history"}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={async()=>{
                      const input = addWalletInput.trim();
                      if(!input||addWalletLoading) return;
                      setAddWalletLoading(true);
                      setAddWalletResult(null);
                      try {
                        // Try orchestrator first (it has Polymarket API access)
                        const r = await fetch(`${ORCHESTRATOR_BASE}/wallet-lookup`,{
                          method:"POST",
                          headers:{"Content-Type":"application/json"},
                          body:JSON.stringify({address:input})
                        });
                        if(r.ok){
                          const d = await r.json();
                          setAddWalletResult(d);
                        } else {
                          // Fallback: try Gamma API directly (public)
                          const addr = input.startsWith("0x")?input:null;
                          if(addr){
                            const pm = await fetch(`https://gamma-api.polymarket.com/trades?maker=${addr}&limit=20`);
                            if(pm.ok){
                              const trades = await pm.json();
                              const tradeList = Array.isArray(trades)?trades:trades.data||[];
                              setAddWalletResult({
                                ok: tradeList.length>0,
                                handle: addr.slice(0,6)+"..."+addr.slice(-4),
                                address: addr,
                                trades: tradeList.length,
                                pnl: null,
                                winRate: null,
                                focus: "Unknown — analyzing...",
                                pattern: "Recently added — AI will analyze their pattern after 24hrs of data.",
                                copyable: true,
                                recentTrades: tradeList.slice(0,3).map(t=>({
                                  market: t.title||t.question||"Unknown market",
                                  side: t.side||"YES",
                                  entry: parseFloat(t.price||0.5),
                                  pnl: null,
                                  status: "unknown"
                                })),
                                error: tradeList.length===0?"No trades found for this address":null,
                              });
                            } else {
                              setAddWalletResult({ok:false,error:"Could not fetch wallet data. Check address and try again."});
                            }
                          } else {
                            setAddWalletResult({ok:false,error:"Enter a valid 0x wallet address"});
                          }
                        }
                      } catch(e) {
                        setAddWalletResult({ok:false,error:`Connection error: ${e.message}`});
                      }
                      setAddWalletLoading(false);
                    }}
                    disabled={addWalletLoading||!addWalletInput.trim()}
                    style={{padding:"11px 22px",background:addWalletLoading||!addWalletInput.trim()?B.surf2:T.accentSoft,border:`1px solid ${addWalletLoading||!addWalletInput.trim()?B.border:T.accentBorder}`,borderRadius:8,color:addWalletLoading||!addWalletInput.trim()?B.dim:T.accentText,fontSize:12,fontWeight:600,cursor:addWalletLoading||!addWalletInput.trim()?"not-allowed":"pointer",fontFamily:"'Outfit',sans-serif",whiteSpace:"nowrap",flexShrink:0}}
                  >
                    {addWalletLoading?"Looking up...":"Lookup Wallet →"}
                  </button>
                </div>
              </Card>

              {/* ── WALLET LIST ── */}
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {wallets.map((w,wi)=>{
                  const isSelected = selectedWallet?.id===w.id;
                  const isCopying  = w.connectionStatus==="live";
                  const isEditing  = editingWallet===w.id;
                  return (
                    <Card key={w.id} style={{padding:0,border:`1px solid ${isSelected?w.color+"50":isCopying?`${B.green}30`:B.border}`,transition:"all 0.2s",boxShadow:isCopying?`0 0 12px ${B.green}10`:"none"}}>

                      {/* Wallet header row */}
                      <div onClick={()=>setSelectedWallet(isSelected?null:w)}
                        style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto auto auto",gap:14,alignItems:"center",padding:"16px 20px",cursor:"pointer"}}>

                        {/* Color dot + handle */}
                        <div style={{width:36,height:36,borderRadius:10,background:`${w.color}18`,border:`1px solid ${w.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                          {w.connectionStatus==="live"?"🔴":w.connectionStatus==="connected"?"🟡":"⚪"}
                        </div>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:B.text,display:"flex",alignItems:"center",gap:8}}>
                            {w.handle}
                            {w.connectionStatus==="live"&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:`${B.green}15`,color:B.green,fontWeight:700,letterSpacing:"0.06em"}}>LIVE COPYING</span>}
                            {w.connectionStatus==="connected"&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:`${B.amber}15`,color:B.amber,fontWeight:700}}>CONNECTED</span>}
                            {!w.address&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:B.surf2,color:B.dim,fontWeight:600}}>NO ADDRESS</span>}
                          </div>
                          <div style={{fontSize:11,color:B.muted,marginTop:2}}>{w.focus}</div>
                        </div>

                        {/* Stats */}
                        {[
                          {label:"P&L",   val:w.allTimePnl!=null?`$${(w.allTimePnl/1000).toFixed(0)}K`:"—",   color:B.green},
                          {label:"Win%",  val:w.winRate!=null?`${w.winRate}%`:"—",                             color:w.winRate>55?B.green:w.winRate>50?B.amber:B.muted},
                          {label:"Trades",val:w.trades!=null?w.trades.toLocaleString():"—",                    color:B.subtext},
                          {label:"Copy",  val:w.copyable?"✓ Copyable":"Study only",                           color:w.copyable?B.green:B.amber},
                        ].map((s,i)=>(
                          <div key={i} style={{textAlign:"center"}}>
                            <div style={{fontSize:13,fontWeight:700,color:s.color,fontFamily:"'Syne',sans-serif"}}>{s.val}</div>
                            <div style={{fontSize:9,color:B.dim,letterSpacing:"0.06em",textTransform:"uppercase"}}>{s.label}</div>
                          </div>
                        ))}

                        <div style={{fontSize:12,color:B.dim,paddingLeft:8}}>{isSelected?"▲":"▼"}</div>
                      </div>

                      {/* Expanded wallet config */}
                      {isSelected&&(
                        <div style={{borderTop:`1px solid ${B.border}`,padding:"20px"}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

                            {/* Left: address + connection */}
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>Wallet Address</div>

                              {/* Address input */}
                              <div style={{display:"flex",gap:8,marginBottom:12}}>
                                <input
                                  defaultValue={w.address}
                                  onChange={e=>{
                                    const addr = e.target.value;
                                    setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,address:addr}:pw));
                                  }}
                                  placeholder="0x... paste address here"
                                  style={{flex:1,background:B.bg,border:`1px solid ${w.address?B.green+"40":B.border}`,borderRadius:6,padding:"8px 12px",fontSize:11,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif",fontFamily:"monospace"}}
                                />
                                <button
                                  onClick={async()=>{
                                    if(!w.address) return;
                                    setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,connectionStatus:"checking"}:pw));
                                    try{
                                      const r = await fetch(`https://gamma-api.polymarket.com/trades?maker=${w.address}&limit=5`,{signal:AbortSignal.timeout(6000)});
                                      const d = await r.json();
                                      const trades = Array.isArray(d)?d:d.data||[];
                                      setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,connectionStatus:trades.length>0?"connected":"no_trades"}:pw));
                                    }catch{
                                      setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,connectionStatus:"error"}:pw));
                                    }
                                  }}
                                  style={{padding:"8px 14px",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:6,color:B.muted,fontSize:11,cursor:"pointer",fontFamily:"'Outfit',sans-serif",whiteSpace:"nowrap"}}
                                >
                                  {w.connectionStatus==="checking"?"Checking...":"Test →"}
                                </button>
                              </div>

                              {/* Connection status */}
                              <div style={{padding:"8px 12px",borderRadius:6,marginBottom:14,
                                background:w.connectionStatus==="live"?`${B.green}10`:w.connectionStatus==="connected"?`${B.amber}10`:w.connectionStatus==="error"?`${B.red}10`:B.surf2,
                                border:`1px solid ${w.connectionStatus==="live"?`${B.green}30`:w.connectionStatus==="connected"?`${B.amber}30`:w.connectionStatus==="error"?`${B.red}30`:B.border}`
                              }}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <div style={{width:7,height:7,borderRadius:"50%",background:w.connectionStatus==="live"?B.green:w.connectionStatus==="connected"?B.amber:w.connectionStatus==="error"?B.red:B.border}}/>
                                  <span style={{fontSize:11,fontWeight:600,color:w.connectionStatus==="live"?B.green:w.connectionStatus==="connected"?B.amber:w.connectionStatus==="error"?B.red:B.muted}}>
                                    {w.connectionStatus==="live"?"Live — actively copying trades":
                                     w.connectionStatus==="connected"?"Connected — ready to copy":
                                     w.connectionStatus==="checking"?"Verifying address...":
                                     w.connectionStatus==="no_trades"?"Address valid but no trades found":
                                     w.connectionStatus==="error"?"Connection failed — check address":
                                     "Not connected — paste address and test"}
                                  </span>
                                </div>
                              </div>

                              {/* Copy config */}
                              {w.copyable&&(
                                <div>
                                  <div style={{fontSize:11,fontWeight:600,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>Copy Settings</div>
                                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                                    {[
                                      {label:"Copy Size",desc:"% of their position we mirror",key:"copySize",min:0.1,max:1.0,step:0.1,format:v=>`${(v*100).toFixed(0)}%`},
                                      {label:"Max per trade",desc:"$ cap per copied trade",key:"maxUsd",min:10,max:200,step:10,format:v=>`$${v}`},
                                    ].map((cfg,ci)=>(
                                      <div key={ci}>
                                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                                          <div>
                                            <span style={{fontSize:11,color:B.subtext,fontWeight:600}}>{cfg.label}</span>
                                            <span style={{fontSize:10,color:B.dim,marginLeft:6}}>{cfg.desc}</span>
                                          </div>
                                          <span style={{fontSize:12,fontWeight:700,color:T.accentText,fontFamily:"'Syne',sans-serif"}}>{cfg.format(w[cfg.key]||cfg.min)}</span>
                                        </div>
                                        <input type="range" min={cfg.min} max={cfg.max} step={cfg.step}
                                          value={w[cfg.key]||cfg.min}
                                          onChange={e=>setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,[cfg.key]:parseFloat(e.target.value)}:pw))}
                                          style={{width:"100%",accentColor:T.accent}}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right: pattern + recent trades */}
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>AI Pattern Analysis</div>
                              <div style={{fontSize:11,color:B.subtext,lineHeight:1.7,background:B.surf2,borderRadius:8,padding:"12px 14px",marginBottom:14,border:`1px solid rgba(139,92,246,0.15)`}}>
                                <span style={{color:"#a78bfa",fontWeight:600}}>🤖 </span>
                                {w.pattern||"No pattern data yet — add address and let bot observe for 24hrs."}
                              </div>

                              {w.recentTrades?.length>0&&(
                                <div>
                                  <div style={{fontSize:11,fontWeight:600,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>Recent Trades</div>
                                  {w.recentTrades.slice(0,3).map((t,ti)=>(
                                    <div key={ti} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:B.bg,borderRadius:6,marginBottom:5,border:`1px solid ${B.border}`}}>
                                      <div style={{fontSize:11,color:B.subtext,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.market}</div>
                                      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:10}}>
                                        <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:t.side==="YES"?`${B.green}15`:t.side==="NO"?`${B.red}15`:`${B.amber}15`,color:t.side==="YES"?B.green:t.side==="NO"?B.red:B.amber,fontWeight:700}}>{t.side}</span>
                                        {t.pnl!=null&&<span style={{fontSize:11,fontWeight:700,color:t.pnl>0?B.green:B.red,fontFamily:"'Syne',sans-serif"}}>{t.pnl>0?"+":""}{t.pnl>0?`$${t.pnl.toLocaleString()}`:"-"}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div style={{display:"flex",gap:10,marginTop:20,paddingTop:16,borderTop:`1px solid ${B.border}`}}>
                            {w.copyable&&w.connectionStatus==="connected"&&(
                              <button onClick={async()=>{
                                // Send to orchestrator to start live copying
                                try{
                                  // Save to Supabase via orchestrator
                                  await fetch(`${ORCHESTRATOR_BASE}/wallets`,{
                                    method:"POST",headers:{"Content-Type":"application/json"},
                                    body:JSON.stringify({wallet:{name:w.handle,address:w.address,copy:true,copy_size:w.copySize,max_usd:w.maxUsd,strategy:w.strategy||"",status:"live"}})
                                  });
                                  // Also send command to copier bot
                                  await fetch(`${ORCHESTRATOR_BASE}/command`,{
                                    method:"POST",headers:{"Content-Type":"application/json"},
                                    body:JSON.stringify({bot:"copier_bot",action:"add_wallet",params:{name:w.handle,address:w.address,copySize:w.copySize,maxUsd:w.maxUsd}})
                                  });
                                  setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,connectionStatus:"live"}:pw));
                                }catch{
                                  setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,connectionStatus:"connected"}:pw));
                                  alert("Orchestrator offline — settings saved locally only");
                                }
                              }} style={{flex:1,padding:"10px 0",background:`${B.green}15`,border:`1px solid ${B.green}40`,borderRadius:8,color:B.green,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                                ▶ Start Copying Live
                              </button>
                            )}
                            {w.connectionStatus==="live"&&(
                              <button onClick={()=>setWallets(prev=>prev.map((pw,i)=>i===wi?{...pw,connectionStatus:"connected"}:pw))}
                                style={{flex:1,padding:"10px 0",background:`${B.amber}15`,border:`1px solid ${B.amber}40`,borderRadius:8,color:B.amber,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                                ⏸ Pause Copying
                              </button>
                            )}
                            <button onClick={()=>setWallets(prev=>prev.filter((_,i)=>i!==wi))}
                              style={{padding:"10px 18px",background:`${B.red}10`,border:`1px solid ${B.red}25`,borderRadius:8,color:B.red,fontSize:12,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {wallets.length===0&&(
                <div style={{textAlign:"center",padding:"60px 0",color:B.muted}}>
                  <div style={{fontSize:32,marginBottom:12}}>👛</div>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>No wallets added yet</div>
                  <div style={{fontSize:12}}>Paste a Polymarket wallet address above to get started</div>
                </div>
              )}
              </div>
              )}

            </div>
          )}

          {/* ── SETTINGS ── */}
          {page==="ai"&&(
            <div className="in">

              {/* ── HEADER ── */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
                <div>
                  <div style={{fontSize:20,fontWeight:700,fontFamily:"'Syne',sans-serif",letterSpacing:"-0.02em",background:"linear-gradient(135deg,#a78bfa,#6366f1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Multi-Agent AI Orchestrator</div>
                  <div style={{fontSize:12,color:B.muted,marginTop:4}}>Bots run independently · AI supervises every 6hrs · Models work together</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#a78bfa",boxShadow:"0 0 8px #a78bfa"}}/>
                  <span style={{fontSize:11,color:"#a78bfa",fontWeight:600,letterSpacing:"0.06em"}}>
                    {models.filter(m=>m.status==="live").length} MODELS LIVE
                  </span>
                </div>
              </div>

              {/* ── MODEL REGISTRY ── */}
              <Card style={{padding:"20px 24px",marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>Model Registry</div>
                    <div style={{fontSize:11,color:B.muted,marginTop:2}}>Each model has a role · Orchestrator uses the best available for each job</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {["supervisor","chat","standby"].map(role=>(
                      <span key={role} style={{fontSize:10,padding:"3px 10px",borderRadius:20,background:role==="supervisor"?`${B.green}15`:role==="chat"?`rgba(139,92,246,0.15)`:`${B.surf2}`,color:role==="supervisor"?B.green:role==="chat"?"#a78bfa":B.muted,fontWeight:600,letterSpacing:"0.04em",textTransform:"capitalize"}}>
                        {models.filter(m=>m.role===role&&m.status==="live").length} {role}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Model cards */}
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                  {models.map((m,i)=>(
                    <div key={m.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1.5fr auto",gap:12,alignItems:"center",padding:"14px 16px",background:B.surf2,borderRadius:10,border:`1px solid ${m.status==="live"?`${m.color}25`:B.border}`,opacity:m.status==="live"?1:0.6}}>

                      {/* Name + provider */}
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:32,height:32,borderRadius:8,background:`${m.color}15`,border:`1px solid ${m.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                          {m.provider==="anthropic"?"🟣":m.provider==="google"?"🟢":m.provider==="openai"?"🔵":"⚙️"}
                        </div>
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:m.status==="live"?B.text:B.muted}}>{m.name}</div>
                          <div style={{fontSize:10,color:B.dim,textTransform:"capitalize"}}>{m.provider}</div>
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:m.status==="live"?m.color:B.red,boxShadow:m.status==="live"?`0 0 6px ${m.color}`:"none"}}/>
                        <span style={{fontSize:11,fontWeight:600,color:m.status==="live"?m.color:B.red,textTransform:"capitalize"}}>{m.status}</span>
                      </div>

                      {/* Latency */}
                      <div>
                        <div style={{fontSize:11,fontWeight:600,color:m.latency<300?B.green:m.latency<800?B.amber:B.red}}>{m.latency?`${m.latency}ms`:"—"}</div>
                        <div style={{fontSize:9,color:B.dim}}>latency</div>
                      </div>

                      {/* RPM */}
                      <div>
                        <div style={{fontSize:11,fontWeight:600,color:B.subtext}}>{m.rpm?`${m.rpm} rpm`:"—"}</div>
                        <div style={{fontSize:9,color:B.dim}}>rate limit</div>
                      </div>

                      {/* Cost */}
                      <div>
                        <div style={{fontSize:11,color:B.muted}}>{m.cost}</div>
                        <div style={{fontSize:9,color:B.dim}}>per 1M tokens</div>
                      </div>

                      {/* Role badge + last used */}
                      <div>
                        <span style={{fontSize:10,padding:"3px 10px",borderRadius:20,fontWeight:600,
                          background:m.role==="supervisor"?`${B.green}15`:m.role==="chat"?`rgba(139,92,246,0.15)`:`${B.surf2}`,
                          color:m.role==="supervisor"?B.green:m.role==="chat"?"#a78bfa":B.muted,
                          textTransform:"capitalize"
                        }}>{m.role}</span>
                        <div style={{fontSize:9,color:B.dim,marginTop:3}}>{m.lastUsed}</div>
                      </div>

                      {/* Health checks */}
                      <div style={{display:"flex",gap:4}}>
                        {[
                          {k:"auth",label:"Auth"},
                          {k:"rate",label:"Rate"},
                          {k:"ping",label:"Ping"},
                        ].map(c=>(
                          <div key={c.k} title={c.label} style={{width:18,height:18,borderRadius:4,background:m.checks[c.k]?`${B.green}20`:`${B.red}20`,border:`1px solid ${m.checks[c.k]?`${B.green}40`:`${B.red}40`}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:m.checks[c.k]?B.green:B.red}}>
                            {m.checks[c.k]?"✓":"✗"}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Orchestrator flow diagram */}
                <div style={{background:B.bg,borderRadius:8,padding:"12px 16px",marginBottom:20}}>
                  <div style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>How models work together</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {[
                      {label:"Every 6hrs",desc:"Gemini supervises",icon:"🟢",color:B.green},
                      {label:"→",desc:"",icon:"",color:B.dim},
                      {label:"Flags issue?",desc:"Telegram alert sent",icon:"📱",color:B.amber},
                      {label:"→",desc:"",icon:"",color:B.dim},
                      {label:"You chat",desc:"Claude answers",icon:"🟣",color:"#a78bfa"},
                      {label:"→",desc:"",icon:"",color:B.dim},
                      {label:"Claude offline?",desc:"GPT-4o Mini fallback",icon:"🔵",color:"#3b82f6"},
                    ].map((step,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                        {step.icon&&<span style={{fontSize:12}}>{step.icon}</span>}
                        <div>
                          <div style={{fontSize:11,fontWeight:600,color:step.color}}>{step.label}</div>
                          {step.desc&&<div style={{fontSize:9,color:B.dim}}>{step.desc}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── ADD MODEL ── */}
                <div style={{borderTop:`1px solid ${B.border}`,paddingTop:16}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:12,color:B.muted,letterSpacing:"0.04em",textTransform:"uppercase"}}>Add a Model</div>
                  <div style={{display:"grid",gridTemplateColumns:"180px 1fr 200px auto",gap:10,alignItems:"center"}}>

                    {/* Provider dropdown */}
                    <select value={addModelProvider} onChange={e=>{
                      setAddModelProvider(e.target.value);
                      setTestResults(null);
                      const names={"openai":"GPT-4o Mini","anthropic":"Claude Sonnet","google":"Gemini 1.5 Flash","custom":"Custom Model"};
                      setAddModelName(names[e.target.value]||"");
                    }} style={{background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif",cursor:"pointer"}}>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="google">Google (Gemini)</option>
                      <option value="custom">Custom / Other</option>
                    </select>

                    {/* API Key input */}
                    <input
                      type="password"
                      value={addModelKey}
                      onChange={e=>setAddModelKey(e.target.value)}
                      placeholder={addModelProvider==="openai"?"sk-proj-...":addModelProvider==="anthropic"?"sk-ant-...":addModelProvider==="google"?"AIza...":"Your API key"}
                      style={{background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 14px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif"}}
                    />

                    {/* Model name (editable for custom) */}
                    <input
                      value={addModelName}
                      onChange={e=>setAddModelName(e.target.value)}
                      placeholder="Model name"
                      style={{background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 14px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif"}}
                    />

                    {/* Test button */}
                    <button
                      onClick={async()=>{
                        if(!addModelKey.trim()){alert("Enter an API key first");return;}
                        setTestingModel(addModelProvider);
                        setTestResults(null);
                        const start=Date.now();
                        try{
                          const r=await fetch(`${ORCHESTRATOR_BASE}/test-model`,{
                            method:"POST",
                            headers:{"Content-Type":"application/json"},
                            body:JSON.stringify({provider:addModelProvider,key:addModelKey,name:addModelName})
                          });
                          const d=await r.json();
                          setTestResults({...d,latency:Date.now()-start});
                          if(d.ok){
                            setModels(prev=>[...prev.filter(m=>m.id!==addModelProvider),{
                              id:addModelProvider+Date.now(),
                              name:addModelName||d.model||addModelProvider,
                              provider:addModelProvider,
                              role:"standby",
                              status:"live",
                              latency:Date.now()-start,
                              rpm:d.rpm||null,
                              cost:d.cost||"unknown",
                              key:addModelKey.slice(0,8)+"...",
                              lastUsed:"just added",
                              checks:{auth:d.auth,rate:d.rate,ping:d.ping},
                              color:addModelProvider==="openai"?"#3b82f6":addModelProvider==="anthropic"?"#a78bfa":addModelProvider==="google"?"#10b981":"#f59e0b"
                            }]);
                            setAddModelKey("");
                          }
                        }catch(e){
                          setTestResults({ok:false,error:"Orchestrator offline or key invalid",latency:Date.now()-start,auth:false,rate:false,ping:false});
                        }
                        setTestingModel(null);
                      }}
                      disabled={testingModel!==null}
                      style={{padding:"9px 18px",background:testingModel?B.surf2:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:testingModel?B.muted:T.accentText,fontSize:12,fontWeight:600,cursor:testingModel?"not-allowed":"pointer",fontFamily:"'Outfit',sans-serif",whiteSpace:"nowrap"}}
                    >
                      {testingModel?"Testing...":"Test Connection →"}
                    </button>
                  </div>

                  {/* Test results */}
                  {testResults&&(
                    <div style={{marginTop:12,padding:"12px 16px",borderRadius:8,background:testResults.ok?`${B.green}08`:`${B.red}08`,border:`1px solid ${testResults.ok?`${B.green}25`:`${B.red}25`}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <span style={{fontSize:16}}>{testResults.ok?"✅":"❌"}</span>
                        <span style={{fontSize:12,fontWeight:600,color:testResults.ok?B.green:B.red}}>
                          {testResults.ok?"Connection successful — model added to registry":"Connection failed"}
                        </span>
                        <span style={{fontSize:11,color:B.muted,marginLeft:"auto"}}>{testResults.latency}ms round-trip</span>
                      </div>
                      <div style={{display:"flex",gap:12}}>
                        {[
                          {label:"Auth",ok:testResults.auth,desc:"API key valid"},
                          {label:"Rate Limits",ok:testResults.rate,desc:testResults.rpm?`${testResults.rpm} rpm`:"checking"},
                          {label:"Ping",ok:testResults.ping,desc:`${testResults.latency}ms`},
                        ].map((c,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:B.bg,borderRadius:6}}>
                            <span style={{fontSize:11,color:c.ok?B.green:B.red,fontWeight:700}}>{c.ok?"✓":"✗"}</span>
                            <div>
                              <div style={{fontSize:11,color:B.subtext,fontWeight:600}}>{c.label}</div>
                              <div style={{fontSize:10,color:B.dim}}>{c.desc}</div>
                            </div>
                          </div>
                        ))}
                        {testResults.error&&<div style={{fontSize:11,color:B.red,padding:"6px 10px",background:B.bg,borderRadius:6}}>{testResults.error}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* ── ORCHESTRATOR STATUS + SUPERVISION SCHEDULE ── */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
                <Card style={{padding:"20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{fontSize:13,fontWeight:600}}>Supervision Log</div>
                    {aiDecisions.length>0&&<span style={{fontSize:10,background:B.greenSoft,color:B.green,borderRadius:6,padding:"2px 8px",fontWeight:700}}>● {aiDecisions.length} real entries</span>}
                  </div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:16}}>Gemini checks every 6hrs · real decisions from VPS</div>
                  {aiDecisions.length>0?(
                    <div style={{display:"flex",flexDirection:"column",gap:0}}>
                      {aiDecisions.slice(0,4).map((d,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 0",borderBottom:i<Math.min(3,aiDecisions.length-1)?`1px solid ${B.border}`:"none"}}>
                          <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,marginTop:3,background:d.risk_level==="HIGH"?B.red:d.risk_level==="MEDIUM"?B.amber:B.green,boxShadow:i===0?`0 0 6px ${B.green}`:"none"}}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:600,color:B.subtext,marginBottom:2}}>
                              {d.type==="manual_command"?"Manual Override":d.type==="user_command"?"Your command":"Gemini Check"}
                            </div>
                            <div style={{fontSize:10,color:B.dim,lineHeight:1.5}}>{(d.assessment||d.reply||d.message||"").slice(0,120)}</div>
                          </div>
                          <div style={{fontSize:9,color:B.dim,flexShrink:0,marginTop:2}}>{d.time}</div>
                        </div>
                      ))}
                    </div>
                  ):(
                    // No real decisions yet — show schedule placeholders
                    <div>
                      {(()=>{
                        const now = new Date();
                        const h = now.getHours();
                        const checks = [
                          {time:"08:00", label:"Morning check",   offset:8},
                          {time:"14:00", label:"Afternoon check", offset:14},
                          {time:"20:00", label:"Evening check",   offset:20},
                          {time:"02:00", label:"Night check",     offset:2},
                        ].map(c=>{
                          const done = h > c.offset;
                          const next = !done && Math.abs(h - c.offset) < 2;
                          return {...c, status: done?"done": next?"next":"pending"};
                        });
                        return checks.map((s,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<3?`1px solid ${B.border}`:"none"}}>
                            <div style={{width:44,textAlign:"center"}}>
                              <div className="num" style={{fontSize:12,fontWeight:700,color:s.status==="done"?B.green:s.status==="next"?B.amber:B.dim}}>{s.time}</div>
                            </div>
                            <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:s.status==="done"?B.green:s.status==="next"?B.amber:B.border,boxShadow:s.status==="next"?`0 0 6px ${B.amber}`:"none"}}/>
                            <div style={{flex:1}}>
                              <div style={{fontSize:11,fontWeight:600,color:s.status==="pending"?B.dim:B.subtext}}>{s.label}</div>
                              <div style={{fontSize:10,color:B.dim}}>{s.status==="done"?"Completed":s.status==="next"?"Due soon":"Scheduled"}</div>
                            </div>
                            <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:s.status==="done"?`${B.green}15`:s.status==="next"?`${B.amber}15`:B.surf2,color:s.status==="done"?B.green:s.status==="next"?B.amber:B.dim,fontWeight:600}}>Gemini</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </Card>

                <Card style={{padding:"20px"}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Bot Independence Status</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:16}}>Each bot runs on its own — AI is optional</div>
                  {(()=>{
                    const bs = liveData?.portfolio?.bot_states || {};
                    return [
                      {bot:"Bond Bot",      key:"bond_bot",    aiDep:"None",   desc:"Scans Gamma API, enters near-certainty markets, holds to resolution."},
                      {bot:"Maker Rebates", key:"rebates_bot", aiDep:"None",   desc:"Posts limit orders every 30s. Pure mechanical execution."},
                      {bot:"BTC 5-Min",     key:"btc5m_bot",   aiDep:"None",   desc:"Reads Chainlink oracle directly. Zero AI dependency."},
                      {bot:"Copier Bot",    key:"copier_bot",  aiDep:"None",   desc:"Polls tracked wallets. Mirrors trades automatically."},
                      {bot:"AI Supervisor", key:null,          aiDep:"Gemini", desc:"Checks in every 6hrs. Bots keep running if offline."},
                    ].map((b,i)=>{
                      const s = b.key ? bs[b.key] : null;
                      const status = b.key ? (s?.status || "no_data") : (liveData?"live":"unknown");
                      const scan = s?.scan_count;
                      return (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<4?`1px solid ${B.border}`:"none"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:status==="live"?B.green:status==="paper"?B.amber:status==="no_data"?B.muted:B.border,boxShadow:status==="live"?`0 0 5px ${B.green}`:status==="paper"?`0 0 5px ${B.amber}`:"none"}}/>
                        <div>
                          <div style={{fontSize:11,fontWeight:600,color:B.subtext}}>{b.bot}</div>
                          <div style={{fontSize:10,color:B.dim}}>
                            {b.desc}{scan!=null&&<span style={{color:T.accentText,marginLeft:4}}>· scan #{scan}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:b.aiDep==="None"?B.greenSoft:`rgba(139,92,246,0.1)`,color:b.aiDep==="None"?B.green:"#a78bfa",fontWeight:600}}>AI: {b.aiDep}</span>
                        {status!=="no_data"&&status!=="unknown"&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:8,background:status==="live"?B.greenSoft:B.amberSoft,color:status==="live"?B.green:B.amber,fontWeight:600}}>{status}</span>}
                      </div>
                    </div>
                  );
                    });
                  })()}
                </Card>
              </div>

              {/* ── CHAT + DECISIONS ── */}
              <div style={{display:"grid",gridTemplateColumns:"1.1fr 0.9fr",gap:20,marginBottom:20}}>
                <Card style={{padding:"20px",display:"flex",flexDirection:"column",height:420}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                    <span>💬</span> Chat with your AI brain
                    <span style={{marginLeft:"auto",fontSize:10,padding:"2px 8px",borderRadius:10,background:"rgba(139,92,246,0.1)",color:"#a78bfa",fontWeight:600}}>
                      {models.find(m=>m.role==="chat"&&m.status==="live")?.name||"No chat model"} active
                    </span>
                  </div>
                  <div style={{fontSize:10,color:B.dim,marginBottom:12}}>Uses Claude for chat · falls back to GPT-4o Mini if offline · costs only when you ask</div>
                  <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
                    {aiChat.map((msg,i)=>(
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
                        <div style={{maxWidth:"88%",padding:"9px 13px",borderRadius:msg.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",background:msg.role==="user"?T.accentSoft:"rgba(139,92,246,0.07)",border:`1px solid ${msg.role==="user"?T.accentBorder:"rgba(139,92,246,0.18)"}`,fontSize:12,color:B.text,lineHeight:1.6}}>{msg.text}</div>
                        <div style={{fontSize:9,color:B.dim,marginTop:2}}>{msg.time}</div>
                      </div>
                    ))}
                    {aiLoading&&<div style={{padding:"9px 13px",background:"rgba(139,92,246,0.06)",borderRadius:"12px 12px 12px 4px",width:"fit-content",border:"1px solid rgba(139,92,246,0.15)"}}>
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>{[0,1,2].map(d=><div key={d} style={{width:5,height:5,borderRadius:"50%",background:"#a78bfa",opacity:0.6}}/>)}<span style={{fontSize:11,color:"#a78bfa",marginLeft:4}}>thinking...</span></div>
                    </div>}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <input value={aiInput} onChange={e=>setAiInput(e.target.value)}
                      onKeyDown={async e=>{if(e.key==="Enter"&&aiInput.trim()&&!aiLoading){const msg=aiInput.trim();setAiInput("");setAiChat(p=>[...p,{role:"user",text:msg,time:"now"}]);setAiLoading(true);try{const r=await fetch(`${ORCHESTRATOR_BASE}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})});const d=await r.json();setAiChat(p=>[...p,{role:"assistant",text:d.reply||"Error",time:"now"}]);}catch{setAiChat(p=>[...p,{role:"assistant",text:"⚠️ Orchestrator offline.",time:"now"}]);}setAiLoading(false);}}}
                      placeholder='Ask anything — "How are we doing?" "Is BTC5M ready to go live?"'
                      style={{flex:1,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif"}}
                    />
                    <button onClick={async()=>{if(!aiInput.trim()||aiLoading)return;const msg=aiInput.trim();setAiInput("");setAiChat(p=>[...p,{role:"user",text:msg,time:"now"}]);setAiLoading(true);try{const r=await fetch(`${ORCHESTRATOR_BASE}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})});const d=await r.json();setAiChat(p=>[...p,{role:"assistant",text:d.reply||"Error",time:"now"}]);}catch{setAiChat(p=>[...p,{role:"assistant",text:"⚠️ Orchestrator offline.",time:"now"}]);}setAiLoading(false);}}
                      style={{padding:"9px 16px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>Send</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                    {["How much did we make today?","Is BTC5M ready to go live?","Which bot is best?","Should I add capital?"].map((q,i)=>(
                      <button key={i} onClick={()=>setAiInput(q)} style={{padding:"3px 9px",fontSize:10,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:20,color:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>{q}</button>
                    ))}
                  </div>
                </Card>

                <Card style={{padding:"20px",height:420,display:"flex",flexDirection:"column"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                    <div style={{fontSize:13,fontWeight:600}}>Supervision Log</div>
                    {aiDecisions.length>0&&<span style={{fontSize:10,background:B.greenSoft,color:B.green,borderRadius:6,padding:"2px 8px",fontWeight:700}}>● {aiDecisions.length} entries</span>}
                  </div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:14}}>Gemini's decisions · every 6 hours · real from VPS</div>
                  <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                    {aiDecisions.length===0?(
                      <div style={{padding:"32px 0",textAlign:"center"}}>
                        <div style={{fontSize:22,marginBottom:10}}>🤖</div>
                        <div style={{fontSize:12,fontWeight:500,color:B.subtext,marginBottom:4}}>No supervision log yet</div>
                        <div style={{fontSize:11,color:B.muted,lineHeight:1.6}}>Gemini checks in every 6 hours.<br/>Entries will appear here after first cycle.</div>
                        <div style={{marginTop:12,fontSize:10,color:B.dim}}>
                          Last check: {liveData?.portfolio?.timestamp
                            ? new Date(liveData.portfolio.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                            : "—"}
                        </div>
                      </div>
                    ):aiDecisions.map((d,i)=>(
                      <div key={i} style={{background:B.surf2,borderRadius:8,padding:"11px 13px",border:`1px solid ${d.risk_level==="HIGH"?`${B.red}30`:d.risk_level==="MEDIUM"?`${B.amber}25`:B.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:d.type==="user_command"?T.accentText:d.type==="manual_command"?B.amber:B.green,letterSpacing:"0.05em",textTransform:"uppercase"}}>
                            {d.type==="user_command"?"👤 You":d.type==="manual_command"?"🎮 Override":"🟢 Gemini"}
                          </span>
                          <div style={{display:"flex",gap:5,alignItems:"center"}}>
                            {d.risk_level&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:d.risk_level==="HIGH"?B.redSoft:d.risk_level==="LOW"?B.greenSoft:B.amberSoft,color:d.risk_level==="HIGH"?B.red:d.risk_level==="LOW"?B.green:B.amber,fontWeight:600}}>{d.risk_level}</span>}
                            <span style={{fontSize:10,color:B.dim,fontFamily:"'JetBrains Mono',monospace"}}>{d.time}</span>
                          </div>
                        </div>
                        <div style={{fontSize:11,color:B.subtext,lineHeight:1.5}}>{d.assessment||d.reply||d.message}</div>
                        {d.opportunities?.slice(0,1).map((op,j)=>(
                          <div key={j} style={{fontSize:10,color:B.green,background:B.greenSoft,borderRadius:4,padding:"4px 8px",marginTop:6}}>💡 {op}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* ── MANUAL OVERRIDES ── */}
              <Card style={{padding:"16px 20px"}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:12,color:B.muted,letterSpacing:"0.04em",textTransform:"uppercase"}}>Manual Overrides</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {[
                    {label:"⏸ Pause All Bots",  action:"pause",  bot:"all",         color:B.amber},
                    {label:"▶ Resume All",        action:"resume", bot:"all",         color:B.green},
                    {label:"⏸ Pause Bond Bot",   action:"pause",  bot:"bond_bot",    color:B.muted},
                    {label:"⏸ Pause Rebates",    action:"pause",  bot:"rebates_bot", color:B.muted},
                    {label:"🔍 Run Check Now",   action:"cycle",  bot:"orchestrator",color:"#10b981"},
                    {label:"🤖 Force AI Cycle",  action:"cycle",  bot:"orchestrator",color:"#a78bfa"},
                  ].map((cmd,i)=>(
                    <button key={i} onClick={async()=>{
                      try{await fetch(`${ORCHESTRATOR_BASE}/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bot:cmd.bot,action:cmd.action})});
                      setAiDecisions(p=>[{id:`D-${Date.now()}`,time:"now",type:"manual_command",assessment:`Manual override: ${cmd.action} → ${cmd.bot}`,decisions:[],risk_level:"LOW"},...p]);}
                      catch{alert("Orchestrator offline — check VPS");}
                    }} style={{padding:"8px 14px",background:`${cmd.color}12`,border:`1px solid ${cmd.color}35`,borderRadius:8,color:cmd.color,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>{cmd.label}</button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {page==="settings"&&(
            <div className="in" style={{maxWidth:960}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

                {/* ── WALLET CONNECTION ── */}
                <Card style={{padding:"22px 24px",gridColumn:"1/-1"}}>
                  <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:4,color:B.text}}>Wallet Connection</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:20}}>Connect your Polymarket wallet to see real USDC balance and transaction history</div>
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    <input
                      value={walletAddress}
                      onChange={e=>setWalletAddress(e.target.value)}
                      placeholder="0x... paste your Polymarket wallet address"
                      style={{flex:1,background:B.surf2,border:`1px solid ${walletBalance!=null?B.greenBorder:B.border}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:B.text,fontFamily:"'JetBrains Mono',monospace"}}
                    />
                    {walletAddress && (
                      <button
                        onClick={()=>setWalletAddress("")}
                        style={{padding:"10px 14px",background:B.redSoft,border:`1px solid ${B.redSoft}`,borderRadius:8,color:B.red,fontSize:12,fontWeight:600}}
                      >Clear</button>
                    )}
                    <button
                      onClick={()=>fetchWalletBalance(walletAddress)}
                      disabled={walletChecking||!walletAddress}
                      style={{padding:"10px 18px",background:walletChecking||!walletAddress?B.surf2:T.accentSoft,border:`1px solid ${walletChecking||!walletAddress?B.border:T.accentBorder}`,borderRadius:8,color:walletChecking||!walletAddress?B.muted:T.accentText,fontSize:12,fontWeight:600}}
                    >{walletChecking?"Searching...":"Connect Wallet →"}</button>
                  </div>
                  {walletBalance!=null&&(
                    <div style={{display:"flex",alignItems:"center",gap:16,background:B.greenSoft,border:`1px solid ${B.greenBorder}`,borderRadius:10,padding:"12px 16px"}}>
                      <span style={{fontSize:18}}>✅</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:B.green}}>Wallet Connected</div>
                        <div style={{fontSize:11,color:B.muted,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>{walletAddress.slice(0,8)}...{walletAddress.slice(-6)}</div>
                      </div>
                      <div style={{marginLeft:"auto",textAlign:"right"}}>
                        <div className="num" style={{fontSize:20,fontWeight:700,color:B.green}}>{fmt.usd(walletBalance)}</div>
                        <div style={{fontSize:10,color:B.muted}}>USDC on Polygon</div>
                      </div>
                      {walletBalance<20&&(
                        <div style={{background:B.redSoft,border:`1px solid ${B.red}30`,borderRadius:8,padding:"8px 12px",fontSize:11,color:B.red,fontWeight:600}}>
                          🚨 Critical — top up to trade
                        </div>
                      )}
                      {walletBalance>=20&&walletBalance<50&&(
                        <div style={{background:B.amberSoft,border:`1px solid ${B.amber}30`,borderRadius:8,padding:"8px 12px",fontSize:11,color:B.amber,fontWeight:600}}>
                          ⚠ Low balance
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* ── POLYMARKET API KEYS ── */}
                <Card style={{padding:"22px 24px"}}>
                  <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:4,color:B.text}}>Polymarket API Keys</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:20}}>Required for live trading. Keys stored on VPS only — never in browser.</div>
                  {[
                    {label:"API Key",     key:"apiKey",      ph:"pk_live_xxxx",  type:"password"},
                    {label:"API Secret",  key:"secret",      ph:"sk_live_xxxx",  type:"password"},
                    {label:"Passphrase",  key:"passphrase",  ph:"your passphrase", type:"password"},
                  ].map(f=>(
                    <div key={f.key} style={{marginBottom:14}}>
                      <label style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",display:"block",marginBottom:6,textTransform:"uppercase",fontWeight:600}}>{f.label}</label>
                      <input
                        type={f.type}
                        placeholder={f.ph}
                        value={polymarketKeys[f.key]}
                        onChange={e=>setPolymarketKeys(p=>({...p,[f.key]:e.target.value}))}
                        style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:B.text,fontFamily:"'JetBrains Mono',monospace"}}
                      />
                    </div>
                  ))}
                  <button
                    onClick={()=>saveConfig({polymarket_api_key:polymarketKeys.apiKey,polymarket_secret:polymarketKeys.secret,polymarket_passphrase:polymarketKeys.passphrase})}
                    style={{width:"100%",padding:"10px",borderRadius:8,fontSize:12,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,color:T.accentText}}
                  >Save to VPS →</button>
                  <div style={{fontSize:10,color:B.muted,marginTop:8,textAlign:"center"}}>Keys sent to orchestrator and stored in .env — never exposed to browser</div>
                </Card>

                {/* ── CONNECTIONS STATUS ── */}
                <Card style={{padding:"22px 24px"}}>
                  <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:4,color:B.text}}>System Connections</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:20}}>Pre-configured connections — edit only if needed</div>
                  {[
                    {label:"Orchestrator", val:ORCHESTRATOR_BASE,   status:"connected", editable:false},
                    {label:"Supabase",     val:SUPABASE_URL,         status:"connected", editable:false},
                    {label:"Polygon RPC",  val:POLYGON_RPC,          status:"connected", editable:true},
                    {label:"Anthropic AI", val:"Configured on VPS",  status: liveData?"connected":"unknown", editable:false},
                  ].map((c,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<3?`1px solid ${B.border}`:"none"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:B.text}}>{c.label}</div>
                        <div style={{fontSize:10,color:B.muted,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{c.val.length>40?c.val.slice(0,40)+"...":c.val}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{
                          fontSize:9,padding:"2px 8px",borderRadius:20,fontWeight:700,letterSpacing:"0.06em",
                          background:c.status==="connected"?B.greenSoft:B.amberSoft,
                          color:c.status==="connected"?B.green:B.amber,
                        }}>{c.status==="connected"?"● LIVE":"● UNKNOWN"}</span>
                      </div>
                    </div>
                  ))}
                </Card>

                {/* ── RISK CONTROLS ── */}
                <Card style={{padding:"22px 24px"}}>
                  <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:4,color:B.text}}>Risk Controls</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:20}}>Saved to VPS — bots read on every cycle</div>
                  {[
                    {k:"autoRestart",label:"Auto-restart on crash",    desc:"Re-launch bots automatically on exit"},
                    {k:"slipGuard",  label:"Slippage guard",           desc:"Cancel orders if slippage exceeds 1.5%"},
                    {k:"rateAlert",  label:"Rate limit warnings",      desc:"Alert at 80% API utilization"},
                    {k:"webhooks",   label:"Webhook notifications",    desc:"POST trade events to Slack or Discord"},
                  ].map(({k,label,desc})=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${B.border}`}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:500,color:B.text}}>{label}</div>
                        <div style={{fontSize:10,color:B.muted,marginTop:2}}>{desc}</div>
                      </div>
                      <div onClick={async()=>{
                        const newToggles={...toggles,[k]:!toggles[k]};
                        setToggles(newToggles);
                        await saveConfig({risk_controls:newToggles});
                      }} style={{width:42,height:22,borderRadius:11,position:"relative",cursor:"pointer",flexShrink:0,background:toggles[k]?T.accentSoft:B.surf2,border:`1px solid ${toggles[k]?T.accentBorder:B.border}`,transition:"all 0.25s"}}>
                        <div style={{position:"absolute",top:3,left:toggles[k]?21:3,width:15,height:15,borderRadius:"50%",transition:"left 0.25s",background:toggles[k]?T.accentText:B.muted}}/>
                      </div>
                    </div>
                  ))}
                </Card>

                {/* ── POSITION LIMITS ── */}
                <Card style={{padding:"22px 24px"}}>
                  <div className="head" style={{fontSize:14,fontWeight:600,marginBottom:4,color:B.text}}>Position Limits</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:20}}>Bots will not exceed these limits per trade</div>
                  {[
                    {label:"Max Position Size (USDC)", key:"maxPosition", ph:"5000"},
                    {label:"Daily Loss Limit (USDC)",  key:"dailyLoss",   ph:"1000"},
                  ].map((f,i)=>(
                    <div key={i} style={{marginBottom:i===0?16:0}}>
                      <label style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",display:"block",marginBottom:6,textTransform:"uppercase",fontWeight:600}}>{f.label}</label>
                      <input
                        type="number"
                        placeholder={f.ph}
                        value={riskLimits[f.key]}
                        onChange={e=>setRiskLimits(r=>({...r,[f.key]:e.target.value}))}
                        style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 12px",fontSize:12,color:B.text,fontFamily:"'JetBrains Mono',monospace"}}
                      />
                    </div>
                  ))}
                  <button
                    onClick={()=>saveConfig({risk_limits:riskLimits})}
                    style={{width:"100%",padding:"10px",marginTop:16,borderRadius:8,fontSize:12,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,color:T.accentText}}
                  >Save Limits →</button>
                </Card>

              </div>
            </div>
          )}

        </main>
      </div>

      {selectedBot&&<TradeDrawer bot={selectedBot} onClose={()=>setBot(null)} mode={mode} liveData={liveData}/>}
      {selectedStrategy&&(
        <StrategyDrawer
          strategy={selectedStrategy}
          onClose={()=>setSelectedStrategy(null)}
          allTrades={allTrades}
          liveData={liveData}
          botsRegistry={botsRegistry}
          B={B} T={T} mode={mode}
        />
      )}
      {showAddBotModal&&(
        <AddBotModal
          onAdd={(newBot)=>{
            setBotsRegistry(prev=>[...prev,newBot]);
            setBotAllocations(prev=>({...prev,[newBot.id]:0}));
          }}
          onClose={()=>setShowAddBotModal(false)}
          existingIds={botsRegistry.map(b=>b.id)}
        />
      )}
      {lbCopyModal&&(
        <CopyConfigModal
          trader={lbCopyModal}
          onConfirm={(cfg)=>startCopyingTrader(lbCopyModal, cfg)}
          onClose={()=>setLbCopyModal(null)}
          availableBalance={mode==="live" ? (walletBalance ?? 0) : (demoBalance ?? 0)}
          isDemo={mode==="demo"}
          B={B} T={T}
        />
      )}
    </div>
    </ThemeCtx.Provider>
  );
}
