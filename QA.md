# GibWeather v2.5 QA

## Release validation
Run:

```bash
python3 scripts/validate_release.py
```

Expected result: `GibWeather v2.5.2 release validation passed`.

## v2.5 checks
- The bottom bar shows seven tabs. Outdoors opens the last-used of Beach, Sea or Air, and the Now-screen "See beaches" and "See air" links still work.
- Tides list alternating High and Low times with heights; the summary says Rising or Falling.
- The Radar screen shows Thunderstorm risk with a badge and timeline; a forecast thunderstorm raises an Important alert unless Thunderstorms is switched off.
- About → Background alerts → Set up asks for notification permission and shows a code; Copy code copies it.
- With the GitHub secrets set, running Background alerts from the Actions tab sends a notification only when the alerts change.
- The Release checks workflow passes on the pull request.

## v2.4 checks
- The Beach status line says it is using nearshore waves; blocking the second marine request falls back to Strait waves without errors.
- Beach days is off by default. With it on, a calm sunny forecast shows a "Great beach conditions" item labelled Beach day.
- Choosing East side or West side only alerts for that side; Good or better triggers on Good hours too.
- The new icon shows on the iOS Home Screen and in the Android launcher, with nothing cropped by circular masks.

- A 32 km/h Levanter gusting 52 km/h rates the west-side beaches Fair, not Good, with a blowy-sand note.
- After sunset, the Sunset and UV cards say Tomorrow and show tomorrow's values.

## v2.3 beach checks
- Bottom navigation shows nine buttons including Beach, with readable labels on a 375 px wide iPhone.
- In an easterly (Levanter) the west-side beaches rate better than the east side; in a westerly (Poniente) the reverse.
- At night the best-bet card names the first daylight hour instead of "Now".
- If the marine feed fails, the Beach screen still rates beaches from wind and weather and says so.
- The Now screen Beaches summary shows East, West and water temperature and opens the Beach screen.
- Ratings remain labelled as automated guidance, not safety advice.

## v2.2 air-quality checks
- Air screen shows AQI band, PM2.5, PM10, dust, NO₂ and ozone from live data.
- Calima outlook names the dust window and peak; bars colour by dust band in both appearances.
- Pollen shows six types, or an out-of-season message when CAMS returns no pollen.
- Air quality, Calima and Pollen alerts respect their toggles and thresholds.
- Air feed failure does not block any other screen; System Health reports it.

## v2.1 radar zoom checks
- Radar zoom remains within levels 6–10 and opens at level 7 on a new device.
- +/− controls disable at the minimum and maximum levels.
- Pinch and double-tap zoom keep the Gibraltar marker centred.
- The selected zoom persists on the current device.
- Changing radar frames preserves the selected zoom.

## v2.0 notification and official-warning checks
- Notifications remain off until the user presses the notification button and grants browser permission.
- Only new Watch or Important flags trigger a notification; repeated renders of the same flags do not.
- Cached forecast fallback never creates a fresh notification.
- Selecting a service-worker notification focuses or opens GibWeather.
- The About screen links to AEMET official warnings and states that GibWeather alerts are automated guidance.
- The app explains that notifications cannot be guaranteed while the static web app is completely closed.

## 24-hour forecast checks
- The Hourly screen shows exactly the next 24 forecast hours.
- The best outdoor-period card identifies and highlights a daylight window.
- The daylight bar places sunrise and sunset markers within the correct 24-hour span.
- Every hourly row includes temperature, feels-like, rain probability and amount, wind and gusts, humidity, visibility and UV.
- Outdoor guidance remains labelled as an automated convenience guide rather than safety advice.

## Appearance and icon checks
- Automatic appearance follows the device colour scheme.
- Dark and Light choices override the device colour scheme and persist after reload.
- Forecast cards, alerts, navigation, settings and status text remain legible in both appearances.
- Browser theme colour follows the active appearance.
- Manifest, Apple touch icon, favicon and offline shell use the v4 natural-colour golden-hour icon assets.

## Smart-alert checks
- Important alerts sort above Watch and Info alerts.
- Default wind, rain, visibility, UV and Levanter thresholds retain their v1.5 behaviour.
- Likely and possible Rock Cloud signals include the expected time.
- Modelled wave heights of 2 m or more trigger rough-sea guidance; 3 m or more is Important.
- Missing marine data does not block land-weather alerts.
- Switching off a category suppresses only that alert type.
- Personal wind, rain, visibility, UV and wave thresholds control when guidance first appears.
- Switching off every category shows a paused state rather than a false all-clear.
- The header count excludes the paused/all-clear information row.

Run `node scripts/test_smart_alerts.js` for the synthetic threshold and severity-order smoke test.

## API contract checks
v1.3 specifically guards two live-data contracts:

1. **Main forecast API** must include the daily variables required by Today/7 Days: weather code, max/min temperature and apparent temperature, precipitation probability/sum, maximum wind/gust, dominant direction, UV max, sunrise and sunset.
2. **Marine API** must use Marine API daily aggregations only: wave/swell maximum heights, dominant directions and periods. Atmospheric daily variables do not belong on the Marine endpoint.

## Synthetic runtime smoke test
The v1.3 release was exercised with mocked network responses representing:
- Open-Meteo main forecast
- ECMWF
- GFS
- DWD ICON
- Open-Meteo Marine
- fresh LXGB observation

Verified results:
- current forecast renders
- Today summary renders
- 48 hourly rows render
- 7 daily rows render
- 7 marine daily rows render
- model agreement renders
- LXGB observation renders
- Sea & Strait status reports loaded
- Celsius → Fahrenheit conversion works
- km/h → mph conversion works
- zero page/runtime errors were recorded

## Before public deployment
After hosting on HTTPS, verify with real network data:
- current forecast loads without cached fallback
- Today and 7 Days populate
- Sea & Strait populates
- ECMWF/GFS/ICON has at least two providers available
- GitHub observation workflow publishes a fresh `data/lxgb-observation.json`
- Home Screen installation works on iPhone/iPad

Marine coastal/tide/current guidance must remain labelled as non-navigational model guidance.


## v1.3 radar checks
- RainViewer metadata endpoint is present and parsed only when `radar.past` has usable frames.
- Radar slider range follows the returned frame count.
- Radar imagery uses RainViewer's documented coordinate-tile form `{path}/512/z/lat/lon/2/1_1.png` at zoom 7, keeping animation requests comfortably below the public API rate limit.
- OpenStreetMap and RainViewer attribution are visible on the radar screen.
- Radar failure/offline state does not block the forecast, model, marine or LXGB observation screens.
- Hosting CSP allows the required RainViewer and OpenStreetMap hosts.

## v1.8 forecast-change tracker
- Baseline is stored only after a successful live refresh.
- Comparison uses matching future timestamps, not unrelated hourly positions.
- Temperature, peak gust, rain probability and Levanter change states are covered by a synthetic Node test.
- Offline mode labels change tracking as unavailable rather than presenting stale revisions as current.

## v1.9 LXGB verification detail
- A fresh airport observation populates four observed-vs-forecast comparison values.
- Temperature delta follows Celsius/Fahrenheit preference without adding an absolute-temperature offset.
- Wind-speed delta follows km/h or mph preference.
- Wind-direction difference uses the shortest angular separation across north (0°/360°).
- Unavailable observations clear all four delta fields.
