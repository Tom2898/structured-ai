/**
 * pricing.js — Structured Products Pricing Models  v2
 *
 * Key improvements over v1:
 *  1. Forward-based BS: F = S·e^(r-q)T — div yield ora abbassa correttamente il forward
 *  2. Skew adjustment: vol(K) = atmVol - skew·ln(K/F)  — i put OTM vengono
 *     prezzati con vol più alta (come da mercato reale), aumentando le cedole
 *  3. Down-and-out put: Rubinstein-Reiner (1991) closed-form, non reflection approx
 *  4. Bug DIST_COST duplicato rimosso (in v1 era azzerato silenziosamente)
 *  5. Clamp cedole più ampi e realistici
 *  6. buildMarketDataPrompt richiede anche skew al motore AI
 */

// ── Black-Scholes helpers ────────────────────────────────────────────────────

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

function normCDF(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Black-Scholes European option — FORWARD-BASED.
 * F = S·e^(r-q)T: il div yield abbassa il forward (call meno care, put più care).
 */
function bsPrice(type, S, K, T, r, q, vol) {
  if (T <= 0 || vol <= 0) return Math.max(0, type === "call" ? S - K : K - S);
  const F  = S * Math.exp((r - q) * T);
  const df = Math.exp(-r * T);
  const d1 = (Math.log(F / K) + 0.5 * vol * vol * T) / (vol * Math.sqrt(T));
  const d2 = d1 - vol * Math.sqrt(T);
  if (type === "call") {
    return df * (F * normCDF(d1) - K * normCDF(d2));
  } else {
    return df * (K * normCDF(-d2) - F * normCDF(-d1));
  }
}

/**
 * Skew-adjusted implied vol per uno strike K vs forward F.
 * Modello sticky-strike lineare:
 *   vol(K) = atmVol - skew · ln(K/F)
 *
 * skew negativo = equity put skew (put OTM costano più degli ATM):
 *   es. skew=-0.12, barriera 65%, fwd 1.06 →
 *   vol = atmVol - (-0.12)·ln(0.65/1.06) ≈ atmVol + 5.9 vols extra
 *
 * Valori tipici: indice -0.10/-0.15, single stock -0.15/-0.25
 */
function skewAdjustedVol(atmVol, K, F, skew) {
  const logMoney = Math.log(K / F);
  const adj = atmVol - skew * logMoney;
  return Math.max(adj, atmVol * 0.5);
}

/**
 * Down-and-out PUT — Rubinstein-Reiner (1991) closed form.
 * S=1, K=strike fraction, H=barrier fraction. Condizione: H < K, S > H.
 */
function downAndOutPut(S, K, H, T, r, q, vol) {
  if (H >= K || S <= H || T <= 0 || vol <= 0) return 0;
  const mu  = (r - q - 0.5 * vol * vol) / (vol * vol);
  const F   = S * Math.exp((r - q) * T);
  const df  = Math.exp(-r * T);
  const sqT = vol * Math.sqrt(T);

  // Vanilla put (forward-based)
  const d1v  = (Math.log(F / K)) / sqT + sqT / 2;
  const d2v  = d1v - sqT;
  const vanPut = df * (K * normCDF(-d2v) - F * normCDF(-d1v));

  // Down-and-in put via Rubinstein-Reiner
  const hS2mu = Math.pow(H / S, 2 * mu);
  const hS2mu2 = Math.pow(H / S, 2 * (mu + 1));
  const hh = H * H;

  const y1  = (Math.log(hh / (S * K))) / sqT + (1 + mu) * sqT;
  const y1m = y1 - sqT;
  const y2  = (Math.log(H / S)) / sqT + (1 + mu) * sqT;
  const y2m = y2 - sqT;

  const diPut =
    - S * Math.exp(-q * T) * hS2mu2 * normCDF(y1)
    + K * df * hS2mu * normCDF(y1m);

  const diPutClamped = Math.max(0, Math.min(vanPut, diPut));
  return Math.max(0, vanPut - diPutClamped);
}

// ── Utility ──────────────────────────────────────────────────────────────────

function round2(x) { return Math.round(x * 1000) / 10; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function pct(x) { return `${round2(x)}%`; }
function pctPA(x) { return `${round2(x)}% p.a.`; }
function months(T) { return `${Math.round(T * 12)} mesi`; }

// ── Worst-of basket vol (Gaussian copula) ────────────────────────────────────

function worstOfVol(vols, rho = 0.4) {
  const N = vols.length;
  if (N === 1) return vols[0];
  const avgVol = vols.reduce((a, b) => a + b, 0) / N;
  const maxVol = Math.max(...vols);
  return avgVol + (maxVol - avgVol) * (1 - rho) * (1 - 1 / N);
}

// ── EUR risk-free rate curve (mid-2025) ──────────────────────────────────────

function riskFreeRate(T) {
  if (T <= 0.5) return 0.032;
  if (T <= 1.0) return 0.031;
  if (T <= 1.5) return 0.030;
  if (T <= 2.0) return 0.030;
  return 0.028;
}

// ── Costi struttura ───────────────────────────────────────────────────────────

const ISSUER_SPREAD = 0.010;  // 1.0% p.a. margine emittente
const DIST_COST     = 0.005;  // 0.5% p.a. distribuzione  (bug: era azzerato in v1)
const TOTAL_COST_PA = ISSUER_SPREAD + DIST_COST;  // 1.5% p.a. totale

// ── Skew default per regime di volatilità ────────────────────────────────────

function defaultSkew(vol) {
  if (vol > 0.40) return -0.22;
  if (vol > 0.30) return -0.18;
  if (vol > 0.20) return -0.13;
  return -0.10;
}

// ──────────────────────────────────────────────────────────────────────────────
// PRICING MODELS
// Input: { vols, divYields, T, skews? }
//   skews: array di slope skew per sottostante (stimato da vol se assente)
// ──────────────────────────────────────────────────────────────────────────────

/** AUTOCALL / PHOENIX */
export function priceAutocall({ vols, divYields, T, skews }) {
  const vol  = vols[0];
  const q    = divYields[0] ?? 0.03;
  const r    = riskFreeRate(T);
  const skew = skews?.[0] ?? defaultSkew(vol);
  const F    = Math.exp((r - q) * T);

  const barrierLevel = vol > 0.35 ? 0.55 : vol > 0.25 ? 0.60 : 0.65;
  const volAtBarrier = skewAdjustedVol(vol, barrierLevel, F, skew);

  const putValue    = downAndOutPut(1, 1, barrierLevel, T, r, q, volAtBarrier);
  const rawCouponPA = (putValue / T) - TOTAL_COST_PA;
  const couponPA    = clamp(rawCouponPA, 0.04, 0.22);

  return {
    barrier: pct(barrierLevel),
    coupon:  pctPA(couponPA),
    participation: "N/A",
    protection: "Condizionale (sopra barriera)",
    strike: "100%",
    observationFrequency: "Trimestrale",
    maturity: months(T),
    note: `Vol ATM: ${pct(vol)} | Vol@bar: ${pct(volAtBarrier)} | Fwd: ${pct(F)} | Skew: ${skew.toFixed(2)} | Div: ${pct(q)}`
  };
}

/** WORST-OF AUTOCALL */
export function priceWorstOfAutocall({ vols, divYields, T, skews }) {
  const vol  = worstOfVol(vols, 0.35);
  const q    = Math.min(...divYields.map(d => d ?? 0.025));
  const r    = riskFreeRate(T);
  const skew = skews?.[0] ?? defaultSkew(vol);
  const F    = Math.exp((r - q) * T);

  const barrierLevel = vol > 0.40 ? 0.50 : vol > 0.30 ? 0.55 : 0.60;
  const volAtBarrier = skewAdjustedVol(vol, barrierLevel, F, skew);

  const putValue    = downAndOutPut(1, 1, barrierLevel, T, r, q, volAtBarrier);
  const rawCouponPA = (putValue / T) * 1.15 - TOTAL_COST_PA;
  const couponPA    = clamp(rawCouponPA, 0.06, 0.30);

  return {
    barrier: pct(barrierLevel),
    coupon:  pctPA(couponPA),
    participation: "N/A",
    protection: "Condizionale — worst-of",
    strike: "100%",
    observationFrequency: "Trimestrale",
    maturity: months(T),
    note: `Vol WO: ${pct(vol)} | Vol@bar: ${pct(volAtBarrier)} | Fwd: ${pct(F)} | Div min: ${pct(q)}`
  };
}

/** REVERSE CONVERTIBLE — put ATM, no skew necessario */
export function priceReverseConvertible({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] ?? 0.03;
  const r   = riskFreeRate(T);

  const putValue    = bsPrice("put", 1, 1, T, r, q, vol);
  const rawCouponPA = (putValue / T) - TOTAL_COST_PA;
  const couponPA    = clamp(rawCouponPA, 0.05, 0.28);

  return {
    barrier: "N/A",
    coupon:  pctPA(couponPA),
    participation: "N/A",
    protection: "Nessuna — rimborso in azioni sotto strike",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Put ATM: ${pct(putValue)} | Div: ${pct(q)}`
  };
}

/** BARRIER REVERSE CONVERTIBLE */
export function priceBarrierReverseConv({ vols, divYields, T, skews }) {
  const vol  = vols[0];
  const q    = divYields[0] ?? 0.03;
  const r    = riskFreeRate(T);
  const skew = skews?.[0] ?? defaultSkew(vol);
  const F    = Math.exp((r - q) * T);

  const barrierLevel = vol > 0.35 ? 0.60 : vol > 0.25 ? 0.65 : 0.70;
  const volAtBarrier = skewAdjustedVol(vol, barrierLevel, F, skew);

  const putValue    = downAndOutPut(1, 1, barrierLevel, T, r, q, volAtBarrier);
  const rawCouponPA = (putValue / T) - TOTAL_COST_PA;
  const couponPA    = clamp(rawCouponPA, 0.04, 0.22);

  return {
    barrier: pct(barrierLevel),
    coupon:  pctPA(couponPA),
    participation: "N/A",
    protection: `Condizionale — rimborso integrale se mai violata la barriera ${pct(barrierLevel)}`,
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol ATM: ${pct(vol)} | Vol@bar: ${pct(volAtBarrier)} | Fwd: ${pct(F)} | Div: ${pct(q)}`
  };
}

/** BONUS CERTIFICATE */
export function priceBonusCertificate({ vols, divYields, T, skews }) {
  const vol  = vols[0];
  const q    = divYields[0] ?? 0.03;
  const r    = riskFreeRate(T);
  const skew = skews?.[0] ?? defaultSkew(vol);
  const F    = Math.exp((r - q) * T);

  const barrierLevel = vol > 0.35 ? 0.55 : vol > 0.25 ? 0.60 : 0.65;
  const volAtBarrier = skewAdjustedVol(vol, barrierLevel, F, skew);

  const putCost    = downAndOutPut(1, 1, barrierLevel, T, r, q, volAtBarrier);
  const divFunding = q * T;
  const bonusRaw   = 1 + (divFunding - putCost - TOTAL_COST_PA * T);
  const bonusLevel = clamp(bonusRaw, 1.05, 1.45);

  return {
    barrier: pct(barrierLevel),
    coupon:  "N/A",
    participation: `1:1 al rialzo sopra ${pct(bonusLevel)}, bonus minimo ${pct(bonusLevel)} a scadenza`,
    protection: `Bonus ${pct(bonusLevel)} garantito se barriera ${pct(barrierLevel)} mai violata`,
    strike: "100%",
    observationFrequency: "Continua (barriera americana)",
    maturity: months(T),
    note: `Vol ATM: ${pct(vol)} | Bonus: ${pct(bonusLevel)} | Div funding: ${pct(divFunding)}`
  };
}

/** EXPRESS CERTIFICATE */
export function priceExpress({ vols, divYields, T }) {
  const vol  = vols[0];
  const q    = divYields[0] ?? 0.03;
  const r    = riskFreeRate(T);
  const nObs = Math.max(1, Math.round(T));

  const callValue1Y   = bsPrice("call", 1, 1, 1, r, q, vol);
  const stepUpPerYear = clamp(callValue1Y - TOTAL_COST_PA, 0.04, 0.20);

  return {
    barrier: "60–70% (barriera capitale a scadenza)",
    coupon:  `${pct(stepUpPerYear)} per anno (step-up cumulativo)`,
    participation: "N/A",
    protection: "Capitale protetto a scadenza se sopra barriera",
    strike: "100%",
    observationFrequency: "Annuale",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Step-up/anno: ${pct(stepUpPerYear)} | Obs: ${nObs} | Div: ${pct(q)}`
  };
}

/** CAPITAL PROTECTED NOTE */
export function priceCapitalProtected({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] ?? 0.03;
  const r   = riskFreeRate(T);

  const bondFloor     = Math.exp(-r * T);
  const optionBudget  = (1 - bondFloor) - TOTAL_COST_PA * T;
  const callPrice     = bsPrice("call", 1, 1, T, r, q, vol);
  const participation = clamp(optionBudget / callPrice, 0.55, 1.70);

  return {
    barrier: "N/A",
    coupon:  "N/A",
    participation: `${pct(participation)} della performance al rialzo`,
    protection: "100% del capitale a scadenza",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Bond floor: ${pct(bondFloor)} | Call: ${pct(callPrice)} | Div: ${pct(q)}`
  };
}

/** OUTPERFORMANCE CERTIFICATE — leva finanziata dal div yield */
export function priceOutperformance({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] ?? 0.03;
  const r   = riskFreeRate(T);

  const callCost    = bsPrice("call", 1, 1, T, r, q, vol);
  const divFunding  = q * T;
  const extraPartic = clamp((divFunding - TOTAL_COST_PA * T) / callCost, 0.05, 1.30);
  const totalPartic = 1 + extraPartic;

  return {
    barrier: "N/A",
    coupon:  "N/A",
    participation: `${pct(totalPartic)} sopra lo strike, 1:1 sotto lo strike`,
    protection: "Nessuna protezione del capitale",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Div funding: ${pct(divFunding)} | Leva extra: ${pct(extraPartic)}`
  };
}

/** TWIN WIN */
export function priceTwinWin({ vols, divYields, T, skews }) {
  const vol  = vols[0];
  const q    = divYields[0] ?? 0.03;
  const r    = riskFreeRate(T);
  const skew = skews?.[0] ?? defaultSkew(vol);
  const F    = Math.exp((r - q) * T);

  const barrierLevel = vol > 0.35 ? 0.55 : vol > 0.25 ? 0.60 : 0.65;
  const volAtBarrier = skewAdjustedVol(vol, barrierLevel, F, skew);

  const callVal  = bsPrice("call", 1, 1, T, r, q, vol);
  const putVal   = bsPrice("put",  1, 1, T, r, q, vol);
  const boPut    = downAndOutPut(1, 1, barrierLevel, T, r, q, volAtBarrier);
  const budget   = (callVal + putVal - boPut) - TOTAL_COST_PA * T;
  const partic   = clamp(budget / callVal, 0.75, 1.70);

  return {
    barrier: pct(barrierLevel),
    coupon:  "N/A",
    participation: `${pct(partic)} in entrambe le direzioni — barriera ${pct(barrierLevel)}`,
    protection: "Protezione condizionale — se barriera violata, performance lineare",
    strike: "100%",
    observationFrequency: "Continua (barriera americana)",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Partic.: ${pct(partic)} | Fwd: ${pct(F)} | Vol@bar: ${pct(volAtBarrier)}`
  };
}

/** SHARK NOTE */
export function priceSharkNote({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] ?? 0.03;
  const r   = riskFreeRate(T);

  const capLevel        = vol > 0.30 ? 1.25 : 1.35;
  const callATM         = bsPrice("call", 1, 1,       T, r, q, vol);
  const callCap         = bsPrice("call", 1, capLevel, T, r, q, vol);
  const callSpreadValue = callATM - callCap;
  const couponPA        = clamp((callSpreadValue / T) - TOTAL_COST_PA, 0.03, 0.16);

  return {
    barrier: `Cap al ${pct(capLevel)} (barriera superiore)`,
    coupon:  pctPA(couponPA),
    participation: `${pct(1)} fino al cap ${pct(capLevel)}, poi cedola aggiuntiva`,
    protection: "Nessuna protezione del capitale",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Cap: ${pct(capLevel)} | Call spread: ${pct(callSpreadValue)}`
  };
}

/** AIRBAG CERTIFICATE */
export function priceAirbag({ vols, divYields, T, skews }) {
  const vol  = vols[0];
  const q    = divYields[0] ?? 0.03;
  const r    = riskFreeRate(T);
  const skew = skews?.[0] ?? defaultSkew(vol);
  const F    = Math.exp((r - q) * T);

  const barrierLevel  = vol > 0.35 ? 0.60 : vol > 0.25 ? 0.65 : 0.70;
  const volAtBarrier  = skewAdjustedVol(vol, barrierLevel, F, skew);
  const airbagFactor  = barrierLevel;

  const callCost      = bsPrice("call", 1, 1, T, r, q, vol);
  const airbagPutCost = downAndOutPut(1, 1, barrierLevel, T, r, q, volAtBarrier);
  const divFunding    = q * T;
  const participRaw   = 1 - (airbagPutCost - divFunding + TOTAL_COST_PA * T) / callCost;
  const participation = clamp(participRaw, 0.75, 1.15);

  return {
    barrier: pct(barrierLevel),
    coupon:  "N/A",
    participation: `${pct(participation)} al rialzo`,
    protection: `Meccanismo airbag: perdite sotto ${pct(barrierLevel)} ridotte di ~${pct(airbagFactor)}`,
    strike: "100%",
    observationFrequency: "Continua (barriera americana)",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Vol@bar: ${pct(volAtBarrier)} | Airbag: ${pct(airbagFactor)} | Div: ${pct(q)}`
  };
}

/** DIGITAL / BINARY NOTE */
export function priceDigital({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] ?? 0.03;
  const r   = riskFreeRate(T);
  const F   = Math.exp((r - q) * T);

  const targetLevel = vol > 0.30 ? 1.0 : 1.05;
  const d2   = (Math.log(F / targetLevel) - 0.5 * vol * vol * T) / (vol * Math.sqrt(T));
  const prob = normCDF(d2);

  const grossCoupon = clamp(0.15 / Math.max(prob, 0.10), 0.10, 0.45);

  return {
    barrier: `Target ${pct(targetLevel)} a scadenza`,
    coupon:  `${pct(grossCoupon)} fisso se sopra target (prob. ~${pct(prob)})`,
    participation: "N/A",
    protection: "Nessuna — rimborso 100% se sotto target, coupon perso",
    strike: pct(targetLevel),
    observationFrequency: "A scadenza",
    maturity: months(T),
    note: `Vol: ${pct(vol)} | Fwd: ${pct(F)} | Prob: ${pct(prob)} | Cedola lorda: ${pct(grossCoupon)}`
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const PRICERS = {
  autocall:   priceAutocall,
  worstof:    priceWorstOfAutocall,
  reverse:    priceReverseConvertible,
  barrier:    priceBarrierReverseConv,
  bonus:      priceBonusCertificate,
  express:    priceExpress,
  capital:    priceCapitalProtected,
  outperform: priceOutperformance,
  twinwin:    priceTwinWin,
  shark:      priceSharkNote,
  airbag:     priceAirbag,
  digital:    priceDigital,
};

export function priceProduct(productId, marketData) {
  const pricer = PRICERS[productId];
  if (!pricer) throw new Error(`Unknown productId: ${productId}`);
  return pricer(marketData);
}

/**
 * Market data prompt — richiede anche skew oltre a vol, div, spot.
 */
export function buildMarketDataPrompt(tickers) {
  return `You are a financial data assistant. For each of the following tickers, find the most recent available data from financial sources (Yahoo Finance, Bloomberg, Investing.com, etc.):

Tickers: ${tickers.join(", ")}

For each ticker return:
- vol1Y: annualised implied volatility 1-year ATM (decimal, e.g. 0.28 for 28%)
- skew: volatility skew slope (negative decimal, sticky-strike convention).
  Measures how much IV increases per unit of log-moneyness below ATM.
  Typical values: equity index -0.10 to -0.15, single stock -0.15 to -0.25.
  If unavailable, use -0.12 for indices, -0.18 for single stocks.
- divYield: trailing 12-month dividend yield (decimal, e.g. 0.035 for 3.5%)
- spot: current spot price (EUR or local currency)
- name: full company/index name

If implied vol unavailable, estimate from 52-week range: vol ≈ (high - low) / (low × 1.6).
If dividend yield unavailable, use 0.

Respond ONLY with this JSON, no text outside:
{
  "marketData": {
    "<TICKER>": { "vol1Y": 0.00, "skew": -0.00, "divYield": 0.00, "spot": 0.00, "name": "<name>" }
  }
}`;
}
