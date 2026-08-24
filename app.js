const APP_VERSION = '1.6';
const GIBRALTAR = { lat: 36.1408, lon: -5.3536, timezone: 'Europe/Gibraltar' };
const CACHE_KEY = 'gibweather:last-forecast:v16';
const BACKUP_CACHE_KEY = 'gibweather:last-known-good:v1';
const LEGACY_CACHE_KEYS = ['gibweather:last-forecast:v15','gibweather:last-forecast:v14','gibweather:last-forecast:v13','gibweather:last-forecast:v12','gibweather:last-forecast:v11','gibweather:last-forecast:v10','gibweather:last-forecast:v8','gibweather:last-forecast:v7','gibweather:last-forecast:v6', 'gibweather:last-forecast:v5', 'gibweather:last-forecast:v4', 'gibweather:last-forecast:v3', 'gibweather:last-forecast:v2', 'gibweather:last-forecast:v1'];
const INTRO_KEY = 'gibweather:intro-seen';
const SETTINGS_KEY = 'gibweather:settings:v1';
const DEFAULT_SETTINGS = {
  temperatureUnit: 'c', windUnit: 'kmh', refreshMinutes: 30,
  alertWind: true, alertRain: true, alertVisibility: true, alertUv: true,
  alertLevanter: true, alertRockCloud: true, alertSea: true,
  alertGustThreshold: 40, alertRainThreshold: 45, alertVisibilityThreshold: 6000,
  alertUvThreshold: 6, alertWaveThreshold: 2
};
const ALERT_TOGGLE_KEYS = [
  'alertWind','alertRain','alertVisibility','alertUv','alertLevanter','alertRockCloud','alertSea'
];
const OBSERVATION_URL = './data/lxgb-observation.json';
const RADAR_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const RADAR_ZOOM = 7;
const RADAR_TILE_SIZE = 256;
const RADAR_GRID_RADIUS = 2;

const API_URL = new URL('https://api.open-meteo.com/v1/forecast');
API_URL.searchParams.set('latitude', GIBRALTAR.lat);
API_URL.searchParams.set('longitude', GIBRALTAR.lon);
API_URL.searchParams.set('timezone', GIBRALTAR.timezone);
API_URL.searchParams.set('forecast_days', '8');
API_URL.searchParams.set('temperature_unit', 'celsius');
API_URL.searchParams.set('wind_speed_unit', 'kmh');
API_URL.searchParams.set('precipitation_unit', 'mm');
API_URL.searchParams.set('current', [
  'temperature_2m','relative_humidity_2m','apparent_temperature','precipitation',
  'weather_code','cloud_cover','pressure_msl','wind_speed_10m','wind_direction_10m','wind_gusts_10m','is_day'
].join(','));
API_URL.searchParams.set('hourly', [
  'temperature_2m','apparent_temperature','relative_humidity_2m','dew_point_2m',
  'precipitation_probability','precipitation','weather_code','cloud_cover','cloud_cover_low',
  'visibility','pressure_msl','wind_speed_10m','wind_direction_10m','wind_gusts_10m','uv_index','is_day'
].join(','));
API_URL.searchParams.set('daily', [
  'weather_code','temperature_2m_max','temperature_2m_min','apparent_temperature_max','apparent_temperature_min',
  'precipitation_probability_max','precipitation_sum','wind_speed_10m_max','wind_gusts_10m_max',
  'wind_direction_10m_dominant','uv_index_max','sunrise','sunset'
].join(','));

const MODEL_FEEDS = [
  { id: 'ecmwf', label: 'ECMWF', endpoint: 'https://api.open-meteo.com/v1/ecmwf' },
  { id: 'gfs', label: 'GFS', endpoint: 'https://api.open-meteo.com/v1/gfs' },
  { id: 'icon', label: 'ICON', endpoint: 'https://api.open-meteo.com/v1/dwd-icon' }
].map(feed => {
  const url = new URL(feed.endpoint);
  url.searchParams.set('latitude', GIBRALTAR.lat);
  url.searchParams.set('longitude', GIBRALTAR.lon);
  url.searchParams.set('timezone', GIBRALTAR.timezone);
  url.searchParams.set('forecast_hours', '24');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');
  url.searchParams.set('hourly', ['wind_speed_10m','wind_direction_10m','wind_gusts_10m','temperature_2m','precipitation'].join(','));
  return { ...feed, url };
});

const MARINE_API_URL = new URL('https://marine-api.open-meteo.com/v1/marine');
MARINE_API_URL.searchParams.set('latitude', GIBRALTAR.lat);
MARINE_API_URL.searchParams.set('longitude', GIBRALTAR.lon);
MARINE_API_URL.searchParams.set('timezone', GIBRALTAR.timezone);
MARINE_API_URL.searchParams.set('forecast_days', '8');
MARINE_API_URL.searchParams.set('length_unit', 'metric');
MARINE_API_URL.searchParams.set('cell_selection', 'sea');
MARINE_API_URL.searchParams.set('current', [
  'wave_height','wave_direction','wave_period','sea_surface_temperature',
  'ocean_current_velocity','ocean_current_direction','sea_level_height_msl'
].join(','));
MARINE_API_URL.searchParams.set('hourly', [
  'wave_height','wave_direction','wave_period','swell_wave_height','swell_wave_direction','swell_wave_period',
  'sea_surface_temperature','ocean_current_velocity','ocean_current_direction','sea_level_height_msl'
].join(','));
MARINE_API_URL.searchParams.set('daily', [
  'wave_height_max','wave_direction_dominant','wave_period_max',
  'swell_wave_height_max','swell_wave_direction_dominant','swell_wave_period_max'
].join(','));

const $ = (id) => document.getElementById(id);
let weatherData = null;
let modelData = null;
let marineData = null;
let observationData = null;
let savedAt = null;
let lastLoadWasCached = false;
let loadInFlight = false;
let lastApiHealth = 'waiting';
let lastModelHealth = 'waiting';
let lastMarineHealth = 'waiting';
let lastObservationHealth = 'waiting';
let lastRadarHealth = 'waiting';
let radarData = null;
let radarFrameIndex = 0;
let radarPlayTimer = null;
let autoRefreshTimer = null;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch (_) { return { ...DEFAULT_SETTINGS }; }
}

let settings = loadSettings();

function persistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
}

function tempValue(c) {
  if (c == null || Number.isNaN(Number(c))) return null;
  return settings.temperatureUnit === 'f' ? (Number(c) * 9/5) + 32 : Number(c);
}

function tempUnitLabel() { return settings.temperatureUnit === 'f' ? '°F' : '°C'; }
function formatTemp(c) {
  const v = tempValue(c);
  return v == null ? '—' : `${Math.round(v)}${tempUnitLabel()}`;
}
function formatTempShort(c) {
  const v = tempValue(c);
  return v == null ? '—°' : `${Math.round(v)}°`;
}
function windValue(kmh) {
  if (kmh == null || Number.isNaN(Number(kmh))) return null;
  return settings.windUnit === 'mph' ? Number(kmh) * 0.621371 : Number(kmh);
}
function windUnitLabel() { return settings.windUnit === 'mph' ? 'mph' : 'km/h'; }
function formatWind(kmh) {
  const v = windValue(kmh);
  return v == null ? '—' : `${Math.round(v)} ${windUnitLabel()}`;
}

function formatCurrentSpeed(kmh) {
  const v = windValue(kmh);
  if (v == null) return '—';
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${windUnitLabel()}`;
}
function formatWave(m) {
  if (m == null || Number.isNaN(Number(m))) return '—';
  return `${Number(m).toFixed(Number(m) < 10 ? 1 : 0)} m`;
}
function formatSeaTemp(c) { return formatTemp(c); }

function weatherInfo(code = 0, isDay = 1) {
  if (code === 0) return ['Clear sky', isDay ? '☀️' : '🌙'];
  if (code === 1) return ['Mainly clear', isDay ? '🌤️' : '🌙'];
  if (code === 2) return ['Partly cloudy', isDay ? '⛅' : '☁️'];
  if (code === 3) return ['Overcast', '☁️'];
  if ([45, 48].includes(code)) return ['Fog', '🌫️'];
  if ([51, 53, 55, 56, 57].includes(code)) return ['Drizzle', '🌦️'];
  if ([61, 63, 65, 66, 67].includes(code)) return ['Rain', '🌧️'];
  if ([71, 73, 75, 77].includes(code)) return ['Snow', '🌨️'];
  if ([80, 81, 82].includes(code)) return ['Rain showers', '🌦️'];
  if ([85, 86].includes(code)) return ['Snow showers', '🌨️'];
  if ([95, 96, 99].includes(code)) return ['Thunderstorm', '⛈️'];
  return ['Mixed conditions', '🌥️'];
}

function compass(deg) {
  if (deg == null || Number.isNaN(Number(deg))) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round((((Number(deg) % 360) + 360) % 360) / 22.5) % 16];
}

function fmtTime(iso) {
  if (!iso) return '—';
  const match = String(iso).match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '—';
}

function fmtDay(date, long = false) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', { weekday: long ? 'long' : 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}

function fakeLocalEpoch(iso) {
  if (!iso) return NaN;
  const normalized = String(iso).length === 16 ? `${iso}:00Z` : `${iso}Z`;
  return Date.parse(normalized);
}

function gibraltarNowFakeEpoch() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: GIBRALTAR.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

function round(v) { return v == null || Number.isNaN(Number(v)) ? '—' : Math.round(Number(v)); }
function kmVisibility(m) { return m == null ? '—' : `${Math.max(0, Number(m)/1000).toFixed(Number(m) < 10000 ? 1 : 0)} km`; }
function uvLabel(v) {
  if (v == null) return '—';
  if (v < 3) return 'Low';
  if (v < 6) return 'Moderate';
  if (v < 8) return 'High';
  if (v < 11) return 'Very high';
  return 'Extreme';
}
function angleInRange(deg, min, max) { return Number.isFinite(deg) && deg >= min && deg <= max; }
function isEasterly(dir) { return angleInRange(Number(dir), 45, 135); }
function isBroadEasterly(dir) { return angleInRange(Number(dir), 25, 155); }
function isWesterly(dir) { return angleInRange(Number(dir), 225, 315); }

function getHourIndex(data) {
  if (!data?.hourly?.time?.length) return 0;
  const currentTime = data.current?.time;
  const exact = data.hourly.time.indexOf(currentTime);
  if (exact >= 0) return exact;
  const target = gibraltarNowFakeEpoch();
  let best = 0, diff = Infinity;
  data.hourly.time.forEach((t, i) => {
    const d = Math.abs(fakeLocalEpoch(t) - target);
    if (d < diff) { diff = d; best = i; }
  });
  return best;
}

function hourSnapshot(data, i) {
  const h = data.hourly;
  const safe = (key) => Array.isArray(h?.[key]) ? h[key][i] : null;
  return {
    time: safe('time'), temp: safe('temperature_2m'), feels: safe('apparent_temperature'),
    humidity: safe('relative_humidity_2m'), dew: safe('dew_point_2m'), rainChance: safe('precipitation_probability'),
    precipitation: safe('precipitation'), code: safe('weather_code'), cloud: safe('cloud_cover'),
    lowCloud: safe('cloud_cover_low'), visibility: safe('visibility'), pressure: safe('pressure_msl'),
    wind: safe('wind_speed_10m'), dir: safe('wind_direction_10m'), gust: safe('wind_gusts_10m'),
    uv: safe('uv_index'), isDay: safe('is_day')
  };
}

function humidityEvidence(s) {
  const rh = Number(s.humidity), low = Number(s.lowCloud), temp = Number(s.temp), dew = Number(s.dew);
  const spread = Number.isFinite(temp) && Number.isFinite(dew) ? temp - dew : null;
  let score = 0;
  if (rh >= 85) score += 2; else if (rh >= 72) score += 1;
  if (low >= 70) score += 2; else if (low >= 40) score += 1;
  if (spread != null && spread <= 3) score += 2; else if (spread != null && spread <= 5) score += 1;
  return { score, spread };
}

function levanterIndex(s) {
  const dir = Number(s.dir), wind = Number(s.wind), gust = Number(s.gust);
  const evidence = humidityEvidence(s);
  if (!isBroadEasterly(dir)) {
    return { label: 'None', icon: '🟢', className: 'state-green', rank: 0, confidence: 'No easterly signal', detail: `${compass(dir)} flow · ${formatWind(wind)}` };
  }

  const core = isEasterly(dir);
  let label = 'Light', icon = '🔵', className = 'state-blue', rank = 1;
  if ((core && wind >= 40) || gust >= 60) { label = 'Strong'; icon = '🔴'; className = 'state-red'; rank = 3; }
  else if ((core && wind >= 22) || gust >= 38) { label = 'Moderate'; icon = '🟠'; className = 'state-orange'; rank = 2; }

  const confidence = !core ? 'Easterly edge signal'
    : evidence.score >= 5 ? 'Classic humid signal'
    : evidence.score >= 2 ? 'Easterly signal supported'
    : 'Dry easterly signal';

  return {
    label, icon, className, rank, confidence,
    detail: `${compass(dir)} ${formatWind(wind)} · gusts ${formatWind(gust)}`
  };
}

function rockCloudIndex(s) {
  const dirOK = isEasterly(Number(s.dir));
  const wind = Number(s.wind), low = Number(s.lowCloud), rh = Number(s.humidity);
  const { spread } = humidityEvidence(s);
  let score = 0;
  if (dirOK) score += 2;
  if (wind >= 10) score += 0.5;
  if (low >= 70) score += 2; else if (low >= 40) score += 1;
  if (rh >= 85) score += 1.5; else if (rh >= 72) score += 0.75;
  if (spread != null && spread <= 3) score += 1.5; else if (spread != null && spread <= 5) score += 0.75;

  if (score >= 5) return { label: 'Likely', icon: '☁️', className: 'state-orange', rank: 2, detail: `Low cloud ${round(low)}% · RH ${round(rh)}%` };
  if (score >= 3) return { label: 'Possible', icon: '🌥️', className: 'state-yellow', rank: 1, detail: `Low cloud ${round(low)}% · ${compass(s.dir)} wind` };
  return { label: 'Unlikely', icon: '☀️', className: 'state-green', rank: 0, detail: `Low cloud ${round(low)}%` };
}

function windRegime(s) {
  const dir = Number(s.dir);
  if (isBroadEasterly(dir)) return 'Levanter';
  if (isWesterly(dir)) return 'Poniente';
  return `${compass(dir)} flow`;
}

function snapshots(data, start, count) {
  const end = Math.min(start + count, data.hourly.time.length);
  return Array.from({ length: Math.max(0, end - start) }, (_, n) => hourSnapshot(data, start + n));
}

function findPeak(items, key) {
  return items.reduce((best, x) => Number(x[key]) > Number(best?.[key] ?? -Infinity) ? x : best, null);
}

function buildOutlook(data, start) {
  const next24 = snapshots(data, start, 24);
  const next12 = next24.slice(0, 12);
  const levStates = next24.map(s => ({ s, state: levanterIndex(s) }));
  const rockStates = next12.map(s => ({ s, state: rockCloudIndex(s) }));
  const currentLev = levStates[0]?.state || levanterIndex(hourSnapshot(data, start));
  const firstLev = levStates.find(x => x.state.rank > 0);
  const peakLev = levStates.reduce((best, x) => x.state.rank > (best?.state.rank ?? -1) ? x : best, null);
  const peakRock = rockStates.reduce((best, x) => x.state.rank > (best?.state.rank ?? -1) ? x : best, null);
  const peakGust = findPeak(next24, 'gust');
  const maxRain = findPeak(next24, 'rainChance');
  const wetStart = next24.find(x => Number(x.rainChance) >= 50);
  const levHours = levStates.filter(x => x.state.rank > 0).length;

  let windText;
  if (currentLev.rank > 0) windText = `${currentLev.label} Levanter now`;
  else if (firstLev) windText = `Levanter possible from ${fmtTime(firstLev.s.time)}`;
  else windText = `${windRegime(next24[0])} now`;

  return {
    currentLev, peakLev, peakRock, peakGust, maxRain, wetStart, levHours,
    windText,
    rockOutlook: peakRock?.state.rank === 2 ? `Likely within 12h${peakRock.s.time ? ` · ${fmtTime(peakRock.s.time)}` : ''}`
      : peakRock?.state.rank === 1 ? 'Possible within 12h' : 'Low risk next 12h'
  };
}

function applyStateCard(el, state) {
  el.classList.remove('state-green','state-blue','state-yellow','state-orange','state-red');
  el.classList.add(state.className);
}

function activeAlertCategoryCount(prefs = settings) {
  return ALERT_TOGGLE_KEYS.filter(key => prefs[key] !== false).length;
}

function alertThreshold(key) {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : Number(DEFAULT_SETTINGS[key]);
}

function buildAdvisories(data, start, marine = marineData) {
  const next24 = snapshots(data, start, 24);
  const next12 = next24.slice(0, 12);
  const advisories = [];
  const peakGust = findPeak(next24, 'gust');
  const peakRain = findPeak(next24, 'rainChance');
  const lowestVisibility = next24.reduce((best, x) => Number(x.visibility) < Number(best?.visibility ?? Infinity) ? x : best, null);
  const peakUV = findPeak(next24, 'uv');
  const peakLev = next24.map(s => ({ s, state: levanterIndex(s) }))
    .reduce((best, x) => x.state.rank > (best?.state.rank ?? -1) ? x : best, null);
  const peakRock = next12.map(s => ({ s, state: rockCloudIndex(s) }))
    .reduce((best, x) => x.state.rank > (best?.state.rank ?? -1) ? x : best, null);

  let peakWave = null;
  if (marine?.hourly?.time?.length) {
    const marineStart = marineHourIndex(marine);
    const marineHours = Array.from(
      { length: Math.max(0, Math.min(marineStart + 24, marine.hourly.time.length) - marineStart) },
      (_, offset) => marineSnapshot(marine, marineStart + offset)
    );
    peakWave = marineHours.reduce((best, x) => Number(x.wave) > Number(best?.wave ?? -Infinity) ? x : best, null);
  }

  const gustThreshold = alertThreshold('alertGustThreshold');
  const rainThreshold = alertThreshold('alertRainThreshold');
  const visibilityThreshold = alertThreshold('alertVisibilityThreshold');
  const uvThreshold = alertThreshold('alertUvThreshold');
  const waveThreshold = alertThreshold('alertWaveThreshold');

  if (settings.alertWind !== false && Number(peakGust?.gust) >= gustThreshold && Number(peakGust?.gust) >= 60) advisories.push({
    icon: '🌪️', title: 'Strong gusts', level: 'high',
    detail: `Peak gusts around ${formatWind(peakGust.gust)} in the next 24 hours.`, time: fmtTime(peakGust.time)
  });
  else if (settings.alertWind !== false && Number(peakGust?.gust) >= gustThreshold) advisories.push({
    icon: '💨', title: 'Breezy / gusty', level: 'medium',
    detail: `Gusts may reach about ${formatWind(peakGust.gust)}.`, time: fmtTime(peakGust.time)
  });

  if (settings.alertRain !== false && Number(peakRain?.rainChance) >= rainThreshold && Number(peakRain?.rainChance) >= 70) advisories.push({
    icon: '🌧️', title: 'High rain chance', level: 'high',
    detail: `Rain probability peaks near ${round(peakRain.rainChance)}%.`, time: fmtTime(peakRain.time)
  });
  else if (settings.alertRain !== false && Number(peakRain?.rainChance) >= rainThreshold) advisories.push({
    icon: '🌦️', title: 'Showers possible', level: 'medium',
    detail: `Rain probability reaches ${round(peakRain.rainChance)}%.`, time: fmtTime(peakRain.time)
  });

  if (settings.alertVisibility !== false && Number(lowestVisibility?.visibility) > 0 && Number(lowestVisibility.visibility) <= visibilityThreshold && Number(lowestVisibility.visibility) < 3000) advisories.push({
    icon: '🌫️', title: 'Poor visibility', level: 'high',
    detail: `Modelled visibility could fall to ${kmVisibility(lowestVisibility.visibility)}.`, time: fmtTime(lowestVisibility.time)
  });
  else if (settings.alertVisibility !== false && Number(lowestVisibility?.visibility) > 0 && Number(lowestVisibility.visibility) <= visibilityThreshold) advisories.push({
    icon: '👁️', title: 'Reduced visibility', level: 'medium',
    detail: `Modelled visibility could fall to ${kmVisibility(lowestVisibility.visibility)}.`, time: fmtTime(lowestVisibility.time)
  });

  if (settings.alertUv !== false && Number(peakUV?.uv) >= uvThreshold && Number(peakUV?.uv) >= 8) advisories.push({
    icon: '☀️', title: 'Very high UV', level: 'high',
    detail: `UV index may reach ${Number(peakUV.uv).toFixed(1)}.`, time: fmtTime(peakUV.time)
  });
  else if (settings.alertUv !== false && Number(peakUV?.uv) >= uvThreshold) advisories.push({
    icon: '☀️', title: 'High UV', level: 'medium',
    detail: `UV index may reach ${Number(peakUV.uv).toFixed(1)}.`, time: fmtTime(peakUV.time)
  });

  if (settings.alertLevanter !== false && peakLev?.state.rank >= 3) advisories.push({
    icon: '🌬️', title: 'Strong Levanter signal', level: 'high',
    detail: `${peakLev.state.detail}. ${peakLev.state.confidence}.`, time: fmtTime(peakLev.s.time)
  });
  else if (settings.alertLevanter !== false && peakLev?.state.rank >= 2) advisories.push({
    icon: '🌬️', title: 'Levanter signal', level: 'medium',
    detail: `${peakLev.state.detail}.`, time: fmtTime(peakLev.s.time)
  });

  if (settings.alertRockCloud !== false && peakRock?.state.rank >= 2) advisories.push({
    icon: '🏔️', title: 'Rock Cloud likely', level: 'medium',
    detail: `Low cloud and humidity favour Rock Cloud conditions. ${peakRock.state.detail}.`, time: fmtTime(peakRock.s.time)
  });
  else if (settings.alertRockCloud !== false && peakRock?.state.rank >= 1) advisories.push({
    icon: '🌥️', title: 'Rock Cloud possible', level: 'low',
    detail: `There is a weaker Rock Cloud signal. ${peakRock.state.detail}.`, time: fmtTime(peakRock.s.time)
  });

  if (settings.alertSea !== false && Number(peakWave?.wave) >= waveThreshold && Number(peakWave?.wave) >= 3) advisories.push({
    icon: '🌊', title: 'Very rough sea guidance', level: 'high',
    detail: `Modelled waves may reach ${formatWave(peakWave.wave)} in the Strait. Do not use GibWeather for navigation.`, time: fmtTime(peakWave.time)
  });
  else if (settings.alertSea !== false && Number(peakWave?.wave) >= waveThreshold) advisories.push({
    icon: '🌊', title: 'Rough sea guidance', level: 'medium',
    detail: `Modelled waves may reach ${formatWave(peakWave.wave)} in the Strait.`, time: fmtTime(peakWave.time)
  });

  if (!advisories.length) {
    const paused = activeAlertCategoryCount() === 0;
    advisories.push({
      icon: paused ? '⏸️' : '✅', title: paused ? 'Custom alerts paused' : 'No notable forecast flags', level: 'low', isClear: true,
      detail: paused ? 'All custom alert categories are switched off.' : 'None of your enabled custom alert thresholds are triggered.', time: '24h'
    });
  }
  const priority = { high: 0, medium: 1, low: 2 };
  return advisories.sort((a, b) => priority[a.level] - priority[b.level]).slice(0, 7);
}

function renderAdvisories(data, marine = marineData) {
  const start = getHourIndex(data);
  const items = buildAdvisories(data, start, marine);
  const high = items.filter(x => x.level === 'high').length;
  const medium = items.filter(x => x.level === 'medium').length;
  const alertCount = items.filter(x => !x.isClear).length;
  const activeCategories = activeAlertCategoryCount();
  const state = high ? 'high' : medium ? 'medium' : 'low';
  const panel = $('smartAlertsPanel');
  panel.classList.remove('alert-state-waiting','alert-state-low','alert-state-medium','alert-state-high');
  panel.classList.add(`alert-state-${state}`);
  $('advisoryBadge').className = `advisory-badge badge-${state}`;
  $('advisoryBadge').textContent = !activeCategories ? 'Paused' : high
    ? `${high} important${medium ? ` · ${medium} watch` : ''}`
    : medium ? `${medium} watch` : 'All clear';
  const topCount = $('topAlertCount');
  if (topCount) {
    topCount.className = `top-alert-count count-${state}`;
    topCount.textContent = `🔔 ${alertCount}`;
    topCount.setAttribute('aria-label', `${alertCount} custom weather alert${alertCount === 1 ? '' : 's'}`);
  }
  const lead = items[0];
  const summaryTitle = !activeCategories ? 'Custom alerts paused' : high ? 'Important conditions expected' : medium ? 'Conditions to watch' : 'No important alerts';
  const summaryDetail = high || medium
    ? `${lead.title} is the highest-priority flag for the next 24 hours.`
    : !activeCategories ? 'Turn on the categories you want in About → Custom alerts.' : 'None of your enabled Gibraltar weather or marine thresholds are currently triggered.';
  $('alertSummary').innerHTML = `<span class="alert-summary-icon">${!activeCategories ? '⏸️' : high ? '🔴' : medium ? '🟠' : '🟢'}</span><div><strong>${summaryTitle}</strong><small>${summaryDetail}</small></div>`;
  const levelLabel = { high: 'Important', medium: 'Watch', low: 'Info' };
  $('advisoryList').innerHTML = items.map(x => `<div class="advisory-item level-${x.level}" role="listitem">
    <div class="advisory-icon">${x.icon}</div>
    <div><strong>${x.title}</strong><small>${x.detail}</small></div>
    <div class="advisory-time">${x.time}<span>${levelLabel[x.level]}</span></div>
  </div>`).join('');
}

function dataAgeLabel() {
  if (!savedAt) return '—';
  const ms = Date.now() - Date.parse(savedAt);
  if (!Number.isFinite(ms) || ms < 0) return 'Just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function dataAgeMinutes(at = savedAt) {
  if (!at) return null;
  const ms = Date.now() - Date.parse(at);
  return Number.isFinite(ms) ? Math.max(0, ms / 60000) : null;
}

function cachedStatusMessage(prefix = 'Showing the last saved Gibraltar forecast.') {
  const age = dataAgeMinutes();
  if (age == null) return prefix;
  if (age >= 24 * 60) return `${prefix} Warning: saved data is ${dataAgeLabel()} old and may be outdated.`;
  if (age >= 6 * 60) return `${prefix} Saved data is ${dataAgeLabel()} old.`;
  return prefix;
}

function renderForecastConfidence() {
  const badge = $('forecastConfidenceBadge');
  const text = $('forecastConfidenceText');
  if (!badge || !text) return;
  const agreement = Array.isArray(modelData?.series) && modelData.series.length >= 2 ? modelAgreement(modelData) : null;
  const age = dataAgeMinutes();
  let score = agreement ? (0.52 + agreement.score * 0.48) : 0.52;
  if (lastLoadWasCached || lastApiHealth !== 'ok') score -= 0.12;
  if (age != null && age > 180) score -= 0.08;
  if (age != null && age > 360) score -= 0.12;
  if (age != null && age > 720) score -= 0.18;
  score = Math.max(0.15, Math.min(0.98, score));
  const level = score >= 0.78 ? 'High' : score >= 0.58 ? 'Medium' : 'Low';
  const cls = level === 'High' ? 'agreement-high' : level === 'Medium' ? 'agreement-medium' : 'agreement-low';
  badge.textContent = level;
  badge.className = `agreement-badge ${cls}`;
  const parts = [];
  if (agreement) parts.push(`${agreement.level.toLowerCase()} 12-hour wind-model agreement`);
  else parts.push('model comparison unavailable');
  if (age != null) parts.push(`forecast data ${dataAgeLabel()} old`);
  if (lastLoadWasCached) parts.push('using saved data');
  else if (lastApiHealth === 'ok') parts.push('live feed');
  text.textContent = `GibWeather rates the wind outlook ${level.toLowerCase()} confidence: ${parts.join(' · ')}.`;
}

function renderSettings() {
  const t = $('temperatureUnitSelect'), w = $('windUnitSelect'), r = $('refreshIntervalSelect');
  if (t) t.value = settings.temperatureUnit;
  if (w) w.value = settings.windUnit;
  if (r) r.value = String(settings.refreshMinutes);
  const toggles = {
    alertWindToggle: 'alertWind', alertRainToggle: 'alertRain',
    alertVisibilityToggle: 'alertVisibility', alertUvToggle: 'alertUv',
    alertLevanterToggle: 'alertLevanter', alertRockCloudToggle: 'alertRockCloud',
    alertSeaToggle: 'alertSea'
  };
  Object.entries(toggles).forEach(([id, key]) => { if ($(id)) $(id).checked = settings[key] !== false; });
  const thresholds = {
    alertGustThresholdSelect: 'alertGustThreshold', alertRainThresholdSelect: 'alertRainThreshold',
    alertVisibilityThresholdSelect: 'alertVisibilityThreshold', alertUvThresholdSelect: 'alertUvThreshold',
    alertWaveThresholdSelect: 'alertWaveThreshold'
  };
  Object.entries(thresholds).forEach(([id, key]) => { if ($(id)) $(id).value = String(alertThreshold(key)); });
  const summary = $('settingsSummary');
  if (summary) summary.textContent = `${tempUnitLabel()} · ${windUnitLabel()} · refresh every ${settings.refreshMinutes} min`;
  const alertSummary = $('alertSettingsSummary');
  if (alertSummary) alertSummary.textContent = `${activeAlertCategoryCount()} of ${ALERT_TOGGLE_KEYS.length} alert types on · saved on this device`;
}

function applySettingsFromUI() {
  const t = $('temperatureUnitSelect'), w = $('windUnitSelect'), r = $('refreshIntervalSelect');
  const selectNumber = (id, allowed, fallback) => {
    const value = Number($(id)?.value);
    return allowed.includes(value) ? value : fallback;
  };
  settings = {
    temperatureUnit: t?.value === 'f' ? 'f' : 'c',
    windUnit: w?.value === 'mph' ? 'mph' : 'kmh',
    refreshMinutes: [15,30,60].includes(Number(r?.value)) ? Number(r.value) : 30,
    alertWind: Boolean($('alertWindToggle')?.checked),
    alertRain: Boolean($('alertRainToggle')?.checked),
    alertVisibility: Boolean($('alertVisibilityToggle')?.checked),
    alertUv: Boolean($('alertUvToggle')?.checked),
    alertLevanter: Boolean($('alertLevanterToggle')?.checked),
    alertRockCloud: Boolean($('alertRockCloudToggle')?.checked),
    alertSea: Boolean($('alertSeaToggle')?.checked),
    alertGustThreshold: selectNumber('alertGustThresholdSelect', [30,40,50,60], DEFAULT_SETTINGS.alertGustThreshold),
    alertRainThreshold: selectNumber('alertRainThresholdSelect', [30,45,60,70], DEFAULT_SETTINGS.alertRainThreshold),
    alertVisibilityThreshold: selectNumber('alertVisibilityThresholdSelect', [2000,3000,6000,10000], DEFAULT_SETTINGS.alertVisibilityThreshold),
    alertUvThreshold: selectNumber('alertUvThresholdSelect', [3,6,8,11], DEFAULT_SETTINGS.alertUvThreshold),
    alertWaveThreshold: selectNumber('alertWaveThresholdSelect', [1.5,2,2.5,3], DEFAULT_SETTINGS.alertWaveThreshold)
  };
  persistSettings();
  renderSettings();
  if (weatherData) renderAll(weatherData);
  scheduleAutoRefresh();
  setStatus('Preferences saved.', 'notice');
}

function resetSettings() {
  settings = { ...DEFAULT_SETTINGS };
  persistSettings();
  renderSettings();
  if (weatherData) renderAll(weatherData);
  scheduleAutoRefresh();
  setStatus('Preferences reset to Gibraltar defaults.', 'notice');
}

function scheduleAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    if (navigator.onLine && document.visibilityState === 'visible') refreshAll(false);
  }, Math.max(15, Number(settings.refreshMinutes) || 30) * 60 * 1000);
}

function renderAppStatus() {
  if ($('topVersion')) {
    $('topVersion').textContent = `v${APP_VERSION}`;
    $('topVersion').setAttribute('aria-label', `App version ${APP_VERSION}`);
  }
  if ($('versionText')) $('versionText').textContent = `v${APP_VERSION}`;
  if ($('lastRefreshText')) $('lastRefreshText').textContent = savedAt ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: GIBRALTAR.timezone }).format(new Date(savedAt)) : '—';
  if ($('dataAgeText')) $('dataAgeText').textContent = dataAgeLabel();
  if ($('connectionText')) $('connectionText').textContent = navigator.onLine ? (lastLoadWasCached ? 'Online · cached' : 'Online · live') : 'Offline';
  renderHealthStatus();
}

function healthRow(icon, title, value, tone='ok') {
  return `<div class="health-row health-${tone}"><span class="health-icon">${icon}</span><div><strong>${title}</strong><small>${value}</small></div></div>`;
}

function renderHealthStatus() {
  const root = $('healthGrid');
  if (!root) return;
  const secure = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  const saved = Boolean(readCachedForecast());
  const swSupported = 'serviceWorker' in navigator;
  const swControlled = Boolean(navigator.serviceWorker?.controller);
  const installed = isStandalone();
  const forecastTone = lastApiHealth === 'ok' ? 'ok' : lastApiHealth === 'cached' ? 'warn' : lastApiHealth === 'waiting' ? 'neutral' : 'bad';
  const forecastText = lastApiHealth === 'ok' ? 'Live Open-Meteo forecast' : lastApiHealth === 'cached' ? 'Using saved forecast' : lastApiHealth === 'waiting' ? 'Waiting for first check' : 'Live refresh unavailable';
  const modelTone = lastModelHealth === 'ok' ? 'ok' : ['cached','degraded'].includes(lastModelHealth) ? 'warn' : lastModelHealth === 'waiting' ? 'neutral' : 'bad';
  const modelCount = Array.isArray(modelData?.series) ? modelData.series.length : 0;
  const modelText = lastModelHealth === 'ok' ? `${modelCount || 3} model feeds available` : lastModelHealth === 'cached' ? 'Saved model comparison' : lastModelHealth === 'degraded' ? 'Main forecast OK · models unavailable' : lastModelHealth === 'waiting' ? 'Waiting for first check' : 'Model comparison unavailable';
  const marineTone = lastMarineHealth === 'ok' ? 'ok' : lastMarineHealth === 'cached' ? 'warn' : lastMarineHealth === 'waiting' ? 'neutral' : 'bad';
  const marineText = lastMarineHealth === 'ok' ? 'Live Strait marine forecast' : lastMarineHealth === 'cached' ? 'Saved marine forecast' : lastMarineHealth === 'waiting' ? 'Waiting for first check' : 'Marine forecast unavailable';
  const observationTone = lastObservationHealth === 'ok' ? 'ok' : lastObservationHealth === 'stale' ? 'warn' : lastObservationHealth === 'waiting' ? 'neutral' : 'bad';
  const observationText = observationData?.available ? `LXGB observation · ${observationAgeLabel(observationData)}` : lastObservationHealth === 'waiting' ? 'Waiting for airport observation' : 'LXGB observation unavailable';
  const radarTone = lastRadarHealth === 'ok' ? 'ok' : lastRadarHealth === 'waiting' ? 'neutral' : lastRadarHealth === 'offline' ? 'warn' : 'bad';
  const radarText = lastRadarHealth === 'ok' ? `${radarData?.frames?.length || 0} recent radar frames` : lastRadarHealth === 'waiting' ? 'Loads on demand' : lastRadarHealth === 'offline' ? 'Unavailable offline' : 'Radar service unavailable';
  root.innerHTML = [
    healthRow(forecastTone === 'ok' ? '✅' : forecastTone === 'bad' ? '❌' : forecastTone === 'warn' ? '⚠️' : 'ℹ️', 'Forecast API', forecastText, forecastTone),
    healthRow(modelTone === 'ok' ? '✅' : modelTone === 'bad' ? '❌' : modelTone === 'warn' ? '⚠️' : 'ℹ️', 'Forecast models', modelText, modelTone),
    healthRow(marineTone === 'ok' ? '✅' : marineTone === 'bad' ? '❌' : marineTone === 'warn' ? '⚠️' : 'ℹ️', 'Marine forecast', marineText, marineTone),
    healthRow(observationTone === 'ok' ? '✅' : observationTone === 'bad' ? '❌' : observationTone === 'warn' ? '⚠️' : 'ℹ️', 'Airport observation', observationText, observationTone),
    healthRow(radarTone === 'ok' ? '✅' : radarTone === 'bad' ? '❌' : radarTone === 'warn' ? '⚠️' : 'ℹ️', 'Rain radar', radarText, radarTone),
    healthRow(swControlled ? '✅' : swSupported ? 'ℹ️' : '❌', 'Offline app shell', swControlled ? 'Active and controlling' : swSupported ? 'Supported · activates after hosting/reload' : 'Not supported', swControlled ? 'ok' : swSupported ? 'neutral' : 'bad'),
    healthRow(saved ? '✅' : 'ℹ️', 'Saved forecast', saved ? `Available · ${dataAgeLabel()} old` : 'Not saved yet', saved ? 'ok' : 'neutral'),
    healthRow(secure ? '✅' : '⚠️', 'Hosting', secure ? (location.protocol === 'https:' ? 'HTTPS secure' : 'Local development') : 'HTTPS required for install', secure ? 'ok' : 'warn'),
    healthRow(installed ? '✅' : 'ℹ️', 'App mode', installed ? 'Installed web app' : 'Browser mode', installed ? 'ok' : 'neutral')
  ].join('');
}

async function runHealthCheck() {
  const btn = $('healthCheckBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  try {
    if (navigator.onLine) await refreshAll(true);
    renderHealthStatus();
    setStatus(navigator.onLine ? 'System health check complete.' : 'Offline health check complete.', 'notice');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Run health check'; }
  }
}


function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const mins = Math.round(ms / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2,'0')}m`;
}

function renderTodaySummary(data) {
  const d = data?.daily;
  if (!d?.time?.length) return;
  $('todayHighLow').textContent = `${formatTempShort(d.temperature_2m_max[0])} / ${formatTempShort(d.temperature_2m_min[0])}`;
  $('todayFeelsRange').textContent = `Feels ${formatTempShort(d.apparent_temperature_max[0])} / ${formatTempShort(d.apparent_temperature_min[0])}`;
  $('todayRainMax').textContent = `${round(d.precipitation_probability_max[0])}%`;
  $('todayRainTotal').textContent = `${Number(d.precipitation_sum[0] || 0).toFixed(1)} mm total`;
  const uv = d.uv_index_max[0];
  $('todayUvMax').textContent = uv == null ? '—' : Number(uv).toFixed(1);
  $('todayUvLabel').textContent = uvLabel(uv);
  $('sunriseToday').textContent = fmtTime(d.sunrise[0]);
  $('sunsetToday').textContent = fmtTime(d.sunset[0]);
  $('todayDaylight').textContent = formatDuration(fakeLocalEpoch(d.sunset[0]) - fakeLocalEpoch(d.sunrise[0]));
}

function chartTimeLabel(iso) {
  return fmtTime(iso);
}

function safeSeries(items, key) {
  return items.map(x => Number(x[key])).filter(Number.isFinite);
}

function linePath(values, xFor, yFor) {
  return values.map((v, i) => `${i ? 'L' : 'M'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
}

function renderTemperatureRainChart(data) {
  const el = $('temperatureRainChart');
  if (!el) return;
  const start = getHourIndex(data);
  const items = snapshots(data, start, 24);
  if (items.length < 2) { el.textContent = 'Chart unavailable.'; return; }
  const temps = safeSeries(items, 'temp');
  const rain = items.map(x => Math.max(0, Math.min(100, Number(x.rainChance) || 0)));
  const tMin = Math.floor(Math.min(...temps) - 1), tMax = Math.ceil(Math.max(...temps) + 1);
  const W=720,H=210,L=42,R=18,T=16,B=34, plotW=W-L-R, plotH=H-T-B;
  const x = i => L + (i / (items.length - 1)) * plotW;
  const yT = v => T + (tMax - v) / Math.max(1, tMax - tMin) * plotH;
  const barW = Math.max(4, plotW / items.length - 3);
  const tempValues = items.map(x => Number(x.temp));
  const labels = [0,6,12,18,23].filter(i => i < items.length);
  const bars = rain.map((v,i) => {
    const h = v/100 * plotH;
    return `<rect class="chart-rain-bar" x="${(x(i)-barW/2).toFixed(1)}" y="${(T+plotH-h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" />`;
  }).join('');
  const grid = [tMin, Math.round((tMin+tMax)/2), tMax].map(v => `<g><line class="chart-gridline" x1="${L}" x2="${W-R}" y1="${yT(v)}" y2="${yT(v)}"/><text class="chart-axis" x="${L-7}" y="${yT(v)+4}" text-anchor="end">${Math.round(tempValue(v))}°</text></g>`).join('');
  const xlabels = labels.map(i => `<text class="chart-axis" x="${x(i)}" y="${H-10}" text-anchor="middle">${i===0?'Now':chartTimeLabel(items[i].time)}</text>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${grid}${bars}<path class="chart-temp-line" d="${linePath(tempValues,x,yT)}"/>${tempValues.map((v,i)=>`<circle class="chart-temp-dot" cx="${x(i)}" cy="${yT(v)}" r="2.5"/>`).join('')}${xlabels}</svg>`;
  const peakRain = Math.max(...rain), maxT = Math.max(...temps), minT = Math.min(...temps);
  el.setAttribute('aria-label', `Next 24 hours: temperature from ${Math.round(tempValue(minT))} to ${Math.round(tempValue(maxT))} ${tempUnitLabel()}, rain probability peaks at ${Math.round(peakRain)} percent.`);
}

function renderWindGustChart(data) {
  const el = $('windGustChart');
  if (!el) return;
  const start = getHourIndex(data);
  const items = snapshots(data, start, 24);
  if (items.length < 2) { el.textContent = 'Chart unavailable.'; return; }
  const windRaw = items.map(x => Number(x.wind) || 0), gustRaw = items.map(x => Number(x.gust) || 0);
  const maxRaw = Math.max(10, ...gustRaw, ...windRaw);
  const W=720,H=210,L=46,R=18,T=16,B=34, plotW=W-L-R, plotH=H-T-B;
  const x = i => L + (i / (items.length - 1)) * plotW;
  const y = v => T + (maxRaw - v) / maxRaw * plotH;
  const labels = [0,6,12,18,23].filter(i => i < items.length);
  const gridVals = [0, maxRaw/2, maxRaw];
  const grid = gridVals.map(v => `<g><line class="chart-gridline" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-axis" x="${L-7}" y="${y(v)+4}" text-anchor="end">${Math.round(windValue(v))}</text></g>`).join('');
  const xlabels = labels.map(i => `<text class="chart-axis" x="${x(i)}" y="${H-10}" text-anchor="middle">${i===0?'Now':chartTimeLabel(items[i].time)}</text>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${grid}<path class="chart-gust-line" d="${linePath(gustRaw,x,y)}"/><path class="chart-wind-line" d="${linePath(windRaw,x,y)}"/>${xlabels}<text class="chart-unit" x="${W-R}" y="${T+11}" text-anchor="end">${windUnitLabel()}</text></svg><div class="chart-legend"><span><i class="legend-line wind"></i>Wind</span><span><i class="legend-line gust"></i>Gusts</span></div>`;
  const peak = Math.max(...gustRaw), mean = windRaw.reduce((a,b)=>a+b,0)/windRaw.length;
  el.setAttribute('aria-label', `Next 24 hours: average wind around ${Math.round(windValue(mean))} ${windUnitLabel()}, peak gust ${Math.round(windValue(peak))} ${windUnitLabel()}.`);
}

function renderForecastCharts(data) {
  renderTemperatureRainChart(data);
  renderWindGustChart(data);
}

function buildWeatherSummary(s, outlook) {
  const pieces = [];
  if (outlook.currentLev.rank > 0) pieces.push(`${outlook.currentLev.label} Levanter now`);
  else if (outlook.peakLev?.state.rank > 0) pieces.push(`Levanter may develop by ${fmtTime(outlook.peakLev.s.time)}`);
  else pieces.push(`${windRegime(s)} conditions`);

  if (outlook.peakRock?.state.rank === 2) pieces.push('Rock cloud is likely');
  else if (outlook.peakRock?.state.rank === 1) pieces.push('Rock cloud is possible');

  const rain = Number(outlook.maxRain?.rainChance || 0);
  if (rain >= 70) pieces.push(`high rain risk (${round(rain)}%)`);
  else if (rain >= 40) pieces.push(`some rain risk (${round(rain)}%)`);
  else pieces.push('rain risk stays low');

  return `${pieces.join('. ')}.`;
}


function localHourNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: GIBRALTAR.timezone, hour: '2-digit', hour12: false })
    .formatToParts(new Date());
  return Number(parts.find(p => p.type === 'hour')?.value || 0);
}

function contiguousWindow(items, predicate) {
  const start = items.findIndex(predicate);
  if (start < 0) return null;
  let end = start;
  for (let i=start+1; i<items.length; i++) {
    if (!predicate(items[i])) break;
    end = i;
  }
  return { start: items[start], end: items[end], startIndex: start, endIndex: end };
}

function buildLocalNarrative(data) {
  const start = getHourIndex(data);
  const hours = snapshots(data, start, 24);
  if (!hours.length) return null;
  const d = data.daily || {};
  const hourNow = localHourNow();
  const periodTitle = hourNow >= 18 ? 'Tonight & tomorrow morning' : hourNow >= 12 ? 'This afternoon & tonight' : 'Today & tonight';
  const current = hours[0];
  const levStates = hours.map(s => ({ s, state: levanterIndex(s) }));
  const rockStates = hours.map(s => ({ s, state: rockCloudIndex(s) }));
  const levWindow = contiguousWindow(levStates, x => x.state.rank > 0);
  const rainWindow = contiguousWindow(hours, x => Number(x.rainChance || 0) >= 50);
  const peakGust = hours.reduce((a,b) => Number(b.gust||0) > Number(a?.gust||-1) ? b : a, null);
  const peakRain = hours.reduce((a,b) => Number(b.rainChance||0) > Number(a?.rainChance||-1) ? b : a, null);
  const peakRock = rockStates.reduce((a,b) => b.state.rank > (a?.state?.rank ?? -1) ? b : a, null);
  const peakLev = levStates.reduce((a,b) => (b.state.rank*100 + Number(b.s.gust||0)) > ((a?.state?.rank||0)*100 + Number(a?.s?.gust||0)) ? b : a, null);

  const sentences = [];
  const hi = d.temperature_2m_max?.[0], lo = d.temperature_2m_min?.[0];
  if (hi != null && lo != null) sentences.push(`Temperatures around ${formatTempShort(hi)} by day and ${formatTempShort(lo)} overnight.`);

  if (levStates[0]?.state.rank > 0) {
    const endText = levWindow && levWindow.endIndex < levStates.length-1 ? `, easing after ${fmtTime(levWindow.end.s.time)}` : '';
    sentences.push(`${levStates[0].state.label} Levanter is already established${endText}.`);
  } else if (levWindow) {
    sentences.push(`Levanter conditions may develop around ${fmtTime(levWindow.start.s.time)}, with the strongest signal near ${fmtTime(peakLev?.s?.time)}.`);
  } else {
    sentences.push(`${windRegime(current)} flow is favoured through the next several hours.`);
  }

  if (peakGust) sentences.push(`Peak gusts are forecast around ${fmtTime(peakGust.time)} at ${formatWind(peakGust.gust)}.`);

  if (rainWindow) {
    const end = rainWindow.endIndex === rainWindow.startIndex ? '' : ` to ${fmtTime(rainWindow.end.time)}`;
    sentences.push(`The clearest rain window is around ${fmtTime(rainWindow.start.time)}${end}, with probability peaking near ${round(peakRain?.rainChance)}%.`);
  } else if (Number(peakRain?.rainChance || 0) >= 30) {
    sentences.push(`A few showers are possible, but rain probability stays below 50% and peaks near ${round(peakRain.rainChance)}%.`);
  } else {
    sentences.push('Rain risk stays low through the next 24 hours.');
  }

  if (peakRock?.state.rank === 2) sentences.push(`Rock Cloud conditions look most favourable around ${fmtTime(peakRock.s.time)}.`);
  else if (peakRock?.state.rank === 1) sentences.push(`There is a possible Rock Cloud signal around ${fmtTime(peakRock.s.time)}.`);

  return {
    periodTitle,
    text: sentences.join(' '),
    wind: levWindow ? `${levStates[0]?.state.rank > 0 ? 'Active now' : 'Possible from '+fmtTime(levWindow.start.s.time)} · peak ${peakLev?.state?.label || '—'}` : `${windRegime(current)} flow`,
    gust: peakGust ? `${formatWind(peakGust.gust)} · ${fmtTime(peakGust.time)}` : '—',
    rain: rainWindow ? `${fmtTime(rainWindow.start.time)}${rainWindow.endIndex!==rainWindow.startIndex?'–'+fmtTime(rainWindow.end.time):''} · ${round(peakRain?.rainChance)}% peak` : `${round(peakRain?.rainChance || 0)}% peak`,
    rock: peakRock ? `${peakRock.state.icon} ${peakRock.state.label}${peakRock.state.rank ? ' · '+fmtTime(peakRock.s.time) : ''}` : '—'
  };
}

function renderLocalNarrative(data) {
  const n = buildLocalNarrative(data);
  if (!n || !$('localNarrative')) return;
  $('narrativeTitle').textContent = n.periodTitle;
  $('localNarrative').textContent = n.text;
  $('narrativeWind').textContent = n.wind;
  $('narrativeGust').textContent = n.gust;
  $('narrativeRain').textContent = n.rain;
  $('narrativeRock').textContent = n.rock;
}

function renderLevanterTimeline(data) {
  const root = $('levanterTimeline');
  if (!root) return;
  const start = getHourIndex(data);
  const items = snapshots(data, start, 12);
  root.innerHTML = items.map((s, idx) => {
    const lev = levanterIndex(s), rock = rockCloudIndex(s);
    const width = Math.max(8, Math.min(100, Number(s.gust || s.wind || 0) / 70 * 100));
    return `<div class="lev-timeline-row ${lev.className}">
      <div class="lev-time">${idx===0?'Now':fmtTime(s.time)}</div>
      <div class="lev-track"><span class="lev-fill" style="width:${width.toFixed(0)}%"></span></div>
      <div class="lev-label"><strong>${lev.icon} ${lev.label}</strong><small>${compass(s.dir)} ${formatWind(s.wind)} · gust ${formatWind(s.gust)} · ${rock.icon} Rock ${rock.label.toLowerCase()}</small></div>
    </div>`;
  }).join('');
}

function renderRainTimeline(data) {
  const root = $('rainTimeline');
  if (!root) return;
  const start = getHourIndex(data);
  const items = snapshots(data, start, 12);
  root.innerHTML = items.map((s, idx) => {
    const chance = Math.max(0, Math.min(100, Number(s.rainChance || 0)));
    return `<div class="rain-timeline-col" title="${round(chance)}% at ${fmtTime(s.time)}"><div class="rain-bar-track"><span class="rain-bar-fill" style="height:${Math.max(4,chance)}%"></span></div><strong>${round(chance)}%</strong><small>${idx===0?'Now':fmtTime(s.time)}</small></div>`;
  }).join('');
}


function observationAgeMinutes(obs) {
  if (!obs?.observed_at) return null;
  const ms = Date.now() - Date.parse(obs.observed_at);
  return Number.isFinite(ms) ? Math.max(0, ms / 60000) : null;
}

function observationAgeLabel(obs) {
  const mins = observationAgeMinutes(obs);
  if (mins == null) return 'age unknown';
  if (mins < 2) return 'just observed';
  if (mins < 60) return `${Math.floor(mins)} min old`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${Math.floor(mins % 60)}m old`;
  return `${Math.floor(hours / 24)}d old`;
}

function formatObservedAt(obs) {
  if (!obs?.observed_at) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: GIBRALTAR.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(obs.observed_at));
  } catch (_) { return '—'; }
}

function observationCloudText(obs) {
  if (obs?.ceiling_ft != null) return `Ceiling ${Math.round(Number(obs.ceiling_ft))} ft`;
  const clouds = Array.isArray(obs?.clouds) ? obs.clouds : [];
  if (!clouds.length) return 'No ceiling reported';
  const first = clouds[0];
  return first.height_ft == null ? `${first.amount} cloud` : `${first.amount} ${Math.round(Number(first.height_ft))} ft`;
}

function observationLowCloudProxy(obs) {
  const ceiling = Number(obs?.ceiling_ft);
  if (Number.isFinite(ceiling)) {
    if (ceiling <= 1200) return 100;
    if (ceiling <= 2500) return 80;
    if (ceiling <= 5000) return 45;
  }
  const clouds = Array.isArray(obs?.clouds) ? obs.clouds : [];
  const low = clouds.filter(c => Number.isFinite(Number(c.height_ft)) && Number(c.height_ft) <= 5000);
  if (low.some(c => ['BKN','OVC','VV'].includes(c.amount))) return 80;
  if (low.some(c => c.amount === 'SCT')) return 50;
  if (low.some(c => c.amount === 'FEW')) return 25;
  return 0;
}

function forecastObservationMatch(obs, data) {
  if (!obs?.available || !data?.current) return null;
  const i = getHourIndex(data), s = hourSnapshot(data, i);
  const checks = [];
  const add = (name, diff, good, fair, text) => {
    if (!Number.isFinite(diff)) return;
    checks.push({ name, points: diff <= good ? 1 : diff <= fair ? 0.55 : 0.1, text });
  };
  const tempDiff = Math.abs(Number(obs.temperature_c) - Number(data.current.temperature_2m));
  add('temperature', tempDiff, 1, 2.5, `temperature ${tempDiff.toFixed(1)}°C apart`);
  const windDiff = Math.abs(Number(obs.wind_speed_kmh) - Number(data.current.wind_speed_10m));
  add('wind speed', windDiff, 8, 16, `wind ${Math.round(windDiff)} km/h apart`);
  if (Number(obs.wind_speed_kmh) >= 5 && Number.isFinite(Number(obs.wind_direction_deg))) {
    const dirDiff = circularDifference(Number(obs.wind_direction_deg), Number(data.current.wind_direction_10m));
    add('wind direction', dirDiff, 25, 65, `direction ${Math.round(dirDiff)}° apart`);
  }
  const pressureDiff = Math.abs(Number(obs.pressure_hpa) - Number(data.current.pressure_msl));
  add('pressure', pressureDiff, 2, 5, `pressure ${pressureDiff.toFixed(0)} hPa apart`);
  if (!checks.length) return null;
  const score = checks.reduce((a,b) => a + b.points, 0) / checks.length;
  const level = score >= .82 ? 'Excellent' : score >= .64 ? 'Good' : score >= .42 ? 'Mixed' : 'Poor';
  const className = level === 'Excellent' || level === 'Good' ? 'agreement-high' : level === 'Mixed' ? 'agreement-medium' : 'agreement-low';
  return { level, className, score, details: checks.map(x => x.text) };
}

function renderObservation(obs, data=weatherData) {
  const root = $('observationPanel');
  if (!root) return;
  const badge = $('observationBadge');
  if (!obs?.available) {
    root.classList.add('observation-unavailable');
    badge.textContent = 'Unavailable';
    badge.className = 'agreement-badge agreement-low';
    $('observationTime').textContent = 'Waiting for LXGB feed';
    $('obsTemp').textContent = '—';
    $('obsWind').textContent = '—';
    $('obsVisibility').textContent = '—';
    $('obsPressure').textContent = '—';
    $('obsCloud').textContent = obs?.reason || 'Airport observation has not been published yet.';
    $('obsMatch').textContent = 'Forecast comparison will appear when a fresh airport observation is available.';
    $('obsRaw').textContent = '';
    return;
  }
  root.classList.remove('observation-unavailable');
  const age = observationAgeMinutes(obs);
  const fresh = age != null && age <= 90;
  badge.textContent = fresh ? 'Fresh observation' : `Older · ${observationAgeLabel(obs)}`;
  badge.className = `agreement-badge ${fresh ? 'agreement-high' : 'agreement-medium'}`;
  $('observationTime').textContent = `${formatObservedAt(obs)} · ${observationAgeLabel(obs)}`;
  $('obsTemp').textContent = formatTemp(obs.temperature_c);
  $('obsTempDetail').textContent = `Dew point ${formatTemp(obs.dew_point_c)} · RH ${round(obs.relative_humidity_pct)}%`;
  const obsDir = obs.variable_wind ? 'VRB' : compass(obs.wind_direction_deg);
  $('obsWind').textContent = `${obsDir} ${formatWind(obs.wind_speed_kmh)}`;
  $('obsWindDetail').textContent = obs.wind_gust_kmh == null ? 'No gust reported' : `Gust ${formatWind(obs.wind_gust_kmh)}`;
  $('obsVisibility').textContent = obs.visibility_10km_or_more ? '10+ km' : kmVisibility(obs.visibility_m);
  $('obsPressure').textContent = obs.pressure_hpa == null ? '—' : `${Math.round(Number(obs.pressure_hpa))} hPa`;
  $('obsCloud').textContent = observationCloudText(obs);
  const observedLev = levanterIndex({
    dir: obs.wind_direction_deg, wind: obs.wind_speed_kmh, gust: obs.wind_gust_kmh ?? obs.wind_speed_kmh,
    humidity: obs.relative_humidity_pct, lowCloud: observationLowCloudProxy(obs), temp: obs.temperature_c, dew: obs.dew_point_c
  });
  $('obsRegime').textContent = obs.variable_wind ? 'Variable wind' : `${observedLev.icon} ${observedLev.rank > 0 ? `${observedLev.label} Levanter` : windRegime({dir: obs.wind_direction_deg})}`;
  const match = forecastObservationMatch(obs, data);
  if (match) {
    $('obsMatch').innerHTML = `<strong class="obs-match ${match.className}">${match.level} forecast match</strong><span>${match.details.slice(0,3).join(' · ')}</span>`;
  } else $('obsMatch').textContent = 'Forecast comparison unavailable.';
  $('obsRaw').textContent = obs.raw || '';
}

async function loadObservation() {
  try {
    const response = await fetch(`${OBSERVATION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Observation HTTP ${response.status}`);
    const data = await response.json();
    observationData = data;
    if (data?.available) {
      const age = observationAgeMinutes(data);
      lastObservationHealth = age != null && age <= 120 ? 'ok' : 'stale';
    } else lastObservationHealth = 'unavailable';
  } catch (err) {
    console.warn('LXGB observation unavailable', err);
    lastObservationHealth = 'unavailable';
  }
  renderObservation(observationData, weatherData);
  renderHealthStatus();
}

function radarTileFraction(lat, lon, zoom) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = lat * Math.PI / 180;
  const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n;
  return { x, y };
}

function radarFrameLocalTime(frame) {
  if (!frame?.time) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: GIBRALTAR.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit'
  }).format(new Date(Number(frame.time) * 1000));
}

function radarFrameAgeMinutes(frame) {
  if (!frame?.time) return null;
  return Math.max(0, Math.round((Date.now() - Number(frame.time) * 1000) / 60000));
}

function stopRadarPlayback() {
  if (radarPlayTimer) clearInterval(radarPlayTimer);
  radarPlayTimer = null;
  if ($('radarPlayBtn')) $('radarPlayBtn').textContent = '▶ Play';
}

function positionRadarGrid() {
  const map = $('radarMap'), grid = $('radarTileGrid');
  if (!map || !grid || !radarData?.frames?.length || map.clientWidth === 0) return;
  const center = radarTileFraction(GIBRALTAR.lat, GIBRALTAR.lon, RADAR_ZOOM);
  const x0 = Math.floor(center.x) - RADAR_GRID_RADIUS;
  const y0 = Math.floor(center.y) - RADAR_GRID_RADIUS;
  const px = (center.x - x0) * RADAR_TILE_SIZE;
  const py = (center.y - y0) * RADAR_TILE_SIZE;
  grid.style.transform = `translate(${Math.round(map.clientWidth / 2 - px)}px, ${Math.round(map.clientHeight / 2 - py)}px)`;
}

function renderRadarFrame(index = radarFrameIndex) {
  const grid = $('radarTileGrid'), map = $('radarMap');
  if (!grid || !map) return;
  const frames = radarData?.frames || [];
  if (!frames.length) {
    grid.innerHTML = '';
    $('radarFrameTime').textContent = 'No radar frame available';
    $('radarAgeBadge').textContent = 'Unavailable';
    return;
  }
  radarFrameIndex = Math.max(0, Math.min(Number(index) || 0, frames.length - 1));
  const frame = frames[radarFrameIndex];
  const center = radarTileFraction(GIBRALTAR.lat, GIBRALTAR.lon, RADAR_ZOOM);
  const x0 = Math.floor(center.x) - RADAR_GRID_RADIUS;
  const y0 = Math.floor(center.y) - RADAR_GRID_RADIUS;
  const count = RADAR_GRID_RADIUS * 2 + 1;
  const maxTile = 2 ** RADAR_ZOOM;
  const pieces = [];
  for (let gy = 0; gy < count; gy++) {
    for (let gx = 0; gx < count; gx++) {
      const txRaw = x0 + gx;
      const tx = ((txRaw % maxTile) + maxTile) % maxTile;
      const ty = y0 + gy;
      if (ty < 0 || ty >= maxTile) continue;
      const left = gx * RADAR_TILE_SIZE, top = gy * RADAR_TILE_SIZE;
      const base = `https://tile.openstreetmap.org/${RADAR_ZOOM}/${tx}/${ty}.png`;
      pieces.push(`<img class="radar-base-tile" src="${base}" alt="" style="left:${left}px;top:${top}px" loading="eager" decoding="async">`);
    }
  }
  const overlaySize = 512;
  const centerPx = (center.x - x0) * RADAR_TILE_SIZE;
  const centerPy = (center.y - y0) * RADAR_TILE_SIZE;
  const radar = `${radarData.host}${frame.path}/${overlaySize}/${RADAR_ZOOM}/${GIBRALTAR.lat}/${GIBRALTAR.lon}/2/1_1.png`;
  pieces.push(`<img class="radar-overlay-tile radar-coordinate-overlay" src="${radar}" alt="" style="left:${centerPx - overlaySize/2}px;top:${centerPy - overlaySize/2}px;width:${overlaySize}px;height:${overlaySize}px" loading="eager" decoding="async">`);
  grid.style.width = `${count * RADAR_TILE_SIZE}px`;
  grid.style.height = `${count * RADAR_TILE_SIZE}px`;
  grid.innerHTML = pieces.join('');
  $('radarFrameTime').textContent = `${radarFrameLocalTime(frame)} Gibraltar time`;
  const age = radarFrameAgeMinutes(frame);
  $('radarAgeBadge').textContent = age == null ? '—' : age <= 15 ? `${age} min ago` : `${age} min old`;
  $('radarSlider').value = String(radarFrameIndex);
  requestAnimationFrame(positionRadarGrid);
}

function renderRadarTimeline() {
  const slider = $('radarSlider');
  if (!slider) return;
  const frames = radarData?.frames || [];
  slider.min = '0';
  slider.max = String(Math.max(0, frames.length - 1));
  slider.value = String(Math.max(0, Math.min(radarFrameIndex, frames.length - 1)));
  slider.disabled = frames.length < 2;
}

function playRadar() {
  const frames = radarData?.frames || [];
  if (frames.length < 2) return;
  if (radarPlayTimer) { stopRadarPlayback(); return; }
  $('radarPlayBtn').textContent = '■ Stop';
  if (radarFrameIndex >= frames.length - 1) radarFrameIndex = 0;
  renderRadarFrame(radarFrameIndex);
  radarPlayTimer = setInterval(() => {
    radarFrameIndex += 1;
    if (radarFrameIndex >= frames.length) radarFrameIndex = 0;
    renderRadarFrame(radarFrameIndex);
  }, 700);
}

async function loadRadar(force = false) {
  const status = $('radarStatus');
  if (!navigator.onLine) {
    lastRadarHealth = 'offline';
    if (status) { status.textContent = 'Radar requires an internet connection.'; status.className = 'status-banner offline'; }
    renderHealthStatus();
    return;
  }
  if (radarData?.frames?.length && !force) {
    lastRadarHealth = 'ok';
    renderRadarTimeline();
    if (document.querySelector('.view.active')?.dataset.view === 'radar') renderRadarFrame(radarFrameIndex);
    return;
  }
  if (status) { status.textContent = 'Loading recent radar…'; status.className = 'status-banner notice'; }
  try {
    const response = await fetchWithRetry(RADAR_API_URL, 2);
    const payload = await response.json();
    const frames = Array.isArray(payload?.radar?.past) ? payload.radar.past.filter(f => f?.path && f?.time) : [];
    if (!payload?.host || !frames.length) throw new Error('No radar frames returned');
    radarData = { host: payload.host, generated: payload.generated, frames };
    radarFrameIndex = frames.length - 1;
    lastRadarHealth = 'ok';
    renderRadarTimeline();
    if (status) { status.textContent = `${frames.length} recent radar frames available.`; status.className = 'status-banner success'; }
    if (document.querySelector('.view.active')?.dataset.view === 'radar') renderRadarFrame(radarFrameIndex);
  } catch (err) {
    console.warn('Rain radar unavailable', err);
    lastRadarHealth = 'error';
    if (status) { status.textContent = 'Recent rain radar is temporarily unavailable. The forecast screens are unaffected.'; status.className = 'status-banner error'; }
  }
  renderHealthStatus();
}

async function refreshAll(force=false) {
  await Promise.all([loadWeather(force), loadObservation(), loadRadar(force)]);
}

function renderNow(data) {
  const i = getHourIndex(data);
  const s = hourSnapshot(data, i);
  const [condition, icon] = weatherInfo(data.current.weather_code, data.current.is_day);
  const lev = levanterIndex(s), rock = rockCloudIndex(s), outlook = buildOutlook(data, i);

  $('currentCondition').textContent = condition;
  $('currentIcon').textContent = icon;
  $('currentTemp').textContent = formatTempShort(data.current.temperature_2m);
  $('feelsLike').textContent = `Feels like ${formatTemp(data.current.apparent_temperature)}`;
  $('updatedAt').textContent = `Forecast ${fmtTime(data.current.time)}`;
  $('weatherSummary').textContent = buildWeatherSummary(s, outlook);
  renderLocalNarrative(data);
  renderRainTimeline(data);

  $('levanterStatus').textContent = `${lev.icon} ${lev.label}`;
  $('levanterDetail').textContent = lev.detail;
  $('levanterConfidence').textContent = lev.confidence;
  applyStateCard($('levanterCard'), lev);

  $('rockCloudStatus').textContent = `${rock.icon} ${rock.label}`;
  $('rockCloudDetail').textContent = rock.detail;
  $('rockCloudOutlook').textContent = outlook.rockOutlook;
  applyStateCard($('rockCloudCard'), rock);

  $('windRegime').textContent = windRegime(s);
  $('windOutlook').textContent = outlook.levHours ? `${outlook.levHours} of next 24h easterly` : 'No Levanter signal next 24h';
  $('peakGust24').textContent = outlook.peakGust ? formatWind(outlook.peakGust.gust) : '—';
  $('peakGustTime').textContent = outlook.peakGust ? `around ${fmtTime(outlook.peakGust.time)}` : '—';
  $('rainRisk24').textContent = outlook.maxRain ? `${round(outlook.maxRain.rainChance)}%` : '—';
  $('rainWindow24').textContent = outlook.wetStart ? `50%+ from ${fmtTime(outlook.wetStart.time)}` : 'No 50%+ rain window';

  $('windNow').textContent = formatWind(data.current.wind_speed_10m);
  $('windDirNow').textContent = `${compass(data.current.wind_direction_10m)} · ${round(data.current.wind_direction_10m)}°`;
  $('gustNow').textContent = formatWind(data.current.wind_gusts_10m);
  $('humidityNow').textContent = `${round(data.current.relative_humidity_2m)}%`;
  $('dewPointNow').textContent = `Dew point ${formatTemp(s.dew)}`;
  $('rainNow').textContent = `${round(s.rainChance)}%`;
  $('rainAmountNow').textContent = `${Number(data.current.precipitation || 0).toFixed(1)} mm`;
  $('visibilityNow').textContent = kmVisibility(s.visibility);
  $('uvNow').textContent = s.uv == null ? '—' : Number(s.uv).toFixed(1);
  $('uvTextNow').textContent = uvLabel(s.uv);
  $('pressureNow').textContent = `${round(data.current.pressure_msl)} hPa`;
  $('lowCloudNow').textContent = `${round(s.lowCloud)}%`;

  renderTodaySummary(data);
  $('levanterExplanation').textContent = `${lev.icon} Current: ${lev.label}. ${lev.confidence}. Wind ${compass(s.dir)} ${formatWind(s.wind)}, gusts ${formatWind(s.gust)}. Over the next 24 hours, ${outlook.levHours} forecast hour${outlook.levHours === 1 ? '' : 's'} show an easterly/Levanter signal.`;

  $('nextHours').innerHTML = snapshots(data, i, 8).map((x, n) => {
    const [, ico] = weatherInfo(x.code, x.isDay);
    return `<div class="hour-card"><div class="time">${n===0?'Now':fmtTime(x.time)}</div><div class="ico">${ico}</div><strong>${formatTempShort(x.temp)}</strong><small>🌧️ ${round(x.rainChance)}%</small></div>`;
  }).join('');
}

function renderHourly(data) {
  renderForecastCharts(data);
  const start = getHourIndex(data);
  const limit = Math.min(start + 48, data.hourly.time.length);
  const rows = [];
  let lastDate = null;
  for (let i=start; i<limit; i++) {
    const s = hourSnapshot(data, i), [, icon] = weatherInfo(s.code, s.isDay);
    const date = String(s.time).slice(0,10);
    if (date !== lastDate) {
      const label = i === start ? 'Today' : fmtDay(date, true);
      rows.push(`<div class="day-divider">${label}</div>`);
      lastDate = date;
    }
    rows.push(`<div class="hour-row">
      <div><strong>${i===start?'Now':fmtTime(s.time)}</strong></div>
      <div class="row-icon">${icon}</div>
      <div><strong>${formatTemp(s.temp)}</strong><div class="details">${compass(s.dir)} ${formatWind(s.wind)} · gust ${formatWind(s.gust)}</div></div>
      <div class="rain">🌧️ ${round(s.rainChance)}%<br><span class="details">${Number(s.precipitation||0).toFixed(1)} mm</span></div>
    </div>`);
  }
  $('hourlyList').innerHTML = rows.join('');
}

function renderDaily(data) {
  const d = data.daily;
  $('dailyList').innerHTML = d.time.slice(0,7).map((date, i) => {
    const [, icon] = weatherInfo(d.weather_code[i], 1);
    const day = i===0 ? 'Today' : i===1 ? 'Tomorrow' : fmtDay(date);
    return `<div class="daily-row">
      <div><strong>${day}</strong></div>
      <div class="row-icon">${icon}</div>
      <div><div class="temps">${formatTempShort(d.temperature_2m_max[i])} / ${formatTempShort(d.temperature_2m_min[i])}</div><div class="sub">${compass(d.wind_direction_10m_dominant[i])} wind · gust ${formatWind(d.wind_gusts_10m_max[i])}</div><div class="sub">Rain total ${Number(d.precipitation_sum[i] || 0).toFixed(1)} mm</div></div>
      <div class="daily-side"><strong>🌧️ ${round(d.precipitation_probability_max[i])}%</strong><div class="sub">UV ${round(d.uv_index_max[i])}</div></div>
    </div>`;
  }).join('');
}


function modelAgreement(data) {
  const series = Array.isArray(data?.series) ? data.series.filter(x => Array.isArray(x.time) && Array.isArray(x.wind) && Array.isArray(x.dir)) : [];
  if (series.length < 2) return { level: 'Unavailable', className: 'agreement-low', score: 0, series, text: 'Not enough model data is available for a comparison.' };
  const hours = Math.min(12, ...series.map(x => x.time.length));
  let directionPoints = 0, speedPoints = 0, easterlyPoints = 0;
  for (let i=0; i<hours; i++) {
    const dirs = series.map(x => Number(x.dir[i])).filter(Number.isFinite);
    const winds = series.map(x => Number(x.wind[i])).filter(Number.isFinite);
    const easterlies = dirs.map(isEasterly);
    if (dirs.length >= 2) {
      const diffs = [];
      for (let a=0; a<dirs.length; a++) for (let b=a+1; b<dirs.length; b++) diffs.push(circularDifference(dirs[a], dirs[b]));
      const avgDiff = diffs.reduce((a,b) => a+b, 0) / diffs.length;
      directionPoints += avgDiff <= 20 ? 1 : avgDiff <= 45 ? 0.65 : avgDiff <= 75 ? 0.3 : 0;
      const eastCount = easterlies.filter(Boolean).length;
      const majority = Math.max(eastCount, easterlies.length-eastCount) / easterlies.length;
      easterlyPoints += majority === 1 ? 1 : majority >= 2/3 ? 0.65 : 0;
    }
    if (winds.length >= 2) {
      const mean = winds.reduce((a,b) => a+b, 0) / winds.length;
      const spread = Math.max(...winds) - Math.min(...winds);
      speedPoints += spread <= Math.max(8, mean*.3) ? 1 : spread <= Math.max(15, mean*.55) ? 0.55 : 0.15;
    }
  }
  const denom = hours * 3;
  const score = denom ? (directionPoints + speedPoints + easterlyPoints) / denom : 0;
  const level = score >= .78 ? 'High' : score >= .56 ? 'Medium' : 'Low';
  const className = level === 'High' ? 'agreement-high' : level === 'Medium' ? 'agreement-medium' : 'agreement-low';

  const firstEast = series.map(x => isEasterly(Number(x.dir[0]))).filter(Boolean).length;
  const text = firstEast === series.length
    ? `All ${series.length} models currently favour an easterly/Levanter flow.`
    : firstEast >= 2
      ? `${firstEast} of ${series.length} models currently favour an easterly/Levanter flow.`
      : firstEast === 1
        ? `Only 1 of ${series.length} models currently favours an easterly/Levanter flow.`
        : `None of the ${series.length} models currently favours a core easterly/Levanter direction.`;
  return { level, className, score, series, text };
}

function circularDifference(a, b) {
  const diff = Math.abs(Number(a) - Number(b)) % 360;
  return Math.min(diff, 360 - diff);
}

function renderModelComparison(data) {
  const badge = $('modelAgreementBadge'), text = $('modelAgreementText'), rows = $('modelRows');
  const result = modelAgreement(data);
  if (result.series.length < 2) {
    badge.textContent = 'Unavailable';
    badge.className = 'agreement-badge agreement-low';
    text.textContent = 'Model comparison could not be loaded. The main GibWeather forecast still works normally.';
    rows.innerHTML = result.series.map(x => `<div class="model-row"><div><strong>${x.label}</strong><small>Available</small></div><div><strong>${compass(x.dir?.[0])} ${round(x.dir?.[0])}°</strong><small>Direction</small></div><div class="model-wind"><strong>${formatWind(x.wind?.[0])}</strong><small>gust ${formatWind(x.gust?.[0])}</small></div></div>`).join('');
    return;
  }
  badge.textContent = `${result.level} agreement`;
  badge.className = `agreement-badge ${result.className}`;
  text.textContent = `${result.text} Overall 12-hour wind agreement: ${Math.round(result.score*100)}%.`;
  rows.innerHTML = result.series.map(x => {
    const dir = x.dir[0], wind = x.wind[0], gust = x.gust?.[0];
    const lev = levanterIndex({ dir, wind, gust, humidity: null, lowCloud: null, temp: null, dew: null });
    return `<div class="model-row"><div><strong>${x.label}</strong><small>${lev.icon} ${lev.label}</small></div><div><strong>${compass(dir)} ${round(dir)}°</strong><small>Direction</small></div><div class="model-wind"><strong>${formatWind(wind)}</strong><small>gust ${formatWind(gust)}</small></div></div>`;
  }).join('');
}

async function fetchModelComparison() {
  const results = await Promise.all(MODEL_FEEDS.map(async feed => {
    try {
      const response = await fetchWithRetry(feed.url.toString(), 2);
      const data = await response.json();
      const h = data?.hourly;
      if (!h?.time || !Array.isArray(h.wind_speed_10m) || !Array.isArray(h.wind_direction_10m)) return null;
      return {
        id: feed.id, label: feed.label, time: h.time, wind: h.wind_speed_10m, dir: h.wind_direction_10m,
        gust: h.wind_gusts_10m || [], temp: h.temperature_2m || [], precipitation: h.precipitation || []
      };
    } catch (_) { return null; }
  }));
  return { series: results.filter(Boolean) };
}

function renderWind(data) {
  renderLevanterTimeline(data);
  const start = getHourIndex(data), limit = Math.min(start + 24, data.hourly.time.length);
  const rows = [];
  for (let i=start; i<limit; i++) {
    const s = hourSnapshot(data, i), lev = levanterIndex(s), rock = rockCloudIndex(s);
    rows.push(`<div class="wind-row ${lev.className}">
      <div><strong>${i===start?'Now':fmtTime(s.time)}</strong></div>
      <div><span class="wind-arrow" style="transform:rotate(${Number(s.dir)+180}deg)">↑</span><strong>${compass(s.dir)} ${round(s.dir)}°</strong><div class="details">${lev.icon} ${lev.label} · ${rock.icon} Rock ${rock.label.toLowerCase()} · RH ${round(s.humidity)}%</div></div>
      <div class="wind-speed">${round(windValue(s.wind))}<small> ${windUnitLabel()}</small><div class="details">gust ${formatWind(s.gust)}</div></div>
    </div>`);
  }
  $('windHours').innerHTML = rows.join('');
}

function marineHourIndex(data) {
  if (!data?.hourly?.time?.length) return 0;
  const currentTime = data.current?.time;
  const exact = data.hourly.time.indexOf(currentTime);
  if (exact >= 0) return exact;
  const target = gibraltarNowFakeEpoch();
  let best = 0, diff = Infinity;
  data.hourly.time.forEach((t, i) => {
    const d = Math.abs(fakeLocalEpoch(t) - target);
    if (d < diff) { diff = d; best = i; }
  });
  return best;
}

function marineSnapshot(data, i) {
  const h = data?.hourly || {};
  const safe = (key) => Array.isArray(h[key]) ? h[key][i] : null;
  return {
    time: safe('time'), wave: safe('wave_height'), waveDir: safe('wave_direction'), wavePeriod: safe('wave_period'),
    swell: safe('swell_wave_height'), swellDir: safe('swell_wave_direction'), swellPeriod: safe('swell_wave_period'),
    seaTemp: safe('sea_surface_temperature'), current: safe('ocean_current_velocity'), currentDir: safe('ocean_current_direction'),
    seaLevel: safe('sea_level_height_msl')
  };
}

function renderMarine(data) {
  const status = $('seaStatus');
  const hours = $('seaHours');
  const daily = $('seaDaily');
  if (!status || !hours || !daily) return;
  if (!data?.hourly?.time?.length) {
    status.textContent = 'Marine forecast is temporarily unavailable. The main Gibraltar weather forecast is still working.';
    status.className = 'status-banner notice';
    hours.innerHTML = '';
    daily.innerHTML = '';
    ['seaWaveNow','seaWaveDirNow','seaPeriodNow','seaTempNow','seaCurrentNow','seaLevelNow'].forEach(id => { if ($(id)) $(id).textContent = '—'; });
    return;
  }
  status.textContent = 'Strait marine forecast loaded.';
  status.className = 'status-banner success';
  const i = marineHourIndex(data);
  const snap = marineSnapshot(data, i);
  const c = data.current || {};
  const wave = c.wave_height ?? snap.wave;
  const waveDir = c.wave_direction ?? snap.waveDir;
  const wavePeriod = c.wave_period ?? snap.wavePeriod;
  const seaTemp = c.sea_surface_temperature ?? snap.seaTemp;
  const current = c.ocean_current_velocity ?? snap.current;
  const currentDir = c.ocean_current_direction ?? snap.currentDir;
  const seaLevel = c.sea_level_height_msl ?? snap.seaLevel;
  $('seaWaveNow').textContent = formatWave(wave);
  $('seaWaveDirNow').textContent = `${compass(waveDir)} ${round(waveDir)}°`;
  $('seaPeriodNow').textContent = wavePeriod == null ? '—' : `${Number(wavePeriod).toFixed(1)} s`;
  $('seaTempNow').textContent = formatSeaTemp(seaTemp);
  $('seaCurrentNow').textContent = `${formatCurrentSpeed(current)} · toward ${compass(currentDir)}`;
  $('seaLevelNow').textContent = seaLevel == null ? '—' : `${Number(seaLevel).toFixed(2)} m MSL`;

  const limit = Math.min(i + 25, data.hourly.time.length);
  const rows = [];
  for (let n=i; n<limit; n+=3) {
    const s = marineSnapshot(data, n);
    rows.push(`<div class="sea-row"><div><strong>${n===i?'Now':fmtTime(s.time)}</strong></div><div><strong>🌊 ${formatWave(s.wave)}</strong><small>${compass(s.waveDir)} · ${s.wavePeriod == null ? '—' : Number(s.wavePeriod).toFixed(1)+' s'}</small></div><div><strong>Swell ${formatWave(s.swell)}</strong><small>${compass(s.swellDir)} · ${s.swellPeriod == null ? '—' : Number(s.swellPeriod).toFixed(1)+' s'}</small></div></div>`);
  }
  hours.innerHTML = rows.join('');

  const d = data.daily || {};
  if (!Array.isArray(d.time)) { daily.innerHTML = ''; return; }
  daily.innerHTML = d.time.slice(0,7).map((date, idx) => {
    const label = idx===0 ? 'Today' : idx===1 ? 'Tomorrow' : fmtDay(date);
    const waveMax = d.wave_height_max?.[idx];
    const waveDirDom = d.wave_direction_dominant?.[idx];
    const swellMax = d.swell_wave_height_max?.[idx];
    const swellDir = d.swell_wave_direction_dominant?.[idx];
    return `<div class="sea-row sea-daily-row"><div><strong>${label}</strong></div><div><strong>Max ${formatWave(waveMax)}</strong><small>${compass(waveDirDom)} waves</small></div><div><strong>Swell ${formatWave(swellMax)}</strong><small>${compass(swellDir)} dominant</small></div></div>`;
  }).join('');
}

function renderAll(data) {
  renderNow(data);
  renderAdvisories(data, marineData);
  renderHourly(data);
  renderDaily(data);
  renderWind(data);
  renderModelComparison(modelData);
  renderMarine(marineData);
  renderObservation(observationData, data);
  renderForecastConfidence();
  renderAppStatus();
  renderSettings();
}

function setStatus(text, kind='') {
  const el = $('statusBanner');
  el.textContent = text;
  el.className = `status-banner ${kind}`.trim();
}

function setOnlineUI() {
  $('onlineState').textContent = navigator.onLine ? (lastLoadWasCached ? '● Cached' : '● Live') : '● Offline';
  $('onlineState').classList.toggle('offline-pill', !navigator.onLine || lastLoadWasCached);
  renderAppStatus();
}

function readCachedForecast() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.data) return parsed;
      } catch (_) {}
    }
    const backup = localStorage.getItem(BACKUP_CACHE_KEY);
    if (backup) {
      try {
        const parsed = JSON.parse(backup);
        if (parsed?.data) return parsed;
      } catch (_) {}
    }
    for (const key of LEGACY_CACHE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      try {
        const parsed = JSON.parse(legacy);
        if (parsed?.data) return { savedAt: parsed.savedAt || null, data: parsed.data, models: parsed.models || null, marine: parsed.marine || null };
        return { savedAt: null, data: parsed, models: null, marine: null };
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function saveForecast(data, models=null, marine=null) {
  savedAt = new Date().toISOString();
  const payload = JSON.stringify({ savedAt, data, models, marine });
  try {
    localStorage.setItem(CACHE_KEY, payload);
    localStorage.setItem(BACKUP_CACHE_KEY, payload);
  } catch (_) {}
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { cache: 'no-store', signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function fetchWithRetry(url, attempts = 2) {
  let lastError;
  for (let n = 0; n < attempts; n++) {
    try {
      const response = await fetchWithTimeout(url, n === 0 ? 12000 : 16000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      lastError = err;
      if (n + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 700));
    }
  }
  throw lastError;
}

async function loadWeather(force=false) {
  if (loadInFlight) return;
  loadInFlight = true;
  $('refreshBtn').classList.add('loading');
  setOnlineUI();
  if (!navigator.onLine) {
    const cached = readCachedForecast();
    if (cached) {
      savedAt = cached.savedAt;
      lastLoadWasCached = true;
      lastApiHealth = 'cached';
      lastModelHealth = cached.models ? 'cached' : 'unavailable';
      lastMarineHealth = cached.marine ? 'cached' : 'unavailable';
      weatherData = cached.data;
      modelData = cached.models || null;
      marineData = cached.marine || null;
      renderAll(weatherData);
      setStatus(cachedStatusMessage('Offline — showing the last saved Gibraltar forecast.'), 'offline');
    } else setStatus('You are offline and no saved forecast is available yet.', 'error');
    $('refreshBtn').classList.remove('loading');
    loadInFlight = false;
    return;
  }

  try {
    if (force) setStatus('Refreshing Gibraltar forecast…');
    const [response, models, marineResponse] = await Promise.all([
      fetchWithRetry(API_URL.toString(), 2),
      fetchModelComparison().catch(() => ({ series: [] })),
      fetchWithRetry(MARINE_API_URL.toString(), 2).catch(() => null)
    ]);
    const data = await response.json();
    if (!data?.current || !data?.hourly || !data?.daily) throw new Error('Incomplete forecast response');
    let marine = null;
    if (marineResponse?.ok) {
      try {
        const candidate = await marineResponse.json();
        if (!candidate?.error && Array.isArray(candidate?.hourly?.time) && candidate.hourly.time.length) marine = candidate;
      } catch (_) {}
    }
    weatherData = data;
    modelData = models;
    marineData = marine;
    lastLoadWasCached = false;
    lastApiHealth = 'ok';
    lastModelHealth = models?.series?.length >= 2 ? 'ok' : models?.series?.length ? 'degraded' : 'unavailable';
    lastMarineHealth = marine ? 'ok' : 'unavailable';
    saveForecast(data, models, marine);
    renderAll(data);
    setStatus('Forecast updated.', 'success');
  } catch (err) {
    console.error(err);
    const cached = readCachedForecast();
    if (cached) {
      savedAt = cached.savedAt;
      lastLoadWasCached = true;
      lastApiHealth = 'error';
      lastModelHealth = cached.models ? 'cached' : 'unavailable';
      lastMarineHealth = cached.marine ? 'cached' : 'unavailable';
      weatherData = cached.data;
      modelData = cached.models || null;
      marineData = cached.marine || null;
      renderAll(weatherData);
      setStatus(cachedStatusMessage('Could not refresh — showing the last saved forecast.'), 'offline');
    } else {
      lastApiHealth = 'error';
      lastModelHealth = 'unavailable';
      lastMarineHealth = 'unavailable';
      renderHealthStatus();
      setStatus('Could not load the forecast. Check your connection and try again.', 'error');
    }
  } finally {
    $('refreshBtn').classList.remove('loading');
    loadInFlight = false;
    setOnlineUI();
  }
}

function changeView(target) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === target));
  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.target === target;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (target === 'radar') {
    stopRadarPlayback();
    if (radarData?.frames?.length) renderRadarFrame(radarFrameIndex);
    else loadRadar(false);
  } else stopRadarPlayback();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function renderInstallDiagnostics() {
  const root = $('installDiagnostics');
  if (!root) return;
  const httpsOK = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  const swOK = 'serviceWorker' in navigator;
  const standalone = isStandalone();
  const localStoreOK = (() => { try { localStorage.setItem('gibweather:test','1'); localStorage.removeItem('gibweather:test'); return true; } catch (_) { return false; } })();
  const rows = [
    [httpsOK ? '✅' : '⚠️', 'Secure hosting', httpsOK ? 'HTTPS ready' : 'HTTPS required'],
    [swOK ? '✅' : '⚠️', 'Offline support', swOK ? 'Supported' : 'Not supported'],
    [localStoreOK ? '✅' : '⚠️', 'Saved forecast', localStoreOK ? 'Available' : 'Unavailable'],
    [standalone ? '✅' : 'ℹ️', 'Home Screen', standalone ? 'Installed' : 'Not installed']
  ];
  root.innerHTML = rows.map(([icon,title,value]) => `<div><span>${icon}</span><div><strong>${title}</strong><small>${value}</small></div></div>`).join('');
}

function updateInstallUI() {
  const standalone = isStandalone();
  const state = $('installState');
  if (standalone) {
    state.textContent = 'GibWeather is currently running as an installed Home Screen app.';
    $('installHelpBtn').hidden = true;
  } else if (location.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(location.hostname)) {
    state.textContent = 'GibWeather needs to be hosted over HTTPS before it can be installed normally on iPhone/iPad.';
  } else if (isIOS()) {
    state.innerHTML = 'Ready to install: open this page in <strong>Safari</strong>, tap Share, then choose <strong>Add to Home Screen</strong>.';
  } else {
    state.textContent = 'This browser can run GibWeather now. Installation options depend on the browser and device.';
  }
  renderInstallDiagnostics();
}

function showFirstRun() {
  try { if (localStorage.getItem(INTRO_KEY) === '1') return; } catch (_) {}
  const intro = $('onboarding');
  if (intro) intro.hidden = false;
}

function dismissFirstRun() {
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (_) {}
  const intro = $('onboarding');
  if (intro) intro.hidden = true;
}

function showUpdateToast() {
  const toast = $('updateToast');
  if (toast) toast.hidden = false;
}

async function shareForecast() {
  if (!weatherData) return;
  const i = getHourIndex(weatherData);
  const s = hourSnapshot(weatherData, i);
  const lev = levanterIndex(s);
  const text = `Gibraltar: ${formatTemp(weatherData.current.temperature_2m)}, ${weatherInfo(weatherData.current.weather_code, weatherData.current.is_day)[0]}. Wind ${compass(s.dir)} ${formatWind(s.wind)}, gusts ${formatWind(s.gust)}. Levanter: ${lev.label}.`;
  try {
    if (navigator.share) await navigator.share({ title: 'GibWeather', text, url: location.protocol.startsWith('http') ? location.href : undefined });
    else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setStatus('Forecast summary copied to clipboard.', 'notice');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.error(err);
  }
}

function clearSavedForecast() {
  try { [CACHE_KEY, BACKUP_CACHE_KEY, ...LEGACY_CACHE_KEYS].forEach(key => localStorage.removeItem(key)); } catch (_) {}
  savedAt = null;
  renderAppStatus();
  setStatus('Saved offline forecast cleared. Live weather is unchanged.', 'notice');
}

document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => changeView(btn.dataset.target)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => changeView(btn.dataset.go)));
$('refreshBtn').addEventListener('click', () => refreshAll(true));
$('shareBtn')?.addEventListener('click', shareForecast);
$('clearCacheBtn')?.addEventListener('click', clearSavedForecast);
$('installCheckBtn')?.addEventListener('click', () => { updateInstallUI(); setStatus('Installation readiness checked.', 'notice'); });
$('healthCheckBtn')?.addEventListener('click', runHealthCheck);
$('saveSettingsBtn')?.addEventListener('click', applySettingsFromUI);
$('resetSettingsBtn')?.addEventListener('click', resetSettings);
$('startBtn')?.addEventListener('click', dismissFirstRun);
$('reloadAppBtn')?.addEventListener('click', () => location.reload());
$('radarPlayBtn')?.addEventListener('click', playRadar);
$('radarSlider')?.addEventListener('input', (event) => { stopRadarPlayback(); renderRadarFrame(Number(event.target.value)); });
window.addEventListener('resize', () => { if (document.querySelector('.view.active')?.dataset.view === 'radar') positionRadarGrid(); });
$('installHelpBtn').addEventListener('click', () => {
  const box = $('installHelp');
  box.hidden = !box.hidden;
  $('installHelpBtn').textContent = box.hidden ? 'Show installation steps' : 'Hide installation steps';
});
window.addEventListener('online', () => refreshAll(true));
window.addEventListener('offline', setOnlineUI);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !navigator.onLine || loadInFlight) return;
  const age = dataAgeMinutes();
  const staleAfter = Math.max(15, Number(settings.refreshMinutes) || 30);
  if (age == null || age >= staleAfter) refreshAll(false);
  else loadObservation();
});

setInterval(() => { renderAppStatus(); }, 60000);
scheduleAutoRefresh();
setInterval(async () => {
  if ('serviceWorker' in navigator && navigator.onLine) {
    try { const reg = await navigator.serviceWorker.getRegistration(); await reg?.update(); } catch (_) {}
  }
}, 6 * 60 * 60 * 1000);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast();
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => { renderInstallDiagnostics(); renderHealthStatus(); });
      renderInstallDiagnostics();
    } catch (err) {
      console.error(err);
      renderInstallDiagnostics();
    }
  });
}

renderSettings();
updateInstallUI();
setOnlineUI();
showFirstRun();
refreshAll();
