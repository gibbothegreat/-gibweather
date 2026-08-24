# GibWeather v1.6 QA

## Release validation
Run:

```bash
python3 scripts/validate_release.py
```

Expected result: `GibWeather v1.6 release validation passed`.

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
