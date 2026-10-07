# GibWeather v2.5.3

GibWeather is a Gibraltar-first Progressive Web App for iPhone, iPad and modern browsers.

## Main features
- Current Gibraltar forecast and feels-like temperature
- Actual Gibraltar Airport (LXGB) METAR observation with forecast-vs-observation match indicator
- Detailed LXGB observed-vs-forecast differences for temperature, wind, direction and pressure
- 48-hour hourly forecast and 7-day forecast
- 24-hour temperature/rain and wind/gust charts
- Levanter / Poniente interpretation
- Experimental Rock Cloud likelihood
- ECMWF, GFS and DWD ICON wind-model comparison
- Gibraltar local forecast flags for wind, rain, visibility and UV
- Sea & Strait forecast: wave height/direction/period, swell, sea-surface temperature, ocean-current guidance and modelled sea level
- Beach guide for Eastern Beach, Catalan Bay, Sandy Bay, Western Beach, Camp Bay and Little Bay, rating each shore from onshore wind, waves, rain and air temperature
- Air quality (European AQI, PM2.5, PM10, NO₂, ozone), Saharan dust / Calima outlook and pollen forecast from CAMS via Open-Meteo
- Celsius/Fahrenheit and km/h/mph preferences
- 15/30/60-minute automatic refresh
- Offline app shell and last-known-good forecast fallback
- iPhone/iPad Home Screen PWA support
- System-health and installation-readiness checks
- Recent Gibraltar-centred rain radar history with timeline animation
- Radar zoom levels 6–10 with +/− controls, pinch and double-tap while keeping Gibraltar centred
- Direct MeteoGib link for local forecaster commentary
- Smart Gibraltar alerts with severity, timing, Rock Cloud and rough-sea guidance
- Forecast change tracker comparing temperature, peak gusts, rain risk and Levanter timing with the previous live refresh
- Per-device alert categories and personal trigger thresholds with a live header count
- Opt-in device notifications for new Watch and Important forecast flags
- Direct access to official AEMET adverse-weather warnings for the nearby Campo de Gibraltar and Strait area
- Automatic, dark and light appearances saved per device
- Crisp Rock, sun and sea Home Screen icon designed to stay legible at small sizes

## v1.2 reliability release
v1.2 corrects the live API contracts used by the app. The main Open-Meteo forecast request now explicitly asks for the daily fields needed by the Today and 7-day screens. The Open-Meteo Marine request now uses only supported marine daily aggregations (`wave_height_max`, dominant wave direction, period, and swell equivalents). A release validator is included at `scripts/validate_release.py` to guard against mixing atmospheric and marine API variables in future builds.

## Data sources
### Forecasts
GibWeather calls Open-Meteo directly from the browser. The main forecast uses Open-Meteo Best Match; wind-model comparison uses Open-Meteo ECMWF, GFS and DWD ICON endpoints; the Sea & Strait screen uses the Open-Meteo Marine Weather API, and the Beach screen adds two nearshore Marine API points, one east of Catalan Bay and one inside the Bay of Gibraltar. Open-Meteo attribution is displayed in the app under CC BY 4.0.

### Actual airport observation
GibWeather uses the Gibraltar Airport METAR station **LXGB**. The source is the NOAA/NWS Aviation Weather Center (AviationWeather.gov). Its API does not permit browser CORS requests, so `.github/workflows/update-lxgb-observation.yml` fetches and normalizes the latest METAR server-side and publishes `data/lxgb-observation.json` for the app to read from its own origin.

The observation is an airport measurement and can differ from conditions elsewhere in Gibraltar.

## Important limitations
The Levanter, Rock Cloud, forecast-confidence, forecast-match and local-advisory features are GibWeather heuristics and are not official warnings. Marine tides/currents and coastal values are model guidance only and must not be used for navigation or safety-critical decisions.

MeteoGib is linked as an independent local forecaster. GibWeather does not scrape or republish MeteoGib forecasts and is not affiliated with MeteoGib.

## Run locally
Service workers require HTTP/HTTPS. From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

The bundled `data/lxgb-observation.json` is an unavailable placeholder until the GitHub observation updater has run. For local testing, replace it temporarily with a normalized observation or mock the request.

## Validate the release

```bash
python3 scripts/validate_release.py
```

This checks JavaScript syntax, custom-alert behavior, manifest/version consistency, HTML/JavaScript DOM references, app-shell files, deployment JSON/TOML, the main daily forecast contract, the Marine API daily contract, and the LXGB updater configuration.

## Deploy
GibWeather is a static app. Deployment configurations are included for GitHub Pages, Netlify and Vercel. See `DEPLOY.md`.

## Release status
v2.5 groups Sea, Beach and Air under one Outdoors tab, adds tide times and thunderstorm risk, adds optional background alerts sent by a GitHub Actions job, and runs the release checks automatically on every pull request.

v2.4 rates beaches with nearshore wave forecasts for each side of the Rock, adds opt-in Beach day alerts, rates strong or gusty wind more cautiously even when it blows offshore, and introduces a new home screen icon.

v2.3 adds the Beach screen: a best-bet beach, per-beach ratings for both sides of the Rock, an east-vs-west hourly comparison, a 3-day beach outlook and a Beaches summary on the Now screen.

v2.2 adds the Air screen: air quality, a 48-hour Calima (Saharan dust) outlook, pollen levels and matching custom alerts.

v2.1 adds Gibraltar-centred radar zoom levels 6–10 with accessible +/− buttons, pinch and double-tap controls, plus a saved per-device zoom preference. It preserves v2.0 notifications and official-warning access along with the existing forecast, observation, marine and model-comparison features.


## Rain radar (v1.3)
The Radar screen loads recent precipitation imagery from RainViewer's public Weather Maps API and layers it over OpenStreetMap tiles. It shows observational history rather than future radar nowcasts. The imagery is loaded only while online and is not part of the offline forecast cache.
