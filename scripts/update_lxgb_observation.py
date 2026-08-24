#!/usr/bin/env python3
"""Fetch and normalize the latest Gibraltar Airport (LXGB) METAR.

Designed for GitHub Actions. AviationWeather.gov blocks browser CORS, so GibWeather
retrieves the observation server-side and publishes a tiny same-origin JSON file.
"""
from __future__ import annotations

import calendar
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

STATION = "LXGB"
SOURCE_URL = f"https://aviationweather.gov/api/data/metar?ids={STATION}&format=raw&hours=2"
OUT = Path(__file__).resolve().parents[1] / "data" / "lxgb-observation.json"
USER_AGENT = "GibWeather/1.6 (+https://github.com/)"


def parse_signed_temp(token: str | None) -> float | None:
    if not token or token == "//":
        return None
    return -float(token[1:]) if token.startswith("M") else float(token)


def resolve_obs_time(day: int, hour: int, minute: int, now: datetime) -> datetime:
    """Resolve DDHHMMZ to the closest plausible UTC date around now."""
    candidates: list[datetime] = []
    year, month = now.year, now.month
    for offset in (-1, 0, 1):
        m = month + offset
        y = year
        while m < 1:
            m += 12
            y -= 1
        while m > 12:
            m -= 12
            y += 1
        if day <= calendar.monthrange(y, m)[1]:
            candidates.append(datetime(y, m, day, hour, minute, tzinfo=timezone.utc))
    if not candidates:
        return now
    candidates.sort(
        key=lambda dt: (
            dt > now.replace(microsecond=0) and (dt - now).total_seconds() > 7200,
            abs((dt - now).total_seconds()),
        )
    )
    return candidates[0]


def rh_from_temp_dew(temp_c: float | None, dew_c: float | None) -> float | None:
    if temp_c is None or dew_c is None:
        return None
    a, b = 17.625, 243.04
    sat = math.exp((a * temp_c) / (b + temp_c))
    act = math.exp((a * dew_c) / (b + dew_c))
    return max(0.0, min(100.0, 100.0 * act / sat))


def parse_metar(raw: str, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    raw = " ".join(raw.strip().split())
    tokens = raw.split()
    # Raw aviation feeds may prefix reports with METAR or SPECI. Normalize the
    # token stream for parsing while preserving the original report text.
    report_tokens = tokens[1:] if tokens and tokens[0] in {"METAR", "SPECI"} else tokens
    if len(report_tokens) < 3 or report_tokens[0] != STATION:
        raise ValueError(f"Not an {STATION} METAR: {raw[:80]}")
    tokens = report_tokens

    time_match = next(
        (re.fullmatch(r"(\d{2})(\d{2})(\d{2})Z", t) for t in tokens if re.fullmatch(r"\d{6}Z", t)),
        None,
    )
    if not time_match:
        raise ValueError("METAR observation time not found")
    day, hour, minute = map(int, time_match.groups())
    observed = resolve_obs_time(day, hour, minute, now)

    wind_dir = wind_kt = gust_kt = None
    variable_wind = False
    for t in tokens:
        m = re.fullmatch(r"(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT", t)
        if m:
            variable_wind = m.group(1) == "VRB"
            wind_dir = None if variable_wind else int(m.group(1))
            wind_kt = int(m.group(2))
            gust_kt = int(m.group(3)) if m.group(3) else None
            break

    visibility_m = None
    cavok = "CAVOK" in tokens
    if cavok:
        visibility_m = 10000
    else:
        for t in tokens:
            if re.fullmatch(r"\d{4}", t):
                visibility_m = 10000 if t == "9999" else int(t)
                break

    temp_c = dew_c = None
    for t in tokens:
        m = re.fullmatch(r"(M?\d{2}|//)/(M?\d{2}|//)", t)
        if m:
            temp_c = parse_signed_temp(m.group(1))
            dew_c = parse_signed_temp(m.group(2))
            break

    pressure_hpa = None
    for t in tokens:
        m = re.fullmatch(r"Q(\d{4})", t)
        if m:
            pressure_hpa = int(m.group(1))
            break

    clouds = []
    for t in tokens:
        m = re.match(r"^(FEW|SCT|BKN|OVC|VV)(\d{3}|///)", t)
        if not m:
            continue
        amount, height = m.groups()
        feet = None if height == "///" else int(height) * 100
        clouds.append({"amount": amount, "height_ft": feet})

    ceiling_candidates = [
        c["height_ft"]
        for c in clouds
        if c["amount"] in {"BKN", "OVC", "VV"} and c["height_ft"] is not None
    ]
    ceiling_ft = min(ceiling_candidates) if ceiling_candidates else None

    weather_codes = []
    wx_re = re.compile(
        r"^(?:[-+]?|VC)(?:MI|PR|BC|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|SQ|FC|SS|DS)+$"
    )
    for t in tokens:
        if wx_re.fullmatch(t):
            weather_codes.append(t)

    rh = rh_from_temp_dew(temp_c, dew_c)
    return {
        "available": True,
        "station": STATION,
        "station_name": "Gibraltar Airport",
        "observed_at": observed.isoformat().replace("+00:00", "Z"),
        "raw": raw,
        "wind_direction_deg": wind_dir,
        "variable_wind": variable_wind,
        "wind_speed_kt": wind_kt,
        "wind_gust_kt": gust_kt,
        "wind_speed_kmh": None if wind_kt is None else round(wind_kt * 1.852, 1),
        "wind_gust_kmh": None if gust_kt is None else round(gust_kt * 1.852, 1),
        "visibility_m": visibility_m,
        "visibility_10km_or_more": cavok or visibility_m == 10000,
        "temperature_c": temp_c,
        "dew_point_c": dew_c,
        "relative_humidity_pct": None if rh is None else round(rh, 1),
        "pressure_hpa": pressure_hpa,
        "clouds": clouds,
        "ceiling_ft": ceiling_ft,
        "weather_codes": weather_codes,
        "source": "AviationWeather.gov / NOAA-NWS Aviation Weather Center",
        "source_url": SOURCE_URL,
    }


def newest_metar(text: str, now: datetime) -> dict:
    parsed = []
    for line in text.splitlines():
        line = line.strip()
        if not (
            line.startswith(STATION + " ")
            or line.startswith("METAR " + STATION + " ")
            or line.startswith("SPECI " + STATION + " ")
        ):
            continue
        try:
            parsed.append(parse_metar(line, now))
        except Exception:
            continue
    if not parsed:
        raise ValueError("No parseable LXGB METAR returned")
    parsed.sort(key=lambda x: x["observed_at"], reverse=True)
    return parsed[0]


def main() -> int:
    now = datetime.now(timezone.utc)
    req = Request(SOURCE_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/plain"})
    try:
        with urlopen(req, timeout=20) as response:
            text = response.read().decode("utf-8", "replace")
        payload = newest_metar(text, now)
        payload["retrieved_at"] = now.isoformat().replace("+00:00", "Z")
    except Exception as exc:
        print(f"Observation update failed: {exc}", file=sys.stderr)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding="utf-8"))
            if old.get("raw") == payload.get("raw"):
                print("LXGB METAR unchanged; no file update needed")
                return 0
        except Exception:
            pass

    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {OUT} with {payload['observed_at']} observation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
