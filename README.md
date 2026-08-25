# GibWeather v1.6.1

GibWeather is a Gibraltar-first Progressive Web App for iPhone, iPad and modern browsers.

## Main features
- Current Gibraltar forecast and feels-like temperature
- Actual Gibraltar Airport (LXGB) METAR observation with forecast-vs-observation match indicator
- 48-hour hourly forecast and 7-day forecast
- 24-hour temperature/rain and wind/gust charts
- Levanter / Poniente interpretation
- Experimental Rock Cloud likelihood
- ECMWF, GFS and DWD ICON wind-model comparison
- Gibraltar local forecast flags for wind, rain, visibility and UV
- Sea & Strait forecast: wave height/direction/period, swell, sea-surface temperature, ocean-current guidance and modelled sea level
- Celsius/Fahrenheit and km/h/mph preferences
- 15/30/60-minute automatic refresh
- Offline app shell and last-known-good forecast fallback
- iPhone/iPad Home Screen PWA support
- System-health and installation-readiness checks
- Recent Gibraltar-centred rain radar history with timeline animation
- Direct MeteoGib link for local forecaster commentary
- Smart Gibraltar alerts with severity, timing, Rock Cloud and rough-sea guidance
- Per-device alert categories and personal trigger thresholds with a live header count
- Automatic, dark and light appearances saved per device
- Red-and-white Rock and cloud icon with a yellow sun

## v1.2 reliability release
v1.2 corrects the live API contracts used by the app. The main Open-Meteo forecast request now explicitly asks for the daily fields needed by the Today and 7-day screens. The Open-Meteo Marine request now uses only supported marine daily aggregations (`wave_height_max`, dominant wave direction, period, and swell equivalents). A release validator is included at `scripts/validate_release.py` to guard against mixing atmospheric and marine API variables in future builds.

## Data sources
### Forecasts
GibWeather calls Open-Meteo directly from the browser. The main forecast uses Open-Meteo Best Match; wind-model comparison uses Open-Meteo ECMWF, GFS and DWD ICON endpoints; the Sea & Strait screen uses the Open-Meteo Marine Weather API. Open-Meteo attribution is displayed in the app under CC BY 4.0.

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
v1.6.1 adds automatic, dark and light appearances plus the selected yellow-sun GibWeather icon. It retains v1.6 custom alert categories, personal thresholds and the live header count alongside the local narrative, timelines, radar, LXGB observation, marine and model-comparison features.


## Rain radar (v1.3)
The Radar screen loads recent precipitation imagery from RainViewer's public Weather Maps API and layers it over OpenStreetMap tiles. It shows observational history rather than future radar nowcasts. The imagery is loaded only while online and is not part of the offline forecast cache.
