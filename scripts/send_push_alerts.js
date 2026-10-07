#!/usr/bin/env node
'use strict';

// Background alerts for GibWeather. Runs from .github/workflows/background-alerts.yml:
// fetches the same forecasts as the app, evaluates them with app.js's own alert logic and the
// user's saved settings, and sends a Web Push message when the set of alerts changes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'push-state.json');
const NOTIFY_LEVELS = ['high', 'medium', 'good'];

function loadApp() {
  class FakeElement {
    constructor() { Object.assign(this, { textContent: '', innerHTML: '', hidden: false, value: '', checked: false, dataset: {}, style: {}, className: '' }); this.classList = { add() {}, remove() {}, toggle() {} }; }
    addEventListener() {} setAttribute() {} removeAttribute() {} querySelector() { return null; }
  }
  const elements = new Map();
  const storage = new Map();
  const context = {
    console: { log() {}, warn() {}, error() {} },
    URL, Intl, Date, Math, JSON, Number, String, Array, Object, RegExp, Promise, AbortController,
    document: {
      visibilityState: 'visible', documentElement: { dataset: {} },
      getElementById: id => { if (!elements.has(id)) elements.set(id, new FakeElement()); return elements.get(id); },
      querySelectorAll: () => [], querySelector: () => null, addEventListener() {}
    },
    navigator: { onLine: false },
    location: { protocol: 'https:', hostname: 'actions.invalid', href: 'https://actions.invalid/' },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), scrollTo() {}, navigator: {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    fetch: async () => { throw new Error('app.js must not fetch inside the alert job'); }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), context, { filename: 'app.js' });
  return context;
}

async function getJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
    } catch (_) {}
    await new Promise(r => setTimeout(r, attempt * 2000));
  }
  return null;
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) { return {}; }
}

async function main() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const rawSubscription = process.env.PUSH_SUBSCRIPTION;
  if (!privateKey || !rawSubscription) {
    console.log('Background alerts are not set up: add the VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION repository secrets.');
    return;
  }
  let code;
  try { code = JSON.parse(rawSubscription); } catch (_) { throw new Error('PUSH_SUBSCRIPTION is not valid JSON. Copy the code from About → Background alerts again.'); }
  const subscription = code.subscription || code;
  if (!subscription?.endpoint) throw new Error('PUSH_SUBSCRIPTION has no endpoint. Copy the code from About → Background alerts again.');

  const app = loadApp();
  const urls = vm.runInContext('({ api: API_URL.toString(), marine: MARINE_API_URL.toString(), air: AIR_API_URL.toString(), beach: BEACH_SEA_API_URL.toString(), publicKey: PUSH_PUBLIC_KEY })', app);
  const [data, marine, air, beachRaw] = await Promise.all([getJson(urls.api), getJson(urls.marine), getJson(urls.air), getJson(urls.beach)]);
  if (!urls.publicKey) { console.log('Background alerts are not set up: PUSH_PUBLIC_KEY in app.js is empty.'); return; }
  if (!data?.current || !data?.hourly) throw new Error('Main Open-Meteo forecast unavailable.');

  app.__prefs = code.settings || {};
  app.__beach = beachRaw ? app.parseBeachSea(beachRaw) : null;
  vm.runInContext('settings = { ...DEFAULT_SETTINGS, ...__prefs }; beachSeaData = __beach;', app);
  const valid = d => d && !d.error && Array.isArray(d.hourly?.time) && d.hourly.time.length ? d : null;
  const items = app.buildAdvisories(data, app.getHourIndex(data), valid(marine), valid(air))
    .filter(item => !item.isClear && NOTIFY_LEVELS.includes(item.level));

  // Only titles and levels: re-timed forecasts of the same alert should not notify again.
  const signature = crypto.createHash('sha256').update(items.map(i => `${i.level}:${i.title}`).join('|')).digest('hex');
  const state = readState();
  const previous = state.signature || '';
  const write = sig => fs.writeFileSync(STATE_FILE, JSON.stringify({ signature: sig }, null, 2) + '\n');
  if (!items.length) {
    console.log('No alerts to send.');
    if (previous) write('');
    return;
  }
  if (signature === previous) { console.log('Alerts unchanged since the last notification.'); return; }

  const lead = items[0];
  const prefix = lead.level === 'high' ? 'Important' : lead.level === 'good' ? 'Beach day' : 'Watch';
  const extra = items.length > 1 ? ` Plus ${items.length - 1} more forecast flag${items.length === 2 ? '' : 's'}.` : '';
  const webpush = require('web-push');
  webpush.setVapidDetails('https://gibbothegreat.github.io/-gibweather/', urls.publicKey, privateKey);
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title: `${prefix}: ${lead.title}`, body: `${lead.detail}${extra}` }), { TTL: 3600, urgency: lead.level === 'high' ? 'high' : 'normal' });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) throw new Error('The device subscription has expired. Open GibWeather → About → Background alerts → Set up, and paste the new code into PUSH_SUBSCRIPTION.');
    throw err;
  }
  write(signature);
  console.log(`Sent: ${prefix}: ${lead.title} (${items.length} alert${items.length === 1 ? '' : 's'}).`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
