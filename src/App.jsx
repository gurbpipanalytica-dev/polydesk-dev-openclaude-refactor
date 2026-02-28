import { useState, useEffect, useRef } from "react";
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

// ── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  demo: {
    accent:"#4f6ef7", accentSoft:"rgba(79,110,247,0.12)", accentBorder:"rgba(79,110,247,0.35)",
    accentText:"#818cf8", accentGlow:"rgba(79,110,247,0.2)",
    logoGrad:"linear-gradient(135deg,#4f6ef7 0%,#7c3aed 100%)",
    lineColor:"#4f6ef7", headerBorder:"rgba(79,110,247,0.15)",
    label:"DEMO", balanceLabel:"Virtual Balance", balance:"$25,000.00", pnlLabel:"Simulated P&L",
  },
  live: {
    accent:"#059669", accentSoft:"rgba(5,150,105,0.12)", accentBorder:"rgba(5,150,105,0.35)",
    accentText:"#10b981", accentGlow:"rgba(5,150,105,0.2)",
    logoGrad:"linear-gradient(135deg,#059669 0%,#0d9488 100%)",
    lineColor:"#10b981", headerBorder:"rgba(16,185,129,0.15)",
    label:"LIVE", balanceLabel:"USDC Balance", balance:"$12,440.80", pnlLabel:"Realized P&L",
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
  {wallet:"TeemuTeemuTeemu", pnl:2840, winRate:57.0, trades:38,  method:"Esports Lag",    copySize:0.8, color:"#10b981"},
  {wallet:"Account88888",    pnl:1920, winRate:53.9, trades:62,  method:"BTC Direction",  copySize:0.6, color:"#3b82f6"},
  {wallet:"kingofcoinflips", pnl:3110, winRate:57.3, trades:51,  method:"BTC Direction",  copySize:0.7, color:"#8b5cf6"},
  {wallet:"defiance_cr",     pnl:840,  winRate:null, trades:null,method:"MM Signal Only", copySize:0,   color:"#f59e0b"},
  {wallet:"gabagool",        pnl:0,    winRate:99.1, trades:0,   method:"Study Only",     copySize:0,   color:"#ef4444"},
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
  {id:"w3", handle:"kingofcoinflips", allTimePnl:697083, winRate:57.3, biggestWin:null,
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

const PIE_C = ["#10b981","#3b82f6","#8b5cf6","#f59e0b","#ef4444"];

// ── BASE COLORS ───────────────────────────────────────────────────────────────
const B = {
  bg:"#080d1a", surf:"#0c1220", surf2:"#101828",
  border:"rgba(255,255,255,0.06)", text:"#e2e8f0",
  subtext:"#94a3b8", muted:"#475569", dim:"#334155",
  green:"#10b981", red:"#ef4444", amber:"#f59e0b",
};

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
const ChartTip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#0f1629",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"10px 14px",fontSize:12,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
      <div style={{color:"#64748b",marginBottom:4,fontSize:11}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||"#e2e8f0",fontWeight:600}}>
          {p.name}: {typeof p.value==="number"?`$${p.value.toLocaleString()}`:p.value}
        </div>
      ))}
    </div>
  );
};

const StatusBadge = ({status}) => {
  const c={live:{bg:"rgba(16,185,129,0.12)",color:"#10b981",label:"Live"},paused:{bg:"rgba(245,158,11,0.12)",color:"#f59e0b",label:"Paused"},error:{bg:"rgba(239,68,68,0.12)",color:"#ef4444",label:"Error"},open:{bg:"rgba(79,110,247,0.12)",color:"#818cf8",label:"Open"},closed:{bg:"rgba(100,116,139,0.12)",color:"#94a3b8",label:"Closed"}}[status]||{bg:"rgba(100,116,139,0.12)",color:"#94a3b8",label:status};
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,color:c.color,fontSize:11,fontWeight:600,letterSpacing:"0.04em",padding:"3px 9px",borderRadius:20}}>
    {(status==="live"||status==="open")&&<span style={{width:5,height:5,borderRadius:"50%",background:c.color,display:"inline-block",animation:"pulse 2s infinite"}}/>}
    {c.label}
  </span>;
};

const Sparkline = ({positive}) => {
  const d=positive?[3,5,4,7,6,8,9,8,11,10,13,12,15,14,17,20]:[15,13,14,11,12,9,10,8,7,9,6,5,7,4,3,2];
  const max=Math.max(...d),min=Math.min(...d);
  const pts=d.map((v,i)=>`${(i/(d.length-1))*56},${18-((v-min)/(max-min))*16}`).join(" ");
  return <svg width={58} height={20}><polyline points={pts} fill="none" stroke={positive?"#10b981":"#ef4444"} strokeWidth={1.5} strokeLinejoin="round" opacity={0.9}/></svg>;
};

const Card = ({children, style={}}) => (
  <div style={{background:B.surf,border:`1px solid ${B.border}`,borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.3)",...style}}>
    {children}
  </div>
);

const CardHeader = ({title, sub, right}) => (
  <div style={{padding:"18px 20px 0",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
    <div>
      <div style={{fontSize:13,fontWeight:600,color:B.text}}>{title}</div>
      {sub && <div style={{fontSize:11,color:B.muted,marginTop:2}}>{sub}</div>}
    </div>
    {right}
  </div>
);

// ── PERIOD SELECTOR ───────────────────────────────────────────────────────────
const PERIODS = ["1D","7D","1M","3M","ALL","Custom"];

const PeriodSelector = ({period, setPeriod, T, customRange, setCustomRange}) => {
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
            transition:"all 0.2s",cursor:"pointer",letterSpacing:"0.04em",
          }}>{p}</button>
        ))}
        <button onClick={()=>{setPeriod("Custom");setShowCustom(s=>!s);}} style={{
          padding:"5px 12px",fontSize:11,fontWeight:period==="Custom"?700:400,
          background:period==="Custom"?T.accentSoft:"transparent",
          color:period==="Custom"?T.accentText:B.muted,
          border:"none",transition:"all 0.2s",cursor:"pointer",letterSpacing:"0.04em",
          display:"flex",alignItems:"center",gap:4,
        }}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={4} width={18} height={18} rx={2}/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          Custom
        </button>
      </div>
      {/* Custom range inputs */}
      {showCustom && (
        <div style={{display:"flex",alignItems:"center",gap:8,background:B.surf2,border:`1px solid ${T.accentBorder}`,borderRadius:8,padding:"5px 10px"}}>
          <input type="date" value={customRange.from} onChange={e=>setCustomRange(r=>({...r,from:e.target.value}))}
            style={{background:"transparent",border:"none",color:B.text,fontSize:11,fontFamily:"'Outfit',sans-serif",outline:"none",colorScheme:"dark"}}/>
          <span style={{color:B.muted,fontSize:11}}>→</span>
          <input type="date" value={customRange.to} onChange={e=>setCustomRange(r=>({...r,to:e.target.value}))}
            style={{background:"transparent",border:"none",color:B.text,fontSize:11,fontFamily:"'Outfit',sans-serif",outline:"none",colorScheme:"dark"}}/>
          <button style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,color:T.accentText,cursor:"pointer"}}>Apply</button>
        </div>
      )}
    </div>
  );
};

// ── HEATMAP COMPONENT ─────────────────────────────────────────────────────────
const TradeHeatmap = ({T}) => {
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
const ModeSwitch = ({mode,onChange,T}) => {
  const isLive = mode==="live";
  return (
    <div onClick={()=>onChange(isLive?"demo":"live")} style={{display:"flex",alignItems:"center",gap:0,background:B.surf2,border:`1px solid ${T.accentBorder}`,borderRadius:10,padding:3,cursor:"pointer",boxShadow:`0 0 16px ${T.accentGlow}`,transition:"all 0.4s",userSelect:"none"}}>
      <div style={{padding:"5px 14px",borderRadius:7,fontSize:11,fontWeight:700,letterSpacing:"0.06em",transition:"all 0.3s",background:!isLive?"rgba(79,110,247,0.2)":"transparent",color:!isLive?"#818cf8":B.muted}}>DEMO</div>
      <div style={{width:36,height:20,borderRadius:10,margin:"0 4px",background:isLive?"linear-gradient(135deg,#059669,#10b981)":"linear-gradient(135deg,#4f6ef7,#7c3aed)",position:"relative",transition:"background 0.4s",flexShrink:0,boxShadow:isLive?"0 0 10px rgba(16,185,129,0.5)":"0 0 10px rgba(79,110,247,0.5)"}}>
        <div style={{position:"absolute",top:2,left:isLive?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.3s cubic-bezier(.68,-.55,.27,1.55)",boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}}/>
      </div>
      <div style={{padding:"5px 14px",borderRadius:7,fontSize:11,fontWeight:700,letterSpacing:"0.06em",transition:"all 0.3s",background:isLive?"rgba(5,150,105,0.2)":"transparent",color:isLive?"#10b981":B.muted}}>LIVE</div>
    </div>
  );
};

// ── TRADE DRAWER ──────────────────────────────────────────────────────────────
const TradeDrawer = ({bot,onClose,T}) => {
  const trades = (mode==="live" && liveData?.real_trades)
    ? (liveData.real_trades.filter(t => t.bot === bot.file?.replace("polydesk_","").replace(".py","").replace("_bot","")+"_bot") || [])
    : (TRADE_LOGS[bot.id] || []);
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",zIndex:200}}/>
      <div style={{position:"fixed",right:0,top:0,bottom:0,width:600,background:B.surf,borderLeft:`1px solid ${B.border}`,zIndex:201,display:"flex",flexDirection:"column",boxShadow:"-20px 0 60px rgba(0,0,0,0.5)",animation:"slidein 0.3s cubic-bezier(.16,1,.3,1)"}}>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${B.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${bot.color}18`,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${bot.color}30`}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:bot.color,boxShadow:`0 0 8px ${bot.color}`}}/>
              </div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16}}>{bot.name}</div>
                <div style={{fontSize:11,color:B.muted}}>{bot.strategy}</div>
              </div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:8,background:B.surf2,border:`1px solid ${B.border}`,color:B.muted,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {label:"Total P&L",val:bot.pnl>=0?`+$${bot.pnl.toLocaleString()}`:`-$${Math.abs(bot.pnl).toLocaleString()}`,color:bot.pnl>=0?B.green:B.red},
              {label:"Win Rate",val:`${bot.win}%`,color:bot.win>70?B.green:bot.win>50?B.amber:B.red},
              {label:"Avg Exec",val:`${bot.exec}ms`,color:B.text},
              {label:"Trades",val:bot.trades.toLocaleString(),color:B.text},
            ].map((s,i)=>(
              <div key={i} style={{background:B.bg,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:9,color:B.muted,letterSpacing:"0.1em",marginBottom:4,textTransform:"uppercase"}}>{s.label}</div>
                <div style={{fontSize:15,fontWeight:700,fontFamily:"'Syne',sans-serif",color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {trades.map(t=>{
            const isOpen=t.status==="open";
            return (
              <div key={t.id} style={{padding:"14px 24px",borderBottom:`1px solid rgba(255,255,255,0.04)`,background:isOpen?T.accentSoft:"transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.side==="YES"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)",color:t.side==="YES"?B.green:B.red}}>{t.side}</span>
                    <span style={{fontSize:13,fontWeight:500,color:B.text,maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.market}</span>
                  </div>
                  <StatusBadge status={t.status}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                  {[
                    {label:"Size",val:`$${t.size.toLocaleString()}`,color:B.subtext},
                    {label:"Entry",val:t.entry.toFixed(2),color:B.subtext},
                    {label:"Exit",val:isOpen?"—":t.exit.toFixed(2),color:isOpen?B.muted:B.subtext},
                    {label:"Exec",val:`${t.execMs}ms`,color:t.execMs<40?B.green:t.execMs<60?B.amber:B.red},
                    {label:"P&L",val:isOpen?"Live":t.pnl>=0?`+$${t.pnl}`:`-$${Math.abs(t.pnl)}`,color:isOpen?T.accentText:t.pnl>0?B.green:B.red,bold:true},
                  ].map((col,j)=>(
                    <div key={j}>
                      <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:3,textTransform:"uppercase"}}>{col.label}</div>
                      <div style={{fontSize:12,fontWeight:col.bold?700:500,color:col.color,fontFamily:col.bold?"'Syne',sans-serif":"inherit"}}>{col.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:8,fontSize:10,color:B.dim}}>{t.time} · {t.id}</div>
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
const AllocateTab = ({balance, available, totalAllocated, T, isDemo}) => {
  const BOTS_CONFIG = [
    {id:"bond",    name:"Bond Bot",          file:"polydesk_bond_bot.py",         color:"#10b981", recommended:0.78, description:"Near-certainty markets · 98% win rate"},
    {id:"rebates", name:"Maker Rebates Bot", file:"polydesk_maker_rebates_bot.py",color:"#3b82f6", recommended:0.22, description:"50 markets · earns rebates on every fill"},
    {id:"btc5m",   name:"BTC 5-Min Bot",     file:"polydesk_btc5m_bot.py",        color:"#8b5cf6", recommended:0.00, description:"Paper only until 50+ trade track record"},
    {id:"copier",  name:"Copier Bot",         file:"polydesk_copier_bot.py",       color:"#f59e0b", recommended:0.00, description:"Mirror whale wallets · configure in Copier tab"},
  ];

  const recAmounts  = BOTS_CONFIG.map(b => Math.round(balance * b.recommended));
  const [allocs, setAllocs] = useState(() => BOTS_CONFIG.map((b,i) => ({
    ...b,
    amount: recAmounts[i],
  })));
  const [saved,  setSaved]  = useState(false);
  const [editing, setEditing] = useState(null);  // which bot id is being manually edited
  const [inputVal, setInputVal] = useState("");

  const totalAlloc  = allocs.reduce((s,a) => s + a.amount, 0);
  const remaining   = balance - totalAlloc;
  const isOver      = remaining < 0;
  const isExact     = remaining === 0;

  const setAmount = (id, val) => {
    const num = Math.max(0, Math.min(balance, parseFloat(val) || 0));
    setAllocs(prev => prev.map(a => a.id === id ? {...a, amount: num} : a));
    setSaved(false);
  };

  const applyRecommended = () => {
    setAllocs(prev => prev.map((a, i) => ({...a, amount: recAmounts[i]})));
    setSaved(false);
  };

  const saveToBackend = async (allocData) => {
    try {
      const payload = Object.fromEntries(allocData.map(a=>[a.id, a.amount]));
      await fetch(`${ORCHESTRATOR_URL}/allocations`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({allocations: payload})
      });
    } catch(e) { /* non-fatal — saved locally */ }
  };

  const distributeRemaining = () => {
    // Add remaining to bond bot (highest win rate)
    if(remaining <= 0) return;
    setAllocs(prev => prev.map(a => a.id === "bond" ? {...a, amount: a.amount + remaining} : a));
    setSaved(false);
  };

  const clearAll = () => {
    setAllocs(prev => prev.map(a => ({...a, amount: 0})));
    setSaved(false);
  };

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
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:13,fontWeight:600}}>Allocate Per Bot</div>
            <div style={{fontSize:11,color:B.muted}}>Drag slider or type exact amount</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={applyRecommended} style={{padding:"6px 12px",fontSize:11,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:7,color:T.accentText,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
              ✦ Recommended
            </button>
            {remaining > 0 && (
              <button onClick={distributeRemaining} style={{padding:"6px 12px",fontSize:11,fontWeight:600,background:`${B.green}12`,border:`1px solid ${B.green}30`,borderRadius:7,color:B.green,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                + Add Remainder to Bond
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

                {/* Amount display / input */}
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

const FundsTab = ({mode,T,demoBalance,setDemoBalance,demoTxns,setDemoTxns,demoAllocated}) => {
  const [tab,setTab]           = useState("overview");
  const [withdrawAddr,setWA]   = useState("");
  const [withdrawAmt,setWAmt]  = useState("");
  const [submitted,setSubmit]  = useState(false);
  const [customAmt,setCustom]  = useState("");
  const [topupAnim,setAnim]    = useState(null);   // which amount button was just clicked
  const isDemo    = mode==="demo";
  const totalAllocated = isDemo ? (demoAllocated||12441) : ALLOC_LIVE.reduce((s,a)=>s+a.alloc,0);
  const balance   = isDemo ? (demoBalance||25000) : 12440.80;
  const available = balance - totalAllocated;
  const isLow     = isDemo && available < 2000;
  const isDepleted = isDemo && available < 100;

  const persistAppState = async (key, value) => {
    try {
      await fetch(`${ORCHESTRATOR_URL}/app-state`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({key, value})
      });
    } catch(e) { /* non-fatal */ }
  };

  const loadAppState = async (key, fallback) => {
    try {
      const r = await fetch(`${ORCHESTRATOR_URL}/app-state?key=${key}`);
      if(r.ok){ const d = await r.json(); return d.value ?? fallback; }
    } catch(e) {}
    return fallback;
  };

  // Load persisted demo balance on mount
  useEffect(()=>{
    loadAppState("demo_balance", 25000).then(v => {
      if(v && v !== 25000) setDemoBalance(parseFloat(v));
    });
    loadAppState("demo_txns", []).then(v => {
      if(v && v.length > 0) setDemoTxns(v);
    });
  }, []);

  const addDemoFunds = (amt) => {
    if(!amt||amt<=0) return;
    const newBal = (demoBalance||25000) + amt;
    setDemoBalance(newBal);
    const newTx = {
      id:`DX-${Date.now()}`,
      type:"deposit",
      desc:`Virtual top-up`,
      amount:amt,
      time: new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),
      status:"confirmed"
    };
    const newTxns = [newTx, ...(demoTxns||[])];
    setDemoTxns(newTxns);
    setAnim(amt);
    setTimeout(()=>setAnim(null),1200);
    // Persist to Supabase
    persistAppState("demo_balance", newBal);
    persistAppState("demo_txns", newTxns.slice(0,50));
  };

  const simulateWithdraw = (amt) => {
    if(!amt||amt<=0||amt>available) return;
    setDemoBalance(prev=>prev-parseFloat(amt));
    const newTx = {
      id:`DX-${Date.now()}`,
      type:"withdraw",
      desc:`Virtual withdrawal`,
      amount:-parseFloat(amt),
      time: new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),
      status:"simulated"
    };
    setDemoTxns(prev=>[newTx,...prev]);
    setSubmit(true);
    setTimeout(()=>setSubmit(false),3000);
  };
  return (
    <div>
      <div style={{background:B.surf,border:`1px solid ${T.accentBorder}`,borderRadius:14,padding:"28px",marginBottom:24,boxShadow:`0 0 40px ${T.accentGlow}`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:T.accentGlow,filter:"blur(60px)",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
            <div>
              <div style={{fontSize:11,color:B.muted,letterSpacing:"0.08em",marginBottom:8,textTransform:"uppercase"}}>{T.balanceLabel}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:38,fontWeight:800,letterSpacing:"-0.03em",lineHeight:1,color:isDepleted?B.red:isLow?B.amber:"inherit"}}>
                ${isDemo?balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"12,440"}<span style={{fontSize:22,color:B.subtext}}>{isDemo?"":".80"}</span>
              </div>
              <div style={{fontSize:12,color:T.accentText,marginTop:8}}>
                {T.pnlLabel}: <span style={{fontWeight:700}}>+$20,100 (+80.4%)</span>
              </div>
            </div>
            {isDemo&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
                <div style={{background:"rgba(79,110,247,0.15)",border:"1px solid rgba(79,110,247,0.3)",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#818cf8",fontWeight:600,textAlign:"center"}}><div style={{fontSize:16,marginBottom:2}}>🎭</div>VIRTUAL</div>
                {isLow&&<div style={{background:isDepleted?`${B.red}15`:`${B.amber}15`,border:`1px solid ${isDepleted?B.red:B.amber}40`,borderRadius:8,padding:"6px 12px",fontSize:11,color:isDepleted?B.red:B.amber,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                  <span>{isDepleted?"🚨":"⚠️"}</span>
                  {isDepleted?"Balance depleted — top up to continue testing":"Low balance — consider topping up"}
                </div>}
              </div>
            )}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[
              {label:"Available", val:`$${Math.max(0,available).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`, color:isDepleted?B.red:isLow?B.amber:B.text},
              {label:"In Bots",   val:`$${totalAllocated.toLocaleString()}`, color:T.accentText},
              {label:"Profit",    val:isDemo?`+$${Math.max(0,balance-25000).toLocaleString()}`:`+$20,100`, color:B.green},
            ].map((s,i)=>(
              <div key={i} style={{background:"rgba(0,0,0,0.3)",borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:B.muted,letterSpacing:"0.08em",marginBottom:4,textTransform:"uppercase"}}>{s.label}</div>
                <div style={{fontSize:16,fontWeight:700,fontFamily:"'Syne',sans-serif",color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:`1px solid ${B.border}`}}>
        {["overview","deposit","withdraw","allocate"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 18px",fontSize:12,letterSpacing:"0.05em",textTransform:"uppercase",color:tab===t?T.accentText:B.muted,borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent",marginBottom:-1,background:"transparent",border:"none",borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent",cursor:"pointer",transition:"all 0.2s",fontFamily:"'Outfit',sans-serif"}}>{t}</button>
        ))}
      </div>
      {tab==="overview"&&(
        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between"}}>
            <div style={{fontSize:13,fontWeight:600}}>Transaction History</div>
            <span style={{fontSize:11,color:B.muted}}>{TXNS.length} transactions</span>
          </div>
          {(isDemo?demoTxns:TXNS).map((tx,i)=>{
            const typeColors={profit:B.green,loss:B.red,deposit:"#818cf8",withdraw:B.amber,simulated:B.muted};
            const typeIcons={profit:"↑",loss:"↓",deposit:"⊕",withdraw:"→",simulated:"↗"};
            const txList = isDemo?demoTxns:TXNS;
            return (
              <div key={tx.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:i<txList.length-1?`1px solid ${B.border}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:34,height:34,borderRadius:10,background:`${typeColors[tx.type]}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:typeColors[tx.type],flexShrink:0}}>{typeIcons[tx.type]}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:500}}>{tx.desc}</div>
                    <div style={{fontSize:11,color:B.muted,marginTop:2}}>{tx.time} · {tx.id}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:700,fontFamily:"'Syne',sans-serif",color:tx.amount>0?B.green:B.red}}>{tx.amount>0?"+":""}{tx.amount<0?"-":""}${Math.abs(tx.amount).toLocaleString()}</div>
                  <div style={{fontSize:10,color:B.green,marginTop:2}}>✓ {tx.status}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {tab==="deposit"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <Card style={{padding:"24px"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{isDemo?"Add Virtual Funds":"Deposit USDC"}</div>
            <div style={{fontSize:11,color:B.muted,marginBottom:20}}>{isDemo?"Instantly top up your demo balance":"Send USDC on Polygon only"}</div>
            {isDemo?(<div>
              {/* Quick top-up amounts */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[1000,5000,10000,25000].map(amt=>(
                  <button key={amt} onClick={()=>addDemoFunds(amt)}
                    style={{padding:"14px 12px",borderRadius:8,fontSize:13,fontWeight:600,
                      background:topupAnim===amt?`${B.green}20`:T.accentSoft,
                      border:`1px solid ${topupAnim===amt?B.green:T.accentBorder}`,
                      color:topupAnim===amt?B.green:T.accentText,
                      cursor:"pointer",transition:"all 0.3s",fontFamily:"'Outfit',sans-serif",
                      transform:topupAnim===amt?"scale(0.97)":"scale(1)",
                    }}>
                    {topupAnim===amt?"✓ Added!": `+ $${amt.toLocaleString()}`}
                  </button>
                ))}
              </div>
              {/* Custom amount */}
              <div style={{borderTop:`1px solid ${B.border}`,paddingTop:14}}>
                <div style={{fontSize:11,color:B.muted,marginBottom:8,letterSpacing:"0.05em",textTransform:"uppercase"}}>Custom Amount</div>
                <div style={{display:"flex",gap:8}}>
                  <input
                    type="number"
                    placeholder="Enter amount..."
                    value={customAmt}
                    onChange={e=>setCustom(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&customAmt>0&&(addDemoFunds(parseFloat(customAmt)),setCustom(""))}
                    style={{flex:1,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif"}}
                  />
                  <button onClick={()=>{if(customAmt>0){addDemoFunds(parseFloat(customAmt));setCustom("");}}}
                    disabled={!customAmt||customAmt<=0}
                    style={{padding:"9px 18px",background:customAmt>0?T.accentSoft:B.surf2,border:`1px solid ${customAmt>0?T.accentBorder:B.border}`,borderRadius:8,color:customAmt>0?T.accentText:B.dim,fontSize:12,fontWeight:600,cursor:customAmt>0?"pointer":"not-allowed",fontFamily:"'Outfit',sans-serif"}}>
                    Add →
                  </button>
                </div>
              </div>
              {/* Balance bar */}
              <div style={{marginTop:16,padding:"12px 14px",background:B.surf2,borderRadius:8,border:`1px solid ${B.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,color:B.muted}}>Balance utilisation</span>
                  <span style={{fontSize:11,fontWeight:600,color:T.accentText}}>{Math.min(100,Math.round((totalAllocated/Math.max(balance,1))*100))}%</span>
                </div>
                <div style={{height:6,background:B.bg,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,(totalAllocated/Math.max(balance,1))*100)}%`,background:T.accent,borderRadius:3,transition:"width 0.5s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                  <span style={{fontSize:10,color:B.dim}}>${totalAllocated.toLocaleString()} deployed</span>
                  <span style={{fontSize:10,color:B.dim}}>${Math.max(0,available).toLocaleString()} free</span>
                </div>
              </div>
            </div>):(
              <div>
                <div style={{background:B.surf2,borderRadius:10,padding:"16px",marginBottom:16,textAlign:"center"}}>
                  <div style={{width:120,height:120,margin:"0 auto 12px",background:"linear-gradient(135deg,#1e293b,#0f172a)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:B.muted,border:`1px solid ${B.border}`}}>QR CODE</div>
                  <div style={{fontSize:12,color:T.accentText,fontFamily:"monospace",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:6,padding:"8px 12px",wordBreak:"break-all"}}>0x8f4a2B3c91dE04F73a2e9b1cD5607Ef8a29</div>
                </div>
                <div style={{fontSize:11,color:B.amber,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:"10px 12px"}}>⚠ Polygon (MATIC) network only.</div>
              </div>
            )}
          </Card>
          <Card style={{padding:"24px"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:20}}>Recent Deposits</div>
            {TXNS.filter(t=>t.type==="deposit").map((tx,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${B.border}`}}>
                <div><div style={{fontSize:12,fontWeight:500}}>{tx.desc}</div><div style={{fontSize:11,color:B.muted}}>{tx.time}</div></div>
                <div style={{fontSize:14,fontWeight:700,color:T.accentText,fontFamily:"'Syne',sans-serif"}}>+${tx.amount.toLocaleString()}</div>
              </div>
            ))}
          </Card>
        </div>
      )}
      {tab==="withdraw"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <Card style={{padding:"24px"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{isDemo?"Simulate Withdrawal":"Withdraw USDC"}</div>
            <div style={{fontSize:11,color:B.muted,marginBottom:20}}>{isDemo?"Test the withdrawal flow":"Sends USDC on Polygon"}</div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:B.muted,letterSpacing:"0.05em",display:"block",marginBottom:6}}>DESTINATION ADDRESS</label>
              <input type="text" placeholder="0x..." value={withdrawAddr} onChange={e=>setWA(e.target.value)} style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,fontFamily:"monospace"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:B.muted,letterSpacing:"0.05em",display:"block",marginBottom:6}}>AMOUNT (USDC)</label>
              <input type="number" placeholder="0.00" value={withdrawAmt} onChange={e=>setWAmt(e.target.value)} style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,fontFamily:"'Outfit',sans-serif"}}/>
            </div>
            {submitted?(
              <div style={{textAlign:"center",padding:"14px",background:`${B.green}10`,border:`1px solid ${B.green}30`,borderRadius:8,color:B.green,fontSize:13,fontWeight:600}}>
                ✓ {isDemo?"Simulated — balance updated":"Transaction submitted"}
              </div>
            ):(
              <button onClick={()=>isDemo?simulateWithdraw(withdrawAmt):setSubmit(true)}
                disabled={isDemo&&(parseFloat(withdrawAmt||0)>available||!withdrawAmt)}
                style={{width:"100%",padding:"11px",borderRadius:8,fontSize:13,fontWeight:600,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,color:T.accentText,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
                {isDemo?"Simulate Withdraw →":"Withdraw →"}
              </button>
            )}
          </Card>
          <Card style={{padding:"24px"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:20}}>Recent Withdrawals</div>
            {TXNS.filter(t=>t.type==="withdraw").map((tx,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${B.border}`}}>
                <div><div style={{fontSize:12,fontWeight:500}}>{tx.desc}</div><div style={{fontSize:11,color:B.muted}}>{tx.time}</div></div>
                <div style={{fontSize:14,fontWeight:700,color:B.amber,fontFamily:"'Syne',sans-serif"}}>${Math.abs(tx.amount).toLocaleString()}</div>
              </div>
            ))}
          </Card>
        </div>
      )}
      {tab==="allocate"&&(
        <AllocateTab balance={balance} available={available} totalAllocated={totalAllocated} T={T} isDemo={isDemo}/>
      )}
    </div>
  );
};

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function PolydeskV9() {
  const [mode,setMode]       = useState("demo");
  const [page,setPage]       = useState("overview");
  const [period,setPeriod]   = useState("1M");
  const [customRange,setCR]  = useState({from:"2026-01-01",to:"2026-02-22"});
  const [selectedBot,setBot] = useState(null);
  const [apiKey,setApiKey]   = useState("");
  const [saved,setSaved]     = useState(false);
  const [time,setTime]       = useState(new Date());
  const [rate,setRate]       = useState(342);
  const [toggles,setToggles] = useState({autoRestart:true,slipGuard:true,rateAlert:true,webhooks:false});

  const T = THEMES[mode];
  const data = PNL_SETS[period] || PNL_SETS["1M"];
  const meta = PNL_META[period] || PNL_META["1M"];

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
  const [wallets, setWallets]             = useState(TRACKED_WALLETS.map(w=>({...w, address:"", connectionStatus:"not_added", copySize:0.7, maxUsd:80, liveStatus:null})));
  const [addWalletInput, setAddWalletInput] = useState("");
  const [addWalletLoading, setAddWalletLoading] = useState(false);
  const [addWalletResult, setAddWalletResult]   = useState(null);
  const [editingWallet, setEditingWallet]       = useState(null);
  const [stratFilter, setStratFilter] = useState("all");
  const [aiChat, setAiChat]       = useState([
    {role:"assistant", text:"Hey. I'm watching all 3 bots and your $450 portfolio. Bond Bot is your priority right now — 98% win rate and your capital compounds daily. Ask me anything about performance, or tell me to pause/adjust a bot.", time:"now"}
  ]);
  const [aiInput, setAiInput]     = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDecisions, setAiDecisions] = useState([
    {id:"D-1",time:"14:58",type:"orchestration_cycle",risk_level:"LOW",assessment:"All bots healthy. Bond Bot filled 2 near-certain markets. Maker Rebates earning steady rebates across 48 markets. BTC5M paper performing well at 71% win rate — monitoring for live promotion.",decisions:[{bot:"bond_bot",action:"continue",reason:"4 new near-certain markets available above 96c"},{bot:"btc5m_bot",action:"continue",reason:"Paper win rate 71% over 35 trades — need 15 more before live consideration"}],opportunities:["BTC > $88k by Feb 28 at 97c — strong bond candidate","Fed rate hold March at 96c — add to bond rotation"]},
    {id:"D-2",time:"14:53",type:"orchestration_cycle",risk_level:"LOW",assessment:"Maker Rebates Bot running 48 markets, generating ~$4.20 in rebates per hour. Capital slightly below target due to pending fills.",decisions:[{bot:"rebates_bot",action:"continue",reason:"Healthy rebate generation. No adjustments needed."}],opportunities:[]},
    {id:"D-3",time:"14:48",type:"user_command",message:"How much did we make today?",reply:"Total daily P&L: +$47.20. Bond Bot: +$31.50 (2 resolved positions). Maker Rebates: +$15.70 in rebates across 48 markets. BTC5M: paper only. Clean day.",decisions:[]},
  ]);
  const ORCHESTRATOR_URL = "https://api.gurbcapital.com";  // ← update after deploy

  // ── DEMO BALANCE (persists across tab switches) ───────────────────────────────
  const [demoBalance,    setDemoBalance]    = useState(25000);
  const [demoTxns,       setDemoTxns]       = useState([
    {id:"DX-001",type:"deposit",desc:"Starting virtual balance",amount:25000,time:"Feb 26 00:00",status:"confirmed"},
  ]);
  const [demoAllocated,  setDemoAllocated]  = useState(12441);   // how much is in bots

  // ── LIVE DATA STATE ──────────────────────────────────────────────────────────
  const [liveData,    setLiveData]   = useState(null);    // null = not fetched yet
  const [dataLoading, setDataLoading]= useState(false);
  const [lastFetch,   setLastFetch]  = useState(null);
  const [fetchError,  setFetchError] = useState(null);
  const [liveMarkets, setLiveMarkets]= useState([]);       // real Polymarket markets for demo

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

  // ── LIVE DATA FETCHER ────────────────────────────────────────────────────────
  const fetchLiveData = async () => {
    if(dataLoading) return;
    setDataLoading(true);
    setFetchError(null);
    try {
      // Fetch bot states from orchestrator (reads Supabase)
      const [statusR, pmR] = await Promise.allSettled([
        fetch(`${ORCHESTRATOR_URL}/status`, {signal: AbortSignal.timeout(8000)}),
        fetch("https://gamma-api.polymarket.com/markets?active=true&limit=20&order=volume24hr&ascending=false",
          {signal: AbortSignal.timeout(8000)}),
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
      const tradesR = await fetch(`${ORCHESTRATOR_URL}/trades?limit=50&mode=live`,
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
        const r = await fetch("https://gamma-api.polymarket.com/markets?active=true&limit=20&order=volume24hr&ascending=false");
        if(r.ok){ const d = await r.json(); setLiveMarkets(d.slice(0,20)); }
      } catch(e) {}
    };
    fetchMarkets();  // always fetch markets regardless of mode
    const iv = setInterval(fetchMarkets, 60000);
    return () => clearInterval(iv);
  }, []);

  // Fetch on mount, and every 30s when in live mode
  useEffect(() => {
    if(mode === "live") {
      fetchLiveData();
      const interval = setInterval(fetchLiveData, 30000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  // Helper: get bot data — live from API or mock from BOTS array
  const getBotData = (botIndex) => {
    if(mode === "live" && liveData?.portfolio?.bot_states) {
      const botKeys = Object.keys(liveData.portfolio.bot_states);
      const key = botKeys[botIndex];
      if(key) {
        const s = liveData.portfolio.bot_states[key];
        return {
          ...BOTS[botIndex],
          pnl:    s.daily_pnl    || 0,
          win:    s.win_rate     || 0,
          trades: s.trades_today || 0,
          status: s.status === "live" ? "live" : s.status === "paper" ? "live" : s.status,
          ping:   BOTS[botIndex]?.ping || 12,
        };
      }
    }
    return BOTS[botIndex];
  };

  // Helper: get portfolio totals — live or mock
  const getPortfolioTotals = () => {
    if(mode === "live" && liveData?.portfolio) {
      const p = liveData.portfolio;
      return {
        totalPnl:    p.total_daily_pnl || 0,
        activeBots:  Object.values(p.bot_states||{}).filter(b=>b.status==="live").length,
        totalTrades: Object.values(p.bot_states||{}).reduce((s,b)=>s+(b.trades_today||0),0),
        capital:     p.total_capital || TOTAL_CAPITAL_USD,
      };
    }
    return {
      totalPnl:    BOTS.reduce((s,b)=>s+b.pnl,0),
      activeBots:  BOTS.filter(b=>b.status==="live").length,
      totalTrades: BOTS.reduce((s,b)=>s+b.trades,0),
      capital:     TOTAL_CAPITAL_USD,
    };
  };

  const portfolio   = getPortfolioTotals();
  const totalPnl    = portfolio.totalPnl;
  const activeBots  = portfolio.activeBots;
  const totalTrades = portfolio.totalTrades;
  const avgPing     = Math.round(BOTS.reduce((s,b)=>s+b.ping,0)/BOTS.length);

  const navItems = [
    {id:"overview",   label:"Overview",   path:"M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"},
    {id:"bots",       label:"Bots",       path:"M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2z"},
    {id:"strategies", label:"Strategies", path:"M9 11H3v2h6v-2zm0-4H3v2h6V7zm0 8H3v2h6v-2zm10-4h-8v2h8v-2zm0-4h-8v2h8V7zm0 8h-8v2h8v-2z"},
    {id:"copier",     label:"Copier",     path:"M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"},
    {id:"exec",       label:"Execution",  path:"M13 2L3 14h9l-1 8 10-12h-9l1-8z"},
    {id:"funds",      label:"Funds",      path:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"},
    {id:"ai",         label:"AI Brain",    path:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"},
    {id:"settings",   label:"Settings",   path:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6.93-1.45a1 1 0 0 0-.19-1.09l-1.42-1.42a1 1 0 0 0-1.09-.19l-1.15.48a4 4 0 0 0-.51-.29l-.27-1.2A1 1 0 0 0 13 9h-2a1 1 0 0 0-.98.79l-.27 1.2a4 4 0 0 0-.51.29l-1.15-.48a1 1 0 0 0-1.09.19L5.58 12.4a1 1 0 0 0-.19 1.09l.48 1.15a4 4 0 0 0-.29.51l-1.2.27A1 1 0 0 0 3.7 16.4l.27 1.2c.09.18.18.35.29.51l-.48 1.15a1 1 0 0 0 .19 1.09l1.42 1.42a1 1 0 0 0 1.09.19l1.15-.48c.16.11.33.2.51.29l.27 1.2A1 1 0 0 0 9 23h2a1 1 0 0 0 .98-.79l.27-1.2c.18-.09.35-.18.51-.29l1.15.48a1 1 0 0 0 1.09-.19l1.42-1.42a1 1 0 0 0 .19-1.09l-.48-1.15c.11-.16.2-.33.29-.51l1.2-.27A1 1 0 0 0 18.3 17.6z"},
  ];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:B.bg,color:B.text,fontFamily:"'Outfit',sans-serif",transition:"background 0.4s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .in{animation:in 0.35s cubic-bezier(.16,1,.3,1) both}
        .bot-row:hover{background:rgba(255,255,255,0.025)!important;cursor:pointer}
        .bot-card:hover{border-color:rgba(255,255,255,0.12)!important;transform:translateY(-2px)}
        .bot-card{transition:all 0.2s}
        input:focus{outline:none;}
        button{cursor:pointer;font-family:'Outfit',sans-serif;}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5);}
      `}</style>

      {/* SIDEBAR */}
      <aside style={{width:220,flexShrink:0,background:B.surf,borderRight:`1px solid ${B.border}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"22px 20px 18px",borderBottom:`1px solid ${B.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:T.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.4s",boxShadow:`0 0 14px ${T.accentGlow}`}}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,letterSpacing:"-0.01em",lineHeight:1}}>POLYDESK</div>
              <div style={{fontSize:10,color:B.muted,marginTop:2,letterSpacing:"0.06em"}}>v9.0</div>
            </div>
          </div>
        </div>
        <nav style={{padding:"12px 10px",flex:1}}>
          <div style={{fontSize:10,color:B.dim,letterSpacing:"0.08em",padding:"6px 10px 8px",textTransform:"uppercase"}}>Menu</div>
          {navItems.map(item=>{
            const active=page===item.id;
            return (
              <button key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:7,border:"none",background:active?T.accentSoft:"transparent",color:active?T.accentText:B.subtext,fontSize:13,fontWeight:active?600:400,textAlign:"left",transition:"all 0.2s",marginBottom:2}}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={active?T.accentText:B.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={item.path}/></svg>
                {item.label}
                {item.id==="bots"&&<span style={{marginLeft:"auto",fontSize:10,background:`${B.green}20`,color:B.green,borderRadius:10,padding:"1px 7px",fontWeight:600}}>{activeBots}</span>}
                {item.id==="overview"&&mode==="live"&&dataLoading&&<span style={{marginLeft:"auto",fontSize:9,color:B.amber}}>↻</span>}
                {item.id==="ai"&&<span style={{marginLeft:"auto",fontSize:10,background:"rgba(139,92,246,0.2)",color:"#a78bfa",borderRadius:10,padding:"1px 7px",fontWeight:600}}>ON</span>}
                {item.id==="funds"&&<span style={{marginLeft:"auto",fontSize:10,background:T.accentSoft,color:T.accentText,borderRadius:10,padding:"1px 7px",fontWeight:600}}>$</span>}
              </button>
            );
          })}
        </nav>
        <div style={{padding:"16px 20px",borderTop:`1px solid ${B.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:B.green,animation:"pulse 2s infinite",display:"inline-block"}}/>
            <span style={{fontSize:11,color:B.subtext}}>All systems nominal</span>
          </div>
          <div style={{fontSize:10,color:B.dim}}>{time.toUTCString().slice(17,25)} UTC</div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Header */}
        <header style={{height:58,borderBottom:`1px solid ${T.headerBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",background:"rgba(12,18,32,0.92)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,flexShrink:0,transition:"border-color 0.4s"}}>
          <div>
            <div style={{fontSize:15,fontWeight:600}}>{navItems.find(n=>n.id===page)?.label}</div>
            <div style={{fontSize:11,color:B.muted}}>{mode==="demo"?"Paper trading — live market data":"Live trading — real capital"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,padding:"6px 14px",transition:"all 0.4s"}}>
              <span style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>{T.balanceLabel}</span>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:T.accentText}}>{T.balance}</span>
              {mode==="demo"&&<span style={{fontSize:9,background:"rgba(129,140,248,0.2)",color:"#818cf8",borderRadius:4,padding:"1px 5px",fontWeight:700,letterSpacing:"0.06em"}}>DEMO</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"6px 12px",fontSize:12}}>
              <span style={{fontSize:10,color:B.dim}}>Rate</span>
              <span style={{color:rate>420?B.red:rate>320?B.amber:B.green,fontWeight:600}}>{rate}<span style={{color:B.dim,fontWeight:400}}>/500</span></span>
            </div>
            <ModeSwitch mode={mode} onChange={setMode} T={T}/>
          </div>
        </header>

        <main style={{flex:1,padding:"28px",overflowY:"auto"}}>

          {/* ── OVERVIEW ── */}
          {page==="overview"&&(
            <div className="in">

              {/* KPI Row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
                {[
                  {label:"Total P&L",      value:meta.total,  sub:`${meta.pct} · ${period==="1D"?"today":period==="7D"?"this week":period==="1M"?"this month":"this period"}`, color:B.green, spark:true},
                  {label:"Sharpe Ratio",   value:meta.sharpe, sub:"Risk-adjusted return",  color:parseFloat(meta.sharpe)>2?B.green:parseFloat(meta.sharpe)>1?B.amber:B.red, spark:false},
                  {label:"Max Drawdown",   value:meta.drawdown,sub:"Worst peak-to-trough", color:B.red, spark:false},
                  {label:"Win Streak",     value:`${meta.streak}`,sub:"Consecutive wins",  color:B.amber, spark:false},
                ].map((k,i)=>(
                  <Card key={i} style={{padding:"18px 20px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <span style={{fontSize:11,color:B.muted,letterSpacing:"0.04em",fontWeight:500}}>{k.label}</span>
                      {k.spark&&<Sparkline positive={true}/>}
                    </div>
                    <div style={{fontSize:26,fontWeight:700,color:k.color,fontFamily:"'Syne',sans-serif",letterSpacing:"-0.02em",lineHeight:1,marginBottom:6}}>{k.value}</div>
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
                       period==="1D"?"Today, Feb 22":
                       period==="7D"?"Feb 15 – Feb 22":
                       period==="1M"?"Feb 1 – Feb 22":
                       period==="3M"?"Dec 1 – Feb 22":"All time"}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <span style={{fontSize:15,fontWeight:700,color:T.accentText,transition:"color 0.4s",fontFamily:"'Syne',sans-serif"}}>{meta.total}</span>
                    <PeriodSelector period={period} setPeriod={setPeriod} T={T} customRange={customRange} setCustomRange={setCR}/>
                  </div>
                </div>
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
              </Card>

              {/* Row: Daily P&L + Category Breakdown */}
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:20,marginBottom:20}}>
                <Card style={{padding:"20px 20px 12px"}}>
                  <CardHeader title="Daily P&L" sub="Per-session result"/>
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
                </Card>

                {/* Market Category Breakdown */}
                <Card style={{padding:"18px 20px"}}>
                  <CardHeader title="Alpha by Category" sub="Where profit comes from"/>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
                    {CATEGORIES.map((cat,i)=>(
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
                    ))}
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
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={BOT_COMPARE} layout="vertical" margin={{top:0,right:20,bottom:0,left:0}}>
                      <CartesianGrid strokeDasharray="2 4" stroke={B.border} horizontal={false}/>
                      <XAxis type="number" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                      <YAxis type="category" dataKey="bot" tick={{fill:B.subtext,fontSize:11}} axisLine={false} tickLine={false} width={80}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Bar dataKey="pnl" name="P&L" radius={[0,4,4,0]}>
                        {BOT_COMPARE.map((e,i)=><Cell key={i} fill={e.pnl>=0?BOTS[i]?.color||B.green:B.red} fillOpacity={0.8}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Risk stats */}
                <Card style={{padding:"18px 20px"}}>
                  <CardHeader title="Risk Dashboard" sub="Portfolio-wide metrics"/>
                  <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:4}}>
                    {[
                      {label:"Sharpe Ratio",     val:meta.sharpe,  good:parseFloat(meta.sharpe)>2, suffix:"",     desc:"Above 2 = excellent"},
                      {label:"Max Drawdown",      val:meta.drawdown,good:false,                    suffix:"",     desc:"Worst loss from peak"},
                      {label:"Profit Factor",     val:"3.4×",       good:true,                     suffix:"",     desc:"Gross profit / gross loss"},
                      {label:"Avg Trade Size",    val:"$2,840",     good:true,                     suffix:"",     desc:"Mean position size"},
                      {label:"Avg Hold Time",     val:"4.2h",       good:true,                     suffix:"",     desc:"Avg time in market"},
                      {label:"Best Trade",        val:"+$3,528",    good:true,                     suffix:"",     desc:"Arb Alpha — Feb 19"},
                      {label:"Worst Trade",       val:"-$690",      good:false,                    suffix:"",     desc:"AI Ensemble — Feb 22"},
                    ].map((s,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<6?`1px solid ${B.border}`:"none"}}>
                        <div>
                          <div style={{fontSize:12,color:B.subtext}}>{s.label}</div>
                          <div style={{fontSize:10,color:B.dim}}>{s.desc}</div>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",color:s.good?B.green:B.red}}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Trade Heatmap */}
              <TradeHeatmap T={T}/>

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
                  <CardHeader title="Copier Performance" sub="Your P&L from each tracked wallet" right={
                    <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:`${T.accentSoft}`,color:T.accentText,fontWeight:600}}>3 Active Copies</span>
                  }/>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={COPIER_COMPARE} layout="vertical" margin={{top:0,right:20,bottom:0,left:0}}>
                      <CartesianGrid strokeDasharray="2 4" stroke={B.border} horizontal={false}/>
                      <XAxis type="number" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(1)}k`}/>
                      <YAxis type="category" dataKey="wallet" tick={{fill:B.subtext,fontSize:10}} axisLine={false} tickLine={false} width={110}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Bar dataKey="pnl" name="P&L" radius={[0,4,4,0]}>
                        {COPIER_COMPARE.map((e,i)=><Cell key={i} fill={e.pnl>0?e.color:B.border} fillOpacity={e.copySize>0?0.85:0.3}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",gap:16,marginTop:12,paddingTop:10,borderTop:`1px solid ${B.border}`}}>
                    {[{l:"Copying",v:"3 wallets",c:B.green},{l:"Studying",v:"2 wallets",c:B.muted},{l:"Total Copy P&L",v:"$7,870",c:B.green}].map((s,i)=>(
                      <div key={i}>
                        <div style={{fontSize:10,color:B.dim,letterSpacing:"0.06em",textTransform:"uppercase"}}>{s.l}</div>
                        <div style={{fontSize:13,fontWeight:700,color:s.c,fontFamily:"'Syne',sans-serif"}}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card style={{padding:"18px 20px"}}>
                  <CardHeader title="Copier Intelligence" sub={mode==="live"&&liveData?"Live data ✓":"What each wallet teaches"}/>
                  <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:4}}>
                    {COPIER_COMPARE.map((w,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<COPIER_COMPARE.length-1?`1px solid ${B.border}`:"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:w.color,flexShrink:0,opacity:w.copySize>0?1:0.4}}/>
                          <div>
                            <div style={{fontSize:11,color:w.copySize>0?B.subtext:B.dim,fontWeight:w.copySize>0?600:400}}>{w.wallet}</div>
                            <div style={{fontSize:10,color:B.dim}}>{w.method}</div>
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:12,fontWeight:700,color:w.pnl>0?B.green:w.pnl===0?B.muted:B.red,fontFamily:"'Syne',sans-serif"}}>{w.pnl>0?`+$${w.pnl.toLocaleString()}`:w.pnl===0?"—":`-$${Math.abs(w.pnl)}`}</div>
                          <div style={{fontSize:10,color:B.dim}}>{w.winRate?`${w.winRate}% win`:"study only"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

            </div>
          )}

          {/* ── BOTS ── */}
          {page==="bots"&&(
            <div className="in">
              <div style={{marginBottom:16,fontSize:12,color:B.muted,display:"flex",alignItems:"center",gap:6}}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><circle cx={12} cy={12} r={10}/><path d="M12 8v4m0 4h.01"/></svg>
                Click any bot card or row to view its trade log
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
                {BOTS.slice(0,3).map(b=>(
                  <div key={b.id} className="bot-card" onClick={()=>setBot(b)} style={{background:B.surf,border:`1px solid ${B.border}`,borderRadius:12,padding:"18px 20px",borderTop:`2px solid ${b.color}`,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                      <div><div style={{fontWeight:600,fontSize:14,marginBottom:3}}>{b.name}</div><div style={{fontSize:11,color:B.muted}}>{b.strategy}</div></div>
                      <StatusBadge status={b.status}/>
                    </div>
                    <div style={{fontSize:24,fontWeight:700,fontFamily:"'Syne',sans-serif",color:b.pnl>=0?B.green:B.red,letterSpacing:"-0.02em",marginBottom:4}}>{b.pnl>=0?"+":""}${Math.abs(b.pnl).toLocaleString()}</div>
                    <div style={{fontSize:11,color:B.muted,marginBottom:16}}>{b.pct>=0?"+":""}{b.pct}% return</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[["Win",b.win+"%"],["Ping",b.ping+"ms"],["Exec",b.exec+"ms"]].map(([l,v])=>(
                        <div key={l} style={{background:B.surf2,borderRadius:7,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:B.dim,letterSpacing:"0.08em",marginBottom:3,textTransform:"uppercase"}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:14,fontSize:11,color:T.accentText,display:"flex",alignItems:"center",gap:5,transition:"color 0.4s"}}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={T.accentText} strokeWidth={2.5}><path d="M9 18l6-6-6-6"/></svg>View trade log
                    </div>
                  </div>
                ))}
              </div>
              <Card style={{overflow:"hidden"}}>
                <div style={{padding:"18px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between"}}>
                  <div style={{fontSize:13,fontWeight:600}}>All Bots</div>
                  <span style={{fontSize:11,color:B.muted}}>{BOTS.length} strategies</span>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${B.border}`}}>
                    {["Strategy","Status","Return","Win Rate","Trades","Rate",""].map(h=>(
                      <th key={h} style={{padding:"10px 20px",textAlign:"left",fontSize:11,color:B.muted,fontWeight:500,letterSpacing:"0.04em"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {BOTS.map((b,i)=>(
                      <tr key={b.id} className="bot-row" onClick={()=>setBot(b)} style={{borderBottom:i<BOTS.length-1?`1px solid ${B.border}`:"none",background:"transparent",transition:"background 0.15s"}}>
                        <td style={{padding:"14px 20px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:30,height:30,borderRadius:8,background:`${b.color}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{width:8,height:8,borderRadius:"50%",background:b.color}}/></div>
                            <div><div style={{fontWeight:500,fontSize:13}}>{b.name}</div><div style={{fontSize:11,color:B.muted}}>{b.strategy}</div></div>
                          </div>
                        </td>
                        <td style={{padding:"14px 20px"}}><StatusBadge status={b.status}/></td>
                        <td style={{padding:"14px 20px"}}><span style={{fontWeight:600,color:b.pnl>=0?B.green:B.red}}>{b.pnl>=0?"+":""}${Math.abs(b.pnl).toLocaleString()}</span><span style={{fontSize:11,color:B.muted,marginLeft:6}}>{b.pct>=0?"+":""}{b.pct}%</span></td>
                        <td style={{padding:"14px 20px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:60,height:4,background:B.surf2,borderRadius:2,overflow:"hidden"}}><div style={{width:`${b.win}%`,height:"100%",borderRadius:2,background:b.win>70?B.green:b.win>50?B.amber:B.red}}/></div>
                            <span style={{fontSize:12,color:B.subtext}}>{b.win}%</span>
                          </div>
                        </td>
                        <td style={{padding:"14px 20px",fontSize:13,color:B.subtext}}>{b.trades.toLocaleString()}</td>
                        <td style={{padding:"14px 20px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:80,height:4,background:B.surf2,borderRadius:2,overflow:"hidden"}}><div style={{width:`${b.rate}%`,height:"100%",borderRadius:2,background:b.rate>80?B.red:b.rate>55?B.amber:B.green}}/></div>
                            <span style={{fontSize:11,color:B.muted}}>{b.rate}%</span>
                          </div>
                        </td>
                        <td style={{padding:"14px 20px"}}><span style={{fontSize:11,color:T.accentText,display:"flex",alignItems:"center",gap:4,transition:"color 0.4s"}}>→ Trades</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* ── EXECUTION ── */}
          {page==="exec"&&(
            <div className="in">
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:24}}>
                {[{label:"Avg Ping",val:`${avgPing}ms`,good:avgPing<20},{label:"Avg Execution",val:"44ms",good:true},{label:"API Rate",val:`${rate}/500`,good:rate<420},{label:"Fastest Trade",val:"11ms",good:true},{label:"Failed Orders",val:"3",good:false}].map((k,i)=>(
                  <Card key={i} style={{padding:"16px 18px"}}>
                    <div style={{fontSize:10,color:B.muted,letterSpacing:"0.06em",marginBottom:10,textTransform:"uppercase"}}>{k.label}</div>
                    <div style={{fontSize:22,fontWeight:700,fontFamily:"'Syne',sans-serif",color:k.good?B.text:B.red,letterSpacing:"-0.02em"}}>{k.val}</div>
                  </Card>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
                {[{title:"Ping Latency (ms)",color:T.lineColor},{title:"Order Execution Speed (ms)",color:T.accentText}].map((ch,ci)=>(
                  <Card key={ci} style={{padding:"20px 20px 12px"}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>{ch.title}</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={LATENCY} margin={{top:4,right:4,bottom:0,left:-20}}>
                        <defs>
                          <linearGradient id={`eg${ci}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ch.color} stopOpacity={0.18}/><stop offset="100%" stopColor={ch.color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke={B.border} vertical={false}/>
                        <XAxis dataKey="t" tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:B.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Area type="monotone" dataKey="ms" stroke={ch.color} strokeWidth={2} fill={`url(#eg${ci})`} dot={false} name={ch.title}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                ))}
              </div>
              <Card style={{padding:"20px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div><div style={{fontSize:13,fontWeight:600}}>API Rate Limit</div><div style={{fontSize:11,color:B.muted}}>Polymarket CLOB — live</div></div>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:rate>420?B.red:rate>320?B.amber:B.green}}>{rate}<span style={{fontSize:13,color:B.muted,fontFamily:"'Outfit',sans-serif",fontWeight:400}}>/500</span></span>
                </div>
                <div style={{height:8,background:B.surf2,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:4,transition:"width 0.8s ease",width:`${(rate/500)*100}%`,background:rate>420?`linear-gradient(90deg,${B.amber},${B.red})`:rate>320?`linear-gradient(90deg,${B.green},${B.amber})`:`linear-gradient(90deg,${T.accent},${B.green})`}}/>
                </div>
                <div style={{marginTop:8,fontSize:11,color:rate>420?B.amber:B.muted}}>{rate>420?"⚠ High utilization":`${500-rate} requests available this minute`}</div>
              </Card>
            </div>
          )}

          {/* ── FUNDS ── */}
          {page==="funds"&&(<div className="in"><FundsTab mode={mode} T={T} demoBalance={demoBalance} setDemoBalance={setDemoBalance} demoTxns={demoTxns} setDemoTxns={setDemoTxns} demoAllocated={demoAllocated}/></div>)}

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
                          built:   {label:"✅ Built",    bg:`rgba(16,185,129,0.15)`, color:B.green,  border:"rgba(16,185,129,0.35)"},
                          in_dev:  {label:"🔧 In Dev",   bg:"rgba(245,158,11,0.06)",color:B.amber,  border:"rgba(245,158,11,0.15)"},
                          planned: {label:"📋 Planned",  bg:"rgba(71,85,105,0.08)", color:B.dim,    border:B.border},
                        }[s.status];
                        return (
                          <div key={si} style={{
                            background:isBuilt?`rgba(16,185,129,0.04)`:B.surf,
                            border:`1px solid ${isBuilt?`${tier.color}45`:isInDev?"rgba(245,158,11,0.1)":B.border}`,
                            borderRadius:10,padding:"14px 16px",
                            opacity:isPlanned?0.45:isInDev?0.65:1,
                            filter:isPlanned?"grayscale(0.5)":isInDev?"grayscale(0.2)":"none",
                            boxShadow:isBuilt?`0 0 18px rgba(16,185,129,0.08)`:"none",
                            transition:"all 0.2s",
                            position:"relative",overflow:"hidden",
                          }}>
                            {isBuilt&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${tier.color},transparent)`}}/>}
                            {isBuilt&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:`linear-gradient(180deg,${tier.color},transparent)`}}/>}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                              <div style={{fontSize:13,fontWeight:isBuilt?700:600,color:isBuilt?B.text:isInDev?"rgba(148,163,184,0.7)":"rgba(100,116,139,0.5)",paddingRight:8}}>{s.name}</div>
                              <span style={{flexShrink:0,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:20,background:statusConf.bg,color:statusConf.color,border:`1px solid ${statusConf.border}`}}>{statusConf.label}</span>
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

              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
                <div>
                  <div style={{fontSize:20,fontWeight:700,fontFamily:"'Syne',sans-serif",letterSpacing:"-0.02em"}}>Wallet Intelligence</div>
                  <div style={{fontSize:12,color:B.muted,marginTop:4}}>Add a wallet address · Auto-configure · Go live in seconds</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:B.green,boxShadow:`0 0 6px ${B.green}`}}/>
                  <span style={{fontSize:11,color:B.green,fontWeight:600}}>
                    {wallets.filter(w=>w.connectionStatus==="live").length} COPYING LIVE
                  </span>
                  <span style={{fontSize:11,color:B.muted,marginLeft:4}}>
                    · {wallets.filter(w=>w.connectionStatus==="connected"||w.connectionStatus==="live").length} connected
                  </span>
                </div>
              </div>

              {/* ── ADD WALLET ── */}
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
                        const r = await fetch(`${ORCHESTRATOR_URL}/wallet-lookup`,{
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
                                  await fetch(`${ORCHESTRATOR_URL}/wallets`,{
                                    method:"POST",headers:{"Content-Type":"application/json"},
                                    body:JSON.stringify({wallet:{name:w.handle,address:w.address,copy:true,copy_size:w.copySize,max_usd:w.maxUsd,strategy:w.strategy||"",status:"live"}})
                                  });
                                  // Also send command to copier bot
                                  await fetch(`${ORCHESTRATOR_URL}/command`,{
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
                          const r=await fetch(`${ORCHESTRATOR_URL}/test-model`,{
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
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Supervision Schedule</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:16}}>Bots run independently — AI checks in every 6 hours</div>
                  {[
                    {time:"08:00",label:"Morning check",status:"done",model:"Gemini Flash",summary:"All healthy. Bond +$31.50."},
                    {time:"14:00",label:"Afternoon check",status:"done",model:"Gemini Flash",summary:"Rebates running 48 markets. BTC5M 71% win rate paper."},
                    {time:"20:00",label:"Evening check",status:"next",model:"Gemini Flash",summary:"Scheduled in 4h 12m"},
                    {time:"02:00",label:"Night check",status:"pending",model:"Gemini Flash",summary:"Scheduled"},
                  ].map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<3?`1px solid ${B.border}`:"none"}}>
                      <div style={{width:44,textAlign:"center"}}>
                        <div style={{fontSize:12,fontWeight:700,color:s.status==="done"?B.green:s.status==="next"?B.amber:B.dim,fontFamily:"'Syne',sans-serif"}}>{s.time}</div>
                      </div>
                      <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:s.status==="done"?B.green:s.status==="next"?B.amber:B.border,boxShadow:s.status==="next"?`0 0 6px ${B.amber}`:"none"}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:600,color:s.status==="pending"?B.dim:B.subtext}}>{s.label}</div>
                        <div style={{fontSize:10,color:B.dim}}>{s.summary}</div>
                      </div>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:s.status==="done"?`${B.green}15`:s.status==="next"?`${B.amber}15`:B.surf2,color:s.status==="done"?B.green:s.status==="next"?B.amber:B.dim,fontWeight:600}}>{s.model}</span>
                    </div>
                  ))}
                </Card>

                <Card style={{padding:"20px"}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Bot Independence Status</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:16}}>Each bot runs on its own — AI is optional</div>
                  {[
                    {bot:"Bond Bot",         status:"live",  aiDep:"None",    desc:"Runs its own logic. Scans Gamma API, enters, holds, exits."},
                    {bot:"Maker Rebates",    status:"live",  aiDep:"None",    desc:"Posts limit orders every 30s. Pure mechanical execution."},
                    {bot:"BTC5M Bot",        status:"paper", aiDep:"None",    desc:"Reads Chainlink directly. Zero AI dependency."},
                    {bot:"Copier Bot",       status:"live",  aiDep:"None",    desc:"Polls wallet addresses. Mirrors trades at set size."},
                    {bot:"AI Supervisor",    status:"live",  aiDep:"Gemini",  desc:"Checks in every 6hrs. Bots keep running if it's offline."},
                  ].map((b,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<4?`1px solid ${B.border}`:"none"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:b.status==="live"?B.green:b.status==="paper"?B.amber:B.border}}/>
                        <div>
                          <div style={{fontSize:11,fontWeight:600,color:B.subtext}}>{b.bot}</div>
                          <div style={{fontSize:10,color:B.dim}}>{b.desc}</div>
                        </div>
                      </div>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,flexShrink:0,
                        background:b.aiDep==="None"?`${B.green}10`:`rgba(139,92,246,0.1)`,
                        color:b.aiDep==="None"?B.green:"#a78bfa",fontWeight:600
                      }}>AI dep: {b.aiDep}</span>
                    </div>
                  ))}
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
                      onKeyDown={async e=>{if(e.key==="Enter"&&aiInput.trim()&&!aiLoading){const msg=aiInput.trim();setAiInput("");setAiChat(p=>[...p,{role:"user",text:msg,time:"now"}]);setAiLoading(true);try{const r=await fetch(`${ORCHESTRATOR_URL}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})});const d=await r.json();setAiChat(p=>[...p,{role:"assistant",text:d.reply||"Error",time:"now"}]);}catch{setAiChat(p=>[...p,{role:"assistant",text:"⚠️ Orchestrator offline.",time:"now"}]);}setAiLoading(false);}}}
                      placeholder='Ask anything — "How are we doing?" "Is BTC5M ready to go live?"'
                      style={{flex:1,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,outline:"none",fontFamily:"'Outfit',sans-serif"}}
                    />
                    <button onClick={async()=>{if(!aiInput.trim()||aiLoading)return;const msg=aiInput.trim();setAiInput("");setAiChat(p=>[...p,{role:"user",text:msg,time:"now"}]);setAiLoading(true);try{const r=await fetch(`${ORCHESTRATOR_URL}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})});const d=await r.json();setAiChat(p=>[...p,{role:"assistant",text:d.reply||"Error",time:"now"}]);}catch{setAiChat(p=>[...p,{role:"assistant",text:"⚠️ Orchestrator offline.",time:"now"}]);}setAiLoading(false);}}
                      style={{padding:"9px 16px",background:T.accentSoft,border:`1px solid ${T.accentBorder}`,borderRadius:8,color:T.accentText,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>Send</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                    {["How much did we make today?","Is BTC5M ready to go live?","Which bot is best?","Should I add capital?"].map((q,i)=>(
                      <button key={i} onClick={()=>setAiInput(q)} style={{padding:"3px 9px",fontSize:10,background:B.surf2,border:`1px solid ${B.border}`,borderRadius:20,color:B.muted,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>{q}</button>
                    ))}
                  </div>
                </Card>

                <Card style={{padding:"20px",height:420,display:"flex",flexDirection:"column"}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Supervision Log</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:14}}>Gemini's decisions · every 6 hours</div>
                  <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                    {aiDecisions.map((d,i)=>(
                      <div key={i} style={{background:B.surf2,borderRadius:8,padding:"11px 13px",border:`1px solid ${d.risk_level==="HIGH"?`${B.red}30`:d.risk_level==="MEDIUM"?`${B.amber}25`:B.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <span style={{fontSize:10,fontWeight:600,color:d.type==="user_command"?T.accentText:"#10b981",letterSpacing:"0.05em",textTransform:"uppercase"}}>
                            {d.type==="user_command"?"👤 You":d.type==="manual_command"?"🎮 Override":"🟢 Gemini"}
                          </span>
                          <div style={{display:"flex",gap:5,alignItems:"center"}}>
                            {d.risk_level&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:d.risk_level==="LOW"?`${B.green}15`:`${B.amber}15`,color:d.risk_level==="LOW"?B.green:B.amber,fontWeight:600}}>{d.risk_level}</span>}
                            <span style={{fontSize:10,color:B.dim}}>{d.time}</span>
                          </div>
                        </div>
                        <div style={{fontSize:11,color:B.subtext,lineHeight:1.5}}>{d.assessment||d.reply||d.message}</div>
                        {d.opportunities?.slice(0,1).map((op,j)=>(
                          <div key={j} style={{fontSize:10,color:B.green,background:`${B.green}08`,borderRadius:4,padding:"3px 7px",marginTop:5}}>💡 {op}</div>
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
                      try{await fetch(`${ORCHESTRATOR_URL}/command`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bot:cmd.bot,action:cmd.action})});
                      setAiDecisions(p=>[{id:`D-${Date.now()}`,time:"now",type:"manual_command",assessment:`Manual override: ${cmd.action} → ${cmd.bot}`,decisions:[],risk_level:"LOW"},...p]);}
                      catch{alert("Orchestrator offline — check VPS");}
                    }} style={{padding:"8px 14px",background:`${cmd.color}12`,border:`1px solid ${cmd.color}35`,borderRadius:8,color:cmd.color,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>{cmd.label}</button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {page==="settings"&&(
            <div className="in" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,maxWidth:900}}>
              <Card style={{padding:"22px 24px"}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>API Configuration</div>
                <div style={{fontSize:11,color:B.muted,marginBottom:20}}>Connect your Polymarket account</div>
                {[{label:"Polymarket API Key",ph:"pk_live_xxxx",type:"password"},{label:"Polygon Wallet Key",ph:"0x...",type:"password"},{label:"RPC Endpoint",ph:"https://polygon-rpc.com",type:"text"},{label:"Max Rate Limit",ph:"500",type:"number"},{label:"Default Slippage (%)",ph:"1.5",type:"number"}].map((f,i)=>(
                  <div key={i} style={{marginBottom:16}}>
                    <label style={{fontSize:11,color:B.muted,letterSpacing:"0.04em",display:"block",marginBottom:6}}>{f.label.toUpperCase()}</label>
                    <input type={f.type} placeholder={f.ph} value={f.label.includes("API")?apiKey:undefined} onChange={f.label.includes("API")?e=>setApiKey(e.target.value):undefined} style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,fontFamily:"'Outfit',sans-serif",transition:"all 0.2s"}}/>
                  </div>
                ))}
                <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2200);}} style={{width:"100%",padding:"10px",borderRadius:8,fontSize:13,fontWeight:600,background:saved?"rgba(16,185,129,0.15)":T.accentSoft,border:`1px solid ${saved?"rgba(16,185,129,0.4)":T.accentBorder}`,color:saved?B.green:T.accentText,transition:"all 0.3s"}}>
                  {saved?"✓  Saved":"Save configuration"}
                </button>
              </Card>
              <div>
                <Card style={{padding:"22px 24px",marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Risk Controls</div>
                  <div style={{fontSize:11,color:B.muted,marginBottom:20}}>Automated protections</div>
                  {[{k:"autoRestart",label:"Auto-restart on crash",desc:"Re-launch bots on exit"},{k:"slipGuard",label:"Slippage guard",desc:"Cancel if slippage exceeds threshold"},{k:"rateAlert",label:"Rate limit warnings",desc:"Alert at 80% utilization"},{k:"webhooks",label:"Webhook notifications",desc:"POST events to Slack or Discord"}].map(({k,label,desc})=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:`1px solid ${B.border}`}}>
                      <div><div style={{fontSize:13,fontWeight:500}}>{label}</div><div style={{fontSize:11,color:B.muted,marginTop:2}}>{desc}</div></div>
                      <div onClick={()=>setToggles(t=>({...t,[k]:!t[k]}))} style={{width:44,height:24,borderRadius:12,position:"relative",cursor:"pointer",flexShrink:0,background:toggles[k]?T.accentSoft:B.surf2,border:`1px solid ${toggles[k]?T.accentBorder:B.border}`,transition:"all 0.3s"}}>
                        <div style={{position:"absolute",top:3,left:toggles[k]?22:4,width:16,height:16,borderRadius:"50%",transition:"all 0.3s",background:toggles[k]?T.accentText:B.muted}}/>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card style={{padding:"22px 24px"}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:20}}>Position Limits</div>
                  {[{label:"Max Position Size",placeholder:"$5,000 USDC"},{label:"Daily Loss Limit",placeholder:"$1,000 USDC"}].map((f,i)=>(
                    <div key={i} style={{marginBottom:i===0?14:0}}>
                      <label style={{fontSize:11,color:B.muted,letterSpacing:"0.04em",display:"block",marginBottom:6}}>{f.label.toUpperCase()}</label>
                      <input type="text" placeholder={f.placeholder} style={{width:"100%",background:B.surf2,border:`1px solid ${B.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:B.text,fontFamily:"'Outfit',sans-serif"}}/>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

        </main>
      </div>

      {selectedBot&&<TradeDrawer bot={selectedBot} onClose={()=>setBot(null)} T={T}/>}
    </div>
  );
}
