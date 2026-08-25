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
need(alert_test.returncode==0,f'Smart-alert runtime test failed: {alert_test.stderr.strip()}')

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

# DOM references
ids=set(re.findall(r'\bid="([^"]+)"',HTML))
refs=set(re.findall(r"\$\('([^']+)'\)",APP))
missing=sorted(refs-ids)
need(not missing,'app.js references missing HTML ids: '+', '.join(missing))

# App shell
required=['index.html','styles.css','app.js','manifest.webmanifest','version.json','data/lxgb-observation.json','icons/icon-192-v3.png','icons/icon-512-v3.png','icons/icon-180-v3.png']
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
