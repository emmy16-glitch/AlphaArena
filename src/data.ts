export type Asset = {
  symbol: string; name: string; price: number; changePct: number; changeAbs: number; volume: string;
  high24: number; low24: number; spark: number[]; volatility: 'Low'|'Normal'|'Elevated'|'High';
  liquidity: 'Deep'|'Normal'|'Thin'|'Strained'; sentiment: number; status: string; session: string;
};

export const assets: Asset[] = [
  { symbol:'rNVDA', name:'NVIDIA · Tokenized', price:184.42, changePct:4.21, changeAbs:7.44, volume:'8.2M', high24:186.10, low24:176.02, spark:[176.2,176.8,175.9,177.4,178.1,177.2,179.5,180.8,179.9,181.2,182.6,181.8,183.4,184.9,184.1,184.42], volatility:'Elevated', liquidity:'Normal', sentiment:62, status:'Unusual overnight strength', session:'Overnight · Live' },
  { symbol:'rTSLA', name:'Tesla · Tokenized', price:248.91, changePct:-2.14, changeAbs:-5.44, volume:'5.1M', high24:256.40, low24:246.80, spark:[256.1,255.2,254,254.8,253.1,251.9,252.6,251.2,250.4,249.8,250.9,249.1,248.5,249.3,248.2,248.91], volatility:'Normal', liquidity:'Deep', sentiment:-18, status:'Drifting lower on light news', session:'Overnight · Live' },
  { symbol:'rAAPL', name:'Apple · Tokenized', price:232.18, changePct:0.84, changeAbs:1.93, volume:'3.4M', high24:233.02, low24:229.44, spark:[230.1,230.6,229.8,230.9,231.4,231,231.8,232.4,231.9,232,232.6,232.1,231.7,232.2,232,232.18], volatility:'Low', liquidity:'Deep', sentiment:24, status:'Calm, tracking index', session:'Overnight · Live' },
  { symbol:'rMSFT', name:'Microsoft · Tokenized', price:428.55, changePct:1.12, changeAbs:4.75, volume:'2.1M', high24:430.20, low24:422.10, spark:[423.1,424.2,423.5,425.1,426,425.4,426.8,427.5,426.9,427.8,428.9,428.1,429,428.4,428.1,428.55], volatility:'Low', liquidity:'Deep', sentiment:31, status:'Steady bid, low vol', session:'Overnight · Live' },
  { symbol:'rAMD', name:'AMD · Tokenized', price:122.67, changePct:2.86, changeAbs:3.41, volume:'4.6M', high24:123.40, low24:118.20, spark:[118.4,119.1,118.8,120.2,119.6,120.8,121.4,120.9,121.8,122.3,121.7,122.5,122.1,122.9,122.4,122.67], volatility:'Normal', liquidity:'Normal', sentiment:44, status:'Sympathy move with NVDA', session:'Overnight · Live' },
  { symbol:'rQQQ', name:'Nasdaq 100 · Tokenized', price:512.30, changePct:0.62, changeAbs:3.16, volume:'1.8M', high24:514.10, low24:508.44, spark:[509.1,509.8,508.9,510.2,511,510.5,511.4,512,511.6,512.4,512.8,512.2,512.9,512.5,512.1,512.30], volatility:'Low', liquidity:'Deep', sentiment:28, status:'Index anchor, stable', session:'Overnight · Live' },
];

export type PulseItem = { id:string; time:string; asset:string; severity:'info'|'elevated'|'watch'; title:string; summary:string; tags:string[]; score:number };
export const pulseItems: PulseItem[] = [
  { id:'p1', time:'8m ago', asset:'rNVDA', severity:'elevated', title:'Unusual overnight strength', summary:'rNVDA is +4.2% with volume 2.3× its overnight median. Move began without a single headline — consistent with repositioning ahead of an AI partnership briefing.', tags:['Volume anomaly','Gap risk'], score:78 },
  { id:'p2', time:'26m ago', asset:'rTSLA', severity:'watch', title:'Order-book thinning below $250', summary:'Bid depth within 1% fell in the last hour. Price is drifting, not breaking — but the liquidity cushion is thinner than usual for this hour.', tags:['Liquidity','Fragile'], score:54 },
  { id:'p3', time:'1h ago', asset:'Macro', severity:'info', title:'Yields steady, futures flat', summary:'Overnight tape is stock-specific, not macro-driven. Cross-asset pressure is low — moves appear more idiosyncratic.', tags:['Macro','Calm'], score:22 },
  { id:'p4', time:'2h ago', asset:'rAMD', severity:'info', title:'Sympathy bid, weaker conviction', summary:'rAMD follows rNVDA but on thinner volume and fading momentum. Analogues suggest sympathy legs fade first if NVDA cools.', tags:['Analogue','Sympathy'], score:41 },
];

export type Battle = { id:string; asset:string; thesis:string; userSide:'LONG'|'SHORT'|'WAIT'; aiSide:'LONG'|'SHORT'|'WAIT'; aiName:string; entry:number; current:number; userPnl:number; aiPnl:number; timeLeft:string; progress:number; stake:number; status:'live'|'closing'|'settled'; participants:number };
export const battles: Battle[] = [
  { id:'b1', asset:'rNVDA', thesis:'Partnership momentum carries through the overnight session.', userSide:'LONG', aiSide:'WAIT', aiName:'NightOwl v3', entry:181.20, current:184.42, userPnl:3.12, aiPnl:0, timeLeft:'5h 12m', progress:38, stake:10000, status:'live', participants:1842 },
  { id:'b2', asset:'rTSLA', thesis:'Liquidity gap resolves lower before U.S. open.', userSide:'SHORT', aiSide:'SHORT', aiName:'Contrarian-7', entry:251.40, current:248.91, userPnl:1.84, aiPnl:1.84, timeLeft:'2h 44m', progress:62, stake:5000, status:'live', participants:967 },
  { id:'b3', asset:'rAAPL', thesis:'Calm drift — no edge, no trade.', userSide:'WAIT', aiSide:'LONG', aiName:'Driftline', entry:231.02, current:232.18, userPnl:0, aiPnl:0.51, timeLeft:'8h 05m', progress:21, stake:2500, status:'live', participants:412 },
];

export type Leader = { rank:number; name:string; type:'human'|'ai'; style:string; returnPct:number; winRate:number; streak:number; battles:number };
export const leaders: Leader[] = [
  { rank:1, name:'NightOwl v3', type:'ai', style:'Patient · Mean-reversion', returnPct:34.2, winRate:71, streak:8, battles:214 },
  { rank:2, name:'mira.trades', type:'human', style:'Event-driven', returnPct:28.7, winRate:64, streak:5, battles:96 },
  { rank:3, name:'Contrarian-7', type:'ai', style:'Contrarian · Vol fade', returnPct:26.1, winRate:62, streak:4, battles:187 },
  { rank:4, name:'kaito', type:'human', style:'Momentum', returnPct:22.4, winRate:58, streak:3, battles:142 },
  { rank:5, name:'Driftline', type:'ai', style:'Trend · Low turnover', returnPct:19.8, winRate:66, streak:6, battles:158 },
  { rank:6, name:'sofia.q', type:'human', style:'Macro aware', returnPct:17.2, winRate:59, streak:2, battles:88 },
  { rank:7, name:'Skeptic Prime', type:'ai', style:'Risk-first · WAIT heavy', returnPct:15.9, winRate:74, streak:9, battles:201 },
  { rank:8, name:'You', type:'human', style:'Learning · Balanced', returnPct:12.4, winRate:57, streak:3, battles:34 },
];

export const scenarios = [
  { id:'s1', label:'Nasdaq −5% overnight', category:'Index shock', severity:72 },
  { id:'s2', label:'NVDA earnings miss', category:'Single-name', severity:64 },
  { id:'s3', label:'Yields spike +40bp', category:'Macro', severity:58 },
  { id:'s4', label:'AI regulation shock', category:'Policy', severity:81 },
  { id:'s5', label:'Chip export restriction', category:'Geopolitics', severity:77 },
  { id:'s6', label:'Liquidity freeze', category:'Market structure', severity:69 },
];

export function sparkPath(data:number[], w=120, h=36): string { const min=Math.min(...data); const max=Math.max(...data); const range=max-min||1; const step=w/(data.length-1); return data.map((v,i)=>{ const x=i*step; const y=h-((v-min)/range)*(h-4)-2; return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' '); }
export function fmtPrice(n:number): string { return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
