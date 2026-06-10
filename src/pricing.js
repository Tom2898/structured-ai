/**
 * pricing.js — Structured Products Pricing Models
 *
 * Each model takes real market parameters and returns realistic terms.
 * Parameters come from AI web search (vol, spot, divYield, riskFreeRate).
 *
 * Models used:
 *  - Black-Scholes put/call approximations for coupon estimation
 *  - Bond floor + call spread for capital protected notes
 *  - Worst-of discount for basket products
 *  - Airbag / leverage factor for protection products
 *
 * All rates are expressed as decimals (0.10 = 10%).
 */

// ── Black-Scholes helpers ────────────────────────────────────────────────────

function erf(x) {
  // Abramowitz & Stegun approximation — sufficient for option pricing
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
 * Black-Scholes European option price.
 * @param {"call"|"put"} type
 * @param {number} S   spot price (normalised, e.g. 1.0)
 * @param {number} K   strike (normalised, e.g. 1.0 = ATM)
 * @param {number} T   time to maturity in years
 * @param {number} r   risk-free rate (decimal)
 * @param {number} q   continuous dividend yield (decimal)
 * @param {number} vol annualised implied volatility (decimal)
 * @returns {number} option price as fraction of spot
 */
function bsPrice(type, S, K, T, r, q, vol) {
  if (T <= 0 || vol <= 0) return Math.max(0, type === "call" ? S - K : K - S);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
  const d2 = d1 - vol * Math.sqrt(T);
  if (type === "call") {
    return S * Math.exp(-q * T) * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normCDF(-d2) - S * Math.exp(-q * T) * normCDF(-d1);
  }
}

/**
 * Digital (cash-or-nothing) put price at barrier B.
 */
function digitalPut(S, B, T, r, q, vol) {
  const d2 = (Math.log(S / B) + (r - q - 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
  return Math.exp(-r * T) * normCDF(-d2);
}

/**
 * Approximate down-and-out put price (barrier option) via reflection formula.
 * Gives the survival probability above barrier B.
 */
function downAndOutPutApprox(S, K, B, T, r, q, vol) {
  // Price of vanilla put minus down-and-in put (reflection approximation)
  const vanillaPut = bsPrice("put", S, K, T, r, q, vol);
  const mu = (r - q - 0.5 * vol * vol) / (vol * vol);
  const lambda = Math.pow(B / S, 2 * mu);
  const reflectedPut = lambda * bsPrice("put", (B * B) / S, K, T, r, q, vol);
  return Math.max(0, vanillaPut - reflectedPut);
}

// ── Utility ──────────────────────────────────────────────────────────────────

function round2(x) { return Math.round(x * 1000) / 10; } // → % with 1 decimal
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function pct(x) { return `${round2(x)}%`; }
function pctPA(x) { return `${round2(x)}% p.a.`; }
function months(T) { return `${Math.round(T * 12)} months`; }

// ── Worst-of basket vol (Gaussian copula approximation) ─────────────────────
/**
 * For a worst-of basket the effective vol is amplified by (1 - correlation).
 * For N assets with average pairwise correlation ρ:
 *   vol_wo ≈ avg_vol × sqrt(1 + (N-1)(1 - ρ) / N × spread_factor)
 * Simple approximation used by practitioners.
 */
function worstOfVol(vols, rho = 0.4) {
  const N = vols.length;
  if (N === 1) return vols[0];
  const avgVol = vols.reduce((a, b) => a + b, 0) / N;
  const maxVol = Math.max(...vols);
  // Effective vol is between avgVol and maxVol, shifted up by decorrelation
  return avgVol + (maxVol - avgVol) * (1 - rho) * (1 - 1 / N);
}

// ── Risk-free rate by maturity (EUR, approximated) ───────────────────────────
function riskFreeRate(T) {
  // EUR rates mid-2025: ~3.2% short end, ~3.0% 2Y, ~2.8% 3Y
  if (T <= 0.5) return 0.032;
  if (T <= 1.0) return 0.031;
  if (T <= 1.5) return 0.030;
  if (T <= 2.0) return 0.030;
  return 0.028;
}

// ── Issuer spread / structuring cost ────────────────────────────────────────
// Banks typically embed ~1.5-2.5% p.a. in the product cost
const ISSUER_SPREAD = 0.010; // 2% p.a. structuring cost
const DIST_COST = 0.005;     // 0.5% p.a. distribution cost
const DIST_COST = 0.000;
const TOTAL_COST_PA = ISSUER_SPREAD + DIST_COST;

// ──────────────────────────────────────────────────────────────────────────────
// PRICING MODELS — one function per product type
// Each returns: { barrier, coupon, participation, protection, maturity,
//                 strike, observationFrequency, note }
// All inputs: { vols: number[], divYields: number[], T: number (years) }
// ──────────────────────────────────────────────────────────────────────────────

/**
 * AUTOCALL / PHOENIX
 * Structure: quarterly coupon if above barrier, autocall if above strike at obs date.
 * Coupon funded by selling a down-and-out put at barrier.
 */
export function priceAutocall({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);
  const S = 1, K = 1;

  // Barrier: lower for high-vol underlyings
  const barrierLevel = vol > 0.35 ? 0.55 : vol > 0.25 ? 0.60 : 0.65;

  // Coupon = value of down-and-out put sold, annualised, minus costs
  const putValue = downAndOutPutApprox(S, K, barrierLevel, T, r, q, vol);
  const rawCouponPA = (putValue / T) - TOTAL_COST_PA;
  const couponPA = clamp(rawCouponPA, 0.04, 0.14);

  // Autocall trigger = 100% (at or above initial level)
  return {
    barrier: pct(barrierLevel),
    coupon: pctPA(couponPA),
    participation: "N/A",
    protection: "Condizionale (sopra barriera)",
    strike: "100%",
    observationFrequency: "Trimestrale",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Barriera: ${pct(barrierLevel)}`
  };
}

/**
 * WORST-OF AUTOCALL
 * Same as autocall but uses worst-of basket vol (higher coupon due to basket risk).
 */
export function priceWorstOfAutocall({ vols, divYields, T }) {
  const vol = worstOfVol(vols, 0.35); // lower corr = higher premium
  const q   = Math.min(...divYields) || 0.025; // worst-of div = min
  const r   = riskFreeRate(T);
  const S = 1, K = 1;

  const barrierLevel = vol > 0.40 ? 0.50 : vol > 0.30 ? 0.55 : 0.60;

  const putValue = downAndOutPutApprox(S, K, barrierLevel, T, r, q, vol);
  const rawCouponPA = (putValue / T) * 1.1 - TOTAL_COST_PA; // 10% basket premium
  const couponPA = clamp(rawCouponPA, 0.06, 0.20);

  return {
    barrier: pct(barrierLevel),
    coupon: pctPA(couponPA),
    participation: "N/A",
    protection: "Condizionale — worst-of",
    strike: "100%",
    observationFrequency: "Trimestrale",
    maturity: months(T),
    note: `Vol worst-of: ${pct(vol)}, Barriera: ${pct(barrierLevel)}`
  };
}

/**
 * REVERSE CONVERTIBLE
 * No barrier — sells ATM put, full downside below strike.
 * coupon = ATM put value / T - costs
 */
export function priceReverseConvertible({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  const putValue = bsPrice("put", 1, 1, T, r, q, vol);
  const rawCouponPA = (putValue / T) - TOTAL_COST_PA;
  const couponPA = clamp(rawCouponPA, 0.05, 0.18);

  return {
    barrier: "N/A",
    coupon: pctPA(couponPA),
    participation: "N/A",
    protection: "Nessuna — rimborso in azioni sotto strike",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Put ATM: ${pct(putValue)}`
  };
}

/**
 * BARRIER REVERSE CONVERTIBLE
 * Sells down-and-out put at barrier — coupon lower than plain RC but capital protected above barrier.
 */
export function priceBarrierReverseConv({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  const barrierLevel = vol > 0.35 ? 0.60 : vol > 0.25 ? 0.65 : 0.70;

  const putValue = downAndOutPutApprox(1, 1, barrierLevel, T, r, q, vol);
  const rawCouponPA = (putValue / T) - TOTAL_COST_PA;
  const couponPA = clamp(rawCouponPA, 0.04, 0.13);

  return {
    barrier: pct(barrierLevel),
    coupon: pctPA(couponPA),
    participation: "N/A",
    protection: `Condizionale — rimborso integrale se mai violata la barriera ${pct(barrierLevel)}`,
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Barriera: ${pct(barrierLevel)}`
  };
}

/**
 * BONUS CERTIFICATE
 * Buys index + down-and-out put (provides bonus). Bonus level determined by put cost.
 * participation: 1:1 above bonus, full loss below barrier.
 */
export function priceBonusCertificate({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  const barrierLevel = vol > 0.35 ? 0.55 : vol > 0.25 ? 0.60 : 0.65;

  // Bonus level is funded by foregone dividends + put spread
  const putCost = downAndOutPutApprox(1, 1, barrierLevel, T, r, q, vol);
  const divFunding = q * T; // dividends fund the structure
  const bonusRaw = 1 + (divFunding - putCost - TOTAL_COST_PA * T);
  const bonusLevel = clamp(bonusRaw, 1.05, 1.35);

  return {
    barrier: pct(barrierLevel),
    coupon: "N/A",
    participation: `${pct(1)} al rialzo sopra ${pct(bonusLevel)}, bonus minimo ${pct(bonusLevel)} a scadenza`,
    protection: `Bonus ${pct(bonusLevel)} garantito se barriera ${pct(barrierLevel)} mai violata`,
    strike: "100%",
    observationFrequency: "Continua (barriera americana)",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Bonus: ${pct(bonusLevel)}, Barriera: ${pct(barrierLevel)}`
  };
}

/**
 * EXPRESS CERTIFICATE
 * Annual observation: if above strike → repay 100% + step-up premium.
 * Step-up = value of digital call per period.
 */
export function priceExpress({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);
  const nObs = Math.round(T); // annual observations

  // Each observation: digital call that pays step-up if S > K
  const stepUpPerYear = clamp(
    bsPrice("call", 1, 1, 1, r, q, vol) - TOTAL_COST_PA,
    0.04, 0.12
  );

  return {
    barrier: "60-70% (barriera capitale a scadenza)",
    coupon: `${pct(stepUpPerYear)} per anno (step-up cumulativo)`,
    participation: "N/A",
    protection: "Capitale protetto a scadenza se sopra barriera",
    strike: "100%",
    observationFrequency: "Annuale",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Step-up/anno: ${pct(stepUpPerYear)}, Obs: ${nObs}`
  };
}

/**
 * CAPITAL PROTECTED NOTE
 * Bond floor (zero-coupon) + ATM call option.
 * participation = call budget / call price
 */
export function priceCapitalProtected({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  // Zero-coupon bond floor (how much of 100% goes to bond)
  const bondFloor = Math.exp(-r * T); // e.g. 94% for 2Y at 3%

  // Budget available for options after costs
  const optionBudget = (1 - bondFloor) - TOTAL_COST_PA * T;

  // ATM call price
  const callPrice = bsPrice("call", 1, 1, T, r, q, vol);

  // Participation = how much upside we can buy
  const participation = clamp(optionBudget / callPrice, 0.70, 1.50);

  return {
    barrier: "N/A",
    coupon: "N/A",
    participation: `${pct(participation)} della performance al rialzo`,
    protection: "100% del capitale a scadenza",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Bond floor: ${pct(bondFloor)}, Call: ${pct(callPrice)}`
  };
}

/**
 * OUTPERFORMANCE CERTIFICATE
 * Buys 1:1 exposure + extra call spread funded by dividends.
 * Leverage above strike funded by div yield.
 */
export function priceOutperformance({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  // Extra participation funded by dividends minus costs
  const callCost = bsPrice("call", 1, 1, T, r, q, vol);
  const divFunding = q * T;
  const extraPartic = clamp(divFunding / callCost - TOTAL_COST_PA * T / callCost, 0.10, 1.00);
  const totalPartic = 1 + extraPartic; // e.g. 140%

  return {
    barrier: "N/A",
    coupon: "N/A",
    participation: `${pct(totalPartic)} sopra lo strike, 1:1 sotto lo strike`,
    protection: "Nessuna protezione del capitale",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Partecipazione extra: ${pct(extraPartic)}`
  };
}

/**
 * TWIN WIN
 * Gains from both up and down moves. Funded by selling OTM call (cap) + down-and-in put.
 * Participation both directions until barrier is hit.
 */
export function priceTwinWin({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  const barrierLevel = vol > 0.35 ? 0.55 : vol > 0.25 ? 0.60 : 0.65;

  // Both-direction participation: vanilla call + put minus barrier put
  const callVal  = bsPrice("call", 1, 1, T, r, q, vol);
  const putVal   = bsPrice("put",  1, 1, T, r, q, vol);
  const boPut    = downAndOutPutApprox(1, 1, barrierLevel, T, r, q, vol);
  const budget   = (callVal + putVal - boPut) - TOTAL_COST_PA * T;
  const partic   = clamp(budget / callVal, 0.80, 1.50);

  return {
    barrier: pct(barrierLevel),
    coupon: "N/A",
    participation: `${pct(partic)} in entrambe le direzioni — barriera ${pct(barrierLevel)}`,
    protection: "Protezione condizionale — se barriera violata, performance lineare",
    strike: "100%",
    observationFrequency: "Continua (barriera americana)",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Partecipazione: ${pct(partic)}, Barriera: ${pct(barrierLevel)}`
  };
}

/**
 * SHARK NOTE
 * Participation capped at upper barrier (cap). Funded by selling the upside above cap.
 */
export function priceSharkNote({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  // Cap level (upper barrier) — tighter cap = higher coupon budget
  const capLevel = vol > 0.30 ? 1.25 : 1.35;
  const callATM  = bsPrice("call", 1, 1,        T, r, q, vol);
  const callCap  = bsPrice("call", 1, capLevel,  T, r, q, vol);
  const callSpreadValue = callATM - callCap; // value of capped upside
  const couponPA = clamp((callSpreadValue / T) - TOTAL_COST_PA, 0.03, 0.10);

  return {
    barrier: `Cap al ${pct(capLevel)} (barriera superiore)`,
    coupon: pctPA(couponPA),
    participation: `${pct(1)} fino al cap ${pct(capLevel)}, poi cedola aggiuntiva`,
    protection: "Nessuna protezione del capitale",
    strike: "100%",
    observationFrequency: "N/A",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Cap: ${pct(capLevel)}, Cedola potenziata: ${pctPA(couponPA)}`
  };
}

/**
 * AIRBAG CERTIFICATE
 * Downside protected via airbag mechanism: losses below barrier absorbed partially.
 * Airbag factor = (1 - barrier) / (1 - worst performance if barrier breached).
 */
export function priceAirbag({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  const barrierLevel = vol > 0.35 ? 0.60 : vol > 0.25 ? 0.65 : 0.70;

  // Airbag factor: how much loss is absorbed below barrier
  // E.g. barrier 65%, performance -50% → airbag shows -35%/(1-0.65) = -100% * (1-0.65) = absorbed
  const airbagFactor = barrierLevel; // 65% of loss absorbed
  const callCost = bsPrice("call", 1, 1, T, r, q, vol);
  const airbagPutCost = downAndOutPutApprox(1, 1, barrierLevel, T, r, q, vol);
  const divFunding = q * T;
  const participationRaw = 1 - (airbagPutCost - divFunding + TOTAL_COST_PA * T) / callCost;
  const participation = clamp(participationRaw, 0.80, 1.10);

  return {
    barrier: pct(barrierLevel),
    coupon: "N/A",
    participation: `${pct(participation)} al rialzo`,
    protection: `Meccanismo airbag: perdite sotto ${pct(barrierLevel)} ridotte di ~${pct(airbagFactor)}`,
    strike: "100%",
    observationFrequency: "Continua (barriera americana)",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Barriera: ${pct(barrierLevel)}, Airbag: ${pct(airbagFactor)}`
  };
}

/**
 * DIGITAL / BINARY NOTE
 * Fixed coupon if underlying above target at maturity. Price = digital call.
 */
export function priceDigital({ vols, divYields, T }) {
  const vol = vols[0];
  const q   = divYields[0] || 0.03;
  const r   = riskFreeRate(T);

  // Target slightly OTM for meaningful probability
  const targetLevel = vol > 0.30 ? 1.0 : 1.05;

  // Digital call probability × payout
  const d2 = (Math.log(1 / targetLevel) + (r - q - 0.5 * vol * vol) * T) / (vol * Math.sqrt(T));
  const prob = normCDF(d2); // risk-neutral probability above target

  // Coupon = probability × gross coupon - costs; gross coupon set so net is attractive
  const grossCoupon = clamp(0.15 / prob, 0.10, 0.35); // target ~15% if above
  const netCoupon = grossCoupon * prob - TOTAL_COST_PA * T;

  return {
    barrier: `Target ${pct(targetLevel)} a scadenza`,
    coupon: `${pct(grossCoupon)} fisso se sopra target (prob. ~${pct(prob)})`,
    participation: "N/A",
    protection: "Nessuna — rimborso 100% se sotto target, coupon perso",
    strike: pct(targetLevel),
    observationFrequency: "A scadenza",
    maturity: months(T),
    note: `Vol: ${pct(vol)}, Prob: ${pct(prob)}, Cedola lorda: ${pct(grossCoupon)}`
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

/**
 * Price any product given market data.
 * @param {string} productId  - one of the PRODUCTS ids
 * @param {object} marketData - { vols: number[], divYields: number[], T: number }
 * @returns {object} terms object ready to inject into the prompt
 */
export function priceProduct(productId, marketData) {
  const pricer = PRICERS[productId];
  if (!pricer) throw new Error(`Unknown productId: ${productId}`);
  return pricer(marketData);
}

/**
 * Build the market data prompt for AI web search.
 * Returns a prompt string that asks Claude to find real market parameters
 * for all underlyings and return them as JSON.
 */
export function buildMarketDataPrompt(tickers) {
  return `You are a financial data assistant. For each of the following tickers, find the most recent available data from financial sources (Yahoo Finance, Bloomberg, Investing.com, etc.):

Tickers: ${tickers.join(", ")}

For each ticker return:
- vol1Y: annualised implied volatility 1-year (as decimal, e.g. 0.28 for 28%)
- divYield: trailing dividend yield (as decimal, e.g. 0.035 for 3.5%)
- spot: current spot price (in EUR or local currency)
- name: full company/index name

If implied vol is not available, estimate from 52-week high/low: vol ≈ (high - low) / (low × 1.6).
If dividend yield is not available, use 0.

Respond ONLY with this JSON, no text outside:
{
  "marketData": {
    "<TICKER>": { "vol1Y": 0.00, "divYield": 0.00, "spot": 0.00, "name": "<name>" }
  }
}`;
}
