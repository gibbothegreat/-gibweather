#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Anchor not found: {label}")
    return text.replace(old, new, 1)


app_path = ROOT / "app.js"
html_path = ROOT / "index.html"
css_path = ROOT / "styles.css"
sw_path = ROOT / "service-worker.js"
version_path = ROOT / "version.json"
changelog_path = ROOT / "CHANGELOG.md"
readme_path = ROOT / "README.md"
qa_path = ROOT / "QA.md"
validator_path = ROOT / "scripts/validate_release.py"
updater_path = ROOT / "scripts/update_lxgb_observation.py"

app = app_path.read_text(encoding="utf-8")
app = replace_once(app, "const APP_VERSION = '1.8';", "const APP_VERSION = '1.9';", "APP_VERSION")
app = replace_once(app, "const CACHE_KEY = 'gibweather:last-forecast:v18';", "const CACHE_KEY = 'gibweather:last-forecast:v19';", "forecast cache")
app = replace_once(
    app,
    "const LEGACY_CACHE_KEYS = ['gibweather:last-forecast:v17'",
    "const LEGACY_CACHE_KEYS = ['gibweather:last-forecast:v18','gibweather:last-forecast:v17'",
    "legacy cache list",
)

helper = r'''
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

'''
app = replace_once(app, "function renderObservation(obs, data=weatherData) {", helper + "function renderObservation(obs, data=weatherData) {", "observation helper insertion")
app = replace_once(
    app,
    "    $('obsRaw').textContent = '';\n    return;",
    "    $('obsRaw').textContent = '';\n    renderObservationDeltas(null, data);\n    return;",
    "unavailable observation deltas",
)
app = replace_once(
    app,
    "  } else $('obsMatch').textContent = 'Forecast comparison unavailable.';\n  $('obsRaw').textContent = obs.raw || '';",
    "  } else $('obsMatch').textContent = 'Forecast comparison unavailable.';\n  renderObservationDeltas(obs, data);\n  $('obsRaw').textContent = obs.raw || '';",
    "available observation deltas",
)
app_path.write_text(app, encoding="utf-8")

html = html_path.read_text(encoding="utf-8").replace("v1.8", "v1.9")
anchor = '          <div id="obsMatch" class="observation-match">Comparing observation with the current forecast…</div>\n          <details class="metar-details">'
block = '''          <div id="obsMatch" class="observation-match">Comparing observation with the current forecast…</div>
          <div class="observation-delta-grid" aria-label="Observed minus forecast differences">
            <div><span>🌡️ Temperature difference</span><strong id="obsDeltaTemp">—</strong><small>Observed − forecast</small></div>
            <div><span>💨 Wind-speed difference</span><strong id="obsDeltaWind">—</strong><small>Observed − forecast</small></div>
            <div><span>🧭 Direction difference</span><strong id="obsDeltaDir">—</strong><small>Angular separation</small></div>
            <div><span>📊 Pressure difference</span><strong id="obsDeltaPressure">—</strong><small>Observed − forecast</small></div>
          </div>
          <details class="metar-details">'''
html = replace_once(html, anchor, block, "observation delta grid")
html_path.write_text(html, encoding="utf-8")

css = css_path.read_text(encoding="utf-8")
css += r'''

/* v1.9 · detailed LXGB forecast verification */
.observation-delta-grid {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
  margin:12px 0 2px;
}
.observation-delta-grid > div {
  min-width:0;
  padding:11px;
  border:1px solid var(--line);
  border-radius:14px;
  background:var(--card2);
}
.observation-delta-grid span,
.observation-delta-grid small { display:block; color:var(--muted); }
.observation-delta-grid span { font-size:11px; margin-bottom:5px; }
.observation-delta-grid strong { display:block; font-size:15px; line-height:1.25; }
.observation-delta-grid small { margin-top:4px; font-size:10px; }
@media (max-width:620px) {
  .observation-delta-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
'''
css_path.write_text(css, encoding="utf-8")

sw = sw_path.read_text(encoding="utf-8")
sw = replace_once(sw, "const CACHE = 'gibweather-shell-v18';", "const CACHE = 'gibweather-shell-v19';", "service worker cache")
sw_path.write_text(sw, encoding="utf-8")

version = json.loads(version_path.read_text(encoding="utf-8"))
version.update({"version": "1.9", "released": "2026-08-26", "cache": "gibweather-shell-v19"})
version_path.write_text(json.dumps(version, indent=2) + "\n", encoding="utf-8")

changelog = changelog_path.read_text(encoding="utf-8")
entry = """## v1.9 · Airport verification detail
- Expands the LXGB actual-conditions panel with immediate observed-vs-forecast differences.
- Shows temperature, wind-speed and pressure deltas plus wind-direction angular separation.
- Uses the same current forecast snapshot as GibWeather's existing LXGB match rating so the figures stay internally consistent.
- Converts temperature and wind deltas with the selected units.
- Keeps the existing airport freshness, raw METAR and overall forecast-match assessment.
- Locks v1.8 on a dedicated release branch before the v1.9 upgrade.

"""
changelog = replace_once(changelog, "# GibWeather changelog\n\n", "# GibWeather changelog\n\n" + entry, "changelog header")
changelog_path.write_text(changelog, encoding="utf-8")

readme = readme_path.read_text(encoding="utf-8")
readme = replace_once(readme, "# GibWeather v1.8", "# GibWeather v1.9", "README version")
bullet = "- Actual Gibraltar Airport (LXGB) METAR observation with forecast-vs-observation match indicator\n"
readme = replace_once(readme, bullet, bullet + "- Detailed LXGB observed-vs-forecast differences for temperature, wind, direction and pressure\n", "README airport bullet")
readme = re.sub(
    r"(## Release status\n)([^\n]+\n)",
    r"\1v1.9 expands the Gibraltar Airport verification panel with direct observed-minus-forecast differences for temperature, wind speed and pressure, plus wind-direction separation. It retains the v1.8 forecast change tracker, v1.7 detailed 24-hour view, natural-colour icon, light and dark appearances, custom alerts, local narrative, radar, marine and model-comparison features.\n",
    readme,
    count=1,
)
readme_path.write_text(readme, encoding="utf-8")

qa = qa_path.read_text(encoding="utf-8")
qa = qa.replace("# GibWeather v1.8 QA", "# GibWeather v1.9 QA")
qa = qa.replace("Expected result: `GibWeather v1.8 release validation passed`.", "Expected result: `GibWeather v1.9 release validation passed`.")
qa += """
## v1.9 LXGB verification detail
- A fresh airport observation populates four observed-vs-forecast comparison values.
- Temperature delta follows Celsius/Fahrenheit preference without adding an absolute-temperature offset.
- Wind-speed delta follows km/h or mph preference.
- Wind-direction difference uses the shortest angular separation across north (0°/360°).
- Unavailable observations clear all four delta fields.
"""
qa_path.write_text(qa, encoding="utf-8")

validator = validator_path.read_text(encoding="utf-8")
guard = '''
# v1.9 LXGB observed-vs-forecast detail guardrails.
for control_id in ('obsDeltaTemp','obsDeltaWind','obsDeltaDir','obsDeltaPressure'):
    need(f'id="{control_id}"' in HTML,f'LXGB delta element missing: {control_id}')
need('renderObservationDeltas' in APP,'LXGB delta rendering logic missing')
need('directionGap' in APP,'LXGB wind-direction comparison logic missing')
'''
validator = replace_once(validator, "# METAR updater identity/version.\n", guard + "\n# METAR updater identity/version.\n", "validator v1.9 guardrails")
validator_path.write_text(validator, encoding="utf-8")

updater = updater_path.read_text(encoding="utf-8")
updater = re.sub(r"GibWeather/\d+\.\d+", "GibWeather/1.9", updater)
updater_path.write_text(updater, encoding="utf-8")

# Retire one-shot upgrade workflow files after this script has run.
for rel in (".github/workflows/upgrade-v18.yml", ".github/workflows/upgrade-v19.yml"):
    try:
        (ROOT / rel).unlink()
    except FileNotFoundError:
        pass

print("GibWeather v1.9 upgrade applied")
