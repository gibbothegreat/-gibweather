#!/usr/bin/env python3
from __future__ import annotations
import json, re, subprocess, sys, tomllib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
APP=(ROOT/'app.js').read_text(encoding='utf-8')
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
SW=(ROOT/'service-worker.js').read_text(encoding='utf-8')

errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

def extract_array(prefix:str):
    m=re.search(re.escape(prefix)+r"\s*\[([\s\S]*?)\]\.join\('\,'\)\);",APP)
    if not m:
        # Actual source has .join(',') where comma is inside literal.
        m=re.search(re.escape(prefix)+r"\s*\[([\s\S]*?)\]\.join\('\,'?\)\);",APP)
    if not m:
        # Simpler tolerant matcher.
        m=re.search(re.escape(prefix)+r"\s*\[([\s\S]*?)\]\.join\('\s*,\s*'\)\);",APP)
    if not m: return None
    return re.findall(r"'([^']+)'",m.group(1))

# Syntax
for f in ('app.js','service-worker.js'):
    r=subprocess.run(['node','--check',str(ROOT/f)],capture_output=True,text=True)
    need(r.returncode==0,f'{f} JavaScript syntax failed: {r.stderr.strip()}')

alert_test=subprocess.run(['node',str(ROOT/'scripts/test_smart_alerts.js')],capture_output=True,text=True)
need(alert_test.returncode==0,f'Forecast runtime test failed: {alert_test.stderr.strip()}')
trend_test=subprocess.run(['node',str(ROOT/'scripts/test_forecast_changes.js')],capture_output=True,text=True)
need(trend_test.returncode==0,f'Forecast change test failed: {trend_test.stderr.strip()}')

# JSON/TOML
for f in ('manifest.webmanifest','version.json','vercel.json'):
    try: json.loads((ROOT/f).read_text())
    except Exception as e: errors.append(f'{f} invalid JSON: {e}')
try: tomllib.loads((ROOT/'netlify.toml').read_text())
except Exception as e: errors.append(f'netlify.toml invalid TOML: {e}')

version=json.loads((ROOT/'version.json').read_text())
vm=re.search(r"const APP_VERSION = '([^']+)'",APP)
cachem=re.search(r"const CACHE = '([^']+)'",SW)
need(vm and vm.group(1)==version.get('version'),'APP_VERSION and version.json disagree')
need(cachem and cachem.group(1)==version.get('cache'),'service-worker cache and version.json disagree')
shellm=re.search(r"const SHELL_VERSION = '([^']+)'",SW)
need(shellm and shellm.group(1)==version.get('version'),'service-worker SHELL_VERSION and version.json disagree')
for asset in ('styles.css','app.js'):
    need(f"{asset}?v={version.get('version')}" in HTML,f'index.html must load {asset}?v=<version> so updates bypass stale caches')
need("cache: 'reload'" in SW,'service worker must precache with cache: reload')

# DOM references
ids=set(re.findall(r'\bid="([^"]+)"',HTML))
refs=set(re.findall(r"\$\('([^']+)'\)",APP))
missing=sorted(refs-ids)
need(not missing,'app.js references missing HTML ids: '+', '.join(missing))

# App shell
required=['index.html','styles.css','app.js','manifest.webmanifest','version.json','data/lxgb-observation.json','icons/icon-192-v5.png','icons/icon-512-v5.png','icons/icon-180-v5.png']
for rel in required: need((ROOT/rel).exists(),f'missing app-shell file: {rel}')

# Open-Meteo contract guardrails. These deliberately check the API families are not mixed up.
main_daily=re.search(r"API_URL\.searchParams\.set\('daily', \[([\s\S]*?)\]\.join\(','\)\);",APP)
marine_daily=re.search(r"MARINE_API_URL\.searchParams\.set\('daily', \[([\s\S]*?)\]\.join\(','\)\);",APP)
need(main_daily is not None,'main forecast daily variables are missing')
need(marine_daily is not None,'marine daily variables are missing')
if main_daily:
    vals=set(re.findall(r"'([^']+)'",main_daily.group(1)))
    expected={'weather_code','temperature_2m_max','temperature_2m_min','apparent_temperature_max','apparent_temperature_min','precipitation_probability_max','precipitation_sum','wind_speed_10m_max','wind_gusts_10m_max','wind_direction_10m_dominant','uv_index_max','sunrise','sunset'}
    need(expected <= vals,'main daily forecast missing required variables: '+', '.join(sorted(expected-vals)))
if marine_daily:
    vals=set(re.findall(r"'([^']+)'",marine_daily.group(1)))
    allowed={'wave_height_max','wave_direction_dominant','wave_period_max','wind_wave_height_max','wind_wave_direction_dominant','wind_wave_period_max','wind_wave_peak_period_max','swell_wave_height_max','swell_wave_direction_dominant','swell_wave_period_max','swell_wave_peak_period_max'}
    need(vals <= allowed,'marine daily request contains non-marine variables: '+', '.join(sorted(vals-allowed)))
    need({'wave_height_max','wave_direction_dominant','swell_wave_height_max','swell_wave_direction_dominant'} <= vals,'marine daily request lacks rendered fields')


# Radar contract/attribution guardrails.
need('https://api.rainviewer.com/public/weather-maps.json' in APP,'RainViewer radar metadata endpoint missing')
need('tile.openstreetmap.org' in APP,'OpenStreetMap radar basemap endpoint missing')
need('RainViewer' in HTML and 'OpenStreetMap contributors' in HTML,'radar attribution missing')
need('data-view=\"radar\"' in HTML,'radar view missing')
need(f'Release v{version.get("version")}' in HTML,'About release label and version.json disagree')

# Custom-alert release guardrails.
for control_id in (
    'topAlertCount','alertWindToggle','alertRainToggle','alertVisibilityToggle','alertUvToggle',
    'alertLevanterToggle','alertRockCloudToggle','alertSeaToggle','alertGustThresholdSelect',
    'alertRainThresholdSelect','alertVisibilityThresholdSelect','alertUvThresholdSelect','alertWaveThresholdSelect'
):
    need(f'id="{control_id}"' in HTML,f'custom alert control missing: {control_id}')
need('activeAlertCategoryCount' in APP,'custom alert category logic missing')
need('alertThreshold' in APP,'custom alert threshold logic missing')
need('id="themeSelect"' in HTML,'appearance selector missing')
need('applyTheme' in APP,'theme application logic missing')
need('html[data-theme="light"]' in (ROOT/'styles.css').read_text(),'light theme styles missing')

# v1.7 detailed 24-hour forecast guardrails.
for control_id in (
    'outdoorBadge','outdoorWindow','outdoorReason','outdoorRain','outdoorGust','outdoorUv',
    'daylightTimeline','daylightSummary','temperatureRainChart','windGustChart','hourlyList'
):
    need(f'id="{control_id}"' in HTML,f'24-hour forecast element missing: {control_id}')
need('bestOutdoorPeriod' in APP,'best outdoor-period logic missing')
need('outdoorHourScore' in APP,'outdoor scoring logic missing')
need('renderDaylightTimeline' in APP,'sunrise/sunset timeline logic missing')
need('snapshots(data, start, 24)' in APP,'hourly screen is not limited to 24 hours')
need('Next 48 hours' not in HTML,'obsolete 48-hour label remains')
styles=(ROOT/'styles.css').read_text()
need('.hourly-detail-row' in styles,'detailed hourly-row styles missing')
need('.daylight-track' in styles,'daylight timeline styles missing')

# v1.8 forecast-change tracker guardrails.
for control_id in ('forecastChangeBadge','forecastChangeSummary','forecastChangeTemp','forecastChangeGust','forecastChangeRain','forecastChangeLevanter'):
    need(f'id="{control_id}"' in HTML,f'forecast-change element missing: {control_id}')
need('TREND_CACHE_KEY' in APP,'forecast-change baseline cache missing')
need('buildForecastChanges' in APP,'forecast-change comparison logic missing')
need('preserveForecastBaseline' in APP,'forecast-change baseline capture missing')


# v1.9 LXGB observed-vs-forecast detail guardrails.
for control_id in ('obsDeltaTemp','obsDeltaWind','obsDeltaDir','obsDeltaPressure'):
    need(f'id="{control_id}"' in HTML,f'LXGB delta element missing: {control_id}')
need('renderObservationDeltas' in APP,'LXGB delta rendering logic missing')
need('directionGap' in APP,'LXGB wind-direction comparison logic missing')

# v2.1 radar zoom guardrails.
for control_id in ('radarZoomOutBtn','radarZoomLabel','radarZoomInBtn'):
    need(f'id="{control_id}"' in HTML,f'radar zoom element missing: {control_id}')
need('RADAR_ZOOM_MIN = 6' in APP and 'RADAR_ZOOM_MAX = 10' in APP,'radar zoom range missing')
need('setRadarZoom' in APP,'radar zoom logic missing')
need('setupRadarGestures' in APP,'radar touch gesture support missing')
need('radarZoom' in APP and '${radarZoom}' in APP,'radar tile requests do not use selected zoom')

# v2.0 notification and official-warning guardrails.
for control_id in ('notificationStatus','notificationBtn'):
    need(f'id="{control_id}"' in HTML,f'notification element missing: {control_id}')
need('Notification.requestPermission' in APP,'notification permission flow missing')
need('notifyForNewAdvisories' in APP,'new-advisory notification logic missing')
need('notificationclick' in SW,'service-worker notification click handling missing')
need('aemet.es/en/eltiempo/prediccion/avisos' in HTML,'official AEMET warning link missing')
need('not official warnings' in HTML,'official-warning distinction missing')

# v2.2 air quality, Calima and pollen guardrails.
air_hourly=re.search(r"AIR_API_URL\.searchParams\.set\('hourly', \[([\s\S]*?)\]\.join\(','\)\);",APP)
need('https://air-quality-api.open-meteo.com/v1/air-quality' in APP,'Open-Meteo Air Quality endpoint missing')
need(air_hourly is not None,'air-quality hourly variables are missing')
if air_hourly:
    vals=set(re.findall(r"'([^']+)'",air_hourly.group(1)))
    need({'european_aqi','pm2_5','pm10','dust','grass_pollen','olive_pollen'} <= vals,'air-quality request lacks rendered fields')
    need(not (vals & {'temperature_2m','wave_height','wind_speed_10m'}),'air-quality request contains non-air variables')
need(not re.search(r"AIR_API_URL\.searchParams\.set\('daily'",APP),'Air Quality API has no daily aggregations; do not request them')
for control_id in ('airView','airStatus','airAqiNow','airDustNow','calimaSummary','calimaTimeline','pollenList','airHours','airDaily','airNowSummary',
                   'alertAirToggle','alertCalimaToggle','alertPollenToggle','alertAqiThresholdSelect','alertDustThresholdSelect','alertPollenThresholdSelect'):
    need(f'id="{control_id}"' in HTML,f'air-quality element missing: {control_id}')
need('data-target="air"' in HTML,'Air navigation button missing')
need('buildAirAdvisories' in APP,'air-quality alert logic missing')
need('Copernicus' in HTML,'CAMS attribution missing')
for f in ('_headers','vercel.json','netlify.toml'):
    need('https://air-quality-api.open-meteo.com' in (ROOT/f).read_text(),f'{f} CSP does not allow the Air Quality API')

# v2.3 beach guardrails.
for control_id in ('beachView','beachStatus','beachPickCard','beachPickName','beachPickReason','beachList','beachHours','beachDaily','beachNowSummary','beachSeaTemp'):
    need(f'id="{control_id}"' in HTML,f'beach element missing: {control_id}')
need('data-target="beach"' in HTML,'Beach navigation button missing')
need('beachConditions' in APP and 'renderBeaches(data, marineData)' in APP,'beach rating logic missing')
need('not safety advice' in HTML,'beach safety disclaimer missing')

# v2.4 nearshore beach waves and Beach day alerts.
need('BEACH_SEA_API_URL' in APP and 'parseBeachSea' in APP,'nearshore beach wave request missing')
need(not re.search(r"BEACH_SEA_API_URL\.searchParams\.set\('daily'",APP),'nearshore beach request should be hourly only')
for control_id in ('alertBeachToggle','beachAlertSideSelect','beachAlertRatingSelect'):
    need(f'id="{control_id}"' in HTML,f'beach alert control missing: {control_id}')
need('buildBeachAdvisories' in APP,'beach-day alert logic missing')

# v2.5 Outdoors tab, tides, thunderstorms and background alerts.
need('data-target="outdoors"' in HTML and HTML.count('class="nav-btn') <= 7,'bottom bar should have at most seven tabs including Outdoors')
need('sub-nav-btn' in HTML and 'OUTDOOR_VIEWS' in APP,'Outdoors section switcher missing')
for control_id in ('tideList','tideSummary','stormSummary','stormTimeline','stormBadge','alertStormToggle','pushSetupBtn','pushCode','pushCopyBtn','pushStatus'):
    need(f'id="{control_id}"' in HTML,f'v2.5 element missing: {control_id}')
need("'cape'" in APP and 'stormRisk' in APP,'thunderstorm risk logic missing')
need('tideTurns' in APP and 'sea_level_height_msl' in APP,'tide logic missing')
need(re.search(r"const PUSH_PUBLIC_KEY = '(?:[A-Za-z0-9_-]{87})?';",APP) is not None,'push public key must be empty or an 87-character VAPID public key')
need("addEventListener('push'" in SW,'service-worker push handler missing')
for f in ('.github/workflows/background-alerts.yml','.github/workflows/release-checks.yml','scripts/send_push_alerts.js','data/push-state.json'):
    need((ROOT/f).exists(),f'missing v2.5 file: {f}')

# METAR updater identity/version.
updater=(ROOT/'scripts/update_lxgb_observation.py').read_text()
need('LXGB' in updater,'LXGB updater station missing')
need('aviationweather.gov/api/data/metar' in updater,'METAR updater endpoint missing')

if errors:
    print('GibWeather release validation FAILED')
    for e in errors: print(' -',e)
    sys.exit(1)
print(f"GibWeather v{version['version']} release validation passed")
print(f"HTML IDs: {len(ids)} · JS DOM refs: {len(refs)} · cache: {version['cache']}")
