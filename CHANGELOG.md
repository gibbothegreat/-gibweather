# GibWeather changelog

## v1.9 · Airport verification detail
- Expands the LXGB actual-conditions panel with immediate observed-vs-forecast differences.
- Shows temperature, wind-speed and pressure deltas plus wind-direction angular separation.
- Uses the same current forecast snapshot as GibWeather's existing LXGB match rating so the figures stay internally consistent.
- Converts temperature and wind deltas with the selected units.
- Keeps the existing airport freshness, raw METAR and overall forecast-match assessment.
- Locks v1.8 on a dedicated release branch before the v1.9 upgrade.

## v1.8 · Forecast change tracker
- Adds a **What changed?** panel to the Now screen.
- Compares matching forecast hours with the previous successful live refresh saved on the same device.
- Tracks temperature, next-12-hour peak gusts, next-12-hour rain risk and Levanter timing/strength changes.
- Distinguishes forecast revision from observed weather verification; LXGB remains the actual-conditions comparison.
- Pauses change tracking while offline and resumes after a successful live refresh.
- Keeps the comparison private in local browser storage with the existing forecast cache.
- Refreshes the offline shell and release validation for v1.8.

## v1.7 · Detailed 24-hour forecast
- Rebuilds the Hourly screen around the next 24 hours in Gibraltar local time.
- Adds an automated best outdoor-period guide based on daylight, rain, wind, visibility, UV and feels-like temperature.
- Adds a daylight timeline with sunrise and sunset markers.
- Expands every hourly row with temperature, feels-like, rain probability and amount, wind and gusts, humidity, visibility and UV.
- Highlights the recommended outdoor hours without treating the guide as a safety forecast.

## v1.6.2 · Natural-colour icon
- Replaces the red-and-white icon with the selected warm natural-colour design.
- Uses golden-hour sky, limestone Rock, golden sun, soft cloud and deep-blue sea colours.
- Refreshes the Apple Home Screen, browser, manifest and offline icon assets.

## v1.6.1 · Light appearance and refreshed icon
- Adds a complete light appearance across forecasts, alerts, settings, navigation, charts and status surfaces.
- Adds **Automatic**, **Dark** and **Light** appearance choices saved on each device.
- Updates the browser theme colour to match the active appearance.
- Introduces the selected red-and-white Rock, cloud and yellow-sun GibWeather icon at all PWA and Apple Home Screen sizes.
- Refreshes the offline shell so installed apps receive the new appearance and icon assets.

## v1.6 · Custom alerts
- Lets each device choose which Gibraltar alert categories are enabled: wind, rain, visibility, UV, Levanter, Rock Cloud and rough seas.
- Adds personal trigger thresholds for gusts, rain chance, visibility, UV and modelled wave height.
- Keeps higher **Important** severity thresholds fixed while personal thresholds control when guidance first appears.
- Shows the current custom-alert count beside the version badge at the top of the app.
- Saves alert choices locally alongside the existing unit and refresh preferences.
- Adds synthetic coverage for disabled categories, custom thresholds, paused alerts and the header count.

## v1.5 · Smart Gibraltar alerts
- Promotes alerts near the top of the Now screen so important local conditions are visible immediately.
- Adds clear **Important**, **Watch** and **Info** severity labels plus a highest-priority summary.
- Adds Rock Cloud likelihood to the 24-hour alert assessment.
- Adds modelled rough-sea guidance from the Open-Meteo Marine feed.
- Keeps all alert wording explicitly non-official and marine guidance non-navigational.
- Refreshes the offline app cache for the v1.5 release.

## v1.4 · Local outlook release
- Adds a plain-English **Today / Tonight** Gibraltar forecast narrative generated from the live forecast.
- Adds quick local cards for Levanter timing, peak gust, rain window and Rock Cloud timing.
- Adds a **12-hour rain-probability timeline** on the Now screen.
- Adds a dedicated **12-hour Levanter timeline** to the Wind screen.
- Retains the full v1.3 radar, LXGB airport observation, model-comparison, marine, offline and PWA features.
- Corrects QA wording so synthetic Node/DOM runtime coverage is not described as a real browser test.

## v1.3 — 2026-08-24
### Radar release
- Added a Gibraltar-centred **Rain Radar** screen using RainViewer's public Weather Maps API.
- Added a timeline/slider for recent radar history plus play/stop animation.
- Added a lightweight tiled OpenStreetMap basemap with a fixed Gibraltar marker; no map framework dependency is required.
- Added visible RainViewer and OpenStreetMap attribution.
- Added radar availability to System Health and a clear offline/unavailable state.
- Updated hosting CSP rules so RainViewer metadata/tiles and OpenStreetMap tiles can load securely.
- Explicitly excludes third-party radar/map imagery from the service-worker offline cache.
- Updated app/cache version to v1.3 / `gibweather-shell-v13`.

## v1.2 — 2026-08-24
### Reliability release
- Fixed the main Open-Meteo request so it explicitly requests all daily fields used by **Today at a glance** and the **7 Days** screen.
- Fixed the Open-Meteo Marine request: daily variables now use the supported marine aggregations instead of atmospheric daily fields.
- Added validation so a malformed/error Marine API payload cannot be reported as a healthy marine feed.
- Added `scripts/validate_release.py` to catch API-family mixups, missing daily fields, DOM reference errors, version/cache mismatches and packaging problems before release.
- Updated the LXGB METAR updater user-agent to GibWeather/1.2.
- Updated app/cache version to v1.2 / `gibweather-shell-v12`.
- Re-ran synthetic runtime coverage for the full 48-hour, 7-day, model, marine, observation and unit-conversion paths with zero runtime errors.

## v1.1 — 2026-08-24
- Added Gibraltar Airport LXGB METAR observation panel.
- Added forecast-vs-observation match rating.
- Added server-side GitHub Actions METAR updater for AviationWeather.gov.
- Added observation feed health status and offline observation fallback.

## v1.0 — 2026-08-24
- Stable PWA release baseline.
- Added Sea & Strait forecast.
- Added ECMWF/GFS/ICON model comparison.
- Added offline fallback, install diagnostics, system health, accessibility and unit preferences.
