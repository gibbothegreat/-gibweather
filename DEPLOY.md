# GibWeather deployment

## Recommended: GitHub Pages
1. Create a repository named `gibweather` with the default branch `main`.
2. Copy the contents of this folder into the repository root and push to `main`.
3. In GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. The included `.github/workflows/pages.yml` publishes the static PWA over HTTPS.
5. The included `.github/workflows/update-lxgb-observation.yml` runs at minutes 23 and 53 each hour and updates `data/lxgb-observation.json` when a new Gibraltar Airport METAR is available.
6. Run **Update Gibraltar Airport observation** manually once from the Actions tab after first deployment so the live airport card is populated immediately.
7. Open the GitHub Pages URL in Safari on iPhone/iPad and use **Add to Home Screen → Open as Web App**.

### GitHub permissions
The observation updater needs repository `contents: write` so the GitHub Actions bot can commit the refreshed JSON file. This permission is scoped in the workflow itself. If repository settings disallow Actions from writing, enable **Settings → Actions → General → Workflow permissions → Read and write permissions**.

## Netlify / Vercel
The static app itself can also be deployed to Netlify or Vercel using the included configuration files. The LXGB observation updater is a GitHub Actions workflow, so the source repository should still live on GitHub if you want the automatic airport observation feed. The generated `data/lxgb-observation.json` will then be part of each redeployment/pull from GitHub.

## Observation freshness
The app requests the observation JSON with browser caching disabled and the service worker uses network-first behaviour. Host configuration files also mark the observation JSON `no-cache`. GibWeather labels observations older than 90 minutes as older and considers them degraded in System Health after 120 minutes.

## Files required at the web root
- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- `version.json`
- `data/lxgb-observation.json`
- `icons/`

For GitHub-based observation updates also keep:
- `scripts/update_lxgb_observation.py`
- `.github/workflows/update-lxgb-observation.yml`
- `.github/workflows/pages.yml`


## External radar hosts
Production security headers must allow `https://api.rainviewer.com` in `connect-src`, and `https://*.rainviewer.com` plus `https://tile.openstreetmap.org` in `img-src`. The included Netlify/Vercel/header files are already configured.
