#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor() {
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.value = '';
    this.checked = false;
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener() {}
  setAttribute() {}
  removeAttribute() {}
  querySelector() { return null; }
}

const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, new FakeElement());
  return elements.get(id);
};
const storage = new Map();
const document = {
  visibilityState: 'visible',
  documentElement: { dataset: {} },
  getElementById: element,
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener() {}
};
const navigator = { onLine: false };
const location = { protocol: 'https:', hostname: 'example.test', href: 'https://example.test/' };
const context = {
  console: { log() {}, warn() {}, error() {} },
  URL, Intl, Date, Math, JSON, Number, String, Array, Object, RegExp, Promise,
  AbortController, document, navigator, location,
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  },
  window: {
    addEventListener() {},
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    scrollTo() {}
  },
  setTimeout, clearTimeout,
  setInterval: () => 0,
  clearInterval() {},
  fetch: async () => { throw new Error('network disabled in synthetic alert test'); }
};
vm.createContext(context);
const root = path.resolve(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context, { filename: 'app.js' });

function weather(overrides = {}) {
  const length = 30;
  const values = (value) => Array.from({ length }, () => value);
  const times = Array.from({ length }, (_, i) => `2026-08-25T${String(i).padStart(2, '0')}:00`);
  const hourly = {
    time: times,
    temperature_2m: values(24),
    apparent_temperature: values(25),
    relative_humidity_2m: values(overrides.humidity ?? 55),
    dew_point_2m: values(overrides.dew ?? 14),
    precipitation_probability: values(overrides.rain ?? 10),
    precipitation: values(0),
    weather_code: values(1),
    cloud_cover: values(20),
    cloud_cover_low: values(overrides.lowCloud ?? 15),
    visibility: values(overrides.visibility ?? 10000),
    pressure_msl: values(1017),
    wind_speed_10m: values(overrides.wind ?? 10),
    wind_direction_10m: values(overrides.direction ?? 270),
    wind_gusts_10m: values(overrides.gust ?? 15),
    uv_index: values(overrides.uv ?? 2),
    is_day: values(1)
  };
  return {
    current: {
      time: times[0], temperature_2m: 24, apparent_temperature: 25,
      weather_code: 1, is_day: 1, wind_speed_10m: hourly.wind_speed_10m[0],
      wind_direction_10m: hourly.wind_direction_10m[0],
      wind_gusts_10m: hourly.wind_gusts_10m[0],
      relative_humidity_2m: hourly.relative_humidity_2m[0],
      precipitation: 0, pressure_msl: 1017
    },
    hourly,
    daily: { time: ['2026-08-25'] }
  };
}

function marine(wave) {
  const length = 30;
  return {
    current: { time: '2026-08-25T00:00', wave_height: wave },
    hourly: {
      time: Array.from({ length }, (_, i) => `2026-08-25T${String(i).padStart(2, '0')}:00`),
      wave_height: Array.from({ length }, () => wave),
      wave_direction: Array.from({ length }, () => 90),
      wave_period: Array.from({ length }, () => 7),
      swell_wave_height: Array.from({ length }, () => wave * .7)
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function setAlertSettings(overrides = {}) {
  context.__settingsOverrides = overrides;
  vm.runInContext('settings = { ...DEFAULT_SETTINGS, ...__settingsOverrides };', context);
  delete context.__settingsOverrides;
}

setAlertSettings();
const severe = context.buildAdvisories(weather({
  humidity: 92, dew: 23, rain: 82, lowCloud: 95, visibility: 1800,
  wind: 45, direction: 90, gust: 66, uv: 9
}), 0, marine(3.2));
const severeTitles = severe.map(item => item.title);
[
  'Strong gusts', 'High rain chance', 'Poor visibility', 'Very high UV',
  'Strong Levanter signal', 'Rock Cloud likely', 'Very rough sea guidance'
].forEach(title => assert(severeTitles.includes(title), `Missing alert: ${title}`));
assert(severe.every((item, index) => index === 0 || ({ high: 0, medium: 1, low: 2 })[severe[index - 1].level] <= ({ high: 0, medium: 1, low: 2 })[item.level]), 'Alerts are not severity sorted');

const clear = context.buildAdvisories(weather(), 0, marine(1.1));
assert(clear.length === 1 && clear[0].title === 'No notable forecast flags', 'Clear forecast should produce one all-clear item');

const landOnly = context.buildAdvisories(weather({ rain: 75 }), 0, null);
assert(landOnly.some(item => item.title === 'High rain chance'), 'Missing marine data blocked land alert generation');

setAlertSettings({ alertRain: false });
const rainDisabled = context.buildAdvisories(weather({ rain: 82 }), 0, null);
assert(!rainDisabled.some(item => /rain|shower/i.test(item.title)), 'Disabled rain category still generated an alert');

setAlertSettings({ alertRainThreshold: 70 });
const belowCustomRain = context.buildAdvisories(weather({ rain: 65 }), 0, null);
assert(!belowCustomRain.some(item => /rain|shower/i.test(item.title)), 'Rain alert ignored the custom threshold');

setAlertSettings({ alertRainThreshold: 60 });
const atCustomRain = context.buildAdvisories(weather({ rain: 60 }), 0, null);
assert(atCustomRain.some(item => item.title === 'Showers possible'), 'Rain alert did not trigger at the custom threshold');

setAlertSettings({
  alertWind: false, alertRain: false, alertVisibility: false, alertUv: false,
  alertLevanter: false, alertRockCloud: false, alertSea: false
});
const paused = context.buildAdvisories(weather({ gust: 70, rain: 90, uv: 10 }), 0, marine(3.5));
assert(paused.length === 1 && paused[0].title === 'Custom alerts paused', 'All categories off should show the paused state');

setAlertSettings({
  alertWind: false, alertVisibility: false, alertUv: false,
  alertLevanter: false, alertRockCloud: false, alertSea: false
});
context.renderAdvisories(weather({ rain: 82 }), null);
assert(element('topAlertCount').textContent === '🔔 1', 'Header alert count did not update');

context.applyTheme('light');
assert(document.documentElement.dataset.theme === 'light', 'Light theme did not apply');
context.applyTheme('dark');
assert(document.documentElement.dataset.theme === 'dark', 'Dark theme did not apply');

process.stdout.write('GibWeather custom alert smoke test passed\n');
