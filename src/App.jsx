import React, { useState } from "react";
import { supabase } from './lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: "autocall", name: "Autocall / Phoenix", risk: "medium", category: "Income", icon: "↩", desc: "Rimborso anticipato se il sottostante supera la barriera alle date di osservazione. Cedola periodica condizionale.", keyTerms: ["Cedola condizionale", "Barriera di rimborso", "Osservazione periodica", "Rimborso anticipato"] },
  { id: "capital", name: "Capital Protected Note", risk: "low", category: "Protection", icon: "🛡", desc: "Protezione del 100% del capitale a scadenza con partecipazione al rialzo.", keyTerms: ["100% protezione capitale", "Partecipazione al rialzo", "Nessuna barriera", "Garanzia a scadenza"] },
  { id: "reverse", name: "Reverse Convertible", risk: "medium-high", category: "Income", icon: "↔", desc: "Cedola fissa elevata, ma capitale a rischio se il sottostante scende sotto lo strike.", keyTerms: ["Cedola fissa alta", "Rischio capitale", "Strike a 100%", "Nessuna barriera"] },
  { id: "barrier", name: "Barrier Reverse Conv.", risk: "medium", category: "Income", icon: "⬇", desc: "Come il reverse convertible ma con barriera — capitale protetto finché la barriera non viene violata.", keyTerms: ["Cedola fissa", "Barriera di protezione", "Strike a 100%", "Protezione condizionale"] },
  { id: "bonus", name: "Bonus Certificate", risk: "medium", category: "Growth", icon: "★", desc: "Bonus a scadenza se la barriera non viene mai toccata. Partecipazione integrale sopra il livello bonus.", keyTerms: ["Bonus garantito", "Barriera americana", "Partecipazione 1:1", "Crescita con protezione"] },
  { id: "express", name: "Express Certificate", risk: "medium", category: "Income", icon: "⚡", desc: "Uscita anticipata con rendimento fisso a ogni data di osservazione se il sottostante è sopra lo strike.", keyTerms: ["Uscita anticipata", "Rendimento fisso", "Osservazione annuale", "Step-up premio"] },
  { id: "outperform", name: "Outperformance Cert.", risk: "medium-high", category: "Growth", icon: "📈", desc: "Partecipazione con leva al rialzo sopra lo strike, 1:1 al ribasso.", keyTerms: ["Leva al rialzo", "1:1 al ribasso", "Nessuna protezione", "Strike a 100%"] },
  { id: "twinwin", name: "Twin Win", risk: "medium", category: "Growth", icon: "⚖", desc: "Guadagna sia dai movimenti al rialzo che al ribasso, a meno che la barriera non venga violata.", keyTerms: ["Doppia direzione", "Barriera americana", "Simmetria bull/bear", "Alta partecipazione"] },
  { id: "worstof", name: "Worst-of Autocall", risk: "high", category: "Income", icon: "🎯", desc: "Cedola più alta tramite esposizione all'asset con la peggiore performance in un basket.", keyTerms: ["Cedola elevata", "Basket worst-of", "Rischio amplificato", "Barriera condizionale"] },
  { id: "shark", name: "Shark Note", risk: "medium", category: "Growth", icon: "🦈", desc: "Partecipazione limitata da una barriera superiore — cedola più alta in cambio.", keyTerms: ["Partecipazione con cap", "Barriera superiore", "Cedola potenziata", "Crescita limitata"] },
  { id: "airbag", name: "Airbag Certificate", risk: "medium-low", category: "Protection", icon: "🪂", desc: "Protezione parziale del capitale tramite meccanismo airbag che ammortizza le perdite.", keyTerms: ["Airbag sul ribasso", "Protezione parziale", "Partecipazione ridotta", "Ammortizzatore perdite"] },
  { id: "digital", name: "Digital / Binary Note", risk: "medium-high", category: "Income", icon: "◈", desc: "Payoff fisso se il sottostante chiude sopra un livello target a scadenza.", keyTerms: ["Payoff binario", "Target a scadenza", "Cedola fissa condizionale", "Tutto o niente"] },
];

// Which products are suggested per objective
const OBJECTIVE_PRODUCTS = {
  "Preservazione del capitale":      ["capital", "airbag", "barrier", "autocall"],
  "Reddito / cedole periodiche":     ["autocall", "barrier", "reverse", "express", "worstof", "digital"],
  "Crescita del capitale":           ["bonus", "outperform", "twinwin", "shark", "capital"],
  "Diversificazione del portafoglio":["autocall", "bonus", "twinwin", "worstof", "express"],
  "Rendimento assoluto":             ["twinwin", "autocall", "express", "worstof", "digital", "outperform"],
};

const RISK_COLOR = {
  "low":         { bg: "#e8f5e9", text: "#2e7d32", label: "Basso" },
  "medium-low":  { bg: "#f1f8e9", text: "#558b2f", label: "Med-Basso" },
  "medium":      { bg: "#fff8e1", text: "#f57f17", label: "Medio" },
  "medium-high": { bg: "#fff3e0", text: "#e65100", label: "Med-Alto" },
  "high":        { bg: "#fce4ec", text: "#c62828", label: "Alto" },
};

const CAT_COLOR = {
  "Income":     { bg: "#e3f2fd", text: "#1565c0" },
  "Protection": { bg: "#e8f5e9", text: "#2e7d32" },
  "Growth":     { bg: "#f3e5f5", text: "#6a1b9a" },
};

const PLANS = [
  { id: "free", name: "Free", priceMonthly: "€0", priceAnnual: "€0", period: "/mese", proposalLimit: 3, features: ["3 proposte/mese", "Tutti i 12 prodotti", "Export PDF", "Caratteristiche del sottostante"], cta: "Inizia gratis", highlight: false },
  { id: "retail", name: "Retail", priceMonthly: "€19.90", priceAnnual: "€19.90", period: "/mese", proposalLimit: 20, features: ["20 proposte/mese", "Tutti i 12 prodotti", "Export PDF", "Caratteristiche del sottostante", "🔍 Ricerca ISIN Euronext reali"], cta: "Inizia con Retail", highlight: false, priceId: "price_1TYZBRHcctqaGDVzptl5Nuxf" },
  { id: "pro", name: "Pro", priceMonthly: "€49", priceAnnual: "€39", period: "/mese", proposalLimit: 100, features: ["100 proposte/mese", "Tutti i 12 prodotti", "Export PDF con brand", "Storico proposte", "🔍 Ricerca ISIN Euronext reali", "Confronto affiancato", "Supporto prioritario"], cta: "Prova Pro gratis", highlight: true, annualNote: "Risparmia €120/anno" },
  { id: "unlimited", name: "Unlimited", priceMonthly: "€199", priceAnnual: "€159", period: "/mese", proposalLimit: Infinity, features: ["Proposte illimitate", "Tutti i 12 prodotti", "Export PDF con brand", "Storico proposte", "🔍 Ricerca ISIN Euronext reali", "Confronto affiancato", "Note cliente sulle proposte", "Export CSV/webhook", "Supporto prioritario"], cta: "Prova Unlimited gratis", highlight: false, annualNote: "Risparmia €480/anno" },
];

const FREE_LIMIT = 3;

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f5f0; --surface: #ffffff; --border: rgba(0,0,0,0.09); --border-md: rgba(0,0,0,0.15);
    --text: #1a1a18; --muted: #6b6b65; --accent: #1a3a2a; --accent-light: #e8f0eb; --accent-mid: #2d5c40;
    --gold: #b8942a; --gold-light: #fdf6e3; --pro: #7c3aed; --pro-light: #f5f3ff;
    --radius: 12px; --radius-sm: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.10);
  }
  body { font-family: 'DM Mono', monospace; background: var(--bg); color: var(--text); min-height: 100vh; }

  /* LANDING */
  .landing { min-height: 100vh; display: flex; flex-direction: column; }
  .landing-nav { height: 60px; display: flex; align-items: center; padding: 0 2.5rem; background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; gap: 1rem; }
  .landing-logo { display: flex; align-items: center; gap: 10px; flex: 1; }
  .logo-mark { width: 32px; height: 32px; border: 1.5px solid var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 16px; color: var(--accent); }
  .logo-name { font-family: 'Fraunces', serif; font-size: 18px; color: var(--accent); font-weight: 400; }
  .landing-nav-actions { display: flex; gap: 8px; }
  .btn-ghost { padding: 7px 16px; font-size: 12px; border: 1px solid var(--border-md); border-radius: var(--radius-sm); background: none; cursor: pointer; color: var(--muted); font-family: 'DM Mono', monospace; transition: all 0.12s; letter-spacing: 0.03em; }
  .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
  .btn-primary { padding: 7px 18px; font-size: 12px; border: none; border-radius: var(--radius-sm); background: var(--accent); color: #fff; cursor: pointer; font-family: 'DM Mono', monospace; transition: background 0.15s; letter-spacing: 0.03em; }
  .btn-primary:hover { background: var(--accent-mid); }
  .hero { padding: 5rem 2.5rem 4rem; max-width: 860px; margin: 0 auto; text-align: center; }
  .hero-eyebrow { display: inline-block; font-size: 10px; letter-spacing: 0.12em; color: var(--accent); background: var(--accent-light); border-radius: 99px; padding: 4px 14px; margin-bottom: 1.5rem; }
  .hero h1 { font-family: 'Fraunces', serif; font-size: 3.2rem; font-weight: 300; line-height: 1.15; color: var(--text); margin-bottom: 1.25rem; }
  .hero h1 em { font-style: italic; color: var(--accent-mid); }
  .hero p { font-size: 14px; color: var(--muted); line-height: 1.8; max-width: 580px; margin: 0 auto 2.5rem; }
  .hero-actions { display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap; }
  .btn-hero { padding: 12px 28px; font-size: 13px; border: none; border-radius: var(--radius-sm); background: var(--accent); color: #fff; cursor: pointer; font-family: 'DM Mono', monospace; transition: background 0.15s; letter-spacing: 0.04em; }
  .btn-hero:hover { background: var(--accent-mid); }
  .btn-hero-outline { padding: 12px 24px; font-size: 13px; border: 1.5px solid var(--border-md); border-radius: var(--radius-sm); background: none; color: var(--text); cursor: pointer; font-family: 'DM Mono', monospace; transition: all 0.15s; letter-spacing: 0.04em; }
  .btn-hero-outline:hover { border-color: var(--accent); color: var(--accent); }
  .hero-note { font-size: 11px; color: var(--muted); margin-top: 1rem; }
  .features-strip { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 2.5rem; display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap; }
  .feature-item { display: flex; align-items: center; gap: 10px; }
  .feature-icon { width: 36px; height: 36px; background: var(--accent-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .feature-text strong { display: block; margin-bottom: 1px; font-size: 12px; }
  .feature-text span { color: var(--muted); font-size: 11px; }

  /* PRICING */
  .billing-toggle { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 2.5rem; }
  .billing-toggle-track { width: 44px; height: 24px; border-radius: 99px; background: var(--border-md); cursor: pointer; position: relative; transition: background 0.2s; border: none; padding: 0; flex-shrink: 0; }
  .billing-toggle-track.annual { background: var(--accent); }
  .billing-toggle-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  .billing-toggle-track.annual .billing-toggle-thumb { transform: translateX(20px); }
  .billing-label { font-size: 12px; color: var(--muted); cursor: pointer; }
  .billing-label.active { color: var(--text); font-weight: 500; }
  .billing-save-badge { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: #e8f5e9; color: #2e7d32; letter-spacing: 0.03em; border: 1px solid rgba(46,125,50,0.2); }
  .plan-annual-note { font-size: 10px; color: #2e7d32; margin-top: 3px; letter-spacing: 0.02em; }
  .plan-price-strike { font-size: 13px; color: var(--muted); text-decoration: line-through; margin-right: 4px; vertical-align: middle; }
  .pricing-section { padding: 4rem 2.5rem; max-width: 900px; margin: 0 auto; }
  .section-title { font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 300; text-align: center; margin-bottom: 0.4rem; }
  .section-sub { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 2.5rem; }
  .plans-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .plan-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 1.75rem 1.5rem; position: relative; transition: box-shadow 0.15s; }
  .plan-card:hover { box-shadow: var(--shadow-lg); }
  .plan-card.highlight { border-color: var(--accent); }
  .plan-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--accent); color: #fff; font-size: 10px; letter-spacing: 0.08em; padding: 3px 14px; border-radius: 99px; white-space: nowrap; }
  .plan-name { font-size: 11px; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px; }
  .plan-price { font-family: 'Fraunces', serif; font-size: 2.2rem; font-weight: 400; color: var(--text); line-height: 1; }
  .plan-period { font-size: 12px; color: var(--muted); margin-left: 2px; }
  .plan-divider { height: 1px; background: var(--border); margin: 1.25rem 0; }
  .plan-features { list-style: none; margin-bottom: 1.5rem; }
  .plan-features li { font-size: 12px; color: var(--muted); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .plan-features li::before { content: "✓"; color: var(--accent); font-size: 11px; flex-shrink: 0; }
  .plan-cta { width: 100%; padding: 10px; border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.04em; cursor: pointer; transition: all 0.15s; }
  .plan-cta.outline { border: 1.5px solid var(--border-md); background: none; color: var(--text); }
  .plan-cta.outline:hover { border-color: var(--accent); color: var(--accent); }
  .plan-cta.filled { border: none; background: var(--accent); color: #fff; }
  .plan-cta.filled:hover { background: var(--accent-mid); }
  .landing-footer { padding: 2rem 2.5rem; border-top: 1px solid var(--border); text-align: center; font-size: 11px; color: var(--muted); }

  /* AUTH */
  .auth-wrap { min-height: 100vh; display: flex; }
  .auth-left { width: 400px; min-height: 100vh; background: var(--accent); display: flex; flex-direction: column; justify-content: space-between; padding: 3rem; flex-shrink: 0; }
  .auth-left-logo { display: flex; align-items: center; gap: 10px; }
  .auth-left-logo-mark { width: 36px; height: 36px; border: 1.5px solid rgba(255,255,255,0.4); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 18px; color: #fff; }
  .auth-left-logo-name { font-family: 'Fraunces', serif; font-size: 20px; color: #fff; font-weight: 300; }
  .auth-left-tagline { font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 0.04em; margin-top: 3px; }
  .auth-left-middle h1 { font-family: 'Fraunces', serif; font-size: 2.2rem; color: #fff; font-weight: 300; line-height: 1.25; }
  .auth-left-middle p { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 0.9rem; line-height: 1.7; }
  .auth-left-bottom { font-size: 11px; color: rgba(255,255,255,0.3); }
  .auth-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .auth-card { width: 100%; max-width: 380px; }
  .auth-card h2 { font-family: 'Fraunces', serif; font-size: 1.6rem; font-weight: 400; margin-bottom: 0.3rem; }
  .auth-tabs { display: flex; gap: 0; margin-bottom: 1.75rem; border: 1px solid var(--border-md); border-radius: var(--radius-sm); overflow: hidden; }
  .auth-tab { flex: 1; padding: 8px; font-size: 12px; font-family: 'DM Mono', monospace; border: none; background: none; cursor: pointer; color: var(--muted); transition: all 0.12s; letter-spacing: 0.03em; }
  .auth-tab.active { background: var(--accent); color: #fff; }
  .form-group { margin-bottom: 1rem; }
  .form-group label { display: block; font-size: 10px; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 5px; }
  .form-group input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-md); border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 13px; background: var(--surface); color: var(--text); outline: none; transition: border-color 0.15s; }
  .form-group input:focus { border-color: var(--accent-mid); }
  .auth-btn { width: 100%; padding: 11px; background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 13px; letter-spacing: 0.04em; cursor: pointer; margin-top: 0.5rem; transition: background 0.15s; }
  .auth-btn:hover { background: var(--accent-mid); }
  .auth-error { margin-top: 0.6rem; font-size: 11px; color: #c62828; text-align: center; }
  .auth-switch { margin-top: 1.25rem; font-size: 12px; color: var(--muted); text-align: center; }
  .auth-switch a { color: var(--accent); cursor: pointer; text-decoration: underline; }
  .plan-selector { margin-bottom: 1.25rem; }
  .plan-selector label { display: block; font-size: 10px; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 8px; }
  .plan-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .plan-opt { padding: 8px 6px; border: 1px solid var(--border-md); border-radius: var(--radius-sm); text-align: center; cursor: pointer; transition: all 0.12s; background: none; font-family: 'DM Mono', monospace; }
  .plan-opt.selected { border-color: var(--accent); background: var(--accent-light); }
  .plan-opt-name { font-size: 11px; color: var(--text); display: block; }
  .plan-opt-price { font-size: 10px; color: var(--muted); display: block; margin-top: 1px; }
  .plan-opt.selected .plan-opt-name { color: var(--accent); }

  /* APP NAV */
  .topnav { height: 56px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 2rem; gap: 1rem; position: sticky; top: 0; z-index: 100; }
  .topnav-logo { display: flex; align-items: center; gap: 8px; }
  .topnav-logo-mark { width: 28px; height: 28px; border: 1.5px solid var(--accent); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 14px; color: var(--accent); }
  .topnav-logo-name { font-family: 'Fraunces', serif; font-size: 16px; color: var(--accent); font-weight: 400; }
  .topnav-spacer { flex: 1; }
  .topnav-tab { padding: 6px 14px; font-size: 12px; letter-spacing: 0.04em; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; background: none; color: var(--muted); font-family: 'DM Mono', monospace; transition: all 0.12s; }
  .topnav-tab:hover { color: var(--text); }
  .topnav-tab.active { background: var(--accent-light); color: var(--accent); border-color: rgba(26,58,42,0.15); }
  .topnav-user { display: flex; align-items: center; gap: 8px; }
  .topnav-avatar { width: 30px; height: 30px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; letter-spacing: 0.04em; }
  .plan-pill { font-size: 9px; padding: 2px 8px; border-radius: 99px; letter-spacing: 0.05em; background: var(--gold-light); color: var(--gold); border: 1px solid rgba(184,148,42,0.25); }
  .plan-pill.free { background: var(--accent-light); color: var(--accent); border-color: rgba(26,58,42,0.18); }
  .plan-pill.pro { background: var(--pro-light); color: var(--pro); border-color: rgba(124,58,237,0.2); }
  .plan-pill.retail { background: #e3f2fd; color: #1565c0; border-color: rgba(21,101,192,0.2); }
  .logout-btn { padding: 5px 12px; font-size: 11px; border: 1px solid var(--border-md); border-radius: var(--radius-sm); background: none; cursor: pointer; color: var(--muted); font-family: 'DM Mono', monospace; }
  .logout-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* MAIN */
  .main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
  .page-title { font-family: 'Fraunces', serif; font-size: 1.8rem; font-weight: 300; margin-bottom: 0.3rem; }
  .page-sub { font-size: 12px; color: var(--muted); margin-bottom: 2rem; }
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 2rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.1rem 1.2rem; }
  .stat-label { font-size: 10px; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px; }
  .stat-value { font-family: 'Fraunces', serif; font-size: 1.7rem; font-weight: 400; color: var(--text); }
  .stat-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }

  /* CATALOG */
  .catalog-filters { display: flex; gap: 8px; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .filter-btn { padding: 5px 14px; font-size: 11px; letter-spacing: 0.04em; border: 1px solid var(--border-md); border-radius: 99px; background: none; cursor: pointer; color: var(--muted); font-family: 'DM Mono', monospace; transition: all 0.12s; }
  .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
  .filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .product-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 1rem; cursor: pointer; transition: all 0.15s; }
  .product-card:hover { border-color: var(--accent-mid); box-shadow: var(--shadow); transform: translateY(-1px); }
  .product-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .product-icon { font-size: 20px; }
  .product-cat-badge { font-size: 10px; padding: 2px 8px; border-radius: 99px; letter-spacing: 0.03em; }
  .product-name { font-size: 13px; font-weight: 400; margin-bottom: 4px; }
  .product-desc { font-size: 11px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .product-risk-badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.03em; }

  /* GENERATOR */
  .gen-layout { display: grid; grid-template-columns: 340px 1fr; gap: 1.5rem; align-items: start; }
  .gen-form { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; }
  .gen-form h3 { font-family: 'Fraunces', serif; font-size: 1rem; font-weight: 400; margin-bottom: 1.25rem; }
  .field-label { font-size: 10px; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 5px; display: block; }
  .field-group { margin-bottom: 1rem; }
  select.field-select { width: 100%; padding: 8px 10px; border: 1px solid var(--border-md); border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 12px; background: var(--surface); color: var(--text); outline: none; }
  select.field-select:focus { border-color: var(--accent-mid); }
  input.field-input { width: 100%; padding: 8px 10px; border: 1px solid var(--border-md); border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 12px; background: var(--surface); color: var(--text); outline: none; }
  input.field-input:focus { border-color: var(--accent-mid); }

  /* PRODUCT SELECTOR */
  .product-selector-section { margin-bottom: 1rem; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
  .product-selector-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg); cursor: pointer; user-select: none; }
  .product-selector-title { font-size: 10px; letter-spacing: 0.07em; color: var(--muted); }
  .product-selector-count { font-size: 10px; color: var(--accent); background: var(--accent-light); padding: 2px 8px; border-radius: 99px; }
  .product-selector-chevron { font-size: 10px; color: var(--muted); transition: transform 0.2s; }
  .product-selector-chevron.open { transform: rotate(180deg); }
  .product-selector-body { padding: 10px 12px; background: var(--surface); }
  .product-selector-note { font-size: 10px; color: var(--muted); margin-bottom: 10px; font-style: italic; }
  .product-option { border: 1.5px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 6px; overflow: hidden; transition: border-color 0.15s; cursor: pointer; }
  .product-option:last-child { margin-bottom: 0; }
  .product-option.selected { border-color: var(--accent); }
  .product-option.suggested { border-color: rgba(26,58,42,0.3); }
  .product-option-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; }
  .product-option-checkbox { width: 14px; height: 14px; border: 1.5px solid var(--border-md); border-radius: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--surface); transition: all 0.12s; }
  .product-option.selected .product-option-checkbox { background: var(--accent); border-color: var(--accent); }
  .product-option-check { color: #fff; font-size: 9px; line-height: 1; }
  .product-option-icon { font-size: 14px; flex-shrink: 0; }
  .product-option-info { flex: 1; min-width: 0; }
  .product-option-name { font-size: 11px; color: var(--text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .product-option-meta { display: flex; gap: 4px; margin-top: 2px; align-items: center; }
  .product-option-suggested { font-size: 9px; color: var(--accent); background: var(--accent-light); padding: 1px 6px; border-radius: 99px; letter-spacing: 0.03em; }
  .product-option-expand { font-size: 11px; color: var(--muted); flex-shrink: 0; padding: 2px 6px; }
  .product-option-detail { padding: 0 10px 10px 40px; }
  .product-option-desc { font-size: 11px; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
  .product-option-terms { display: flex; flex-wrap: wrap; gap: 4px; }
  .product-option-term { font-size: 10px; padding: 2px 7px; border-radius: 4px; background: var(--bg); color: var(--muted); border: 1px solid var(--border); }
  .product-selector-actions { display: flex; gap: 6px; margin-top: 8px; }
  .product-selector-action-btn { font-size: 10px; padding: 3px 10px; border: 1px solid var(--border-md); border-radius: 99px; background: none; cursor: pointer; color: var(--muted); font-family: 'DM Mono', monospace; transition: all 0.12s; }
  .product-selector-action-btn:hover { border-color: var(--accent); color: var(--accent); }

  .underlying-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; max-height: 120px; overflow-y: auto; }
  .gen-btn { width: 100%; padding: 10px; background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.05em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; margin-top: 1rem; }
  .gen-btn:hover:not(:disabled) { background: var(--accent-mid); }
  .gen-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* OUTPUT */
  .output-area { display: flex; flex-direction: column; gap: 16px; }
  .output-placeholder { background: var(--surface); border: 1px dashed var(--border-md); border-radius: var(--radius); padding: 3rem; text-align: center; color: var(--muted); font-size: 12px; font-style: italic; }
  .proposal-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: box-shadow 0.15s; }
  .proposal-card:hover { box-shadow: var(--shadow-lg); }
  .proposal-header { padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: #fafaf8; }
  .proposal-header-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .proposal-rank { width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .proposal-product-name { font-size: 13px; font-weight: 500; color: var(--text); }
  .proposal-header-right { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .proposal-body { padding: 1.25rem 1.5rem; }
  .struct-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .struct-section { background: var(--bg); border-radius: var(--radius-sm); padding: 0.875rem 1rem; }
  .struct-section-title { font-size: 9px; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 6px; }
  .struct-rows { display: flex; flex-direction: column; gap: 4px; }
  .struct-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
  .struct-row-label { color: var(--muted); }
  .struct-row-value { color: var(--text); font-weight: 500; }
  .struct-row-value.positive { color: #2e7d32; }
  .struct-row-value.warning { color: #e65100; }
  .underlying-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .underlying-chip { font-size: 10px; padding: 2px 8px; border-radius: 4px; background: var(--accent-light); color: var(--accent); border: 1px solid rgba(26,58,42,0.15); }
  .payoff-summary { background: var(--bg); border-radius: var(--radius-sm); padding: 0.875rem 1rem; margin-top: 10px; }
  .payoff-title { font-size: 9px; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 8px; }
  .payoff-scenarios { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .payoff-scenario { text-align: center; padding: 8px 4px; background: var(--surface); border-radius: 6px; border: 1px solid var(--border); }
  .payoff-scenario-label { font-size: 9px; color: var(--muted); margin-bottom: 3px; letter-spacing: 0.04em; }
  .payoff-scenario-value { font-family: 'Fraunces', serif; font-size: 1.1rem; font-weight: 400; }
  .payoff-scenario-value.bull { color: #2e7d32; }
  .payoff-scenario-value.flat { color: #f57f17; }
  .payoff-scenario-value.bear { color: #c62828; }
  .rationale { font-size: 11px; color: var(--muted); line-height: 1.65; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }

  /* ISIN */
  .isin-section { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
  .isin-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .isin-badge { font-size: 9px; padding: 2px 8px; border-radius: 99px; background: var(--pro-light); color: var(--pro); border: 1px solid rgba(124,58,237,0.2); letter-spacing: 0.04em; }
  .isin-search-btn { font-size: 11px; padding: 5px 12px; border: 1px solid var(--pro); border-radius: var(--radius-sm); background: none; color: var(--pro); cursor: pointer; font-family: 'DM Mono', monospace; transition: all 0.12s; display: flex; align-items: center; gap: 5px; }
  .isin-search-btn:hover { background: var(--pro-light); }
  .isin-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .isin-results { display: flex; flex-direction: column; gap: 6px; }
  .isin-row { display: grid; grid-template-columns: 110px 1fr auto auto; gap: 10px; align-items: center; padding: 8px 10px; background: var(--bg); border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 11px; }
  .isin-code { font-family: 'DM Mono', monospace; font-weight: 500; color: var(--accent); letter-spacing: 0.04em; }
  .isin-name { color: var(--muted); }
  .isin-similarity { font-size: 10px; padding: 2px 7px; border-radius: 99px; background: #e8f5e9; color: #2e7d32; }
  .isin-loading { font-size: 11px; color: var(--muted); font-style: italic; }

  /* MISC */
  .upgrade-btn { padding: 8px 20px; background: var(--pro); color: #fff; border: none; border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 12px; cursor: pointer; transition: opacity 0.15s; letter-spacing: 0.03em; }
  .upgrade-btn:hover { opacity: 0.88; }
  .paywall-banner { background: var(--gold-light); border: 1px solid rgba(184,148,42,0.3); border-radius: var(--radius); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .paywall-banner-text strong { display: block; margin-bottom: 2px; font-size: 13px; color: #7a5c10; }
  .paywall-banner-text span { font-size: 11px; color: #a07820; }
  .limit-bar { margin-bottom: 1rem; }
  .limit-label { font-size: 10px; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 5px; display: flex; justify-content: space-between; }
  .limit-track { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
  .limit-fill { height: 100%; background: var(--accent); border-radius: 99px; transition: width 0.4s; }
  .limit-fill.warn { background: var(--gold); }
  .limit-fill.full { background: #c62828; }
  .history-list { display: flex; flex-direction: column; gap: 10px; }
  .history-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: all 0.12s; }
  .history-item:hover { border-color: var(--accent-mid); box-shadow: var(--shadow); }
  .history-icon { width: 36px; height: 36px; background: var(--accent-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .history-info { flex: 1; }
  .history-name { font-size: 13px; }
  .history-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .history-chevron { font-size: 10px; color: var(--muted); }
  .empty-state { text-align: center; padding: 3rem; color: var(--muted); font-size: 13px; }
  .action-btn { padding: 5px 12px; font-size: 11px; border: 1px solid var(--border-md); border-radius: var(--radius-sm); background: none; cursor: pointer; color: var(--muted); font-family: 'DM Mono', monospace; transition: all 0.12s; }
  .action-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .modal { background: var(--surface); border-radius: var(--radius); width: 100%; max-width: 750px; overflow: hidden; box-shadow: var(--shadow-lg); }
  .modal-header { padding: 1.5rem 2rem 0; display: flex; align-items: flex-start; justify-content: space-between; }
  .modal-header h2 { font-family: 'Fraunces', serif; font-size: 1.5rem; font-weight: 300; }
  .modal-header p { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--muted); }
  .modal-body { padding: 1.5rem 2rem 2rem; }
  .modal-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

  /* COMPARE */
  .compare-bar { position: sticky; bottom: 0; z-index: 50; background: var(--accent); color: #fff; padding: 12px 2rem; display: flex; align-items: center; gap: 14px; justify-content: space-between; box-shadow: 0 -4px 20px rgba(0,0,0,0.18); }
  .compare-bar-left { display: flex; align-items: center; gap: 10px; font-size: 12px; }
  .compare-bar-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .compare-bar-chip { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); border-radius: 99px; padding: 3px 10px; font-size: 11px; display: flex; align-items: center; gap: 5px; }
  .compare-bar-chip-x { cursor: pointer; opacity: 0.6; font-size: 10px; }
  .compare-bar-chip-x:hover { opacity: 1; }
  .compare-btn { padding: 8px 20px; background: #fff; color: var(--accent); border: none; border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 12px; cursor: pointer; font-weight: 500; letter-spacing: 0.03em; transition: opacity 0.15s; }
  .compare-btn:hover { opacity: 0.88; }
  .compare-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .compare-clear-btn { padding: 6px 14px; background: none; border: 1px solid rgba(255,255,255,0.35); border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.8); cursor: pointer; }
  .compare-toggle-btn { font-size: 10px; padding: 3px 10px; border: 1px solid var(--border-md); border-radius: 99px; background: none; cursor: pointer; font-family: 'DM Mono', monospace; color: var(--muted); transition: all 0.12s; white-space: nowrap; }
  .compare-toggle-btn.selected { background: var(--pro); color: #fff; border-color: var(--pro); }
  .compare-modal { background: var(--surface); border-radius: var(--radius); width: 100%; max-width: 960px; max-height: 88vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
  .compare-col-header { background: var(--accent); color: #fff; padding: 1rem 1.25rem; }
  .compare-col-header-rank { font-size: 10px; opacity: 0.6; margin-bottom: 2px; }
  .compare-col-header-name { font-size: 13px; font-weight: 500; }
  .compare-row-label { background: #fafaf8; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 10px 14px; font-size: 10px; letter-spacing: 0.07em; color: var(--muted); display: flex; align-items: center; }
  .compare-cell { border-bottom: 1px solid var(--border); padding: 10px 14px; font-size: 12px; color: var(--text); }
  .compare-cell.positive { color: #2e7d32; }
  .compare-cell.warning { color: #e65100; }
  .compare-cell.na { color: var(--muted); font-style: italic; }
  .compare-section-label { background: var(--bg); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 6px 14px; font-size: 9px; letter-spacing: 0.1em; color: var(--muted); font-weight: 600; display: flex; align-items: center; }
  .compare-section-cell { background: var(--bg); border-bottom: 1px solid var(--border); padding: 6px 14px; }

  /* PRINT */
  @media print {
    .topnav, .gen-form, .catalog-filters, .stats-row, .paywall-banner,
    .isin-search-btn, .action-btn, .gen-btn, .compare-bar, .compare-toggle-btn,
    .modal-overlay { display: none !important; }
    .gen-layout { grid-template-columns: 1fr !important; }
    body { background: white; }
    .pdf-print-header { display: flex !important; }
    .proposal-card { break-inside: avoid; page-break-inside: avoid; border: 1.5px solid #ddd !important; margin-bottom: 1.5rem; }
    .pdf-watermark { display: block !important; }
  }
  .pdf-print-header { display: none; align-items: center; justify-content: space-between; padding: 1.25rem 0 1rem; border-bottom: 2px solid var(--accent); margin-bottom: 1.5rem; }
  .pdf-print-header-logo { display: flex; align-items: center; gap: 10px; }
  .pdf-print-header-logo-mark { width: 36px; height: 36px; border: 2px solid var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 18px; color: var(--accent); }
  .pdf-print-header-logo-name { font-family: 'Fraunces', serif; font-size: 20px; color: var(--accent); font-weight: 400; }
  .pdf-print-header-meta { text-align: right; font-size: 11px; color: var(--muted); }
  .pdf-watermark { display: none; font-size: 9px; color: var(--muted); text-align: center; margin-top: 2rem; letter-spacing: 0.05em; }
`;

// ─── ProductSelector Component ────────────────────────────────────────────────
function ProductSelector({ objective, selectedIds, onChange }) {
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const suggestedIds = OBJECTIVE_PRODUCTS[objective] || [];
  // Sort: suggested first
  const sorted = [...PRODUCTS].sort((a, b) => {
    const aS = suggestedIds.includes(a.id);
    const bS = suggestedIds.includes(b.id);
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return 0;
  });

  function toggle(id) {
    onChange(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function selectSuggested() {
    onChange(suggestedIds);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="product-selector-section">
      <div className="product-selector-header" onClick={() => setOpen(o => !o)}>
        <span className="product-selector-title">STRUTTURE DA PROPORRE</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectedIds.length > 0 && (
            <span className="product-selector-count">{selectedIds.length} selezionate</span>
          )}
          <span className={`product-selector-chevron${open ? " open" : ""}`}>▾</span>
        </div>
      </div>
      {open && (
        <div className="product-selector-body">
          <p className="product-selector-note">
            Le strutture evidenziate sono consigliate per l'obiettivo selezionato. Lascia tutto vuoto per lasciar scegliere all'AI.
          </p>
          <div className="product-selector-actions">
            <button className="product-selector-action-btn" onClick={selectSuggested}>✓ Seleziona consigliate</button>
            {selectedIds.length > 0 && (
              <button className="product-selector-action-btn" onClick={clearAll}>Svuota</button>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            {sorted.map(p => {
              const isSuggested = suggestedIds.includes(p.id);
              const isSelected = selectedIds.includes(p.id);
              const isExpanded = expandedId === p.id;
              const risk = RISK_COLOR[p.risk];
              const cat = CAT_COLOR[p.category];
              return (
                <div
                  key={p.id}
                  className={`product-option${isSelected ? " selected" : ""}${isSuggested && !isSelected ? " suggested" : ""}`}
                >
                  <div className="product-option-row" onClick={() => toggle(p.id)}>
                    <div className="product-option-checkbox">
                      {isSelected && <span className="product-option-check">✓</span>}
                    </div>
                    <span className="product-option-icon">{p.icon}</span>
                    <div className="product-option-info">
                      <div className="product-option-name">{p.name}</div>
                      <div className="product-option-meta">
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: cat.bg, color: cat.text }}>{p.category}</span>
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: risk.bg, color: risk.text }}>{risk.label}</span>
                        {isSuggested && <span className="product-option-suggested">✦ Consigliato</span>}
                      </div>
                    </div>
                    <button
                      className="product-option-expand"
                      onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : p.id); }}
                      title="Dettagli"
                    >
                      {isExpanded ? "▴" : "▾"}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="product-option-detail">
                      <p className="product-option-desc">{p.desc}</p>
                      <div className="product-option-terms">
                        {p.keyTerms.map(t => (
                          <span key={t} className="product-option-term">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPlan, setAuthPlan] = useState("free");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("generator");
  const [catFilter, setCatFilter] = useState("All");
  const [riskAppetite, setRiskAppetite] = useState("");
  const [horizon, setHorizon] = useState("");
  const [objective, setObjective] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [underlyingInput, setUnderlyingInput] = useState("");
  const [underlyings, setUnderlyings] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isinLoading, setIsinLoading] = useState({});
  const [isinResults, setIsinResults] = useState({});
  const [isinUsedIndex, setIsinUsedIndex] = useState(null); // index (0|1|2) that consumed ISIN search this batch
  const [history, setHistory] = useState([]);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [compareSelected, setCompareSelected] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const planInfo = PLANS.find(p => p.id === (user?.plan || "free"));
  const proposalsUsed = history.length;
  const proposalLimit = planInfo?.proposalLimit ?? FREE_LIMIT;
  const atLimit = proposalLimit !== Infinity && proposalsUsed >= proposalLimit;
  const isPro = user?.plan === "pro" || user?.plan === "unlimited";
  const isRetail = user?.plan === "retail";
  const canSearchISIN = isPro || isRetail;

  // Reset product selection when objective changes
  function handleObjectiveChange(val) {
    setObjective(val);
    setSelectedProductIds([]);
  }
async function handleStripeCheckout(plan) {
  if (!plan.priceId) return;
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: plan.priceId, email: authEmail || "" })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert("Errore nel checkout. Riprova.");
  } catch (err) {
    alert("Errore: " + err.message);
  }
}
  async function handleAuth() {
    setAuthError("");
    if (!authEmail || !authPassword) { setAuthError("Compila tutti i campi."); return; }
    if (authMode === "signup" && !authName) { setAuthError("Inserisci il tuo nome."); return; }
    if (authPassword.length < 6) { setAuthError("La password deve essere di almeno 6 caratteri."); return; }

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { name: authName, plan: authPlan } }
      });
      if (error) { setAuthError(error.message); return; }
      const name = authName;
      const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      setUser({ name, email: authEmail, initials, plan: authPlan });
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, name, plan: authPlan })
      });
      setScreen("app");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) { setAuthError(error.message); return; }
      const name = data.user.user_metadata?.name || authEmail.split("@")[0];
      const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const plan = data.user.user_metadata?.plan || "free";
      setUser({ name, email: authEmail, initials, plan });
      setScreen("app");
    }
  }

  function addUnderlying(raw) {
    const tokens = raw.split(/[\s,;]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
    setUnderlyings(prev => {
      const existing = new Set(prev.map(u => u.toUpperCase()));
      return [...prev, ...tokens.filter(t => !existing.has(t))];
    });
    setUnderlyingInput("");
  }

  function removeUnderlying(u) {
    setUnderlyings(prev => prev.filter(x => x !== u));
  }

  async function generateProposals() {
    if (!riskAppetite || !horizon || !objective || underlyings.length === 0) return;
    if (atLimit) { setShowUpgradeModal(true); return; }
    setLoading(true);
    setProposals([]);
    setIsinResults({});
    setCompareSelected([]);

    // Build product constraint
    const allowedProducts = selectedProductIds.length > 0
      ? PRODUCTS.filter(p => selectedProductIds.includes(p.id))
      : PRODUCTS;

    const productListStr = allowedProducts.map(p => `  - ${p.id}: ${p.name} (${p.category}, rischio ${RISK_COLOR[p.risk].label})`).join("\n");

    const prompt = `You are a structured products expert at a private bank.
A client has the following profile:
- Risk appetite: ${riskAppetite}
- Investment horizon: ${horizon}
- Investment objective: ${objective}

AVAILABLE UNDERLYINGS — the client has selected these and ONLY these:
${underlyings.map((u, i) => `  ${i + 1}. ${u}`).join("\n")}

ALLOWED PRODUCT STRUCTURES — propose ONLY from this list:
${productListStr}

CRITICAL RULES:
1. Each proposal's "underlying.suggested" must contain ONLY tickers from: [${underlyings.map(u => `"${u}"`).join(", ")}]
2. Use ONLY productIds from the allowed list above
3. Propose EXACTLY 3 structures from the allowed list that best fit the profile

Reply ONLY with this JSON (no text outside):
{
  "proposals": [
    {
      "rank": 1,
      "productId": "<id>",
      "productName": "<name>",
      "productIcon": "<icon>",
      "rationale": "<2-3 sentences>",
      "underlying": {
        "suggested": ["<ticker from client list>"],
        "type": "<Index/Single Stock/Basket/Commodity/ETF>",
        "rationale": "<brief>"
      },
      "terms": {
        "maturity": "<e.g. 18 months>",
        "strike": "<e.g. 100%>",
        "barrier": "<e.g. 60% or N/A>",
        "coupon": "<e.g. 8% p.a. or N/A>",
        "participation": "<e.g. 100% upside or N/A>",
        "protection": "<e.g. 100% or N/A>",
        "observationFrequency": "<e.g. quarterly or N/A>"
      },
      "payoff": {
        "bull": "<outcome if underlying rises>",
        "flat": "<outcome if underlying is flat>",
        "bear": "<outcome if underlying falls>"
      },
      "riskLevel": "<low|medium-low|medium|medium-high|high>",
      "category": "<Income|Protection|Growth>"
    }
  ]
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-beta": "claude-ai-artifact-api-2025-04-25" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const rawText = data.content?.map(b => b.text || "").join("") || "";
      const clean = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setProposals(parsed.proposals || []);
      setIsinResults({});
      setIsinUsedIndex(null);
      setHistory(h => [{
        id: Date.now(), risk: riskAppetite, horizon, objective,
        underlyings: underlyings.join(", "),
        proposals: parsed.proposals || [],
        underlyingLabels: underlyings,
        date: new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
      }, ...h]);
    } catch {
      setProposals([{ error: true, message: "Errore nella generazione. Riprova." }]);
    }
    setLoading(false);
  }

  async function searchISIN(proposal, index) {
    if (!canSearchISIN) { setShowUpgradeModal(true); return; }
    // Only one ISIN search allowed per batch of 3 proposals (generator tab)
    // History tab uses string keys like "h_...", so we only restrict numeric indices
    if (typeof index === "number" && isinUsedIndex !== null && isinUsedIndex !== index) return;
    if (typeof index === "number") setIsinUsedIndex(index);
    setIsinLoading(prev => ({ ...prev, [index]: true }));
    const underlying = proposal.underlying.suggested.join(", ");
    const activeFilter = canSearchISIN
      ? "\nIMPORTANTE: includi SOLO certificati ancora attivi e quotati. Escludi tassativamente certificati già scaduti, rimborsati anticipatamente (autocalled/early redeemed) o cancellati dalla quotazione."
      : "";

    // Build focused search queries for known reliable sources
    const searchHints = [
      `site:borsaitaliana.it certificati ${proposal.productName} ${underlying}`,
      `site:structuredretail.com certificate ${proposal.productName} ${underlying}`,
      `site:euronext.com structured certificate ${proposal.productName} ${underlying}`,
      `ISIN certificato "${proposal.productName}" ${underlying} Euronext`,
    ].join("\n");

    const prompt = `Sei un esperto di certificati strutturati. Cerca su web certificati reali quotati su Euronext Milan (Borsa Italiana) o Euronext con queste caratteristiche:

CARATTERISTICHE CERCATE:
- Tipo struttura: ${proposal.productName}
- Sottostante: ${underlying}
- Barriera indicativa: ${proposal.terms.barrier}
- Cedola indicativa: ${proposal.terms.coupon}
- Categoria: ${proposal.category || ""}
${activeFilter}

FONTI PRIORITARIE da cercare (in questo ordine):
1. borsaitaliana.it/certificati o finanzaonline.com/certificati
2. structuredretail.com
3. it.investing.com/structured-products
4. Qualsiasi pagina con codice ISIN (formato XS, DE, IT + 10 cifre) e nome emittente

QUERY DI RICERCA SUGGERITE:
${searchHints}

Dopo la ricerca, estrai tutti i certificati trovati con ISIN reali. Accetta anche corrispondenze parziali (tipo struttura simile o sottostante correlato).

Rispondi SEMPRE e SOLO con questo JSON (nessun testo fuori):
{"isins":[{"isin":"<codice ISIN reale>","emittente":"<nome emittente>","nome":"<nome prodotto>","scadenza":"<data scadenza>","similarity":"Alta|Media","fonte":"<URL pagina trovata>"}],"note":"<eventuale commento>"}

Se non trovi ISIN esatti, inserisci quelli più simili trovati con similarity "Media". Non restituire mai un array vuoto se hai trovato qualcosa di correlato.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-beta": "claude-ai-artifact-api-2025-04-25" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      // Grab the LAST text block (final answer after web search)
      const textBlocks = (data.content || []).filter(b => b.type === "text" && b.text);
      const rawText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : "";
      // Strip markdown fences, then extract the outermost JSON object
      const stripped = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      // Use a greedy match to get the full JSON object including nested arrays
      const jsonMatch = stripped.match(/\{[\s\S]*"isins"[\s\S]*\}/);
      if (!jsonMatch) {
        setIsinResults(prev => ({ ...prev, [index]: { isins: [], note: "Nessun certificato trovato per questa struttura." } }));
      } else {
        try {
          setIsinResults(prev => ({ ...prev, [index]: JSON.parse(jsonMatch[0]) }));
        } catch {
          setIsinResults(prev => ({ ...prev, [index]: { isins: [], note: "Errore nel parsing dei risultati." } }));
        }
      }
    } catch { setIsinResults(prev => ({ ...prev, [index]: { error: true } })); }
    setIsinLoading(prev => ({ ...prev, [index]: false }));
  }

  function toggleCompare(proposal, index) {
    if (!isPro) { setShowUpgradeModal(true); return; } // compare rimane solo Pro+
    const key = `${index}`;
    setCompareSelected(prev => {
      const already = prev.find(x => x.key === key);
      if (already) return prev.filter(x => x.key !== key);
      if (prev.length >= 3) return prev;
      return [...prev, { key, proposal }];
    });
  }

  function handlePrintPDF() {
    if (!isPro && !isRetail) { setShowUpgradeModal(true); return; }
    setTimeout(() => window.print(), 100);
  }

  const filteredProducts = catFilter === "All" ? PRODUCTS : PRODUCTS.filter(p => p.category === catFilter);

  // ── LANDING ──────────────────────────────────────────────────────────────
  if (screen === "landing") return (
    <>
      <style>{css}</style>
      <div className="landing">
        <nav className="landing-nav">
          <div className="landing-logo">
            <div className="logo-mark">S</div>
            <div className="logo-name">StructuredAI</div>
          </div>
          <div className="landing-nav-actions">
            <button className="btn-ghost" onClick={() => { setAuthMode("login"); setScreen("auth"); }}>Accedi</button>
            <button className="btn-primary" onClick={() => { setAuthMode("signup"); setScreen("auth"); }}>Inizia gratis</button>
          </div>
        </nav>
        <div className="hero">
          <div className="hero-eyebrow">AI · PRODOTTI STRUTTURATI</div>
          <h1>Proponi la struttura giusta <em>in pochi secondi</em></h1>
          <p>Seleziona l'obiettivo del cliente, scegli le strutture adatte e lascia che l'AI generi proposte complete con scenari di payoff e codici ISIN Euronext reali.</p>
          <div className="hero-actions">
            <button className="btn-hero" onClick={() => { setAuthMode("signup"); setScreen("auth"); }}>Inizia gratis →</button>
            <button className="btn-hero-outline" onClick={() => { setAuthMode("login"); setScreen("auth"); }}>Accedi</button>
          </div>
          <div className="hero-note">Nessuna carta di credito richiesta · Piano Free: 3 proposte/mese</div>
        </div>
        <div className="features-strip">
          {[
            { icon: "🧠", title: "Basato sull'AI", sub: "Abbina il prodotto giusto al profilo" },
            { icon: "📊", title: "Term sheet completi", sub: "Barriera, cedola, payoff, sottostante" },
            { icon: "🗂", title: "Selezione guidata", sub: "Strutture filtrate per obiettivo" },
            { icon: "🔍", title: "ISIN Euronext (Pro)", sub: "Certificati reali con ISIN" },
          ].map(f => (
            <div className="feature-item" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-text"><strong>{f.title}</strong><span>{f.sub}</span></div>
            </div>
          ))}
        </div>
        <div className="pricing-section">
          <div className="section-title">Piani e prezzi</div>
          <div className="section-sub">Inizia gratis. Nessuna carta di credito.</div>
          <div className="billing-toggle">
            <span className={`billing-label${!billingAnnual ? " active" : ""}`} onClick={() => setBillingAnnual(false)}>Mensile</span>
            <button className={`billing-toggle-track${billingAnnual ? " annual" : ""}`} onClick={() => setBillingAnnual(b => !b)}>
              <div className="billing-toggle-thumb" />
            </button>
            <span className={`billing-label${billingAnnual ? " active" : ""}`} onClick={() => setBillingAnnual(true)}>Annuale</span>
            {billingAnnual && <span className="billing-save-badge">Risparmia fino a €480/anno</span>}
          </div>
          <div className="plans-grid">
{PLANS.map(plan => {
  const price = billingAnnual ? plan.priceAnnual : plan.priceMonthly;
  const comingSoon = plan.id === "pro" || plan.id === "unlimited";
  return (
    <div key={plan.id} className={`plan-card${plan.highlight ? " highlight" : ""}${comingSoon ? " coming-soon-card" : ""}`}
      style={comingSoon ? { opacity: 0.5, filter: "grayscale(0.4)", pointerEvents: "none", position: "relative" } : {}}>
      {comingSoon && <div style={{ position:"absolute", top:12, right:12, background:"#6b7280", color:"#fff", fontSize:9, padding:"2px 8px", borderRadius:99, letterSpacing:"0.08em", fontFamily:"'DM Mono',monospace" }}>PROSSIMAMENTE</div>}
      {plan.highlight && !comingSoon && <div className="plan-badge">BEST VALUE</div>}
      <div className="plan-name">{plan.name.toUpperCase()}</div>
      <div><span className="plan-price">{price}</span><span className="plan-period">{plan.period}</span></div>
      {billingAnnual && plan.annualNote && <div className="plan-annual-note">✓ {plan.annualNote}</div>}
      <div className="plan-divider" />
      <ul className="plan-features">{plan.features.map(f => <li key={f}>{f}</li>)}</ul>
      <button className={`plan-cta ${plan.highlight ? "filled" : "outline"}`}
        onClick={() => { if (!comingSoon) {
  if (plan.priceId) {
    handleStripeCheckout(plan);
  } else {
    setAuthPlan(plan.id); setAuthMode("signup"); setScreen("auth");
  }
} }}>
        {comingSoon ? "Prossimamente" : plan.cta}
      </button>
    </div>
  );
})}          </div>
        </div>
        <div className="landing-footer">© 2025 StructuredAI · Solo a scopo informativo · Non costituisce consulenza finanziaria</div>
      </div>
    </>
  );

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (screen === "auth") return (
    <>
      <style>{css}</style>
      <div className="auth-wrap">
        <div className="auth-left">
          <div className="auth-left-logo">
            <div className="auth-left-logo-mark">S</div>
            <div><div className="auth-left-logo-name">StructuredAI</div><div className="auth-left-tagline">AI · PRODOTTI STRUTTURATI</div></div>
          </div>
          <div className="auth-left-middle">
            <h1>Strutture su misura,<br />in pochi secondi.</h1>
            <p>Dalla profilatura del cliente alla proposta completa. Term sheet, payoff, ISIN reali — tutto in un click.</p>
          </div>
          <div className="auth-left-bottom">© 2025 StructuredAI · Solo a scopo informativo</div>
        </div>
        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-tabs">
              <button className={`auth-tab${authMode === "login" ? " active" : ""}`} onClick={() => setAuthMode("login")}>Accedi</button>
              <button className={`auth-tab${authMode === "signup" ? " active" : ""}`} onClick={() => setAuthMode("signup")}>Registrati</button>
            </div>
            {authMode === "signup" && (
              <div className="form-group">
                <label>NOME</label>
                <input placeholder="Mario Rossi" value={authName} onChange={e => setAuthName(e.target.value)} />
              </div>
            )}
            <div className="form-group"><label>EMAIL</label><input type="email" placeholder="nome@banca.it" value={authEmail} onChange={e => setAuthEmail(e.target.value)} /></div>
            <div className="form-group"><label>PASSWORD</label><input type="password" placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} /></div>
            {authMode === "signup" && (
              <div className="plan-selector">
                <label>PIANO</label>
                <div className="plan-opts">
                  {PLANS.map(p => (
                    <button key={p.id} className={`plan-opt${authPlan === p.id ? " selected" : ""}`} onClick={() => setAuthPlan(p.id)}>
                      <span className="plan-opt-name">{p.name}</span>
                      <span className="plan-opt-price">{p.priceMonthly}/mese</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="auth-btn" onClick={handleAuth}>{authMode === "login" ? "Accedi →" : "Crea account →"}</button>
            {authError && <p className="auth-error">{authError}</p>}
            <div className="auth-switch">
              {authMode === "login" ? <>Nessun account? <a onClick={() => setAuthMode("signup")}>Registrati gratis</a></> : <>Hai già un account? <a onClick={() => setAuthMode("login")}>Accedi</a></>}
              {" · "}<a onClick={() => setScreen("landing")}>← Indietro</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // ── APP ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <nav className="topnav">
        <div className="topnav-logo">
          <div className="topnav-logo-mark">S</div>
          <div className="topnav-logo-name">StructuredAI</div>
        </div>
        <div style={{ width: 16 }} />
        {[["generator","Genera"],["catalog","Prodotti"],["history","Storico"],["dashboard","Dashboard"]].map(([t, label]) => (
          <button key={t} className={`topnav-tab${tab === t ? " active" : ""}`} onClick={() => { setTab(t); setViewingHistory(null); }}>{label}</button>
        ))}
        <div className="topnav-spacer" />
        <div className="topnav-user">
          <div className="topnav-avatar">{user.initials}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{user.name}</div>
            <span className={`plan-pill${user.plan === "free" ? " free" : user.plan === "pro" ? " pro" : user.plan === "retail" ? " retail" : ""}`}>{user.plan.toUpperCase()}</span>
          </div>
          <button className="logout-btn" onClick={async () => { await supabase.auth.signOut(); setUser(null); setHistory([]); setScreen("landing"); }}>Esci</button>
        </div>
      </nav>

      <div className="main">

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <>
            <div className="page-title">Dashboard</div>
            <div className="page-sub">{user.name} · {planInfo.name} plan</div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-label">PROPOSTE GENERATE</div><div className="stat-value">{history.length}</div><div className="stat-sub">questa sessione</div></div>
              <div className="stat-card"><div className="stat-label">PRODOTTI IN CATALOGO</div><div className="stat-value">12</div><div className="stat-sub">tutte le categorie</div></div>
              <div className="stat-card"><div className="stat-label">RICERCA ISIN</div><div className="stat-value" style={{ fontSize:"1rem", paddingTop:6 }}>{canSearchISIN ? "✓ Attiva" : "Pro/Retail"}</div><div className="stat-sub">{canSearchISIN ? (isRetail ? "Solo prodotti attivi" : "Euronext disponibile") : "upgrade per abilitare"}</div></div>
              <div className="stat-card"><div className="stat-label">PIANO ATTUALE</div><div className="stat-value" style={{ fontSize:"1.1rem", paddingTop:4 }}>{planInfo.name}</div><div className="stat-sub">{proposalLimit === Infinity ? "Proposte illimitate" : `${proposalsUsed} / ${proposalLimit} utilizzate`}</div></div>
            </div>
            {user.plan === "free" && (
              <div className="paywall-banner">
                <div className="paywall-banner-text">
                  <strong>Piano Free ({proposalsUsed}/{FREE_LIMIT} proposte utilizzate)</strong>
                  <span>Passa a Retail (€19.90/mese) per ricerca ISIN attivi, o a Pro per confronto affiancato e molto altro.</span>
                </div>
                <button className="upgrade-btn" onClick={() => setShowUpgradeModal(true)}>Upgrade →</button>
              </div>
            )}
          </>
        )}

        {/* CATALOG */}
        {tab === "catalog" && (
          <>
            <div className="page-title">Catalogo Prodotti</div>
            <div className="page-sub">12 prodotti strutturati disponibili</div>
            <div className="catalog-filters">
              {["All","Income","Protection","Growth"].map(f => (
                <button key={f} className={`filter-btn${catFilter === f ? " active" : ""}`} onClick={() => setCatFilter(f)}>{f}</button>
              ))}
            </div>
            <div className="product-grid">
              {filteredProducts.map(p => (
                <div key={p.id} className="product-card">
                  <div className="product-card-top">
                    <div className="product-icon">{p.icon}</div>
                    <span className="product-cat-badge" style={{ background: CAT_COLOR[p.category].bg, color: CAT_COLOR[p.category].text }}>{p.category}</span>
                  </div>
                  <div className="product-name">{p.name}</div>
                  <div className="product-desc">{p.desc}</div>
                  <span className="product-risk-badge" style={{ background: RISK_COLOR[p.risk].bg, color: RISK_COLOR[p.risk].text }}>{RISK_COLOR[p.risk].label} rischio</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <>
            <div className="page-title">Storico Proposte</div>
            <div className="page-sub">Tutte le proposte generate in questa sessione</div>
            {viewingHistory ? (
              <>
                <button className="action-btn" style={{ marginBottom: "1.25rem" }} onClick={() => setViewingHistory(null)}>← Torna alla lista</button>
                <div style={{ marginBottom: "0.5rem", fontSize: 12, color: "var(--muted)" }}>{viewingHistory.date} · {viewingHistory.risk} · {viewingHistory.horizon}</div>
                <div className="output-area">
                  {viewingHistory.proposals.map((p, i) => (
                    <ProposalCard key={i} proposal={p} index={i} isPro={isPro} canSearchISIN={canSearchISIN} isRetail={isRetail}
                      userUnderlyings={viewingHistory.underlyingLabels}
                      onSearchISIN={() => searchISIN(p, `h_${viewingHistory.id}_${i}`)}
                      isinLoading={isinLoading[`h_${viewingHistory.id}_${i}`]}
                      isinResults={isinResults[`h_${viewingHistory.id}_${i}`]}
                      onUpgrade={() => setShowUpgradeModal(true)}
                      compareSelected={compareSelected}
                      onToggleCompare={() => toggleCompare(p, `h_${viewingHistory.id}_${i}`)}
                      onExportPDF={handlePrintPDF} />
                  ))}
                </div>
              </>
            ) : history.length === 0 ? (
              <div className="empty-state">Nessuna proposta ancora. Generane una →</div>
            ) : (
              <div className="history-list">
                {history.map(item => (
                  <div key={item.id} className="history-item" onClick={() => setViewingHistory(item)}>
                    <div className="history-icon">📋</div>
                    <div className="history-info">
                      <div className="history-name">{item.objective} · {item.risk}</div>
                      <div className="history-meta">{item.horizon} · {item.proposals.length} strutture · {item.date}</div>
                    </div>
                    <div className="history-chevron">→</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* GENERATOR */}
        {tab === "generator" && (
          <>
            <div className="page-title">Genera Proposta di Struttura</div>
            <div className="page-sub">Compila il profilo, seleziona le strutture d'interesse e lascia che l'AI proponga le migliori opzioni per il cliente</div>

            {proposalLimit !== Infinity && (
              <div className="limit-bar">
                <div className="limit-label"><span>PROPOSTE QUESTO MESE</span><span>{proposalsUsed} / {proposalLimit}</span></div>
                <div className="limit-track">
                  <div className={`limit-fill${proposalsUsed >= proposalLimit ? " full" : proposalsUsed >= proposalLimit * 0.8 ? " warn" : ""}`}
                    style={{ width: `${Math.min(100, (proposalsUsed / proposalLimit) * 100)}%` }} />
                </div>
              </div>
            )}
            {atLimit && (
              <div className="paywall-banner">
                <div className="paywall-banner-text">
                  <strong>Hai usato tutte le {proposalLimit} proposte del piano {planInfo?.name}</strong>
                  <span>{user?.plan === "unlimited" ? "" : user?.plan === "pro" ? "Passa a Unlimited per proposte illimitate." : user?.plan === "retail" ? "Passa a Pro per 100 proposte/mese." : "Passa a Retail per 20 proposte/mese o a Pro per 100."}</span>
                </div>
                <button className="upgrade-btn" onClick={() => setShowUpgradeModal(true)}>Upgrade →</button>
              </div>
            )}

            <div className="gen-layout">
              <div className="gen-form">
                <h3>Profilo Investitore</h3>

                <div className="field-group">
                  <label className="field-label">PROPENSIONE AL RISCHIO *</label>
                  <select className="field-select" value={riskAppetite} onChange={e => setRiskAppetite(e.target.value)}>
                    <option value="">Seleziona...</option>
                    <option value="Bassa">Bassa</option>
                    <option value="Medio-Bassa">Medio-Bassa</option>
                    <option value="Media">Media</option>
                    <option value="Medio-Alta">Medio-Alta</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label">ORIZZONTE TEMPORALE *</label>
                  <select className="field-select" value={horizon} onChange={e => setHorizon(e.target.value)}>
                    <option value="">Seleziona...</option>
                    <option value="6 mesi">6 mesi</option>
                    <option value="12 mesi">12 mesi</option>
                    <option value="18 mesi">18 mesi</option>
                    <option value="24 mesi">24 mesi</option>
                    <option value="36+ mesi">36+ mesi</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label">OBIETTIVO *</label>
                  <select className="field-select" value={objective} onChange={e => handleObjectiveChange(e.target.value)}>
                    <option value="">Seleziona...</option>
                    <option value="Preservazione del capitale">Preservazione del capitale</option>
                    <option value="Reddito / cedole periodiche">Reddito / cedole periodiche</option>
                    <option value="Crescita del capitale">Crescita del capitale</option>
                    <option value="Diversificazione del portafoglio">Diversificazione del portafoglio</option>
                    <option value="Rendimento assoluto">Rendimento assoluto</option>
                  </select>
                </div>

                {/* Product selector — appears after objective chosen */}
                {objective && (
                  <ProductSelector
                    objective={objective}
                    selectedIds={selectedProductIds}
                    onChange={setSelectedProductIds}
                  />
                )}

                <div className="field-group">
                  <label className="field-label" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>SOTTOSTANTI <span style={{ color:"#c62828" }}>*</span></span>
                    {underlyings.length > 0 && (
                      <span style={{ fontSize:10, color:"var(--accent)", cursor:"pointer", fontWeight:400, letterSpacing:0 }} onClick={() => setUnderlyings([])}>
                        rimuovi tutti ({underlyings.length})
                      </span>
                    )}
                  </label>
                  {underlyings.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                      {underlyings.map(u => (
                        <span key={u} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, padding:"3px 10px", borderRadius:99, background:"var(--accent)", color:"#fff", cursor:"pointer", fontFamily:"'DM Mono', monospace", letterSpacing:"0.03em" }} onClick={() => removeUnderlying(u)}>
                          {u} <span style={{ opacity:0.6, fontSize:10 }}>×</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:6 }}>
                    <input className="field-input" style={{ flex:1, textTransform:"uppercase" }} placeholder="es. NVDA, MSFT, AMZN..." value={underlyingInput}
                      onChange={e => setUnderlyingInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); if (underlyingInput.trim()) addUnderlying(underlyingInput); } }} />
                    <button style={{ padding:"8px 12px", background:"var(--accent)", color:"#fff", border:"none", borderRadius:"var(--radius-sm)", cursor:"pointer", fontFamily:"'DM Mono', monospace", fontSize:12, whiteSpace:"nowrap", opacity: underlyingInput.trim() ? 1 : 0.4 }}
                      disabled={!underlyingInput.trim()} onClick={() => addUnderlying(underlyingInput)}>
                      + Aggiungi
                    </button>
                  </div>
                  <div style={{ fontSize:10, color:"var(--muted)", marginTop:5 }}>Ticker o nome. Premi Invio o virgola per aggiungere più sottostanti.</div>
                  {underlyings.length === 0 && <div style={{ fontSize:10, color:"#c62828", marginTop:4 }}>Aggiungi almeno un sottostante per procedere</div>}
                </div>

                <button className="gen-btn"
                  disabled={!riskAppetite || !horizon || !objective || underlyings.length === 0 || loading || atLimit}
                  onClick={generateProposals}>
                  {loading ? "Analisi in corso..." : atLimit ? "Limite raggiunto" : "Genera 3 strutture"}
                </button>
                {(!riskAppetite || !horizon || !objective || underlyings.length === 0) && !atLimit && (
                  <div style={{ fontSize:11, color:"var(--muted)", marginTop:6, textAlign:"center" }}>* campi obbligatori</div>
                )}

                {!canSearchISIN && (
                  <div style={{ marginTop:"1rem", padding:"10px 12px", background:"var(--pro-light)", borderRadius:"var(--radius-sm)", border:"1px solid rgba(124,58,237,0.15)" }}>
                    <div style={{ fontSize:10, color:"var(--pro)", letterSpacing:"0.06em", marginBottom:3 }}>RETAIL / PRO · RICERCA ISIN EURONEXT</div>
                    <div style={{ fontSize:11, color:"#5b21b6" }}>Cerca certificati reali quotati su Euronext con caratteristiche simili.</div>
                    <button style={{ marginTop:8, fontSize:11, padding:"5px 12px", border:"1px solid var(--pro)", borderRadius:"var(--radius-sm)", background:"none", color:"var(--pro)", cursor:"pointer", fontFamily:"'DM Mono', monospace" }} onClick={() => setShowUpgradeModal(true)}>Upgrade →</button>
                  </div>
                )}
              </div>

              <div className="output-area">
                {underlyings.length > 0 && !loading && proposals.length === 0 && (
                  <div style={{ background:"var(--accent-light)", border:"1px solid rgba(26,58,42,0.15)", borderRadius:"var(--radius-sm)", padding:"10px 14px", display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                    <span style={{ fontSize:10, letterSpacing:"0.07em", color:"var(--accent)", marginRight:4 }}>SOTTOSTANTI SELEZIONATI</span>
                    {underlyings.map(u => <span key={u} style={{ fontSize:10, padding:"2px 8px", borderRadius:99, background:"var(--accent)", color:"#fff" }}>{u}</span>)}
                  </div>
                )}
                {loading && (
                  <div className="output-placeholder">
                    <div style={{ fontSize:24, marginBottom:12 }}>🧠</div>
                    <div style={{ marginBottom:6 }}>L'AI sta analizzando il profilo...</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8 }}>Strutture adatte al rischio {riskAppetite} · {horizon}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, justifyContent:"center" }}>
                      {underlyings.map(u => <span key={u} style={{ fontSize:10, padding:"2px 8px", borderRadius:99, background:"var(--accent-light)", color:"var(--accent)", border:"1px solid rgba(26,58,42,0.18)" }}>{u}</span>)}
                    </div>
                  </div>
                )}
                {!loading && proposals.length === 0 && underlyings.length === 0 && (
                  <div className="output-placeholder">
                    <div style={{ fontSize:24, marginBottom:12 }}>📊</div>
                    <div>Compila il profilo a sinistra e clicca "Genera 3 strutture"</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:8 }}>Le proposte utilizzeranno <strong>esclusivamente i sottostanti che selezioni</strong>.</div>
                  </div>
                )}
                {!loading && proposals.length > 0 && (isPro || isRetail) && (
                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <button className="action-btn" style={{ fontSize:11 }} onClick={handlePrintPDF}>↓ Esporta tutte in PDF</button>
                  </div>
                )}
                {!loading && proposals.map((p, i) => (
                  p.error
                    ? <div key={i} style={{ padding:"1rem", background:"#fce4ec", borderRadius:"var(--radius)", fontSize:12, color:"#c62828" }}>{p.message}</div>
                    : <ProposalCard key={i} proposal={p} index={i} isPro={isPro} canSearchISIN={canSearchISIN} isRetail={isRetail}
                        userUnderlyings={underlyings}
                        onSearchISIN={() => searchISIN(p, i)}
                        isinLoading={isinLoading[i]}
                        isinResults={isinResults[i]}
                        isinLocked={typeof isinUsedIndex === "number" && isinUsedIndex !== i}
                        onUpgrade={() => setShowUpgradeModal(true)}
                        compareSelected={compareSelected}
                        onToggleCompare={() => toggleCompare(p, i)}
                        onExportPDF={handlePrintPDF} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* COMPARE BAR */}
      {isPro && compareSelected.length > 0 && (
        <div className="compare-bar">
          <div className="compare-bar-left">
            <span style={{ fontSize:11, opacity:0.7, letterSpacing:"0.05em" }}>CONFRONTO</span>
            <div className="compare-bar-chips">
              {compareSelected.map(x => (
                <div key={x.key} className="compare-bar-chip">
                  {x.proposal.productIcon} {x.proposal.productName}
                  <span className="compare-bar-chip-x" onClick={() => setCompareSelected(prev => prev.filter(p => p.key !== x.key))}>✕</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="compare-clear-btn" onClick={() => setCompareSelected([])}>Svuota</button>
            <button className="compare-btn" disabled={compareSelected.length < 2} onClick={() => setShowCompareModal(true)}>
              {compareSelected.length < 2 ? `Seleziona ancora ${2 - compareSelected.length}` : "Confronta →"}
            </button>
          </div>
        </div>
      )}

      {/* COMPARE MODAL */}
      {showCompareModal && compareSelected.length >= 2 && (
        <div className="modal-overlay" onClick={() => setShowCompareModal(false)}>
          <div className="compare-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ paddingBottom:"1rem", borderBottom:"1px solid var(--border)" }}>
              <div><h2>Confronto Affiancato</h2><p>{compareSelected.length} strutture selezionate</p></div>
              <button className="modal-close" onClick={() => setShowCompareModal(false)}>✕</button>
            </div>
            <div style={{ padding:"1.5rem 2rem 2rem", overflowX:"auto" }}>
              {(() => {
                const cols = compareSelected.length;
                const gridCols = `200px ${Array(cols).fill("1fr").join(" ")}`;
                const rows = [
                  { section:"PROFILO", label:"Prodotto", key: p => `${p.productIcon || "◈"} ${p.productName}` },
                  { label:"Categoria", key: p => p.category },
                  { label:"Livello Rischio", key: p => RISK_COLOR[p.riskLevel]?.label || p.riskLevel },
                  { label:"Sottostante", key: p => (p.underlying?.suggested || []).join(", ") },
                  { section:"TERMINI", label:"Scadenza", key: p => p.terms?.maturity || "—" },
                  { label:"Strike", key: p => p.terms?.strike || "—" },
                  { label:"Barriera", key: p => p.terms?.barrier || "—", className: p => p.terms?.barrier && p.terms.barrier !== "N/A" ? "warning" : "na" },
                  { label:"Cedola", key: p => p.terms?.coupon || "—", className: p => p.terms?.coupon && p.terms.coupon !== "N/A" ? "positive" : "na" },
                  { label:"Partecipazione", key: p => p.terms?.participation || "—", className: p => p.terms?.participation && p.terms.participation !== "N/A" ? "positive" : "na" },
                  { label:"Protezione cap.", key: p => p.terms?.protection || "—", className: p => p.terms?.protection && p.terms.protection !== "N/A" ? "positive" : "na" },
                  { label:"Osservazione", key: p => p.terms?.observationFrequency || "—" },
                  { section:"PAYOFF", label:"🟢 Scenario Bull", key: p => p.payoff?.bull || "—", className: () => "positive" },
                  { label:"🟡 Scenario Flat", key: p => p.payoff?.flat || "—" },
                  { label:"🔴 Scenario Bear", key: p => p.payoff?.bear || "—", className: () => "warning" },
                ];
                return (
                  <div style={{ display:"grid", gridTemplateColumns: gridCols, minWidth:560 }}>
                    <div style={{ background:"#fafaf8", borderRight:"1px solid var(--border)", borderBottom:"1px solid var(--border)", padding:"10px 14px" }} />
                    {compareSelected.map(x => (
                      <div key={x.key} className="compare-col-header" style={{ borderBottom:"1px solid rgba(255,255,255,0.2)" }}>
                        <div className="compare-col-header-rank">#{x.proposal.rank || parseInt(x.key)+1}</div>
                        <div className="compare-col-header-name">{x.proposal.productIcon} {x.proposal.productName}</div>
                        <div style={{ fontSize:10, opacity:0.6, marginTop:2 }}>{x.proposal.category}</div>
                      </div>
                    ))}
                    {rows.map((row, ri) => (
                      <React.Fragment key={ri}>
                        {row.section && (
                          <>
                            <div className="compare-section-label">{row.section}</div>
                            {compareSelected.map(x => <div key={x.key} className="compare-section-cell" />)}
                          </>
                        )}
                        <div className="compare-row-label">{row.label}</div>
                        {compareSelected.map(x => {
                          const val = row.key(x.proposal);
                          const cls = row.className ? row.className(x.proposal) : (val === "—" || val === "N/A" ? "na" : "");
                          return <div key={x.key} className={`compare-cell ${cls}`}>{val === "N/A" ? "—" : val}</div>;
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div><h2>Upgrade del piano</h2><p>Sblocca proposte illimitate e ricerca ISIN reali su Euronext</p></div>
              <button className="modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="billing-toggle" style={{ marginBottom:"1.5rem" }}>
                <span className={`billing-label${!billingAnnual ? " active" : ""}`} onClick={() => setBillingAnnual(false)}>Mensile</span>
                <button className={`billing-toggle-track${billingAnnual ? " annual" : ""}`} onClick={() => setBillingAnnual(b => !b)}>
                  <div className="billing-toggle-thumb" />
                </button>
                <span className={`billing-label${billingAnnual ? " active" : ""}`} onClick={() => setBillingAnnual(true)}>Annuale</span>
                {billingAnnual && <span className="billing-save-badge">Risparmia fino a €480/anno</span>}
              </div>
              <div className="modal-plans">
                {PLANS.map(plan => {
                  const price = billingAnnual ? plan.priceAnnual : plan.priceMonthly;
                  return (
                    <div key={plan.id} className={`plan-card${plan.highlight ? " highlight" : ""}`} style={{ padding:"1.25rem" }}>
                      {plan.highlight && <div className="plan-badge">BEST VALUE</div>}
                      <div className="plan-name">{plan.name.toUpperCase()}</div>
                      <div style={{ marginBottom:"0.25rem" }}>
                        {billingAnnual && plan.annualNote && <span className="plan-price-strike">{plan.priceMonthly}</span>}
                        <span className="plan-price" style={{ fontSize:"1.6rem" }}>{price}</span>
                        <span className="plan-period">{plan.period}</span>
                      </div>
                      {billingAnnual && plan.annualNote && <div className="plan-annual-note" style={{ marginBottom:"0.6rem" }}>✓ {plan.annualNote}</div>}
                      <ul className="plan-features" style={{ marginBottom:"1rem" }}>
                        {plan.features.map(f => <li key={f}>{f}</li>)}
                      </ul>
                      <button className={`plan-cta ${plan.highlight ? "filled" : "outline"}`}
                        onClick={() => { setUser(u => ({ ...u, plan: plan.id })); setShowUpgradeModal(false); }}>
                        {plan.id === user.plan ? "Piano attuale" : plan.cta}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF PRINT HEADER */}
      <div className="pdf-print-header">
        <div className="pdf-print-header-logo">
          <div className="pdf-print-header-logo-mark">S</div>
          <div className="pdf-print-header-logo-name">StructuredAI</div>
        </div>
        <div className="pdf-print-header-meta">
          <div style={{ fontWeight:500 }}>Proposta strutturata riservata al cliente</div>
          <div>Generata il {new Date().toLocaleDateString("it-IT")} · {user?.name}</div>
          {riskAppetite && <div>Rischio: {riskAppetite} · Orizzonte: {horizon}</div>}
        </div>
      </div>
      <div className="pdf-watermark">Documento generato da StructuredAI · Uso riservato · Solo a scopo informativo</div>
    </>
  );
}

// ─── ProposalCard ─────────────────────────────────────────────────────────────
function ProposalCard({ proposal, index, isPro, canSearchISIN, isRetail, userUnderlyings, onSearchISIN, isinLoading, isinResults, isinLocked, onUpgrade, compareSelected, onToggleCompare, onExportPDF }) {
  const risk = RISK_COLOR[proposal.riskLevel] || RISK_COLOR["medium"];
  const cat = CAT_COLOR[proposal.category] || CAT_COLOR["Income"];
  const t = proposal.terms || {};
  const suggestedList = proposal.underlying?.suggested || [];
  const unauthorizedUnderlyings = userUnderlyings ? suggestedList.filter(u => !userUnderlyings.some(uu => uu.toLowerCase() === u.toLowerCase())) : [];
  const key = `${index}`;
  const isSelected = compareSelected ? compareSelected.some(x => x.key === key) : false;
  const compareDisabled = compareSelected && !isSelected && compareSelected.length >= 3;

  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <div className="proposal-header-left">
          <div className="proposal-rank">#{proposal.rank || index + 1}</div>
          <div className="proposal-product-name">{proposal.productIcon || "◈"} {proposal.productName}</div>
          <span className="product-cat-badge" style={{ background:cat.bg, color:cat.text, fontSize:10, padding:"2px 8px", borderRadius:99 }}>{proposal.category}</span>
          <span className="product-risk-badge" style={{ background:risk.bg, color:risk.text, fontSize:10, padding:"2px 8px", borderRadius:4 }}>{risk.label} rischio</span>
        </div>
        <div className="proposal-header-right">
          {isPro && onToggleCompare && (
            <button className={`compare-toggle-btn${isSelected ? " selected" : ""}`} style={{ opacity: compareDisabled ? 0.4 : 1, cursor: compareDisabled ? "not-allowed" : "pointer" }}
              onClick={onToggleCompare} title={compareDisabled ? "Massimo 3 strutture" : isSelected ? "Rimuovi dal confronto" : "Aggiungi al confronto"}>
              {isSelected ? "✓ Nel confronto" : "⊞ Confronta"}
            </button>
          )}
          {isPro && onExportPDF && (
            <button className="action-btn" onClick={onExportPDF} style={{ fontSize:11 }}>↓ PDF</button>
          )}
          {!isPro && onToggleCompare && (
            <button className="compare-toggle-btn" onClick={onUpgrade}>⊞ Confronta <span style={{ fontSize:9, opacity:0.7 }}>PRO</span></button>
          )}
          {canSearchISIN && (
            <button className="isin-search-btn" onClick={onSearchISIN} disabled={isinLoading}>
              {isinLoading ? "⏳ Ricerca..." : "🔍 Cerca ISIN Euronext"}
            </button>
          )}
        </div>
      </div>

      <div className="proposal-body">
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:9, letterSpacing:"0.1em", color:"var(--muted)", marginBottom:4 }}>SOTTOSTANTE UTILIZZATO</div>
          <div className="underlying-chips">
            {suggestedList.map((u, i) => {
              const isValid = !userUnderlyings || userUnderlyings.some(uu => uu.toLowerCase() === u.toLowerCase());
              return <span key={i} className="underlying-chip" style={isValid ? {} : { background:"#fce4ec", color:"#c62828", border:"1px solid rgba(198,40,40,0.2)" }}>{u}{!isValid && " ⚠"}</span>;
            })}
            {proposal.underlying?.type && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:4, background:"#e3f2fd", color:"#1565c0" }}>{proposal.underlying.type}</span>}
          </div>
          {unauthorizedUnderlyings.length > 0 && <div style={{ fontSize:10, color:"#c62828", marginTop:4 }}>⚠ Sottostante non tra quelli selezionati</div>}
          {proposal.underlying?.rationale && <div style={{ fontSize:11, color:"var(--muted)", marginTop:4, fontStyle:"italic" }}>{proposal.underlying.rationale}</div>}
        </div>

        <div className="struct-sections">
          <div className="struct-section">
            <div className="struct-section-title">TERMINI PRINCIPALI</div>
            <div className="struct-rows">
              {t.maturity && <div className="struct-row"><span className="struct-row-label">Scadenza</span><span className="struct-row-value">{t.maturity}</span></div>}
              {t.strike && <div className="struct-row"><span className="struct-row-label">Strike</span><span className="struct-row-value">{t.strike}</span></div>}
              {t.barrier && t.barrier !== "N/A" && <div className="struct-row"><span className="struct-row-label">Barriera</span><span className="struct-row-value warning">{t.barrier}</span></div>}
              {t.observationFrequency && t.observationFrequency !== "N/A" && <div className="struct-row"><span className="struct-row-label">Osservazione</span><span className="struct-row-value">{t.observationFrequency}</span></div>}
            </div>
          </div>
          <div className="struct-section">
            <div className="struct-section-title">RENDIMENTO / PROTEZIONE</div>
            <div className="struct-rows">
              {t.coupon && t.coupon !== "N/A" && <div className="struct-row"><span className="struct-row-label">Cedola</span><span className="struct-row-value positive">{t.coupon}</span></div>}
              {t.participation && t.participation !== "N/A" && <div className="struct-row"><span className="struct-row-label">Partecipazione</span><span className="struct-row-value positive">{t.participation}</span></div>}
              {t.protection && t.protection !== "N/A" && <div className="struct-row"><span className="struct-row-label">Protezione cap.</span><span className="struct-row-value positive">{t.protection}</span></div>}
            </div>
          </div>
        </div>

        {proposal.payoff && (
          <div className="payoff-summary">
            <div className="payoff-title">SCENARI DI PAYOFF INDICATIVI</div>
            <div className="payoff-scenarios">
              <div className="payoff-scenario"><div className="payoff-scenario-label">SCENARIO BULL 🟢</div><div className="payoff-scenario-value bull" style={{ fontSize:"0.85rem" }}>{proposal.payoff.bull}</div></div>
              <div className="payoff-scenario"><div className="payoff-scenario-label">SCENARIO FLAT 🟡</div><div className="payoff-scenario-value flat" style={{ fontSize:"0.85rem" }}>{proposal.payoff.flat}</div></div>
              <div className="payoff-scenario"><div className="payoff-scenario-label">SCENARIO BEAR 🔴</div><div className="payoff-scenario-value bear" style={{ fontSize:"0.85rem" }}>{proposal.payoff.bear}</div></div>
            </div>
          </div>
        )}

        {proposal.rationale && <div className="rationale">💡 {proposal.rationale}</div>}

        <div className="isin-section">
          <div className="isin-section-header">
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:12 }}>🔍</span>
              <span style={{ fontSize:11, color:"var(--muted)" }}>Certificati simili su Euronext</span>
              <span className="isin-badge">{isRetail ? "RETAIL" : "PRO"}</span>
            </div>
            {!canSearchISIN && <button className="isin-search-btn" onClick={onUpgrade} style={{ fontSize:10, borderColor:"var(--pro)", color:"var(--pro)" }}>Sblocca con Retail/Pro →</button>}
            {canSearchISIN && !isinResults && !isinLoading && !isinLocked && (
              <button className="isin-search-btn" onClick={onSearchISIN}>Cerca ISIN Euronext →</button>
            )}
          </div>
          {!canSearchISIN && <div style={{ fontSize:11, color:"var(--muted)", fontStyle:"italic" }}>Upgrade a Retail o Pro per cercare ISIN di certificati quotati su Euronext simili a questa struttura.</div>}
          {canSearchISIN && isinLocked && (
            <div style={{ fontSize:11, color:"var(--muted)", fontStyle:"italic", display:"flex", alignItems:"center", gap:6 }}>
              <span>🔒</span> Ricerca ISIN già utilizzata su un'altra struttura di questa proposta.
            </div>
          )}
          {canSearchISIN && !isinResults && !isinLoading && !isinLocked && <div style={{ fontSize:11, color:"var(--muted)", fontStyle:"italic" }}>Clicca "Cerca ISIN Euronext" per trovare certificati reali con caratteristiche simili.</div>}
          {isinLoading && <div className="isin-loading">⏳ Ricerca certificati su Euronext in corso...</div>}
          {isinResults && !isinLoading && (
            <div className="isin-results">
              {isinResults.error
                ? <div style={{ fontSize:11, color:"#c62828" }}>Errore nella ricerca. Riprova.</div>
                : isinResults.isins?.length === 0
                  ? <div style={{ fontSize:11, color:"var(--muted)", fontStyle:"italic" }}>{isinResults.note || "Nessun certificato trovato."}</div>
                  : <>
                    {(isinResults.isins || []).map((isin, i) => (
                      <div key={i} className="isin-row">
                        <span className="isin-code">{isin.isin}</span>
                        <span className="isin-name">{isin.emittente} · {isin.nome} · sc. {isin.scadenza}</span>
                        {isin.fonte && <span style={{ fontSize:10, color:"var(--muted)", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={isin.fonte}>🔗 {isin.fonte.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]}</span>}
                        <span className="isin-similarity">{isin.similarity === "Alta" || isin.similarity === "High" ? "Alta" : "Media"}</span>
                      </div>
                    ))}
                    {isinResults.note && <div style={{ fontSize:10, color:"var(--muted)", marginTop:4, fontStyle:"italic" }}>{isinResults.note}</div>}
                  </>
              }
              <div style={{ fontSize:10, color:"var(--muted)", marginTop:6, fontStyle:"italic", borderTop:"1px solid var(--border)", paddingTop:6 }}>
                ⚠️ Verificare sempre su <strong>Euronext Markets</strong> o <strong>Borsa Italiana</strong> prima di operare. Dati indicativi.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
