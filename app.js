const APP_VERSION = '2.5.3';
const GIBRALTAR = { lat: 36.1408, lon: -5.3536, timezone: 'Europe/Gibraltar' };
const CACHE_KEY = 'gibweather:last-forecast:v23';
const TREND_CACHE_KEY = 'gibweather:forecast-baseline:v1';
const BACKUP_CACHE_KEY = 'gibweather:last-known-good:v1';
const LEGACY_CACHE_KEYS = ['gibweather:last-forecast:v22','gibweather:last-forecast:v21','gibweather:last-forecast:v20','gibweather:last-forecast:v19','gibweather:last-forecast:v18','gibweather:last-forecast:v17','gibweather:last-forecast:v16','gibweather:last-forecast:v15','gibweather:last-forecast:v14','gibweather:last-forecast:v13','gibweather:last-forecast:v12','gibweather:last-forecast:v11','gibweather:last-forecast:v10','gibweather:last-forecast:v8','gibweather:last-forecast:v7','gibweather:last-forecast:v6', 'gibweather:last-forecast:v5', 'gibweather:last-forecast:v4', 'gibweather:last-forecast:v3', 'gibweather:last-forecast:v2', 'gibweather:last-forecast:v1'];
const INTRO_KEY = 'gibweather:intro-seen';
const SETTINGS_KEY = 'gibweather:settings:v1';
const NOTIFICATION_SIGNATURE_KEY = 'gibweather:last-notification:v1';
const DEFAULT_SETTINGS = {
  temperatureUnit: 'c', windUnit: 'kmh', refreshMinutes: 30, theme: 'dark',
  notificationsEnabled: false,
  alertWind: true, alertRain: true, alertVisibility: true, alertUv: true,
  alertLevanter: true, alertRockCloud: true, alertSea: true,
  alertAir: true, alertCalima: true, alertPollen: true,
  alertStorm: true, alertBeach: false, beachAlertSide: 'either', beachAlertRating: 0,
  alertGustThreshold: 40, alertRainThreshold: 45, alertVisibilityThreshold: 6000,
  alertUvThreshold: 6, alertWaveThreshold: 2,
  alertAqiThreshold: 60, alertDustThreshold: 50, alertPollenThreshold: 2
};
const ALERT_TOGGLE_KEYS = [
  'alertWind','alertRain','alertVisibility','alertUv','alertLevanter','alertRockCloud','alertSea',
  'alertAir','alertCalima','alertPollen','alertStorm','alertBeach'
];
const OBSERVATION_URL = './data/lxgb-observation.json';
const RADAR_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const RADAR_ZOOM_MIN = 6;
const RADAR_ZOOM_MAX = 10;
const RADAR_ZOOM_DEFAULT = 7;
const RADAR_ZOOM_KEY = 'gibweather:radar-zoom:v1';
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
  'visibility','pressure_msl','wind_speed_10m','wind_direction_10m','wind_gusts_10m','uv_index','is_day','cape'
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

// v2.4 · Nearshore wave points: east of Catalan Bay (Mediterranean) and inside the Bay of Gibraltar.
const BEACH_SEA_POINTS = { east: { lat: 36.13, lon: -5.33 }, west: { lat: 36.125, lon: -5.37 } };
const BEACH_SEA_API_URL = new URL('https://marine-api.open-meteo.com/v1/marine');
BEACH_SEA_API_URL.searchParams.set('latitude', [BEACH_SEA_POINTS.east.lat, BEACH_SEA_POINTS.west.lat].join(','));
BEACH_SEA_API_URL.searchParams.set('longitude', [BEACH_SEA_POINTS.east.lon, BEACH_SEA_POINTS.west.lon].join(','));
BEACH_SEA_API_URL.searchParams.set('timezone', GIBRALTAR.timezone);
BEACH_SEA_API_URL.searchParams.set('forecast_days', '4');
BEACH_SEA_API_URL.searchParams.set('length_unit', 'metric');
BEACH_SEA_API_URL.searchParams.set('cell_selection', 'sea');
BEACH_SEA_API_URL.searchParams.set('hourly', ['wave_height','wave_direction','wave_period','sea_surface_temperature','sea_level_height_msl'].join(','));

const AIR_API_URL = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
AIR_API_URL.searchParams.set('latitude', GIBRALTAR.lat);
AIR_API_URL.searchParams.set('longitude', GIBRALTAR.lon);
AIR_API_URL.searchParams.set('timezone', GIBRALTAR.timezone);
AIR_API_URL.searchParams.set('forecast_days', '5');
AIR_API_URL.searchParams.set('current', [
  'european_aqi','pm10','pm2_5','dust','nitrogen_dioxide','ozone'
].join(','));
AIR_API_URL.searchParams.set('hourly', [
  'european_aqi','pm10','pm2_5','dust','nitrogen_dioxide','ozone',
  'grass_pollen','olive_pollen','birch_pollen','alder_pollen','mugwort_pollen','ragweed_pollen'
].join(','));

const $ = (id) => document.getElementById(id);
let weatherData = null;
let modelData = null;
let marineData = null;
let airData = null;
let beachSeaData = null;
let observationData = null;
let savedAt = null;
let lastLoadWasCached = false;
let loadInFlight = false;
let lastApiHealth = 'waiting';
let lastModelHealth = 'waiting';
let lastMarineHealth = 'waiting';
let lastAirHealth = 'waiting';
let lastObservationHealth = 'waiting';
let lastRadarHealth = 'waiting';
let radarData = null;
let radarFrameIndex = 0;
let radarZoom = readRadarZoom();
let radarPlayTimer = null;
let autoRefreshTimer = null;
let previousForecast = null;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch (_) { return { ...DEFAULT_SETTINGS }; }
}

let settings = loadSettings();

function resolvedTheme(choice = settings.theme) {
  if (choice === 'light' || choice === 'dark') return choice;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(choice = settings.theme) {
  const theme = resolvedTheme(choice);
  document.documentElement.dataset.theme = theme;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#eef4f8' : '#0b2239');
}

applyTheme();

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
    uv: safe('uv_index'), isDay: safe('is_day'), cape: safe('cape')
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

function buildAdvisories(data, start, marine = marineData, air = airData) {
  const next24 = snapshots(data, start, 24);
  const next12 = next24.slice(0, 12);
  const advisories = [...buildStormAdvisories(data, start)];
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

  advisories.push(...buildAirAdvisories(air));
  advisories.push(...buildBeachAdvisories(data, marine));

  if (!advisories.length) {
    const paused = activeAlertCategoryCount() === 0;
    advisories.push({
      icon: paused ? '⏸️' : '✅', title: paused ? 'Custom alerts paused' : 'No notable forecast flags', level: 'low', isClear: true,
      detail: paused ? 'All custom alert categories are switched off.' : 'None of your enabled custom alert thresholds are triggered.', time: '24h'
    });
  }
  const priority = { high: 0, medium: 1, good: 2, low: 3 };
  return advisories.sort((a, b) => priority[a.level] - priority[b.level]).slice(0, 9);
}

function renderAdvisories(data, marine = marineData, air = airData) {
  const start = getHourIndex(data);
  const items = buildAdvisories(data, start, marine, air);
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
    : !activeCategories ? 'Turn on the categories you want in About → Custom alerts.' : 'None of your enabled Gibraltar weather, marine or air thresholds are currently triggered.';
  $('alertSummary').innerHTML = `<span class="alert-summary-icon">${!activeCategories ? '⏸️' : high ? '🔴' : medium ? '🟠' : '🟢'}</span><div><strong>${summaryTitle}</strong><small>${summaryDetail}</small></div>`;
  const levelLabel = { high: 'Important', medium: 'Watch', good: 'Beach day', low: 'Info' };
  $('advisoryList').innerHTML = items.map(x => `<div class="advisory-item level-${x.level}" role="listitem">
    <div class="advisory-icon">${x.icon}</div>
    <div><strong>${x.title}</strong><small>${x.detail}</small></div>
    <div class="advisory-time">${x.time}<span>${levelLabel[x.level]}</span></div>
  </div>`).join('');
  notifyForNewAdvisories(items);
}

function notificationSupport() {
  if (!('Notification' in window)) return { supported: false, label: 'Not supported by this browser' };
  if (Notification.permission === 'denied') return { supported: true, label: 'Blocked in browser settings' };
  if (settings.notificationsEnabled && Notification.permission === 'granted') return { supported: true, label: 'On · new Watch and Important flags' };
  return { supported: true, label: 'Off' };
}

function renderNotificationSettings() {
  const status = $('notificationStatus');
  const button = $('notificationBtn');
  if (!status || !button) return;
  const support = notificationSupport();
  status.textContent = support.label;
  button.disabled = !support.supported || Notification.permission === 'denied';
  button.textContent = settings.notificationsEnabled && Notification.permission === 'granted'
    ? 'Turn off notifications' : 'Turn on notifications';
}

// v2.5 · Background alerts. A GitHub Actions job checks the forecast every 30 minutes and sends
// Web Push to the subscription the user pastes into the PUSH_SUBSCRIPTION repository secret.
// Set to the VAPID public key whose private half is stored in the VAPID_PRIVATE_KEY repository secret.
const PUSH_PUBLIC_KEY = '';
const PUSH_SETTING_KEYS = [...ALERT_TOGGLE_KEYS, 'alertGustThreshold','alertRainThreshold','alertVisibilityThreshold',
  'alertUvThreshold','alertWaveThreshold','alertAqiThreshold','alertDustThreshold','alertPollenThreshold','beachAlertSide','beachAlertRating'];

function pushKeyBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64url.length % 4) % 4);
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function backgroundAlertCode(subscription) {
  const prefs = {};
  PUSH_SETTING_KEYS.forEach(key => { prefs[key] = settings[key]; });
  return JSON.stringify({ subscription, settings: prefs, publicKey: activePushPublicKey() });
}

// The key pair is created on this device with WebCrypto. Only the public half is kept here;
// the private half is shown once for the VAPID_PRIVATE_KEY secret and never stored or sent.
const PUSH_KEY_STORAGE = 'gibweather:push-public-key:v1';
function storedPushPublicKey() {
  try { return localStorage.getItem(PUSH_KEY_STORAGE) || ''; } catch (_) { return ''; }
}
function activePushPublicKey() { return PUSH_PUBLIC_KEY || storedPushPublicKey(); }

async function createBackgroundAlertKeys() {
  const status = $('pushStatus'), box = $('pushPrivateKey');
  if (!status || !box) return;
  if (!window.crypto?.subtle) { status.textContent = 'This browser cannot create keys. Try Safari or Chrome over HTTPS.'; return; }
  try {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const bytes = b64url => pushKeyBytes(b64url);
    const pub = new Uint8Array(65);
    pub[0] = 4; pub.set(bytes(jwk.x), 1); pub.set(bytes(jwk.y), 33);
    const publicKey = btoa(String.fromCharCode(...pub)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    try { localStorage.setItem(PUSH_KEY_STORAGE, publicKey); } catch (_) {}
    try {
      const registration = await navigator.serviceWorker?.ready;
      const old = await registration?.pushManager?.getSubscription();
      if (old) await old.unsubscribe();
    } catch (_) {}
    box.value = jwk.d;
    box.hidden = false;
    $('pushKeyCopyBtn').hidden = false;
    $('pushCode').hidden = true;
    $('pushCopyBtn').hidden = true;
    status.textContent = 'Step 1 of 2: copy this private key into a GitHub secret named VAPID_PRIVATE_KEY. It is shown only once. Then tap Set up.';
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not create keys on this device.';
  }
}

async function copyBackgroundAlertKey() {
  const box = $('pushPrivateKey');
  if (!box?.value) return;
  try { await navigator.clipboard.writeText(box.value); $('pushStatus').textContent = 'Private key copied. Save it as the VAPID_PRIVATE_KEY secret on GitHub, then tap Set up.'; }
  catch (_) { box.select(); }
}

async function setupBackgroundAlerts() {
  const status = $('pushStatus'), box = $('pushCode');
  if (!status || !box) return;
  const publicKey = activePushPublicKey();
  if (!publicKey) {
    status.textContent = 'Tap Create keys first, and save the private key on GitHub.';
    return;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    status.textContent = 'This browser cannot receive background alerts. On iPhone, open GibWeather from the Home Screen icon (iOS 16.4 or later).';
    return;
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') { status.textContent = 'Notifications are blocked, so background alerts cannot be set up.'; return; }
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    // A subscription made with older keys would be rejected by the push service, so replace it.
    const subKey = subscription?.options?.applicationServerKey;
    if (subscription && subKey && btoa(String.fromCharCode(...new Uint8Array(subKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== publicKey) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription = subscription || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(publicKey) });
    box.value = backgroundAlertCode(subscription.toJSON());
    if ($('pushPrivateKey')) { $('pushPrivateKey').value = ''; $('pushPrivateKey').hidden = true; $('pushKeyCopyBtn').hidden = true; }
    box.hidden = false;
    $('pushCopyBtn').hidden = false;
    status.textContent = 'Step 2 of 2: copy this code into a GitHub secret named PUSH_SUBSCRIPTION. Copy it again after changing your alert settings.';
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not set up background alerts on this device.';
  }
}

async function copyBackgroundAlertCode() {
  const box = $('pushCode');
  if (!box?.value) return;
  try { await navigator.clipboard.writeText(box.value); $('pushStatus').textContent = 'Copied. Paste it into the PUSH_SUBSCRIPTION secret on GitHub.'; }
  catch (_) { box.select(); }
}

async function showLocalNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch (err) { console.error(err); }
}

async function toggleNotifications() {
  if (!('Notification' in window)) return;
  if (settings.notificationsEnabled && Notification.permission === 'granted') {
    settings.notificationsEnabled = false;
    persistSettings();
    renderNotificationSettings();
    setStatus('Weather notifications turned off.', 'notice');
    return;
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  settings.notificationsEnabled = permission === 'granted';
  persistSettings();
  renderNotificationSettings();
  if (permission === 'granted') {
    await showLocalNotification('GibWeather notifications are on', {
      body: 'You will be notified when a refresh finds a new Watch or Important forecast flag.',
      icon: './icons/icon-192-v5.png', badge: './icons/icon-192-v5.png', tag: 'gibweather-enabled'
    });
    setStatus('Weather notifications turned on.', 'notice');
  } else setStatus('Notification permission was not enabled.', 'notice');
}

function notifyForNewAdvisories(items) {
  if (!settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted' || lastLoadWasCached) return;
  const notable = items.filter(item => !item.isClear && ['high','medium','good'].includes(item.level));
  const signature = notable.map(item => `${item.level}:${item.title}:${item.time}`).join('|');
  let previous = '';
  try { previous = localStorage.getItem(NOTIFICATION_SIGNATURE_KEY) || ''; } catch (_) {}
  if (!signature || signature === previous) return;
  try { localStorage.setItem(NOTIFICATION_SIGNATURE_KEY, signature); } catch (_) {}
  const lead = notable[0];
  const extra = notable.length > 1 ? ` Plus ${notable.length - 1} more forecast flag${notable.length === 2 ? '' : 's'}.` : '';
  showLocalNotification(`${lead.level === 'high' ? 'Important' : lead.level === 'good' ? 'Beach day' : 'Watch'}: ${lead.title}`, {
    body: `${lead.detail}${extra}`,
    icon: './icons/icon-192-v5.png', badge: './icons/icon-192-v5.png', tag: 'gibweather-alerts', renotify: true,
    data: { url: './' }
  });
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
  const t = $('temperatureUnitSelect'), w = $('windUnitSelect'), r = $('refreshIntervalSelect'), theme = $('themeSelect');
  if (t) t.value = settings.temperatureUnit;
  if (w) w.value = settings.windUnit;
  if (r) r.value = String(settings.refreshMinutes);
  if (theme) theme.value = ['auto','dark','light'].includes(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme;
  const toggles = {
    alertWindToggle: 'alertWind', alertRainToggle: 'alertRain',
    alertVisibilityToggle: 'alertVisibility', alertUvToggle: 'alertUv',
    alertLevanterToggle: 'alertLevanter', alertRockCloudToggle: 'alertRockCloud',
    alertSeaToggle: 'alertSea', alertAirToggle: 'alertAir',
    alertCalimaToggle: 'alertCalima', alertPollenToggle: 'alertPollen', alertStormToggle: 'alertStorm', alertBeachToggle: 'alertBeach'
  };
  Object.entries(toggles).forEach(([id, key]) => { if ($(id)) $(id).checked = key === 'alertBeach' ? settings[key] === true : settings[key] !== false; });
  if ($('beachAlertSideSelect')) $('beachAlertSideSelect').value = ['east','west'].includes(settings.beachAlertSide) ? settings.beachAlertSide : 'either';
  const thresholds = {
    alertGustThresholdSelect: 'alertGustThreshold', alertRainThresholdSelect: 'alertRainThreshold',
    alertVisibilityThresholdSelect: 'alertVisibilityThreshold', alertUvThresholdSelect: 'alertUvThreshold',
    alertWaveThresholdSelect: 'alertWaveThreshold', alertAqiThresholdSelect: 'alertAqiThreshold',
    alertDustThresholdSelect: 'alertDustThreshold', alertPollenThresholdSelect: 'alertPollenThreshold',
    beachAlertRatingSelect: 'beachAlertRating'
  };
  Object.entries(thresholds).forEach(([id, key]) => { if ($(id)) $(id).value = String(alertThreshold(key)); });
  const summary = $('settingsSummary');
  const themeLabel = settings.theme === 'light' ? 'Light' : settings.theme === 'auto' ? 'Automatic' : 'Dark';
  if (summary) summary.textContent = `${tempUnitLabel()} · ${windUnitLabel()} · ${themeLabel} · refresh every ${settings.refreshMinutes} min`;
  const alertSummary = $('alertSettingsSummary');
  if (alertSummary) alertSummary.textContent = `${activeAlertCategoryCount()} of ${ALERT_TOGGLE_KEYS.length} alert types on · saved on this device`;
  renderNotificationSettings();
}

function applySettingsFromUI() {
  const t = $('temperatureUnitSelect'), w = $('windUnitSelect'), r = $('refreshIntervalSelect'), theme = $('themeSelect');
  const selectNumber = (id, allowed, fallback) => {
    const value = Number($(id)?.value);
    return allowed.includes(value) ? value : fallback;
  };
  settings = {
    temperatureUnit: t?.value === 'f' ? 'f' : 'c',
    windUnit: w?.value === 'mph' ? 'mph' : 'kmh',
    refreshMinutes: [15,30,60].includes(Number(r?.value)) ? Number(r.value) : 30,
    theme: ['auto','dark','light'].includes(theme?.value) ? theme.value : DEFAULT_SETTINGS.theme,
    notificationsEnabled: settings.notificationsEnabled === true,
    alertWind: Boolean($('alertWindToggle')?.checked),
    alertRain: Boolean($('alertRainToggle')?.checked),
    alertVisibility: Boolean($('alertVisibilityToggle')?.checked),
    alertUv: Boolean($('alertUvToggle')?.checked),
    alertLevanter: Boolean($('alertLevanterToggle')?.checked),
    alertRockCloud: Boolean($('alertRockCloudToggle')?.checked),
    alertSea: Boolean($('alertSeaToggle')?.checked),
    alertAir: Boolean($('alertAirToggle')?.checked),
    alertCalima: Boolean($('alertCalimaToggle')?.checked),
    alertPollen: Boolean($('alertPollenToggle')?.checked),
    alertStorm: Boolean($('alertStormToggle')?.checked),
    alertBeach: Boolean($('alertBeachToggle')?.checked),
    beachAlertSide: ['east','west'].includes($('beachAlertSideSelect')?.value) ? $('beachAlertSideSelect').value : 'either',
    beachAlertRating: selectNumber('beachAlertRatingSelect', [0,1], DEFAULT_SETTINGS.beachAlertRating),
    alertGustThreshold: selectNumber('alertGustThresholdSelect', [30,40,50,60], DEFAULT_SETTINGS.alertGustThreshold),
    alertRainThreshold: selectNumber('alertRainThresholdSelect', [30,45,60,70], DEFAULT_SETTINGS.alertRainThreshold),
    alertVisibilityThreshold: selectNumber('alertVisibilityThresholdSelect', [2000,3000,6000,10000], DEFAULT_SETTINGS.alertVisibilityThreshold),
    alertUvThreshold: selectNumber('alertUvThresholdSelect', [3,6,8,11], DEFAULT_SETTINGS.alertUvThreshold),
    alertWaveThreshold: selectNumber('alertWaveThresholdSelect', [1.5,2,2.5,3], DEFAULT_SETTINGS.alertWaveThreshold),
    alertAqiThreshold: selectNumber('alertAqiThresholdSelect', [40,60,80], DEFAULT_SETTINGS.alertAqiThreshold),
    alertDustThreshold: selectNumber('alertDustThresholdSelect', [25,50,100,150], DEFAULT_SETTINGS.alertDustThreshold),
    alertPollenThreshold: selectNumber('alertPollenThresholdSelect', [1,2,3], DEFAULT_SETTINGS.alertPollenThreshold)
  };
  persistSettings();
  applyTheme();
  renderSettings();
  if (weatherData) renderAll(weatherData);
  scheduleAutoRefresh();
  setStatus('Preferences saved.', 'notice');
}

function resetSettings() {
  settings = { ...DEFAULT_SETTINGS };
  persistSettings();
  applyTheme();
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
  const airTone = lastAirHealth === 'ok' ? 'ok' : lastAirHealth === 'cached' ? 'warn' : lastAirHealth === 'waiting' ? 'neutral' : 'bad';
  const airText = lastAirHealth === 'ok' ? 'Live air quality, dust & pollen' : lastAirHealth === 'cached' ? 'Saved air-quality forecast' : lastAirHealth === 'waiting' ? 'Waiting for first check' : 'Air-quality forecast unavailable';
  const observationTone = lastObservationHealth === 'ok' ? 'ok' : lastObservationHealth === 'stale' ? 'warn' : lastObservationHealth === 'waiting' ? 'neutral' : 'bad';
  const observationText = observationData?.available ? `LXGB observation · ${observationAgeLabel(observationData)}` : lastObservationHealth === 'waiting' ? 'Waiting for airport observation' : 'LXGB observation unavailable';
  const radarTone = lastRadarHealth === 'ok' ? 'ok' : lastRadarHealth === 'waiting' ? 'neutral' : lastRadarHealth === 'offline' ? 'warn' : 'bad';
  const radarText = lastRadarHealth === 'ok' ? `${radarData?.frames?.length || 0} recent radar frames` : lastRadarHealth === 'waiting' ? 'Loads on demand' : lastRadarHealth === 'offline' ? 'Unavailable offline' : 'Radar service unavailable';
  root.innerHTML = [
    healthRow(forecastTone === 'ok' ? '✅' : forecastTone === 'bad' ? '❌' : forecastTone === 'warn' ? '⚠️' : 'ℹ️', 'Forecast API', forecastText, forecastTone),
    healthRow(modelTone === 'ok' ? '✅' : modelTone === 'bad' ? '❌' : modelTone === 'warn' ? '⚠️' : 'ℹ️', 'Forecast models', modelText, modelTone),
    healthRow(marineTone === 'ok' ? '✅' : marineTone === 'bad' ? '❌' : marineTone === 'warn' ? '⚠️' : 'ℹ️', 'Marine forecast', marineText, marineTone),
    healthRow(airTone === 'ok' ? '✅' : airTone === 'bad' ? '❌' : airTone === 'warn' ? '⚠️' : 'ℹ️', 'Air quality & pollen', airText, airTone),
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


function directionGap(a, b) {
  if (a == null || b == null || !Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return null;
  return Math.abs((((Number(a) - Number(b)) + 540) % 360) - 180);
}

function signedDelta(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const shown = digits ? n.toFixed(digits) : Math.round(n).toString();
  return `${n > 0 ? '+' : ''}${shown}`;
}

function renderObservationDeltas(obs, data=weatherData) {
  const ids = ['obsDeltaTemp','obsDeltaWind','obsDeltaDir','obsDeltaPressure'];
  const clear = () => ids.forEach(id => { if ($(id)) $(id).textContent = '—'; });
  if (!obs?.available || !data?.hourly?.time?.length) { clear(); return; }

  const i = getHourIndex(data);
  const s = hourSnapshot(data, i);
  const difference = (a, b) => (a == null || b == null || !Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) ? null : Number(a) - Number(b);
  const tempDiffC = difference(obs.temperature_c, s.temp);
  const windDiffKmh = difference(obs.wind_speed_kmh, s.wind);
  const pressureDiff = difference(obs.pressure_hpa, s.pressure);
  const dirDiff = obs.variable_wind ? null : directionGap(obs.wind_direction_deg, s.dir);

  if ($('obsDeltaTemp')) {
    if (Number.isFinite(tempDiffC)) {
      const delta = settings.temperatureUnit === 'f' ? tempDiffC * 9/5 : tempDiffC;
      $('obsDeltaTemp').textContent = `${signedDelta(delta, 1)}°${settings.temperatureUnit === 'f' ? 'F' : 'C'}`;
    } else $('obsDeltaTemp').textContent = '—';
  }
  if ($('obsDeltaWind')) {
    const delta = windValue(windDiffKmh);
    $('obsDeltaWind').textContent = Number.isFinite(delta) ? `${signedDelta(delta)} ${windUnitLabel()}` : '—';
  }
  if ($('obsDeltaDir')) $('obsDeltaDir').textContent = dirDiff == null ? (obs.variable_wind ? 'VRB' : '—') : `${Math.round(dirDiff)}° apart`;
  if ($('obsDeltaPressure')) $('obsDeltaPressure').textContent = Number.isFinite(pressureDiff) ? `${signedDelta(pressureDiff)} hPa` : '—';
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
    renderObservationDeltas(null, data);
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
  renderObservationDeltas(obs, data);
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

function readRadarZoom() {
  try {
    const value = Number(localStorage.getItem(RADAR_ZOOM_KEY));
    if (Number.isInteger(value)) return Math.max(RADAR_ZOOM_MIN, Math.min(RADAR_ZOOM_MAX, value));
  } catch (_) {}
  return RADAR_ZOOM_DEFAULT;
}

function renderRadarZoomControls() {
  const label = $('radarZoomLabel');
  const zoomOut = $('radarZoomOutBtn');
  const zoomIn = $('radarZoomInBtn');
  if (label) label.textContent = `Z${radarZoom}`;
  if (zoomOut) zoomOut.disabled = radarZoom <= RADAR_ZOOM_MIN;
  if (zoomIn) zoomIn.disabled = radarZoom >= RADAR_ZOOM_MAX;
  const map = $('radarMap');
  map?.setAttribute('aria-label', `Weather radar centred on Gibraltar at zoom level ${radarZoom}`);
}

function setRadarZoom(nextZoom) {
  const next = Math.max(RADAR_ZOOM_MIN, Math.min(RADAR_ZOOM_MAX, Math.round(Number(nextZoom) || RADAR_ZOOM_DEFAULT)));
  if (next === radarZoom) return;
  radarZoom = next;
  try { localStorage.setItem(RADAR_ZOOM_KEY, String(radarZoom)); } catch (_) {}
  renderRadarZoomControls();
  if (radarData?.frames?.length) renderRadarFrame(radarFrameIndex);
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
  const center = radarTileFraction(GIBRALTAR.lat, GIBRALTAR.lon, radarZoom);
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
  const center = radarTileFraction(GIBRALTAR.lat, GIBRALTAR.lon, radarZoom);
  const x0 = Math.floor(center.x) - RADAR_GRID_RADIUS;
  const y0 = Math.floor(center.y) - RADAR_GRID_RADIUS;
  const count = RADAR_GRID_RADIUS * 2 + 1;
  const maxTile = 2 ** radarZoom;
  const pieces = [];
  for (let gy = 0; gy < count; gy++) {
    for (let gx = 0; gx < count; gx++) {
      const txRaw = x0 + gx;
      const tx = ((txRaw % maxTile) + maxTile) % maxTile;
      const ty = y0 + gy;
      if (ty < 0 || ty >= maxTile) continue;
      const left = gx * RADAR_TILE_SIZE, top = gy * RADAR_TILE_SIZE;
      const base = `https://tile.openstreetmap.org/${radarZoom}/${tx}/${ty}.png`;
      pieces.push(`<img class="radar-base-tile" src="${base}" alt="" style="left:${left}px;top:${top}px" loading="eager" decoding="async">`);
    }
  }
  const overlaySize = 512;
  const centerPx = (center.x - x0) * RADAR_TILE_SIZE;
  const centerPy = (center.y - y0) * RADAR_TILE_SIZE;
  const radar = `${radarData.host}${frame.path}/${overlaySize}/${radarZoom}/${GIBRALTAR.lat}/${GIBRALTAR.lon}/2/1_1.png`;
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

function setupRadarGestures() {
  const map = $('radarMap');
  if (!map) return;
  const pointers = new Map();
  let pinchDistance = null;
  let lastTap = null;
  let gestureHadMulti = false;
  const distance = () => {
    const points = [...pointers.values()];
    return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : null;
  };
  map.addEventListener('pointerdown', event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    map.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) { pinchDistance = distance(); gestureHadMulti = true; }
  });
  map.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size !== 2 || !pinchDistance) return;
    const nextDistance = distance();
    if (!nextDistance) return;
    if (nextDistance / pinchDistance >= 1.18) { setRadarZoom(radarZoom + 1); pinchDistance = nextDistance; }
    else if (nextDistance / pinchDistance <= 0.84) { setRadarZoom(radarZoom - 1); pinchDistance = nextDistance; }
  });
  const endPointer = event => {
    const point = pointers.get(event.pointerId);
    const wasSingle = pointers.size === 1;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = null;
    if (gestureHadMulti) {
      if (!pointers.size) gestureHadMulti = false;
      return;
    }
    if (!wasSingle || event.pointerType === 'mouse' || !point) return;
    const now = Date.now();
    if (lastTap && now - lastTap.time < 320 && Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < 32) {
      setRadarZoom(radarZoom + 1);
      lastTap = null;
    } else lastTap = { time: now, x: point.x, y: point.y };
  };
  map.addEventListener('pointerup', endPointer);
  map.addEventListener('pointercancel', endPointer);
  map.addEventListener('dblclick', event => { event.preventDefault(); setRadarZoom(radarZoom + 1); });
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

function outdoorHourScore(s) {
  let score = 100;
  const rain = Number(s.rainChance), precipitation = Number(s.precipitation);
  const gust = Number(s.gust), wind = Number(s.wind), uv = Number(s.uv);
  const visibility = Number(s.visibility), feels = Number(s.feels);
  if (Number(s.isDay) !== 1) score -= 45;
  if (Number.isFinite(rain)) score -= Math.min(55, Math.max(0, rain) * .55);
  if (Number.isFinite(precipitation) && precipitation > .1) score -= Math.min(20, precipitation * 9);
  if (Number.isFinite(gust) && gust > 20) score -= Math.min(32, (gust - 20) * .9);
  if (Number.isFinite(wind) && wind > 30) score -= Math.min(12, (wind - 30) * .5);
  if (Number.isFinite(visibility) && visibility < 10000) score -= Math.min(24, (10000 - visibility) / 420);
  if (Number.isFinite(uv) && uv > 7) score -= Math.min(18, (uv - 7) * 4.5);
  if (Number.isFinite(feels) && feels < 10) score -= Math.min(18, (10 - feels) * 2);
  if (Number.isFinite(feels) && feels > 30) score -= Math.min(22, (feels - 30) * 2.4);
  if (Number(s.code) >= 95) score -= 25;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function outdoorRating(score) {
  if (score >= 76) return { label: 'Great', className: 'outdoor-great' };
  if (score >= 61) return { label: 'Good', className: 'outdoor-good' };
  if (score >= 43) return { label: 'Fair', className: 'outdoor-fair' };
  return { label: 'Limited', className: 'outdoor-limited' };
}

function bestOutdoorPeriod(items) {
  if (!Array.isArray(items) || !items.length) return null;
  let candidates = [];
  for (const length of [3, 2, 4]) {
    for (let start=0; start + length <= items.length; start++) {
      const hours = items.slice(start, start + length);
      if (!hours.every(s => Number(s.isDay) === 1)) continue;
      const scores = hours.map(outdoorHourScore);
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      candidates.push({ startIndex:start, endIndex:start+length-1, hours, score:Math.round(average), rank:average + (length===3 ? 2 : 0) });
    }
  }
  if (!candidates.length) {
    candidates = items.map((s, index) => ({ startIndex:index, endIndex:index, hours:[s], score:outdoorHourScore(s), rank:outdoorHourScore(s) }));
  }
  const best = candidates.reduce((winner, item) => item.rank > (winner?.rank ?? -Infinity) ? item : winner, null);
  const rain = Math.max(...best.hours.map(s => Number(s.rainChance) || 0));
  const gust = Math.max(...best.hours.map(s => Number(s.gust) || 0));
  const uv = Math.max(...best.hours.map(s => Number(s.uv) || 0));
  const visibilityValues = best.hours.map(s => Number(s.visibility)).filter(Number.isFinite);
  const visibility = visibilityValues.length ? Math.min(...visibilityValues) : null;
  return { ...best, rain, gust, uv, visibility, ...outdoorRating(best.score) };
}

function addHoursIso(iso, hours) {
  const epoch = fakeLocalEpoch(iso);
  return Number.isFinite(epoch) ? new Date(epoch + hours * 3600000).toISOString().slice(0,16) : iso;
}

function outdoorWindowText(period) {
  if (!period?.hours?.length) return 'No suitable window found';
  const start = period.hours[0].time;
  const end = addHoursIso(period.hours[period.hours.length-1].time, 1);
  const startText = period.startIndex === 0 ? 'Now' : fmtTime(start);
  const crossesDay = String(start).slice(0,10) !== String(end).slice(0,10);
  return crossesDay ? `${startText}–${fmtDay(String(end).slice(0,10))} ${fmtTime(end)}` : `${startText}–${fmtTime(end)}`;
}

function renderOutdoorSummary(items, period) {
  const badge = $('outdoorBadge');
  if (!period) {
    badge.textContent = 'Unavailable';
    badge.className = 'outdoor-badge outdoor-limited';
    $('outdoorWindow').textContent = 'Outdoor window unavailable';
    $('outdoorReason').textContent = 'The hourly forecast does not contain enough information yet.';
    return;
  }
  badge.textContent = period.label;
  badge.className = `outdoor-badge ${period.className}`;
  $('outdoorWindow').textContent = outdoorWindowText(period);
  $('outdoorRain').textContent = `${round(period.rain)}% peak`;
  $('outdoorGust').textContent = formatWind(period.gust);
  $('outdoorUv').textContent = `${Number(period.uv).toFixed(1)} · ${uvLabel(period.uv)}`;
  const reasons = [];
  if (period.rain < 25) reasons.push('low rain risk');
  else if (period.rain < 50) reasons.push('some shower risk');
  else reasons.push('rain may limit plans');
  if (period.gust < 25) reasons.push('lighter winds');
  else if (period.gust < 40) reasons.push('breezy conditions');
  else reasons.push('strong gusts');
  if (Number.isFinite(period.visibility) && period.visibility < 6000) reasons.push('reduced visibility');
  else reasons.push('useful visibility');
  $('outdoorReason').textContent = `The strongest daylight match combines ${reasons.join(', ')}.`;
}

function solarEventsForWindow(data, items) {
  if (!items.length) return [];
  const start = fakeLocalEpoch(items[0].time);
  const end = fakeLocalEpoch(addHoursIso(items[items.length-1].time, 1));
  const daily = data?.daily || {};
  const events = [];
  (daily.time || []).forEach((date, index) => {
    [['sunrise','Sunrise','🌅'],['sunset','Sunset','🌇']].forEach(([key,label,icon]) => {
      const time = daily[key]?.[index];
      const epoch = fakeLocalEpoch(time);
      if (time && Number.isFinite(epoch) && epoch >= start && epoch <= end) events.push({ key, label, icon, time, epoch, date });
    });
  });
  return events.sort((a,b) => a.epoch - b.epoch);
}

function renderDaylightTimeline(data, items) {
  const root = $('daylightTimeline');
  if (!root || !items.length) return;
  const start = fakeLocalEpoch(items[0].time);
  const endIso = addHoursIso(items[items.length-1].time, 1);
  const end = fakeLocalEpoch(endIso);
  const events = solarEventsForWindow(data, items);
  const segments = items.map(s => `<span class="daylight-segment ${Number(s.isDay)===1?'is-day':'is-night'}" title="${fmtTime(s.time)} · ${Number(s.isDay)===1?'daylight':'night'}"></span>`).join('');
  const markers = events.map(event => {
    const position = Math.max(0, Math.min(100, (event.epoch-start) / Math.max(1,end-start) * 100));
    const edge = position < 14 ? 'edge-left' : position > 86 ? 'edge-right' : '';
    return `<span class="solar-marker ${event.key} ${edge}" style="left:${position.toFixed(2)}%"><i></i><b>${event.icon} ${fmtTime(event.time)}</b></span>`;
  }).join('');
  root.innerHTML = `<div class="daylight-track">${segments}${markers}</div><div class="daylight-axis"><span>Now</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span></div>`;
  const firstDate = String(items[0].time).slice(0,10);
  const summaries = events.map(event => `${event.label} ${event.date===firstDate?'today':event.date} at ${fmtTime(event.time)}`);
  $('daylightSummary').textContent = summaries.length ? summaries.join(' · ') : 'No sunrise or sunset falls inside this 24-hour window.';
  root.setAttribute('aria-label', `Daylight timeline for the next 24 hours. ${summaries.join('. ') || 'No solar event in the window.'}`);
}

function renderHourly(data) {
  renderForecastCharts(data);
  const start = getHourIndex(data);
  const items = snapshots(data, start, 24);
  const period = bestOutdoorPeriod(items);
  renderOutdoorSummary(items, period);
  renderDaylightTimeline(data, items);
  const rows = [];
  let lastDate = null;
  items.forEach((s, offset) => {
    const [condition, icon] = weatherInfo(s.code, s.isDay);
    const date = String(s.time).slice(0,10);
    if (date !== lastDate) {
      const label = offset === 0 ? 'Today' : fmtDay(date, true);
      rows.push(`<div class="day-divider">${label}</div>`);
      lastDate = date;
    }
    const recommended = period && offset >= period.startIndex && offset <= period.endIndex;
    rows.push(`<div class="hour-row hourly-detail-row ${recommended?'outdoor-recommended':''}">
      <div class="hour-time"><strong>${offset===0?'Now':fmtTime(s.time)}</strong>${recommended?'<span class="best-hour-tag">Best</span>':''}</div>
      <div class="hour-weather"><span class="row-icon">${icon}</span><strong>${formatTemp(s.temp)}</strong><small>${condition}</small></div>
      <div class="hour-facts">
        <div><span>Feels</span><strong>${formatTemp(s.feels)}</strong></div>
        <div><span>Rain</span><strong>${round(s.rainChance)}% · ${Number(s.precipitation||0).toFixed(1)} mm</strong></div>
        <div><span>Wind</span><strong>${compass(s.dir)} ${formatWind(s.wind)}</strong><small>Gust ${formatWind(s.gust)}</small></div>
        <div><span>Humidity</span><strong>${round(s.humidity)}%</strong></div>
        <div><span>Visibility</span><strong>${kmVisibility(s.visibility)}</strong></div>
        <div><span>UV</span><strong>${s.uv==null?'—':Number(s.uv).toFixed(1)} · ${uvLabel(s.uv)}</strong></div>
      </div>
    </div>`);
  });
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


// v2.2 · Air quality, Saharan dust (Calima) and pollen
const AQI_BANDS = [
  { max: 20, label: 'Good', tone: 'good', className: 'state-green' },
  { max: 40, label: 'Fair', tone: 'fair', className: 'state-blue' },
  { max: 60, label: 'Moderate', tone: 'moderate', className: 'state-yellow' },
  { max: 80, label: 'Poor', tone: 'poor', className: 'state-orange' },
  { max: 100, label: 'Very poor', tone: 'very-poor', className: 'state-red' },
  { max: Infinity, label: 'Extremely poor', tone: 'extreme', className: 'state-red' }
];
const DUST_BANDS = [
  { max: 20, label: 'None', detail: 'Clear of Saharan dust', rank: 0 },
  { max: 50, label: 'Light haze', detail: 'Slight dust haze possible', rank: 1 },
  { max: 100, label: 'Calima', detail: 'Hazy skies and dusty surfaces likely', rank: 2 },
  { max: 200, label: 'Strong Calima', detail: 'Thick haze; limit strenuous outdoor exercise', rank: 3 },
  { max: Infinity, label: 'Severe Calima', detail: 'Very dense dust; sensitive groups should stay indoors', rank: 4 }
];
// GibWeather guidance cut-offs in grains/m³: [moderate, high, very high]
const POLLEN_TYPES = [
  { key: 'grass_pollen', label: 'Grass', icon: '🌾', cuts: [20, 50, 200] },
  { key: 'olive_pollen', label: 'Olive', icon: '🫒', cuts: [50, 200, 400] },
  { key: 'birch_pollen', label: 'Birch', icon: '🌳', cuts: [10, 50, 200] },
  { key: 'alder_pollen', label: 'Alder', icon: '🌲', cuts: [10, 50, 200] },
  { key: 'mugwort_pollen', label: 'Mugwort', icon: '🌿', cuts: [10, 50, 100] },
  { key: 'ragweed_pollen', label: 'Ragweed', icon: '🌼', cuts: [5, 20, 50] }
];
const POLLEN_LEVELS = ['Low', 'Moderate', 'High', 'Very high'];

function aqiBand(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return AQI_BANDS.find(b => Number(v) <= b.max);
}
function dustBand(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return DUST_BANDS.find(b => Number(v) <= b.max);
}
function pollenLevel(type, v) {
  if (v == null || !Number.isFinite(Number(v))) return -1;
  const n = Number(v);
  if (n < 1) return 0;
  return type.cuts.filter(c => n >= c).length;
}
function airWhen(iso, refIso) {
  if (!iso) return '—';
  return refIso && String(iso).slice(0, 10) !== String(refIso).slice(0, 10) ? `${fmtDay(String(iso).slice(0, 10))} ${fmtTime(iso)}` : fmtTime(iso);
}
function formatMicrograms(v) { return v == null || !Number.isFinite(Number(v)) ? '—' : `${Math.round(Number(v))} µg/m³`; }

function airSnapshot(data, i) {
  const h = data?.hourly || {};
  const safe = (key) => Array.isArray(h[key]) ? h[key][i] : null;
  const snap = { time: safe('time'), aqi: safe('european_aqi'), pm25: safe('pm2_5'), pm10: safe('pm10'), dust: safe('dust'),
    no2: safe('nitrogen_dioxide'), ozone: safe('ozone'), pollen: {} };
  POLLEN_TYPES.forEach(t => { snap.pollen[t.key] = safe(t.key); });
  return snap;
}
function airHours(data, start, count) {
  if (!data?.hourly?.time?.length) return [];
  const end = Math.min(start + count, data.hourly.time.length);
  return Array.from({ length: Math.max(0, end - start) }, (_, n) => airSnapshot(data, start + n));
}
function topPollen(snap) {
  let best = null;
  POLLEN_TYPES.forEach(t => {
    const value = snap?.pollen?.[t.key];
    const level = pollenLevel(t, value);
    if (level < 0) return;
    if (!best || level > best.level || (level === best.level && Number(value) > Number(best.value))) best = { type: t, value, level };
  });
  return best;
}
function hasPollenData(data) {
  return POLLEN_TYPES.some(t => Array.isArray(data?.hourly?.[t.key]) && data.hourly[t.key].some(v => v != null));
}
function peakBy(items, fn) {
  return items.reduce((best, s) => {
    const v = Number(fn(s));
    return Number.isFinite(v) && v > (best ? Number(fn(best)) : -Infinity) ? s : best;
  }, null);
}

function buildAirAdvisories(air) {
  const out = [];
  if (!air?.hourly?.time?.length) return out;
  const items = airHours(air, marineHourIndex(air), 24);
  const aqiThreshold = alertThreshold('alertAqiThreshold');
  const dustThreshold = alertThreshold('alertDustThreshold');
  const pollenThreshold = alertThreshold('alertPollenThreshold');
  const peakAqi = peakBy(items, s => s.aqi);
  if (settings.alertAir !== false && peakAqi && Number(peakAqi.aqi) >= aqiThreshold) {
    const band = aqiBand(peakAqi.aqi);
    out.push({ icon: '😷', title: Number(peakAqi.aqi) >= 80 ? 'Very poor air quality' : 'Reduced air quality',
      level: Number(peakAqi.aqi) >= 80 ? 'high' : 'medium',
      detail: `European AQI may reach ${round(peakAqi.aqi)} (${band.label}).`, time: fmtTime(peakAqi.time) });
  }
  const peakDust = peakBy(items, s => s.dust);
  if (settings.alertCalima !== false && peakDust && Number(peakDust.dust) >= dustThreshold) {
    const band = dustBand(peakDust.dust);
    out.push({ icon: '🏜️', title: Number(peakDust.dust) >= 150 ? 'Strong Calima' : 'Calima / Saharan dust',
      level: Number(peakDust.dust) >= 150 ? 'high' : 'medium',
      detail: `Saharan dust near ${formatMicrograms(peakDust.dust)}. ${band.detail}.`, time: fmtTime(peakDust.time) });
  }
  if (settings.alertPollen !== false) {
    let best = null;
    items.forEach(s => { const p = topPollen(s); if (p && (!best || p.level > best.level || (p.level === best.level && Number(p.value) > Number(best.value)))) best = { ...p, time: s.time }; });
    if (best && best.level >= pollenThreshold) out.push({ icon: best.type.icon, title: `${best.type.label} pollen ${POLLEN_LEVELS[best.level].toLowerCase()}`,
      level: best.level >= 3 ? 'high' : 'medium',
      detail: `${best.type.label} pollen around ${round(best.value)} grains/m³.`, time: fmtTime(best.time) });
  }
  return out;
}

function renderAirNowPanel(air) {
  const el = $('airNowSummary');
  if (!el) return;
  if (!air?.hourly?.time?.length) { el.innerHTML = '<div><span>💨 Air</span><strong>—</strong><small>Unavailable</small></div>'; return; }
  const i = marineHourIndex(air);
  const s = airSnapshot(air, i);
  const c = air.current || {};
  const aqi = c.european_aqi ?? s.aqi;
  const dust = c.dust ?? s.dust;
  const band = aqiBand(aqi);
  const items = airHours(air, i, 24);
  const peakDust = peakBy(items, x => x.dust);
  const pollen = items.map(topPollen).reduce((b, p) => p && (!b || p.level > b.level) ? p : b, null);
  const dBand = dustBand(peakDust?.dust ?? dust);
  el.innerHTML = [
    `<div><span>💨 Air quality</span><strong>${band ? band.label : '—'}</strong><small>EAQI ${round(aqi)}</small></div>`,
    `<div><span>🏜️ Calima</span><strong>${dBand ? dBand.label : '—'}</strong><small>Peak ${formatMicrograms(peakDust?.dust ?? dust)}</small></div>`,
    `<div><span>🌾 Pollen</span><strong>${pollen ? POLLEN_LEVELS[pollen.level] : hasPollenData(air) ? 'Low' : 'Out of season'}</strong><small>${pollen && pollen.level > 0 ? pollen.type.label : 'Next 24 hours'}</small></div>`
  ].join('');
}

function renderAir(air) {
  renderAirNowPanel(air);
  const status = $('airStatus');
  if (!status) return;
  const ids = ['airAqiNow','airAqiLabel','airPm25Now','airPm10Now','airDustNow','airDustLabel','airNo2Now','airOzoneNow'];
  if (!air?.hourly?.time?.length) {
    status.textContent = 'Air-quality and pollen forecast is temporarily unavailable. The main Gibraltar weather forecast is still working.';
    status.className = 'status-banner notice';
    ids.forEach(id => { if ($(id)) $(id).textContent = '—'; });
    ['calimaTimeline','pollenList','airHours','airDaily'].forEach(id => { if ($(id)) $(id).innerHTML = ''; });
    if ($('calimaSummary')) $('calimaSummary').textContent = '—';
    return;
  }
  status.textContent = lastAirHealth === 'cached' ? 'Showing the last saved air-quality forecast.' : 'Air-quality, dust and pollen forecast loaded.';
  status.className = `status-banner ${lastAirHealth === 'cached' ? 'offline' : 'success'}`;
  const i = marineHourIndex(air);
  const s = airSnapshot(air, i);
  const c = air.current || {};
  const aqi = c.european_aqi ?? s.aqi;
  const dust = c.dust ?? s.dust;
  const band = aqiBand(aqi);
  const card = $('airAqiCard');
  if (card && band) applyStateCard(card, band);
  $('airAqiNow').textContent = round(aqi);
  $('airAqiLabel').textContent = band ? band.label : '—';
  $('airPm25Now').textContent = formatMicrograms(c.pm2_5 ?? s.pm25);
  $('airPm10Now').textContent = formatMicrograms(c.pm10 ?? s.pm10);
  $('airDustNow').textContent = formatMicrograms(dust);
  $('airDustLabel').textContent = dustBand(dust)?.label ?? '—';
  $('airNo2Now').textContent = formatMicrograms(c.nitrogen_dioxide ?? s.no2);
  $('airOzoneNow').textContent = formatMicrograms(c.ozone ?? s.ozone);

  // Calima 48-hour outlook
  const next48 = airHours(air, i, 48);
  const peakDust = peakBy(next48, x => x.dust);
  const pBand = dustBand(peakDust?.dust);
  const dustWindow = contiguousWindow(next48, x => Number(x.dust) >= 50);
  $('calimaSummary').textContent = !peakDust ? '—' : pBand.rank >= 2
    ? `${pBand.label} expected${dustWindow ? ` from ${airWhen(dustWindow.start.time, s.time)} to ${airWhen(dustWindow.end.time, s.time)}` : ''}, peaking near ${formatMicrograms(peakDust.dust)} at ${airWhen(peakDust.time, s.time)}. ${pBand.detail}.`
    : pBand.rank === 1 ? `Only a light dust haze is expected, peaking near ${formatMicrograms(peakDust.dust)}.`
    : 'No Saharan dust episode is expected in the next 48 hours.';
  const maxDust = Math.max(60, ...next48.map(x => Number(x.dust) || 0));
  $('calimaTimeline').innerHTML = next48.filter((_, n) => n % 2 === 0).map(x => {
    const b = dustBand(x.dust);
    const h = Math.max(4, Math.round((Number(x.dust) || 0) / maxDust * 100));
    return `<div class="calima-bar dust-rank-${b ? b.rank : 0}" style="height:${h}%" title="${fmtTime(x.time)} · ${formatMicrograms(x.dust)}"></div>`;
  }).join('');

  // Pollen
  const next24 = airHours(air, i, 24);
  if (!hasPollenData(air)) {
    $('pollenList').innerHTML = '<p class="model-copy">Pollen forecasts are currently not issued for this area — this normally means it is out of season.</p>';
  } else {
    $('pollenList').innerHTML = POLLEN_TYPES.map(t => {
      const peak = peakBy(next24, x => x.pollen[t.key]);
      const value = peak?.pollen[t.key];
      const level = pollenLevel(t, value);
      const label = level < 0 ? 'No data' : POLLEN_LEVELS[level];
      return `<div class="pollen-row pollen-level-${Math.max(0, level)}"><span>${t.icon} ${t.label}</span><div class="pollen-meter"><i style="width:${level < 0 ? 0 : level === 0 ? (Number(value) >= 1 ? 15 : 5) : (level + 1) * 25}%"></i></div><strong>${label}</strong><small>${value == null ? '—' : `${round(value)} grains/m³`}</small></div>`;
    }).join('');
  }

  // Hourly
  const rows = [];
  for (let n = 0; n < next24.length; n += 3) {
    const x = next24[n];
    const b = aqiBand(x.aqi);
    const p = topPollen(x);
    rows.push(`<div class="sea-row air-row"><div><strong>${n === 0 ? 'Now' : fmtTime(x.time)}</strong></div><div><strong>AQI ${round(x.aqi)}</strong><small>${b ? b.label : '—'} · PM2.5 ${round(x.pm25)}</small></div><div><strong>Dust ${round(x.dust)}</strong><small>${p && p.level > 0 ? `${p.type.label} ${POLLEN_LEVELS[p.level].toLowerCase()}` : 'Pollen low'}</small></div></div>`);
  }
  $('airHours').innerHTML = rows.join('');

  // Daily outlook from hourly values
  const byDay = new Map();
  air.hourly.time.forEach((t, idx) => {
    const day = t.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(airSnapshot(air, idx));
  });
  const todayKey = s.time ? s.time.slice(0, 10) : null;
  $('airDaily').innerHTML = [...byDay.entries()].filter(([day]) => !todayKey || day >= todayKey).slice(0, 5).map(([day, list], idx) => {
    const label = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : fmtDay(day);
    const pa = peakBy(list, x => x.aqi), pd = peakBy(list, x => x.dust);
    const pp = list.map(topPollen).reduce((b, p) => p && (!b || p.level > b.level) ? p : b, null);
    const ab = aqiBand(pa?.aqi), db = dustBand(pd?.dust);
    return `<div class="sea-row sea-daily-row air-row"><div><strong>${label}</strong></div><div><strong>${ab ? ab.label : '—'}</strong><small>Max AQI ${round(pa?.aqi)}</small></div><div><strong>${db ? db.label : '—'}</strong><small>${pp && pp.level > 0 ? `${pp.type.label} pollen ${POLLEN_LEVELS[pp.level].toLowerCase()}` : 'Pollen low'}</small></div></div>`;
  }).join('');
}

// v2.3 · Beaches and swimming
// Facing is the compass bearing the shore looks out to; wind and waves arriving from near it are onshore.
const BEACHES = [
  { id: 'eastern', name: 'Eastern Beach', side: 'east', facing: 80 },
  { id: 'catalan', name: 'Catalan Bay', side: 'east', facing: 95 },
  { id: 'sandy', name: 'Sandy Bay', side: 'east', facing: 105 },
  { id: 'western', name: 'Western Beach', side: 'west', facing: 260 },
  { id: 'camp', name: 'Camp Bay', side: 'west', facing: 255 },
  { id: 'little', name: 'Little Bay', side: 'west', facing: 245 }
];
const BEACH_SIDES = {
  east: { label: 'East side', short: 'East', facing: 95, openness: 1 },
  west: { label: 'West side', short: 'West', facing: 255, openness: 0.7 }
};
const BEACH_RATINGS = [
  { label: 'Great', className: 'state-green' },
  { label: 'Good', className: 'state-blue' },
  { label: 'Fair', className: 'state-yellow' },
  { label: 'Choppy', className: 'state-orange' },
  { label: 'Rough', className: 'state-red' }
];

function angleGap(a, b) {
  const d = Math.abs((((Number(a) - Number(b)) % 360) + 540) % 360 - 180);
  return Number.isFinite(d) ? d : null;
}

function waterFeel(c) {
  if (c == null || !Number.isFinite(Number(c))) return '—';
  const v = Number(c);
  if (v < 16) return 'Cold';
  if (v < 19) return 'Cool';
  if (v < 22) return 'Refreshing';
  if (v < 25) return 'Pleasant';
  return 'Warm';
}

function marineByTime(marine) {
  const map = new Map();
  (marine?.hourly?.time || []).forEach((t, i) => map.set(t, marineSnapshot(marine, i)));
  return map;
}

function beachConditions(facing, openness, s, sea) {
  const windGap = angleGap(s.dir, facing);
  const wind = Number(s.wind) || 0, gust = Number(s.gust) || 0;
  const onshore = windGap != null && windGap < 90 ? Math.cos(windGap * Math.PI / 180) : 0;
  const offshore = windGap != null && windGap > 110;
  const onshoreWind = wind * onshore, onshoreGust = gust * onshore;
  let wave = null;
  if (sea && sea.wave != null && Number.isFinite(Number(sea.wave))) {
    const waveGap = angleGap(sea.waveDir, facing);
    const exposure = waveGap != null && waveGap < 90 ? 0.3 + 0.7 * Math.cos(waveGap * Math.PI / 180) : 0.25;
    wave = Number(sea.wave) * exposure * openness;
  }
  const wavePts = wave == null ? 0 : wave < 0.3 ? 0 : wave < 0.6 ? 1 : wave < 1 ? 2 : wave < 1.5 ? 3 : 4;
  let windPts = onshoreWind < 12 ? 0 : onshoreWind < 20 ? 1 : onshoreWind < 30 ? 2 : onshoreWind < 40 ? 3 : 4;
  if (onshoreGust >= 50) windPts = 4;
  let rank = Math.max(wavePts, windPts);
  const rain = Number(s.rainChance) || 0;
  const storm = [95, 96, 99].includes(Number(s.code));
  if (rain >= 60) rank += 2; else if (rain >= 35) rank += 1;
  // Strong or gusty wind is unpleasant on any shore, even when it flattens the water.
  const blowy = wind >= 40 || gust >= 60 ? 3 : wind >= 25 || gust >= 40 ? 2 : 0;
  rank = Math.max(rank, blowy);
  if (Number(s.temp) < 18) rank += 1;
  if (storm) rank = 4;
  rank = Math.min(4, rank);

  let reason;
  if (storm) reason = 'Thunderstorms possible — stay out of the water';
  else if (windPts >= wavePts && windPts >= 2) reason = `Onshore ${compass(s.dir)} wind ${formatWind(wind)}, gusts ${formatWind(gust)}`;
  else if (wavePts >= 2) reason = `Waves around ${formatWave(wave)} reaching the shore`;
  else if (blowy && offshore) reason = `Strong offshore ${compass(s.dir)} wind, gusts ${formatWind(gust)}. Blowy on the sand; keep inflatables ashore`;
  else if (blowy) reason = `Gusty ${compass(s.dir)} wind, gusts ${formatWind(gust)}`;
  else if (rain >= 35) reason = `${round(rain)}% chance of rain`;
  else if (offshore && wind >= 15) reason = `Offshore ${compass(s.dir)} breeze keeps it flat — watch inflatables`;
  else if (windGap != null && windGap >= 90 && wind >= 15) reason = `Sheltered from the ${compass(s.dir)} wind`;
  else reason = wave == null ? `Light ${compass(s.dir)} wind` : `Light ${compass(s.dir)} wind and small waves`;
  return { rank, rating: BEACH_RATINGS[rank], wave, onshoreWind, offshore, reason };
}

function parseBeachSea(json) {
  const list = Array.isArray(json) ? json : [json];
  const valid = x => x && !x.error && Array.isArray(x.hourly?.time) && x.hourly.time.length ? x : null;
  const out = { east: valid(list[0]), west: valid(list[1]) };
  return out.east || out.west ? out : null;
}

// Nearshore points already sit on each side of the Rock, so they need no extra shelter factor.
function beachSeaSources(marine, beachSea) {
  const strait = marineByTime(marine);
  const out = {};
  Object.entries(BEACH_SIDES).forEach(([key, side]) => {
    const local = beachSea?.[key] ? marineByTime(beachSea[key]) : null;
    out[key] = local ? { map: local, openness: 1, local: true } : { map: strait, openness: side.openness, local: false };
  });
  return out;
}

function beachHours(data, marine, start, count, beachSea = beachSeaData) {
  if (!data?.hourly?.time?.length) return [];
  const sources = beachSeaSources(marine, beachSea);
  return snapshots(data, start, count).map(s => {
    const seaBySide = {}, sides = {};
    Object.entries(BEACH_SIDES).forEach(([key, side]) => {
      seaBySide[key] = sources[key].map.get(s.time) || null;
      sides[key] = beachConditions(side.facing, sources[key].openness, s, seaBySide[key]);
    });
    return { s, sea: seaBySide.east || seaBySide.west, seaBySide, sides, sources };
  });
}

function bestBeachSide(hour) {
  if (!hour) return null;
  return Object.keys(BEACH_SIDES).reduce((best, key) => !best || hour.sides[key].rank < hour.sides[best].rank ? key : best, null);
}

function beachDayKey(iso) { return iso ? String(iso).slice(0, 10) : null; }

function buildBeachOutlook(data, marine, beachSea = beachSeaData) {
  if (!data?.hourly?.time?.length) return null;
  const start = getHourIndex(data);
  const hours = beachHours(data, marine, start, 72, beachSea);
  if (!hours.length) return null;
  const now = hours[0];
  const daylight = hours.filter(h => Number(h.s.isDay) === 1);
  const pickHour = Number(now.s.isDay) === 1 ? now : daylight[0] || now;
  const pickSide = bestBeachSide(pickHour);
  const beaches = BEACHES.map(b => ({ ...b, ...beachConditions(b.facing, pickHour.sources[b.side].openness, pickHour.s, pickHour.seaBySide[b.side]) }))
    .sort((a, b) => a.rank - b.rank || (a.side === b.side ? 0 : a.side === pickSide ? -1 : 1));
  const nearshore = Object.values(now.sources).some(x => x.local);
  return { hours, now, pickHour, pickSide, beaches, daylight, nearshore, isNight: pickHour !== now };
}

// Opt-in good-news alert: the preferred side reaches the chosen rating for 2+ daylight hours in the next 24h.
function buildBeachAdvisories(data, marine = marineData, beachSea = beachSeaData) {
  if (settings.alertBeach !== true) return [];
  const outlook = buildBeachOutlook(data, marine, beachSea);
  if (!outlook) return [];
  const maxRank = Number(settings.beachAlertRating) === 1 ? 1 : 0;
  const sideKeys = ['east', 'west'].includes(settings.beachAlertSide) ? [settings.beachAlertSide] : Object.keys(BEACH_SIDES);
  const next24 = outlook.hours.slice(0, 24);
  let best = null;
  sideKeys.forEach(key => {
    let i = 0;
    while (i < next24.length) {
      const win = contiguousWindow(next24.slice(i), h => Number(h.s.isDay) === 1 && h.sides[key].rank <= maxRank);
      if (!win) break;
      const start = i + win.startIndex, end = i + win.endIndex;
      if (end - start >= 1) {
        if (!best || start < best.start) best = { key, start, end };
        break;
      }
      i = end + 1;
    }
  });
  if (!best) return [];
  const startHour = next24[best.start], endHour = next24[best.end];
  const label = BEACH_RATINGS[Math.max(...next24.slice(best.start, best.end + 1).map(h => h.sides[best.key].rank))].label;
  const pick = BEACHES.filter(b => b.side === best.key)
    .map(b => ({ ...b, ...beachConditions(b.facing, startHour.sources[best.key].openness, startHour.s, startHour.seaBySide[best.key]) }))
    .sort((a, b) => a.rank - b.rank)[0];
  const until = fmtTime(new Date(fakeLocalEpoch(endHour.s.time) + 3600000).toISOString());
  return [{
    icon: '🏖️', title: `${label} beach conditions`, level: 'good',
    detail: `${BEACH_SIDES[best.key].label} looks ${label.toLowerCase()} from ${fmtTime(startHour.s.time)} to ${until}. Best bet: ${pick.name}.`,
    time: fmtTime(startHour.s.time)
  }];
}

// v2.5 · Thunderstorm risk from the forecast weather code, CAPE (atmospheric instability) and rain chance.
const STORM_LEVELS = [
  { label: 'Very low', className: 'state-green' },
  { label: 'Low', className: 'state-blue' },
  { label: 'Possible', className: 'state-orange' },
  { label: 'Thunderstorms forecast', className: 'state-red' }
];
function stormRisk(s) {
  const cape = Number(s?.cape) || 0, rain = Number(s?.rainChance) || 0;
  let rank = 0;
  if ([95, 96, 99].includes(Number(s?.code))) rank = 3;
  else if (cape >= 1200 && rain >= 40) rank = 2;
  else if (cape >= 500 && rain >= 25) rank = 1;
  return { rank, ...STORM_LEVELS[rank] };
}

function buildStormAdvisories(data, start) {
  if (settings.alertStorm === false || !data?.hourly?.time?.length) return [];
  const peak = snapshots(data, start, 24).map(s => ({ s, risk: stormRisk(s) }))
    .reduce((best, x) => x.risk.rank > (best?.risk.rank ?? 0) ? x : best, null);
  if (!peak || peak.risk.rank < 2) return [];
  return [{
    icon: '⛈️', title: peak.risk.rank === 3 ? 'Thunderstorms forecast' : 'Thunderstorm risk',
    level: peak.risk.rank === 3 ? 'high' : 'medium',
    detail: peak.risk.rank === 3 ? `Thunderstorms are in the forecast around ${fmtTime(peak.s.time)}. Avoid exposed ground and leave the water.`
      : `Unstable air (CAPE ${round(peak.s.cape)} J/kg) with a ${round(peak.s.rainChance)}% rain chance could set off storms.`,
    time: fmtTime(peak.s.time)
  }];
}

function renderStorm(data) {
  const summary = $('stormSummary'), timeline = $('stormTimeline'), badge = $('stormBadge');
  if (!summary || !timeline || !badge) return;
  if (!data?.hourly?.time?.length) { summary.textContent = 'Waiting for forecast data…'; timeline.innerHTML = ''; badge.textContent = '—'; return; }
  const hours = snapshots(data, getHourIndex(data), 24).map(s => ({ s, risk: stormRisk(s) }));
  const peak = hours.reduce((best, x) => x.risk.rank > (best?.risk.rank ?? -1) ? x : best, null);
  badge.textContent = peak.risk.label;
  badge.className = `agreement-badge ${peak.risk.className}`;
  const win = contiguousWindow(hours, x => x.risk.rank >= 2);
  summary.textContent = peak.risk.rank >= 2
    ? `${peak.risk.rank === 3 ? 'Thunderstorms are forecast' : 'Thunderstorms are possible'}${win ? ` from ${fmtTime(win.start.s.time)} to ${fmtTime(win.end.s.time)}` : ''}, most likely around ${fmtTime(peak.s.time)}.`
    : peak.risk.rank === 1 ? `A low thunderstorm risk around ${fmtTime(peak.s.time)}. Showers are more likely than storms.`
    : 'No thunderstorm signal in the next 24 hours.';
  timeline.innerHTML = hours.map(x => `<div class="storm-bar storm-rank-${x.risk.rank}" style="height:${12 + x.risk.rank * 28}%" title="${fmtTime(x.s.time)} · ${x.risk.label}"></div>`).join('');
}

// v2.5 · Tide turns from modelled hourly sea level, refined with a parabola through each turning hour.
function tideSource(marine = marineData, beachSea = beachSeaData) {
  const ok = d => Array.isArray(d?.hourly?.sea_level_height_msl) && d.hourly.sea_level_height_msl.some(v => v != null);
  if (ok(beachSea?.west)) return { data: beachSea.west, label: 'Bay of Gibraltar' };
  if (ok(marine)) return { data: marine, label: 'Strait of Gibraltar' };
  return null;
}

function tideTurns(data, hours = 48) {
  const h = data?.hourly;
  if (!Array.isArray(h?.time) || !Array.isArray(h?.sea_level_height_msl)) return [];
  const start = marineHourIndex(data);
  const end = Math.min(h.time.length - 1, start + hours);
  const lv = h.sea_level_height_msl.map(v => v == null ? NaN : Number(v));
  const out = [];
  for (let i = Math.max(1, start); i < end; i++) {
    const a = lv[i - 1], b = lv[i], c = lv[i + 1];
    if (![a, b, c].every(Number.isFinite)) continue;
    const high = b > a && b >= c, low = b < a && b <= c;
    if (!high && !low) continue;
    const denom = a - 2 * b + c;
    const offset = denom ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / denom)) : 0;
    const epoch = fakeLocalEpoch(h.time[i]) + offset * 3600000;
    if (!Number.isFinite(epoch)) continue;
    out.push({ type: high ? 'High' : 'Low', time: new Date(epoch).toISOString().slice(0, 16), level: b - 0.25 * (a - c) * offset });
  }
  return out;
}

function tideTrend(data) {
  const h = data?.hourly;
  const i = marineHourIndex(data);
  const now = Number(h?.sea_level_height_msl?.[i]), next = Number(h?.sea_level_height_msl?.[i + 1]);
  if (!Number.isFinite(now) || !Number.isFinite(next)) return null;
  return next > now ? 'Rising' : next < now ? 'Falling' : 'Turning';
}

function renderTides(marine = marineData, beachSea = beachSeaData) {
  const el = $('tideList'), summary = $('tideSummary');
  if (!el || !summary) return;
  const src = tideSource(marine, beachSea);
  const turns = src ? tideTurns(src.data).slice(0, 5) : [];
  if (!turns.length) {
    summary.textContent = 'Tide times are unavailable until the marine forecast loads.';
    el.innerHTML = '';
    return;
  }
  const nowKey = String(src.data.hourly.time[marineHourIndex(src.data)]).slice(0, 10);
  const trend = tideTrend(src.data);
  const next = turns[0];
  const nextDay = next.time.slice(0, 10) === nowKey ? '' : `${fmtDay(next.time.slice(0, 10))} `;
  summary.textContent = `${trend ? `${trend} now. ` : ''}Next ${next.type.toLowerCase()} water around ${nextDay}${fmtTime(next.time)}. Modelled for the ${src.label}.`;
  el.innerHTML = turns.map(t => {
    const day = t.time.slice(0, 10);
    return `<div class="tide-row tide-${t.type.toLowerCase()}"><span>${t.type === 'High' ? '⬆️' : '⬇️'} ${t.type}</span><strong>${day === nowKey ? '' : `${fmtDay(day)} `}${fmtTime(t.time)}</strong><small>${t.level >= 0 ? '+' : ''}${t.level.toFixed(2)} m</small></div>`;
  }).join('');
}

function renderBeachNowPanel(outlook, sea) {
  const el = $('beachNowSummary');
  if (!el) return;
  if (!outlook) { el.innerHTML = '<div><span>🏖️ Beaches</span><strong>—</strong><small>Unavailable</small></div>'; return; }
  const h = outlook.pickHour;
  el.innerHTML = [
    ...Object.entries(BEACH_SIDES).map(([key, side]) => `<div class="beach-chip ${h.sides[key].rating.className}"><span>${key === 'east' ? '🌅' : '🌇'} ${side.label}</span><strong>${h.sides[key].rating.label}</strong><small>${outlook.isNight ? `From ${fmtTime(h.s.time)}` : key === outlook.pickSide ? 'Best bet now' : 'Right now'}</small></div>`),
    `<div><span>🌡️ Water</span><strong>${formatSeaTemp(sea)}</strong><small>${waterFeel(sea)}</small></div>`
  ].join('');
}

function renderBeaches(data, marine, beachSea = beachSeaData) {
  const status = $('beachStatus');
  const outlook = buildBeachOutlook(data, marine, beachSea);
  const c = marine?.current || {};
  const seaTemp = c.sea_surface_temperature ?? outlook?.pickHour?.sea?.seaTemp ?? null;
  renderBeachNowPanel(outlook, seaTemp);
  renderTides(marine, beachSea);
  if (!status) return;
  if (!outlook) {
    status.textContent = 'Beach guidance needs the main forecast, which is not available yet.';
    status.className = 'status-banner notice';
    ['beachList','beachHours','beachDaily'].forEach(id => { $(id).innerHTML = ''; });
    ['beachPickName','beachPickReason','beachSeaTemp','beachSeaFeel','beachUv','beachUvLabel','beachSunset','beachSunsetDay','beachWind','beachWindNote'].forEach(id => { $(id).textContent = '—'; });
    return;
  }
  const hasSea = Boolean(marine?.hourly?.time?.length) || outlook.nearshore;
  status.textContent = !hasSea ? 'Marine forecast unavailable, so beach ratings use wind and weather only.'
    : lastMarineHealth === 'cached' ? 'Showing beach guidance from the last saved marine forecast.'
    : outlook.nearshore ? 'Beach guidance loaded with nearshore waves for each side of the Rock.' : 'Beach guidance loaded using Strait waves.';
  status.className = `status-banner ${!hasSea ? 'notice' : lastMarineHealth === 'cached' ? 'offline' : 'success'}`;

  const { pickHour, pickSide, beaches, isNight } = outlook;
  const best = beaches[0];
  const s = pickHour.s;
  $('beachPickEyebrow').textContent = isNight ? `BEST BET FROM ${fmtTime(s.time)}` : 'BEST BET NOW';
  $('beachPickName').textContent = `${best.name} · ${best.rating.label}`;
  const other = pickSide === 'east' ? 'west' : 'east';
  const regime = windRegime(s);
  const sideNote = pickHour.sides[pickSide].rank < pickHour.sides[other].rank
    ? `The ${BEACH_SIDES[pickSide].label.toLowerCase()} is the better choice${regime === 'Levanter' || regime === 'Poniente' ? ` in this ${regime}` : ''}.`
    : 'Both sides of the Rock look similar.';
  const cloudNote = pickSide === 'west' && rockCloudIndex(s).rank >= 1 ? ' The Levanter cloud may keep the west side grey.' : '';
  $('beachPickReason').textContent = `${sideNote} ${best.reason}.${cloudNote}`;
  applyStateCard($('beachPickCard'), best.rating);

  $('beachSeaTemp').textContent = formatSeaTemp(seaTemp);
  $('beachSeaFeel').textContent = waterFeel(seaTemp);
  const dayKey = beachDayKey(s.time);
  const todayHours = outlook.daylight.filter(h => beachDayKey(h.s.time) === dayKey);
  const uvPeak = findPeak(todayHours.map(h => h.s), 'uv');
  $('beachUv').textContent = uvPeak ? round(uvPeak.uv) : '—';
  const nowKey = beachDayKey(outlook.now.s.time);
  const dayLabel = dayKey === nowKey ? 'Today' : Date.parse(`${dayKey}T12:00:00Z`) - Date.parse(`${nowKey}T12:00:00Z`) === 86400000 ? 'Tomorrow' : fmtDay(dayKey);
  $('beachUvLabel').textContent = uvPeak ? `${uvLabel(uvPeak.uv)} · ${dayLabel} ${fmtTime(uvPeak.time)}` : 'No daylight left today';
  $('beachSunsetDay').textContent = dayLabel;
  const dayIdx = Array.isArray(data.daily?.time) ? data.daily.time.indexOf(dayKey) : -1;
  $('beachSunset').textContent = dayIdx >= 0 ? fmtTime(data.daily.sunset?.[dayIdx]) : '—';
  $('beachWind').textContent = regime;
  $('beachWindNote').textContent = regime === 'Levanter' ? 'West side sheltered' : regime === 'Poniente' ? 'East side sheltered' : `${formatWind(s.wind)} ${compass(s.dir)}`;

  $('beachList').innerHTML = BEACHES.map(b => beaches.find(x => x.id === b.id)).map(b =>
    `<div class="beach-row ${b.rating.className}"><div><strong>${b.name}</strong><small>${BEACH_SIDES[b.side].label}</small></div><div><span class="beach-badge">${b.rating.label}</span><small>${b.reason}</small></div></div>`
  ).join('');

  const next = outlook.daylight.slice(0, 13);
  $('beachHours').innerHTML = next.length ? next.filter((_, n) => n % 2 === 0).map(h =>
    `<div class="sea-row beach-hour-row"><div><strong>${h === outlook.now ? 'Now' : beachDayKey(h.s.time) !== beachDayKey(outlook.now.s.time) ? `${fmtDay(beachDayKey(h.s.time))} ${fmtTime(h.s.time)}` : fmtTime(h.s.time)}</strong><small>${compass(h.s.dir)} ${formatWind(h.s.wind)}</small></div>${Object.keys(BEACH_SIDES).map(k => `<div><strong class="beach-tone ${h.sides[k].rating.className}">${BEACH_SIDES[k].short} ${h.sides[k].rating.label}</strong><small>${h.sides[k].offshore ? 'Offshore' : h.sides[k].onshoreWind >= 12 ? `Onshore ${formatWind(h.sides[k].onshoreWind)}` : 'Light onshore'} · ${formatWave(h.sides[k].wave)}</small></div>`).join('')}</div>`
  ).join('') : '<p class="model-copy">No daylight hours in the forecast window.</p>';

  const byDay = new Map();
  outlook.daylight.forEach(h => {
    const hour = Number(String(h.s.time).slice(11, 13));
    if (hour < 10 || hour > 19) return;
    const key = beachDayKey(h.s.time);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(h);
  });
  $('beachDaily').innerHTML = [...byDay.entries()].slice(0, 3).map(([day, list], idx) => {
    const todayKey = beachDayKey(outlook.now.s.time);
    const label = day === todayKey ? 'Today' : idx <= 1 && Date.parse(`${day}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`) === 86400000 ? 'Tomorrow' : fmtDay(day);
    return `<div class="sea-row sea-daily-row beach-hour-row"><div><strong>${label}</strong><small>10:00–19:00</small></div>${Object.keys(BEACH_SIDES).map(k => {
      const ranks = list.map(h => h.sides[k].rank).sort((a, b) => a - b);
      const typical = BEACH_RATINGS[ranks[Math.floor((ranks.length - 1) / 2)]];
      const bestHour = list.reduce((b, h) => !b || h.sides[k].rank < b.sides[k].rank ? h : b, null);
      return `<div><strong class="beach-tone ${typical.className}">${BEACH_SIDES[k].short} ${typical.label}</strong><small>Best ${fmtTime(bestHour.s.time)}</small></div>`;
    }).join('')}</div>`;
  }).join('');
}

function renderAll(data) {
  renderNow(data);
  renderForecastChanges(data);
  renderAdvisories(data, marineData, airData);
  renderHourly(data);
  renderDaily(data);
  renderWind(data);
  renderModelComparison(modelData);
  renderMarine(marineData);
  renderAir(airData);
  renderBeaches(data, marineData);
  renderStorm(data);
  renderObservation(observationData, data);
  renderForecastConfidence();
  renderAppStatus();
  renderSettings();
}

function readTrendBaseline() {
  try {
    const raw = localStorage.getItem(TREND_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ? parsed : null;
  } catch (_) { return null; }
}

function preserveForecastBaseline() {
  const current = readCachedForecast();
  if (!current?.data || !current.savedAt) return;
  const stamp = Date.parse(current.savedAt);
  if (!Number.isFinite(stamp)) return;
  previousForecast = current;
  try { localStorage.setItem(TREND_CACHE_KEY, JSON.stringify(current)); } catch (_) {}
}

function baselineTimeLabel(entry) {
  if (!entry?.savedAt) return 'the previous refresh';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: GIBRALTAR.timezone, hour: '2-digit', minute: '2-digit'
    }).format(new Date(entry.savedAt));
  } catch (_) { return 'the previous refresh'; }
}

function alignedForecastPairs(data, baselineData, count=12) {
  if (!data?.hourly?.time?.length || !baselineData?.hourly?.time?.length) return [];
  const previousIndex = new Map(baselineData.hourly.time.map((time, index) => [time, index]));
  return snapshots(data, getHourIndex(data), count).map(current => {
    const index = previousIndex.get(current.time);
    return index == null ? null : { current, previous: hourSnapshot(baselineData, index) };
  }).filter(Boolean);
}

function deltaTemperatureText(deltaC) {
  if (!Number.isFinite(deltaC)) return '—';
  const converted = settings.temperatureUnit === 'f' ? deltaC * 9/5 : deltaC;
  if (Math.abs(converted) < .5) return 'About the same';
  return `${converted > 0 ? '↑' : '↓'} ${Math.abs(converted).toFixed(Math.abs(converted) < 10 ? 1 : 0)}${tempUnitLabel()} ${converted > 0 ? 'warmer' : 'cooler'}`;
}

function deltaWindText(deltaKmh) {
  if (!Number.isFinite(deltaKmh)) return '—';
  const converted = settings.windUnit === 'mph' ? deltaKmh * .621371 : deltaKmh;
  if (Math.abs(converted) < 2) return 'About the same';
  return `${converted > 0 ? '↑' : '↓'} ${Math.abs(converted).toFixed(0)} ${windUnitLabel()} ${converted > 0 ? 'stronger' : 'weaker'}`;
}

function deltaRainText(delta) {
  if (!Number.isFinite(delta)) return '—';
  if (Math.abs(delta) < 5) return 'About the same';
  return `${delta > 0 ? '↑' : '↓'} ${Math.abs(Math.round(delta))} points ${delta > 0 ? 'higher' : 'lower'}`;
}

function buildForecastChanges(data, baselineEntry=previousForecast) {
  const baseline = baselineEntry?.data;
  const pairs12 = alignedForecastPairs(data, baseline, 12);
  const pairs24 = alignedForecastPairs(data, baseline, 24);
  if (!baseline || pairs12.length < 3) return { available: false };

  const first = pairs12[0];
  const tempDeltaC = Number(first.current.temp) - Number(first.previous.temp);
  const currentPeakGust = Math.max(...pairs12.map(x => Number(x.current.gust) || 0));
  const previousPeakGust = Math.max(...pairs12.map(x => Number(x.previous.gust) || 0));
  const gustDeltaKmh = currentPeakGust - previousPeakGust;
  const currentPeakRain = Math.max(...pairs12.map(x => Number(x.current.rainChance) || 0));
  const previousPeakRain = Math.max(...pairs12.map(x => Number(x.previous.rainChance) || 0));
  const rainDeltaPp = currentPeakRain - previousPeakRain;

  const currentLev = pairs24.find(x => levanterIndex(x.current).rank > 0);
  const previousLev = pairs24.find(x => levanterIndex(x.previous).rank > 0);
  let levanterText = 'No timing change';
  let levanterShiftHours = 0;
  let levanterChanged = false;
  if (currentLev && !previousLev) {
    levanterText = `New signal · ${fmtTime(currentLev.current.time)}`;
    levanterShiftHours = null;
    levanterChanged = true;
  } else if (!currentLev && previousLev) {
    levanterText = 'Earlier signal has eased';
    levanterShiftHours = null;
    levanterChanged = true;
  } else if (currentLev && previousLev) {
    const shift = (fakeLocalEpoch(currentLev.current.time) - fakeLocalEpoch(previousLev.previous.time)) / 3600000;
    levanterShiftHours = Number.isFinite(shift) ? shift : 0;
    if (Math.abs(levanterShiftHours) >= .75) {
      levanterText = `${Math.abs(Math.round(levanterShiftHours))}h ${levanterShiftHours < 0 ? 'earlier' : 'later'}`;
      levanterChanged = true;
    } else {
      const currentRank = levanterIndex(currentLev.current).rank;
      const previousRank = levanterIndex(previousLev.previous).rank;
      if (currentRank !== previousRank) {
        levanterText = currentRank > previousRank ? 'Signal stronger' : 'Signal weaker';
        levanterChanged = true;
      } else levanterText = `Timing steady · ${fmtTime(currentLev.current.time)}`;
    }
  } else levanterText = 'No signal in either update';

  const changed = [];
  if (Math.abs(tempDeltaC) >= 1) changed.push(`temperature ${tempDeltaC > 0 ? 'warmer' : 'cooler'}`);
  if (Math.abs(gustDeltaKmh) >= 5) changed.push(`peak gusts ${gustDeltaKmh > 0 ? 'stronger' : 'weaker'}`);
  if (Math.abs(rainDeltaPp) >= 10) changed.push(`rain risk ${rainDeltaPp > 0 ? 'higher' : 'lower'}`);
  if (levanterChanged) changed.push('Levanter timing changed');
  const baselineLabel = baselineTimeLabel(baselineEntry);
  const significant = changed.length;
  return {
    available: true,
    baselineLabel,
    badge: significant >= 2 ? 'Changed' : significant === 1 ? 'Small change' : 'Steady',
    badgeClass: significant >= 2 ? 'agreement-medium' : 'agreement-high',
    summary: significant ? `Since ${baselineLabel}: ${changed.slice(0, 3).join(' · ')}.` : `Forecast is broadly steady since ${baselineLabel}.`,
    temperature: deltaTemperatureText(tempDeltaC),
    gust: deltaWindText(gustDeltaKmh),
    rain: deltaRainText(rainDeltaPp),
    levanter: levanterText,
    metrics: { tempDeltaC, gustDeltaKmh, rainDeltaPp, levanterShiftHours, significant }
  };
}

function renderForecastChanges(data) {
  const badge = $('forecastChangeBadge');
  const summary = $('forecastChangeSummary');
  if (!badge || !summary) return;
  const ids = ['forecastChangeTemp','forecastChangeGust','forecastChangeRain','forecastChangeLevanter'];
  if (lastLoadWasCached) {
    badge.textContent = 'Offline';
    badge.className = 'agreement-badge';
    summary.textContent = 'Forecast change tracking resumes after the next successful live refresh.';
    ids.forEach(id => { if ($(id)) $(id).textContent = '—'; });
    return;
  }
  const change = buildForecastChanges(data);
  if (!change.available) {
    badge.textContent = 'Learning';
    badge.className = 'agreement-badge';
    summary.textContent = 'A baseline is being saved. Changes will appear after the next live refresh with matching forecast hours.';
    ids.forEach(id => { if ($(id)) $(id).textContent = '—'; });
    return;
  }
  badge.textContent = change.badge;
  badge.className = `agreement-badge ${change.badgeClass}`;
  summary.textContent = change.summary;
  $('forecastChangeTemp').textContent = change.temperature;
  $('forecastChangeGust').textContent = change.gust;
  $('forecastChangeRain').textContent = change.rain;
  $('forecastChangeLevanter').textContent = change.levanter;
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
        if (parsed?.data) return { savedAt: parsed.savedAt || null, data: parsed.data, models: parsed.models || null, marine: parsed.marine || null, air: parsed.air || null, beachSea: parsed.beachSea || null };
        return { savedAt: null, data: parsed, models: null, marine: null, air: null };
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function saveForecast(data, models=null, marine=null, air=null, beachSea=null) {
  savedAt = new Date().toISOString();
  const payload = JSON.stringify({ savedAt, data, models, marine, air, beachSea });
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
      lastAirHealth = cached.air ? 'cached' : 'unavailable';
      weatherData = cached.data;
      modelData = cached.models || null;
      marineData = cached.marine || null;
      airData = cached.air || null;
      beachSeaData = cached.beachSea || null;
      renderAll(weatherData);
      setStatus(cachedStatusMessage('Offline — showing the last saved Gibraltar forecast.'), 'offline');
    } else setStatus('You are offline and no saved forecast is available yet.', 'error');
    $('refreshBtn').classList.remove('loading');
    loadInFlight = false;
    return;
  }

  try {
    if (force) setStatus('Refreshing Gibraltar forecast…');
    const [response, models, marineResponse, airResponse, beachSeaResponse] = await Promise.all([
      fetchWithRetry(API_URL.toString(), 2),
      fetchModelComparison().catch(() => ({ series: [] })),
      fetchWithRetry(MARINE_API_URL.toString(), 2).catch(() => null),
      fetchWithRetry(AIR_API_URL.toString(), 2).catch(() => null),
      fetchWithRetry(BEACH_SEA_API_URL.toString(), 1).catch(() => null)
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
    let air = null;
    if (airResponse?.ok) {
      try {
        const candidate = await airResponse.json();
        if (!candidate?.error && Array.isArray(candidate?.hourly?.time) && candidate.hourly.time.length) air = candidate;
      } catch (_) {}
    }
    let beachSea = null;
    if (beachSeaResponse?.ok) {
      try { beachSea = parseBeachSea(await beachSeaResponse.json()); } catch (_) {}
    }
    weatherData = data;
    modelData = models;
    marineData = marine;
    airData = air;
    beachSeaData = beachSea;
    lastLoadWasCached = false;
    lastApiHealth = 'ok';
    lastModelHealth = models?.series?.length >= 2 ? 'ok' : models?.series?.length ? 'degraded' : 'unavailable';
    lastMarineHealth = marine ? 'ok' : 'unavailable';
    lastAirHealth = air ? 'ok' : 'unavailable';
    preserveForecastBaseline();
    saveForecast(data, models, marine, air, beachSea);
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
      lastAirHealth = cached.air ? 'cached' : 'unavailable';
      weatherData = cached.data;
      modelData = cached.models || null;
      marineData = cached.marine || null;
      airData = cached.air || null;
      beachSeaData = cached.beachSea || null;
      renderAll(weatherData);
      setStatus(cachedStatusMessage('Could not refresh — showing the last saved forecast.'), 'offline');
    } else {
      lastApiHealth = 'error';
      lastModelHealth = 'unavailable';
      lastMarineHealth = 'unavailable';
      lastAirHealth = 'unavailable';
      renderHealthStatus();
      setStatus('Could not load the forecast. Check your connection and try again.', 'error');
    }
  } finally {
    $('refreshBtn').classList.remove('loading');
    loadInFlight = false;
    setOnlineUI();
  }
}

// v2.5 · Sea, Beach and Air share one Outdoors tab; it reopens the last section used.
const OUTDOOR_VIEWS = ['beach', 'sea', 'air'];
const OUTDOOR_VIEW_KEY = 'gibweather:outdoor-view:v1';
function lastOutdoorView() {
  try { const v = localStorage.getItem(OUTDOOR_VIEW_KEY); return OUTDOOR_VIEWS.includes(v) ? v : 'beach'; } catch (_) { return 'beach'; }
}

function changeView(target) {
  if (target === 'outdoors') target = lastOutdoorView();
  if (OUTDOOR_VIEWS.includes(target)) { try { localStorage.setItem(OUTDOOR_VIEW_KEY, target); } catch (_) {} }
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === target));
  document.querySelectorAll('.sub-nav-btn').forEach(b => {
    const active = b.dataset.target === target;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.target === target || (b.dataset.target === 'outdoors' && OUTDOOR_VIEWS.includes(target));
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
  try { [CACHE_KEY, BACKUP_CACHE_KEY, TREND_CACHE_KEY, ...LEGACY_CACHE_KEYS].forEach(key => localStorage.removeItem(key)); } catch (_) {}
  previousForecast = null;
  savedAt = null;
  renderAppStatus();
  setStatus('Saved offline forecast cleared. Live weather is unchanged.', 'notice');
}

document.querySelectorAll('.nav-btn, .sub-nav-btn').forEach(btn => btn.addEventListener('click', () => changeView(btn.dataset.target)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => changeView(btn.dataset.go)));
$('refreshBtn').addEventListener('click', () => refreshAll(true));
$('shareBtn')?.addEventListener('click', shareForecast);
$('clearCacheBtn')?.addEventListener('click', clearSavedForecast);
$('installCheckBtn')?.addEventListener('click', () => { updateInstallUI(); setStatus('Installation readiness checked.', 'notice'); });
$('healthCheckBtn')?.addEventListener('click', runHealthCheck);
$('saveSettingsBtn')?.addEventListener('click', applySettingsFromUI);
$('resetSettingsBtn')?.addEventListener('click', resetSettings);
$('notificationBtn')?.addEventListener('click', toggleNotifications);
$('pushSetupBtn')?.addEventListener('click', setupBackgroundAlerts);
$('pushCopyBtn')?.addEventListener('click', copyBackgroundAlertCode);
$('pushKeysBtn')?.addEventListener('click', createBackgroundAlertKeys);
$('pushKeyCopyBtn')?.addEventListener('click', copyBackgroundAlertKey);
$('themeSelect')?.addEventListener('change', event => applyTheme(event.target.value));
$('startBtn')?.addEventListener('click', dismissFirstRun);
$('reloadAppBtn')?.addEventListener('click', () => location.reload());
$('radarPlayBtn')?.addEventListener('click', playRadar);
$('radarZoomOutBtn')?.addEventListener('click', () => setRadarZoom(radarZoom - 1));
$('radarZoomInBtn')?.addEventListener('click', () => setRadarZoom(radarZoom + 1));
$('radarSlider')?.addEventListener('input', (event) => { stopRadarPlayback(); renderRadarFrame(Number(event.target.value)); });
window.addEventListener('resize', () => { if (document.querySelector('.view.active')?.dataset.view === 'radar') positionRadarGrid(); });
$('installHelpBtn').addEventListener('click', () => {
  const box = $('installHelp');
  box.hidden = !box.hidden;
  $('installHelpBtn').textContent = box.hidden ? 'Show installation steps' : 'Hide installation steps';
});
window.addEventListener('online', () => refreshAll(true));
window.addEventListener('offline', setOnlineUI);
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (settings.theme === 'auto') applyTheme('auto');
});
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

previousForecast = readTrendBaseline();
renderSettings();
renderRadarZoomControls();
setupRadarGestures();
updateInstallUI();
setOnlineUI();
showFirstRun();
refreshAll();
