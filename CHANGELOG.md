# GibWeather changelog

## v2.5.1 · Background alert keys made in the app
- Adds **Create keys** to About → Background alerts. The key pair is created on the device, the private key is shown once for the `VAPID_PRIVATE_KEY` secret and never stored, and no code change or outside key generator is needed.
- The background alert job now derives the public key from `VAPID_PRIVATE_KEY`.
- Refreshes the offline shell to `gibweather-shell-v251`.

## v2.5 · Outdoors tab, tides, thunderstorms and background alerts
- The bottom bar drops from nine tabs to seven: Sea, Beach and Air now share an **Outdoors** tab with Beach / Sea / Air buttons at the top, and it reopens the section you used last.
- Adds **Tides** to the Beach screen: the next high and low water times and heights over 48 hours, from modelled sea level in the Bay of Gibraltar (falling back to the Strait).
- Adds **Thunderstorm risk** to the Radar screen with a 24-hour timeline, based on forecast thunder, CAPE and rain chance, plus a Thunderstorms alert category (on by default).
- Adds optional **Background alerts**: a GitHub Actions job (`background-alerts.yml`) checks the forecast every 30 minutes with your alert settings and sends a Web Push notification when the alerts change, even when GibWeather is closed. One-time setup is in DEPLOY.md.
- Adds a **Release checks** workflow that runs the smoke tests and release validation on every pull request and push to main.
- Refreshes the offline shell to `gibweather-shell-v25`.

## v2.4 · Nearshore beach waves, Beach day alerts and new icon
- The Beach screen now fetches wave forecasts for two nearshore points, one east of Catalan Bay and one inside the Bay of Gibraltar, so each side of the Rock uses its own waves. It falls back to the Strait forecast if that request fails.
- Adds opt-in **Beach days** alerts in About → Custom alerts, with a preferred side (either, east or west) and a rating (Great, or Good or better). An alert appears when that side holds the rating for at least two daylight hours in the next 24 hours, and can trigger a device notification.
- Adds a new home screen icon (`icon-*-v5.png`) with a clearer Rock silhouette, sun and sea that stays inside the maskable safe zone.
- Strong or gusty wind now caps a beach at Fair (25 km/h or gusts 40 km/h) or Choppy (40 km/h or gusts 60 km/h), even when it blows offshore and flattens the water.
- Offshore gales explain that it is blowy on the sand and that inflatables should stay ashore.
- Sunset and UV peak on the Beach screen now name the day the best bet refers to, instead of always saying Today.
- Refreshes the offline shell to `gibweather-shell-v24`.

## v2.3 · Beaches and swimming
- Adds a **Beach** screen rating Eastern Beach, Catalan Bay, Sandy Bay, Western Beach, Camp Bay and Little Bay as Great, Good, Fair, Choppy or Rough.
- Ratings combine onshore wind and gusts, wave height and direction reaching each shore, rain chance, thunderstorms and air temperature.
- Picks a best-bet beach and explains which side of the Rock the Levanter or Poniente favours, including when the Levanter cloud may keep the west side grey.
- Adds water temperature with a comfort label, today's UV peak and sunset time.
- Adds an east-vs-west comparison for the next daylight hours and a 3-day beach outlook (10:00–19:00).
- Adds a **Beaches** summary on the Now screen.
- Refreshes the offline shell to `gibweather-shell-v23`.

## v2.2 · Air quality, Calima and pollen
- Adds an **Air** screen with European AQI, PM2.5, PM10, NO₂, ozone and Saharan dust from the Open-Meteo Air Quality API (CAMS).
- Adds a 48-hour **Calima outlook** with a dust timeline, episode window and peak timing.
- Adds a **pollen** panel for grass, olive, birch, alder, mugwort and ragweed, with an out-of-season state.
- Adds 24-hour and 5-day air outlooks plus an **Air & pollen** summary on the Now screen.
- Adds Air quality, Calima and Pollen alert categories with personal thresholds; they feed the header count and notifications.
- Caches air data with the offline forecast and reports the feed in System Health.
- Allows `air-quality-api.open-meteo.com` in hosting CSP and refreshes the offline shell to `gibweather-shell-v22`.

## v2.1 · Radar zoom
- Adds radar zoom levels 6–10 while keeping Gibraltar fixed at the centre.
- Adds accessible +/− controls with a visible zoom-level indicator.
- Adds pinch-to-zoom and double-tap zoom on touch devices.
- Saves the preferred radar zoom on the current device.
- Refreshes the offline shell and release validation for v2.1.

## v2.0 · Notifications and official-warning access
- Adds opt-in device notifications for newly detected **Watch** and **Important** GibWeather forecast flags.
- De-duplicates notifications on each device and suppresses them when the app is using cached forecast data.
- Opens GibWeather when a notification is selected.
- Adds direct access to the official AEMET adverse-weather warning page for the neighbouring Campo de Gibraltar and Strait area.
- Clearly distinguishes automated GibWeather guidance from official warnings and explains the limitations of notifications in a static web app.
- Refreshes the offline shell and release validation for v2.0.

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
