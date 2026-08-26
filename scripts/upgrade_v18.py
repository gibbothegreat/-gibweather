from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]

# app.js
p=root/'app.js'
s=p.read_text()
s=s.replace("const APP_VERSION = '1.7';", "const APP_VERSION = '1.8';", 1)
s=s.replace("const CACHE_KEY = 'gibweather:last-forecast:v17';", "const CACHE_KEY = 'gibweather:last-forecast:v18';\nconst TREND_CACHE_KEY = 'gibweather:forecast-baseline:v1';", 1)
s=s.replace("const LEGACY_CACHE_KEYS = ['gibweather:last-forecast:v16'", "const LEGACY_CACHE_KEYS = ['gibweather:last-forecast:v17','gibweather:last-forecast:v16'", 1)
s=s.replace("let autoRefreshTimer = null;", "let autoRefreshTimer = null;\nlet previousForecast = null;", 1)

marker="""function setStatus(text, kind='') {\n"""
insert=r'''function readTrendBaseline() {
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

'''
if marker not in s: raise SystemExit('marker setStatus not found')
s=s.replace(marker, insert+marker,1)

s=s.replace("function renderAll(data) {\n  renderNow(data);\n", "function renderAll(data) {\n  renderNow(data);\n  renderForecastChanges(data);\n", 1)
s=s.replace("    lastMarineHealth = marine ? 'ok' : 'unavailable';\n    saveForecast(data, models, marine);", "    lastMarineHealth = marine ? 'ok' : 'unavailable';\n    preserveForecastBaseline();\n    saveForecast(data, models, marine);", 1)
s=s.replace("try { [CACHE_KEY, BACKUP_CACHE_KEY, ...LEGACY_CACHE_KEYS].forEach(key => localStorage.removeItem(key)); } catch (_) {}", "try { [CACHE_KEY, BACKUP_CACHE_KEY, TREND_CACHE_KEY, ...LEGACY_CACHE_KEYS].forEach(key => localStorage.removeItem(key)); } catch (_) {}\n  previousForecast = null;", 1)
s=s.replace("renderSettings();\nupdateInstallUI();", "previousForecast = readTrendBaseline();\nrenderSettings();\nupdateInstallUI();", 1)
p.write_text(s)

# index.html
p=root/'index.html'; s=p.read_text()
s=s.replace('aria-label="App version 1.7">v1.7</span>', 'aria-label="App version 1.8">v1.8</span>')
s=s.replace('<div class="page-title"><h2>About GibWeather</h2><p>Release v1.7</p></div>', '<div class="page-title"><h2>About GibWeather</h2><p>Release v1.8</p></div>')
s=s.replace('<div><span>Version</span><strong id="versionText">v1.7</strong></div>', '<div><span>Version</span><strong id="versionText">v1.8</strong></div>')
s=s.replace('GibWeather v1.7 has no account', 'GibWeather v1.8 has no account')

narrative_close='''        </section>\n\n        <section id="observationPanel" class="panel observation-panel" aria-label="Gibraltar Airport observed weather">'''
change_panel='''        </section>\n\n        <section class="panel" aria-label="Forecast changes since the previous refresh">\n          <div class="section-heading">\n            <div><div class="eyebrow">WHAT CHANGED?</div><h2>Since the last forecast</h2></div>\n            <span id="forecastChangeBadge" class="agreement-badge">Learning…</span>\n          </div>\n          <p id="forecastChangeSummary" class="model-copy">Saving a baseline so GibWeather can compare the next refresh.</p>\n          <div class="narrative-grid">\n            <div><span>🌡️ Temperature</span><strong id="forecastChangeTemp">—</strong></div>\n            <div><span>🌪️ Peak gust</span><strong id="forecastChangeGust">—</strong></div>\n            <div><span>🌧️ Rain risk</span><strong id="forecastChangeRain">—</strong></div>\n            <div><span>🌬️ Levanter</span><strong id="forecastChangeLevanter">—</strong></div>\n          </div>\n          <p class="fineprint">Compared with the previous successful GibWeather forecast stored on this device. This shows how the forecast changed, not how the forecast compared with actual weather.</p>\n        </section>\n\n        <section id="observationPanel" class="panel observation-panel" aria-label="Gibraltar Airport observed weather">'''
if narrative_close not in s: raise SystemExit('narrative close marker not found')
s=s.replace(narrative_close,change_panel,1)
p.write_text(s)

p=root/'service-worker.js'; s=p.read_text().replace("const CACHE = 'gibweather-shell-v17';", "const CACHE = 'gibweather-shell-v18';",1); p.write_text(s)
(root/'version.json').write_text(json.dumps({"name":"GibWeather","version":"1.8","channel":"stable","released":"2026-08-26","cache":"gibweather-shell-v18"},indent=2)+"\n")

p=root/'scripts/update_lxgb_observation.py'; s=p.read_text().replace('GibWeather/1.7 (+https://github.com/)','GibWeather/1.8 (+https://github.com/)'); p.write_text(s)

p=root/'README.md'; s=p.read_text()
s=s.replace('# GibWeather v1.7','# GibWeather v1.8',1)
s=s.replace('- Red-and-white Rock and cloud icon with a yellow sun','- Natural-colour Rock, sun, cloud and sea Home Screen icon')
s=s.replace('- Smart Gibraltar alerts with severity, timing, Rock Cloud and rough-sea guidance','- Smart Gibraltar alerts with severity, timing, Rock Cloud and rough-sea guidance\n- Forecast change tracker comparing temperature, peak gusts, rain risk and Levanter timing with the previous live refresh')
old='v1.7 upgrades the Hourly screen with a detailed 24-hour view, sunrise and sunset markers, and a highlighted best outdoor-period guide. Every hour now includes temperature, feels-like, rain probability and amount, wind and gusts, humidity, visibility and UV. It retains the natural-colour icon, light and dark appearances, custom alerts, local narrative, radar, LXGB observation, marine and model-comparison features.'
new='v1.8 adds a device-local forecast change tracker. After a live refresh, GibWeather compares matching forecast hours with the previous successful refresh and highlights changes in temperature, peak gusts, rain risk and Levanter timing. It retains the v1.7 detailed 24-hour view, natural-colour icon, light and dark appearances, custom alerts, local narrative, radar, LXGB observation, marine and model-comparison features.'
s=s.replace(old,new)
p.write_text(s)

p=root/'CHANGELOG.md'; s=p.read_text()
entry='''# GibWeather changelog\n\n## v1.8 · Forecast change tracker\n- Adds a **What changed?** panel to the Now screen.\n- Compares matching forecast hours with the previous successful live refresh saved on the same device.\n- Tracks temperature, next-12-hour peak gusts, next-12-hour rain risk and Levanter timing/strength changes.\n- Distinguishes forecast revision from observed weather verification; LXGB remains the actual-conditions comparison.\n- Pauses change tracking while offline and resumes after a successful live refresh.\n- Keeps the comparison private in local browser storage with the existing forecast cache.\n- Refreshes the offline shell and release validation for v1.8.\n\n'''
if not s.startswith('# GibWeather changelog\n'): raise SystemExit('changelog header')
s=entry+s[len('# GibWeather changelog\n\n'):]
p.write_text(s)

p=root/'QA.md'; s=p.read_text().replace('# GibWeather v1.7 QA','# GibWeather v1.8 QA',1).replace('GibWeather v1.7 release validation passed','GibWeather v1.8 release validation passed')
s += '''\n## v1.8 forecast-change tracker\n- Baseline is stored only after a successful live refresh.\n- Comparison uses matching future timestamps, not unrelated hourly positions.\n- Temperature, peak gust, rain probability and Levanter change states are covered by a synthetic Node test.\n- Offline mode labels change tracking as unavailable rather than presenting stale revisions as current.\n'''
p.write_text(s)

p=root/'scripts/validate_release.py'; s=p.read_text()
s=s.replace("alert_test=subprocess.run(['node',str(ROOT/'scripts/test_smart_alerts.js')],capture_output=True,text=True)\nneed(alert_test.returncode==0,f'Forecast runtime test failed: {alert_test.stderr.strip()}')", "alert_test=subprocess.run(['node',str(ROOT/'scripts/test_smart_alerts.js')],capture_output=True,text=True)\nneed(alert_test.returncode==0,f'Forecast runtime test failed: {alert_test.stderr.strip()}')\ntrend_test=subprocess.run(['node',str(ROOT/'scripts/test_forecast_changes.js')],capture_output=True,text=True)\nneed(trend_test.returncode==0,f'Forecast change test failed: {trend_test.stderr.strip()}')")
anchor="# METAR updater identity/version.\n"
guard='''# v1.8 forecast-change tracker guardrails.\nfor control_id in ('forecastChangeBadge','forecastChangeSummary','forecastChangeTemp','forecastChangeGust','forecastChangeRain','forecastChangeLevanter'):\n    need(f'id="{control_id}"' in HTML,f'forecast-change element missing: {control_id}')\nneed('TREND_CACHE_KEY' in APP,'forecast-change baseline cache missing')\nneed('buildForecastChanges' in APP,'forecast-change comparison logic missing')\nneed('preserveForecastBaseline' in APP,'forecast-change baseline capture missing')\n\n'''
if anchor not in s: raise SystemExit('validator anchor missing')
s=s.replace(anchor,guard+anchor,1)
p.write_text(s)

print('v1.8 edits applied')