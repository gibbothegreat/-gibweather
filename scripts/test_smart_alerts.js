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
  const startEpoch = Date.UTC(2026, 7, 25, 0, 0, 0);
  const times = Array.from({ length }, (_, i) => new Date(startEpoch + i * 3600000).toISOString().slice(0, 16));
  const daylight = times.map(time => {
    const hour = Number(time.slice(11, 13));
    return hour >= 7 && hour < 21 ? 1 : 0;
  });
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
    is_day: daylight
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
    daily: {
      time: ['2026-08-25', '2026-08-26'],
      sunrise: ['2026-08-25T07:40', '2026-08-26T07:41'],
      sunset: ['2026-08-25T20:56', '2026-08-26T20:55']
    }
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
  alertLevanter: false, alertRockCloud: false, alertSea: false,
  alertAir: false, alertCalima: false, alertPollen: false, alertStorm: false
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

const hourlyUpgrade = weather();
const outdoor = context.bestOutdoorPeriod(context.snapshots(hourlyUpgrade, 0, 24));
assert(outdoor && outdoor.startIndex === 7 && outdoor.endIndex === 9, 'Outdoor guide did not choose the first strong daylight window');
assert(outdoor.label === 'Great', 'Outdoor guide rating is incorrect for clear calm weather');
context.renderHourly(hourlyUpgrade);
assert(element('hourlyList').innerHTML.includes('Feels'), 'Detailed hourly rows are missing feels-like data');
assert(element('hourlyList').innerHTML.includes('Visibility'), 'Detailed hourly rows are missing visibility data');
assert(element('hourlyList').innerHTML.includes('best-hour-tag'), 'Recommended outdoor hours were not highlighted');
assert(element('daylightTimeline').innerHTML.includes('solar-marker'), 'Sunrise or sunset markers were not rendered');
assert(element('outdoorWindow').textContent.length > 0, 'Outdoor window summary was not rendered');

// v2.2 air quality, Calima and pollen
function air({ aqi = 15, dust = 2, grass = 0, olive = 0, pollen = true } = {}) {
  const length = 30;
  const times = Array.from({ length }, (_, i) => new Date(Date.UTC(2026, 7, 25, i)).toISOString().slice(0, 16));
  const fill = v => Array.from({ length }, () => v);
  const hourly = { time: times, european_aqi: fill(aqi), pm2_5: fill(8), pm10: fill(14), dust: fill(dust), nitrogen_dioxide: fill(12), ozone: fill(60) };
  ['grass_pollen','olive_pollen','birch_pollen','alder_pollen','mugwort_pollen','ragweed_pollen'].forEach(k => { hourly[k] = fill(pollen ? 0 : null); });
  if (pollen) { hourly.grass_pollen = fill(grass); hourly.olive_pollen = fill(olive); }
  return { current: { time: times[0], european_aqi: aqi, dust }, hourly };
}
setAlertSettings();
const dusty = context.buildAdvisories(weather(), 0, null, air({ aqi: 85, dust: 180, grass: 80 }));
['Very poor air quality', 'Strong Calima', 'Grass pollen high'].forEach(title => assert(dusty.some(item => item.title === title), `Missing air alert: ${title}`));
assert(dusty.find(item => item.title === 'Strong Calima').level === 'high', 'Strong Calima should be Important');
const cleanAir = context.buildAdvisories(weather(), 0, null, air());
assert(cleanAir.length === 1 && cleanAir[0].isClear, 'Clean air should not raise alerts');
const lightDust = context.buildAdvisories(weather(), 0, null, air({ dust: 60 }));
assert(lightDust.some(item => item.title === 'Calima / Saharan dust' && item.level === 'medium'), 'Calima watch did not trigger at default threshold');
setAlertSettings({ alertDustThreshold: 100 });
assert(!context.buildAdvisories(weather(), 0, null, air({ dust: 60 })).some(item => /Calima/.test(item.title)), 'Calima ignored custom threshold');
setAlertSettings({ alertCalima: false, alertAir: false });
assert(!context.buildAdvisories(weather(), 0, null, air({ aqi: 90, dust: 250 })).some(item => /Calima|air quality/i.test(item.title)), 'Disabled air categories still alerted');
setAlertSettings({ alertPollenThreshold: 1 });
assert(context.buildAdvisories(weather(), 0, null, air({ olive: 80 })).some(item => item.title === 'Olive pollen moderate'), 'Moderate pollen threshold did not trigger');
setAlertSettings();
context.renderAir(air({ aqi: 45, dust: 120, grass: 30 }));
assert(element('airAqiLabel').textContent === 'Moderate', 'AQI band label incorrect');
assert(element('airDustLabel').textContent === 'Strong Calima', 'Dust band label incorrect');
assert(element('calimaSummary').textContent.startsWith('Strong Calima expected'), 'Calima summary missing');
assert(element('pollenList').innerHTML.includes('Grass') && element('pollenList').innerHTML.includes('Moderate'), 'Pollen list did not render');
assert(element('airDaily').innerHTML.includes('Today'), 'Daily air outlook missing');
assert(element('airNowSummary').innerHTML.includes('Calima'), 'Now-screen air summary missing');
context.renderAir(air({ pollen: false }));
assert(element('pollenList').innerHTML.includes('out of season'), 'Out-of-season pollen state missing');
context.renderAir(null);
assert(element('airAqiNow').textContent === '—', 'Unavailable air feed did not clear values');

// v2.3 beaches
const levanterDay = weather({ wind: 35, direction: 90, gust: 50 });
const levanterBeach = context.buildBeachOutlook(levanterDay, marine(1.2));
assert(levanterBeach.pickSide === 'west', 'Levanter should favour the west-side beaches');
assert(levanterBeach.pickHour.sides.east.rank >= 3, 'East side should be choppy or rough in a strong Levanter');
assert(levanterBeach.pickHour.sides.west.rating.label === 'Fair', 'A gusty offshore Levanter should cap the west side at Fair');
assert(levanterBeach.beaches[0].reason.includes('inflatables'), 'Strong offshore wind should warn about inflatables');
const ponienteBeach = context.buildBeachOutlook(weather({ wind: 30, direction: 260, gust: 42 }), marine(0.4));
assert(ponienteBeach.pickSide === 'east', 'Poniente should favour the east-side beaches');
const calmBeach = context.buildBeachOutlook(weather(), marine(0.2));
assert(calmBeach.beaches[0].rating.label === 'Great', 'Calm sunny weather should rate Great');
assert(calmBeach.isNight && calmBeach.pickHour.s.time.endsWith('07:00'), 'At night the best bet should use the first daylight hour');
context.renderBeaches(weather(), marine(0.2));
assert(element('beachSunsetDay').textContent === 'Today' && element('beachSunset').textContent === '20:56', 'Sunset should follow the best-bet day');
context.renderBeaches(levanterDay, marine(1.2));
assert(element('beachList').innerHTML.includes('Catalan Bay') && element('beachList').innerHTML.includes('Camp Bay'), 'Beach list did not render');
assert(element('beachDaily').innerHTML.includes('Today'), 'Beach outlook missing');
assert(element('beachNowSummary').innerHTML.includes('West side'), 'Now-screen beach summary missing');
context.renderBeaches(weather(), null);
assert(element('beachStatus').textContent.includes('wind and weather only'), 'Beach screen did not explain missing marine data');
context.renderBeaches(null, null);
assert(element('beachList').innerHTML === '', 'Unavailable forecast did not clear beach list');

// v2.4 nearshore beach waves and Beach day alerts
function beachSea(east, west) {
  const side = (wave, dir) => {
    const m = marine(wave);
    m.hourly.wave_direction = m.hourly.wave_direction.map(() => dir);
    return m;
  };
  return { east: east == null ? null : side(east, 90), west: west == null ? null : side(west, 250) };
}
assert(context.parseBeachSea([{ hourly: { time: ['2026-08-25T00:00'] } }, { error: true }]).west === null, 'Invalid nearshore point should be dropped');
assert(context.parseBeachSea([{ error: true }, { error: true }]) === null, 'No valid nearshore points should return null');
const swellEast = context.buildBeachOutlook(weather(), marine(0.2), beachSea(1.6, 0.1));
assert(swellEast.nearshore, 'Nearshore waves were not used');
assert(swellEast.pickHour.sides.east.rank >= 3 && swellEast.pickSide === 'west', 'Nearshore east swell should roughen only the east side');
const westOnlyLocal = context.buildBeachOutlook(weather(), marine(0.2), beachSea(null, 0.1));
assert(westOnlyLocal.pickHour.sources.west.local && !westOnlyLocal.pickHour.sources.east.local, 'Missing east point should fall back to Strait waves');
context.renderBeaches(weather(), marine(0.2), beachSea(0.3, 0.1));
assert(element('beachStatus').textContent.includes('nearshore'), 'Beach status should mention nearshore waves');
setAlertSettings();
assert(!context.buildAdvisories(weather(), 0, marine(0.2)).some(item => item.level === 'good'), 'Beach day alerts should be off by default');
setAlertSettings({ alertBeach: true });
const beachDay = context.buildAdvisories(weather(), 0, marine(0.2)).find(item => item.level === 'good');
assert(beachDay && beachDay.title === 'Great beach conditions' && beachDay.time === '07:00', 'Beach day alert did not trigger for calm sunny weather');
setAlertSettings({ alertBeach: true, beachAlertSide: 'east' });
assert(!context.buildAdvisories(weather({ wind: 30, direction: 90, gust: 45 }), 0, marine(1.2)).some(item => item.level === 'good'), 'East-side beach alert fired in a Levanter');
setAlertSettings({ alertBeach: true, beachAlertSide: 'west', beachAlertRating: 1 });
assert(context.buildAdvisories(weather({ wind: 14, direction: 90, gust: 22 }), 0, marine(0.4)).some(item => item.level === 'good' && item.detail.startsWith('West side')), 'Good-or-better west-side alert did not fire');
setAlertSettings();

// v2.5 tides and thunderstorms
const tideData = marine(0.5);
tideData.hourly.sea_level_height_msl = tideData.hourly.time.map((_, i) => 0.5 * Math.cos((i - 3) * 2 * Math.PI / 12.42));
const turns = context.tideTurns(tideData, 28);
assert(turns.length >= 3 && turns[0].type === 'High' && turns[1].type === 'Low' && turns[2].type === 'High', 'Tide turns should alternate high and low');
assert(Math.abs(turns[2].level - 0.5) < 0.05 && turns[2].time.startsWith('2026-08-25T15'), 'High water time or height is off');
assert(turns[1].time.startsWith('2026-08-25T09') && Math.abs(turns[1].level + 0.5) < 0.05, 'Low water time or height is off');
context.renderTides(tideData, null);
assert(element('tideList').innerHTML.includes('High') && element('tideSummary').textContent.includes('Strait'), 'Tides did not render');
context.renderTides(null, null);
assert(element('tideList').innerHTML === '', 'Missing tide data should clear the list');
assert(context.stormRisk({ code: 95 }).rank === 3, 'Forecast thunder should be the top storm level');
assert(context.stormRisk({ code: 3, cape: 1500, rainChance: 50 }).rank === 2, 'Unstable showery air should be a possible storm');
assert(context.stormRisk({ code: 3, cape: 200, rainChance: 80 }).rank === 0, 'Rain without instability is not a storm risk');
const stormy = weather({ rain: 60 });
stormy.hourly.weather_code = stormy.hourly.weather_code.map((c, i) => i === 4 ? 95 : c);
setAlertSettings();
const stormAlerts = context.buildAdvisories(stormy, 0, null);
assert(stormAlerts[0].title === 'Thunderstorms forecast' && stormAlerts[0].level === 'high', 'Thunderstorm alert should lead the list');
setAlertSettings({ alertStorm: false });
assert(!context.buildAdvisories(stormy, 0, null).some(item => /Thunderstorm/.test(item.title)), 'Disabled storm alerts still fired');
setAlertSettings();
context.renderStorm(stormy);
assert(element('stormBadge').textContent === 'Thunderstorms forecast' && element('stormTimeline').innerHTML.includes('storm-rank-3'), 'Storm panel did not render');

process.stdout.write('GibWeather forecast smoke tests passed\n');
