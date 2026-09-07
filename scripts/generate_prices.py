#!/usr/bin/env python3
import argparse
import html
import json
import math
import os
import re
import sys
import tempfile
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import exchange_calendars as xcals
import requests
import yfinance as yf
from pykrx import stock

KST = ZoneInfo("Asia/Seoul")
NEW_YORK = ZoneInfo("America/New_York")
NAVER_STOCK_CATEGORIES = ("KOSPI", "KOSDAQ")
NAVER_ETX_CATEGORIES = ("etf", "etn")
NAVER_PAGE_SIZE = 100
NAVER_KOSPI_CHART_URL = "https://api.stock.naver.com/chart/domestic/index/KOSPI/day"
NAVER_KOSPI_BASIC_URL = "https://m.stock.naver.com/api/index/KOSPI/basic"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
NASDAQ_SYMBOL_URLS = (
    "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
    "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
)
MIN_KRX_PRICE_COUNT = 3000
MIN_US_SUCCESS_RATE = 0.75
MIN_US_SUCCESS_COUNT = 3
MIN_USDKRW_RATE = 500
MAX_USDKRW_RATE = 3000
MAX_PRICE_AGE_DAYS = 7
MAX_PRICE_FUTURE_DAYS = 0
DEFAULT_SYMBOLS_FILENAME = "symbols.json"
KOSPI_BENCHMARK_SYMBOL = "^KS11"
SP500_BENCHMARK_SYMBOL = "^GSPC"
PRICE_BASIS = "unadjusted_close"
BENCHMARK_PRICE_BASIS = "price_index_level"
DISTRIBUTION_TREATMENT = "excluded"
VALUATION_TIMING = "LATEST_COMPLETED_SESSION"
FINAL_CLOSE_STATUS = "FINAL_CLOSE"
KRX_CLOSE_CONFIRMATION_DELAY = timedelta(minutes=10)
US_CLOSE_CONFIRMATION_DELAY = timedelta(minutes=15)
FX_CLOSE_CONFIRMATION_DELAY = timedelta(minutes=15)


class PriceQualityError(RuntimeError):
    pass


def normalize_krx_ticker(ticker):
    value = str(ticker or "").strip().upper()
    return value.zfill(6) if value.isdigit() else value


def normalize_us_ticker(ticker):
    return str(ticker or "").strip().upper().replace("/", "-")


def read_tickers(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {
        "KRX": [normalize_krx_ticker(ticker) for ticker in data.get("KRX", []) if str(ticker).strip()],
        "US": [normalize_us_ticker(ticker) for ticker in data.get("US", []) if str(ticker).strip()]
    }


def parse_price(value):
    text = str(value or "").strip().replace(",", "")
    if not text or text.upper() == "N/A" or text == "-":
        return None
    try:
        price = float(text)
    except ValueError:
        return None
    return price if price > 0 else None


def parse_number(value):
    text = "" if value is None else str(value).strip().replace(",", "")
    if not text or text.upper() == "N/A" or text == "-":
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def parse_calendar_date(value):
    if not isinstance(value, str) or re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is None:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_trade_date(value):
    text = str(value or "").strip()
    candidate = text[:10] if len(text) >= 10 else text
    return candidate if parse_calendar_date(candidate) else None


def parse_compact_trade_date(value):
    text = str(value or "").strip()
    if re.fullmatch(r"\d{8}", text) is None:
        return None
    candidate = f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return candidate if parse_calendar_date(candidate) else None


def resolve_aware_now(now=None):
    if now is None:
        return datetime.now(timezone.utc)
    if not isinstance(now, datetime):
        raise ValueError("now must be a datetime")
    return now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)


def utc_iso(value):
    return resolve_aware_now(value).astimezone(timezone.utc).isoformat(
        timespec="seconds"
    ).replace("+00:00", "Z")


def parse_market_time(value):
    text = str(value or "").strip()
    if re.fullmatch(r"\d{4}", text) is None:
        return None
    try:
        return time(int(text[:2]), int(text[2:]))
    except ValueError:
        return None


def exchange_calendar_session_evidence(
    calendar_name,
    now=None,
    confirmation_delay=timedelta(0),
    lookaround_days=14
):
    """Resolve completed/next sessions from an exchange calendar, not quote rows."""
    instant = resolve_aware_now(now).astimezone(timezone.utc)
    window_start = instant.date() - timedelta(days=max(lookaround_days, 7))
    window_end = instant.date() + timedelta(days=max(lookaround_days, 7))
    calendar = xcals.get_calendar(calendar_name)
    schedule = calendar.schedule.loc[window_start.isoformat():window_end.isoformat()]

    cutoffs = []
    for session_label, row in schedule.iterrows():
        session_date = session_label.date()
        close_value = row.get("close")
        if close_value is None or not hasattr(close_value, "to_pydatetime"):
            continue
        close_at = close_value.to_pydatetime()
        if close_at.tzinfo is None:
            close_at = close_at.replace(tzinfo=timezone.utc)
        cutoff_at = close_at.astimezone(timezone.utc) + confirmation_delay
        cutoffs.append((session_date, cutoff_at))

    completed = [candidate for candidate in cutoffs if candidate[1] <= instant]
    upcoming = [candidate for candidate in cutoffs if candidate[1] > instant]
    if not completed or not upcoming:
        raise RuntimeError(f"{calendar_name} session calendar window is incomplete")

    completed_session, _ = max(completed, key=lambda candidate: candidate[1])
    _, next_cutoff = min(upcoming, key=lambda candidate: candidate[1])
    return {
        "completedSession": completed_session.isoformat(),
        "nextCutoffAt": utc_iso(next_cutoff)
    }


def latest_completed_us_session_evidence(now=None):
    return exchange_calendar_session_evidence(
        "XNYS",
        now=now,
        confirmation_delay=US_CLOSE_CONFIRMATION_DELAY
    )


def adjacent_weekday(value, step):
    candidate = value + timedelta(days=step)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=step)
    return candidate


def fx_session_evidence_from_metadata(metadata, now=None):
    """Resolve Yahoo's completed FX day from its advertised trading period.

    KRW=X is published on Yahoo's CCY venue in the Europe/London timezone. Its
    daily row is already present while that venue's roughly 24-hour period is
    still open, so the row date itself cannot certify a final close.
    """
    if not isinstance(metadata, dict):
        raise RuntimeError("Yahoo FX session metadata is missing")
    if metadata.get("symbol") != "KRW=X" or metadata.get("instrumentType") != "CURRENCY":
        raise RuntimeError("Yahoo FX session metadata identifies an unexpected instrument")

    timezone_name = str(metadata.get("exchangeTimezoneName") or "").strip()
    try:
        market_zone = ZoneInfo(timezone_name)
    except (KeyError, ValueError) as error:
        raise RuntimeError("Yahoo FX session timezone is invalid") from error

    regular = (metadata.get("currentTradingPeriod") or {}).get("regular")
    if not isinstance(regular, dict):
        raise RuntimeError("Yahoo FX regular trading period is missing")
    try:
        start_at = datetime.fromtimestamp(int(regular.get("start")), timezone.utc)
        end_at = datetime.fromtimestamp(int(regular.get("end")), timezone.utc)
    except (TypeError, ValueError, OSError) as error:
        raise RuntimeError("Yahoo FX regular trading period timestamps are invalid") from error
    if not start_at < end_at or not timedelta(hours=20) <= end_at - start_at <= timedelta(hours=26):
        raise RuntimeError("Yahoo FX regular trading period duration is invalid")

    instant = resolve_aware_now(now).astimezone(timezone.utc)
    session_end_local = end_at.astimezone(market_zone)
    session_date = session_end_local.date()
    if session_date.weekday() >= 5 or abs((session_date - instant.astimezone(market_zone).date()).days) > 4:
        raise RuntimeError("Yahoo FX regular trading period date is implausible")

    # Yahoo reports the timestamp of the final included minute. The actual
    # boundary is one minute later, then we wait for the publication buffer.
    close_boundary = end_at + timedelta(minutes=1)
    cutoff_at = close_boundary + FX_CLOSE_CONFIRMATION_DELAY
    if instant < cutoff_at:
        previous_session = adjacent_weekday(session_date, -1)
        previous_confirmation = start_at + FX_CLOSE_CONFIRMATION_DELAY
        consecutive_session = (session_date - previous_session).days == 1
        if consecutive_session and instant < previous_confirmation:
            # The provider may roll metadata to the next day as soon as the old
            # period ends. Keep the old day uncertified during its publication
            # buffer instead of treating the rollover itself as close evidence.
            completed_session = adjacent_weekday(previous_session, -1)
            next_cutoff = previous_confirmation
        else:
            completed_session = previous_session
            next_cutoff = cutoff_at
    else:
        completed_session = session_date
        next_session = adjacent_weekday(session_date, 1)
        next_end_local = datetime.combine(
            next_session,
            session_end_local.timetz().replace(tzinfo=None),
            tzinfo=market_zone
        )
        next_cutoff = (
            next_end_local.astimezone(timezone.utc)
            + timedelta(minutes=1)
            + FX_CLOSE_CONFIRMATION_DELAY
        )

    if next_cutoff <= instant:
        raise RuntimeError("Yahoo FX next close cutoff is not in the future")
    return {
        "completedSession": completed_session.isoformat(),
        "nextCutoffAt": utc_iso(next_cutoff)
    }


def fetch_latest_completed_fx_session_evidence(now=None):
    response = requests.get(
        YAHOO_CHART_URL.format(symbol="KRW=X"),
        params={"interval": "1d", "range": "5d"},
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=20
    )
    response.raise_for_status()
    payload = response.json()
    chart = payload.get("chart") if isinstance(payload, dict) else None
    results = chart.get("result") if isinstance(chart, dict) else None
    metadata = results[0].get("meta") if isinstance(results, list) and results and isinstance(results[0], dict) else None
    return fx_session_evidence_from_metadata(metadata, now=now)


def is_positive_finite_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number) and number > 0


def resolve_quality_date(today):
    if today is None:
        return datetime.now(KST).date()
    if isinstance(today, datetime):
        return today.date()
    if isinstance(today, date):
        return today
    parsed = parse_calendar_date(today)
    if parsed:
        return parsed
    raise ValueError("today must be a valid YYYY-MM-DD date")


def is_fresh_date(value, today):
    trade_date = parse_calendar_date(value)
    if not trade_date:
        return False
    age_days = (today - trade_date).days
    return -MAX_PRICE_FUTURE_DAYS <= age_days <= MAX_PRICE_AGE_DAYS


def is_valid_price_entry(entry, today):
    return (
        isinstance(entry, dict)
        and is_positive_finite_number(entry.get("close"))
        and is_fresh_date(entry.get("date"), today)
        and entry.get("sessionStatus") == FINAL_CLOSE_STATUS
    )


def price_methodology_metadata():
    """Describe exactly what the generated market values do and do not include."""
    return {
        "priceBasis": PRICE_BASIS,
        "distributionTreatment": DISTRIBUTION_TREATMENT,
        "totalReturn": False,
        "valuationTiming": VALUATION_TIMING,
        "benchmarkBasis": BENCHMARK_PRICE_BASIS,
        "quoteCurrencyByMarket": {
            "KRX": "KRW",
            "US": "USD"
        }
    }


def latest_entry_date(entries):
    dates = [
        parse_calendar_date(entry.get("date"))
        for entry in (entries or {}).values()
        if isinstance(entry, dict)
    ]
    valid_dates = [value for value in dates if value]
    return max(valid_dates).isoformat() if valid_dates else None


def build_final_close_certificate(
    output,
    generated_at,
    market_sessions=None,
    valid_until_by_market=None,
    now=None
):
    # `market_sessions` must come from independent calendars/session-state probes.
    # Never infer certification dates from the output rows being certified.
    sessions = market_sessions if isinstance(market_sessions, dict) else {}
    if not isinstance(valid_until_by_market, dict):
        raise ValueError("market-specific final-close validity evidence is required")
    validity = valid_until_by_market
    normalized_validity = {
        market: validity.get(market) if isinstance(validity.get(market), str) else None
        for market in ("KRX", "US", "FX")
    }
    parsed_validity = [
        parse_iso_instant(value)
        for value in normalized_validity.values()
    ]
    global_valid_until = (
        utc_iso(min(parsed_validity))
        if all(value is not None for value in parsed_validity)
        else None
    )
    return {
        "status": FINAL_CLOSE_STATUS,
        "checkedAt": generated_at,
        # Retained for older clients; current clients validate only held markets.
        "validUntil": global_valid_until,
        "validUntilByMarket": normalized_validity,
        "marketSessions": {
            market: parse_trade_date(sessions.get(market))
            for market in ("KRX", "US", "FX")
        }
    }


def parse_iso_instant(value):
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def final_close_contract_failures(output):
    failures = []
    methodology = output.get("methodology")
    if not isinstance(methodology, dict) or methodology.get("valuationTiming") != VALUATION_TIMING:
        failures.append("methodology valuation timing is not certified")

    certificate = output.get("finalCloseCertificate")
    if not isinstance(certificate, dict) or certificate.get("status") != FINAL_CLOSE_STATUS:
        failures.append("final close certificate is missing or invalid")
        return failures

    checked_at = parse_iso_instant(certificate.get("checkedAt"))
    valid_until = parse_iso_instant(certificate.get("validUntil"))
    generated_at = parse_iso_instant(output.get("generatedAt"))
    if not checked_at or not valid_until or not generated_at:
        failures.append("final close certificate timestamps are invalid")
    else:
        if checked_at != generated_at:
            failures.append("final close certificate checkedAt does not match generatedAt")
        if valid_until <= checked_at:
            failures.append("final close certificate validUntil is not after checkedAt")

    valid_until_by_market = certificate.get("validUntilByMarket")
    if not isinstance(valid_until_by_market, dict):
        failures.append("final close certificate market validity timestamps are missing")
    else:
        parsed_market_validity = {
            market: parse_iso_instant(valid_until_by_market.get(market))
            for market in ("KRX", "US", "FX")
        }
        if any(value is None for value in parsed_market_validity.values()):
            failures.append("final close certificate market validity timestamps are invalid")
        elif checked_at:
            expired_at_creation = [
                market for market, value in parsed_market_validity.items()
                if value <= checked_at
            ]
            if expired_at_creation:
                failures.append(
                    "final close certificate market validity is not after checkedAt"
                )
            if valid_until and valid_until != min(parsed_market_validity.values()):
                failures.append(
                    "final close certificate validUntil does not match earliest market validity"
                )

    sessions = certificate.get("marketSessions")
    if not isinstance(sessions, dict):
        failures.append("final close certificate market sessions are missing")
        return failures
    parsed_sessions = {
        market: parse_calendar_date(sessions.get(market))
        for market in ("KRX", "US", "FX")
    }
    if any(value is None for value in parsed_sessions.values()):
        failures.append("final close certificate market session dates are invalid")
        return failures
    if checked_at:
        local_dates = {
            "KRX": checked_at.astimezone(KST).date(),
            "US": checked_at.astimezone(NEW_YORK).date(),
            "FX": checked_at.astimezone(NEW_YORK).date()
        }
        for market, session_date in parsed_sessions.items():
            if session_date > local_dates[market]:
                failures.append(
                    f"{market} certified session is after the certificate check date"
                )

    for market in ("KRX", "US"):
        market_prices = output.get("prices", {}).get(market, {})
        uncertified = [
            ticker for ticker, entry in market_prices.items()
            if not isinstance(entry, dict) or entry.get("sessionStatus") != FINAL_CLOSE_STATUS
        ]
        if uncertified:
            failures.append(f"{market} contains uncertified price entries")
        market_latest = latest_entry_date(market_prices)
        expected_session = sessions.get(market)
        if market_prices and market_latest != expected_session:
            failures.append(
                f"{market} latest price date does not match independently verified session"
            )
        for ticker, entry in market_prices.items():
            entry_date = parse_calendar_date(entry.get("date")) if isinstance(entry, dict) else None
            if entry_date and entry_date > parsed_sessions[market]:
                failures.append(f"{market} {ticker} price date exceeds certified market session")
                break
    fx_entry = output.get("fx", {}).get("USDKRW")
    if isinstance(fx_entry, dict):
        fx_date = parse_calendar_date(fx_entry.get("date"))
        if fx_date and fx_date != parsed_sessions["FX"]:
            failures.append("USDKRW date does not match certified FX session")
    return failures


def build_benchmark_entry(name, symbol, level, trade_date, source, quote_currency):
    return {
        "name": name,
        "symbol": symbol,
        "level": float(level),
        "levelUnit": "index_points",
        "quoteCurrency": quote_currency,
        "date": trade_date,
        "source": source,
        "priceBasis": BENCHMARK_PRICE_BASIS,
        "distributionTreatment": DISTRIBUTION_TREATMENT,
        "totalReturn": False,
        "sessionStatus": FINAL_CLOSE_STATUS
    }


def is_valid_benchmark_entry(entry, today=None):
    quality_date = resolve_quality_date(today)
    return (
        isinstance(entry, dict)
        and is_positive_finite_number(entry.get("level"))
        and is_fresh_date(entry.get("date"), quality_date)
        and entry.get("levelUnit") == "index_points"
        and entry.get("quoteCurrency") in {"KRW", "USD"}
        and entry.get("priceBasis") == BENCHMARK_PRICE_BASIS
        and entry.get("distributionTreatment") == DISTRIBUTION_TREATMENT
        and entry.get("totalReturn") is False
        and entry.get("sessionStatus") == FINAL_CLOSE_STATUS
    )


def validate_price_quality(
    output,
    tickers,
    min_krx_count=MIN_KRX_PRICE_COUNT,
    min_us_success_rate=MIN_US_SUCCESS_RATE,
    min_us_success_count=MIN_US_SUCCESS_COUNT,
    today=None
):
    quality_date = resolve_quality_date(today)
    failures = final_close_contract_failures(output)
    krx_prices = output.get("prices", {}).get("KRX", {})
    valid_krx_count = sum(
        1 for entry in krx_prices.values()
        if is_valid_price_entry(entry, quality_date)
    )
    if valid_krx_count < min_krx_count:
        failures.append(
            f"KRX fresh price count {valid_krx_count} is below minimum {min_krx_count}"
        )

    usdkrw = output.get("fx", {}).get("USDKRW")
    usdkrw_rate = usdkrw.get("rate") if isinstance(usdkrw, dict) else None
    usdkrw_date = usdkrw.get("date") if isinstance(usdkrw, dict) else None
    if (
        not is_positive_finite_number(usdkrw_rate)
        or not MIN_USDKRW_RATE <= float(usdkrw_rate) <= MAX_USDKRW_RATE
        or not is_fresh_date(usdkrw_date, quality_date)
        or not isinstance(usdkrw, dict)
        or usdkrw.get("sessionStatus") != FINAL_CLOSE_STATUS
    ):
        failures.append("USDKRW is missing, stale, or outside the valid date/rate range")

    requested_us = sorted({
        normalize_us_ticker(ticker)
        for ticker in tickers.get("US", [])
        if normalize_us_ticker(ticker)
    })
    us_prices = output.get("prices", {}).get("US", {})
    successful_us = [
        ticker for ticker in requested_us
        if is_valid_price_entry(us_prices.get(ticker), quality_date)
    ]
    required_us_count = 0
    if requested_us:
        required_by_rate = math.ceil(len(requested_us) * min_us_success_rate)
        required_us_count = max(
            min(len(requested_us), min_us_success_count),
            required_by_rate
        )
        if len(successful_us) < required_us_count:
            failures.append(
                "US baseline fresh price coverage "
                f"{len(successful_us)}/{len(requested_us)} is below required "
                f"{required_us_count}/{len(requested_us)}"
            )

    if failures:
        raise PriceQualityError("; ".join(failures))

    return {
        "krx": valid_krx_count,
        "usdkrw": float(usdkrw_rate),
        "usRequested": len(requested_us),
        "usSucceeded": len(successful_us),
        "usRequired": required_us_count
    }


def default_symbols_output(output_path):
    return Path(output_path).with_name(DEFAULT_SYMBOLS_FILENAME)


def build_price_artifacts(output, output_path, symbols_output_path):
    generated_at = output.get("generatedAt")
    if not isinstance(generated_at, str) or not generated_at:
        raise ValueError("generatedAt is required for price artifacts")

    output_path = Path(output_path)
    symbols_output_path = Path(symbols_output_path)
    symbol_file = os.path.relpath(symbols_output_path, start=output_path.parent)

    prices_payload = {
        "generatedAt": generated_at,
        "methodology": price_methodology_metadata(),
        "finalCloseCertificate": output.get("finalCloseCertificate"),
        "fx": output.get("fx", {}),
        "prices": output.get("prices", {"KRX": {}, "US": {}}),
        "benchmarks": output.get("benchmarks", {}),
        "errors": output.get("errors", []),
        "symbolFile": Path(symbol_file).as_posix(),
        "symbolsGeneratedAt": generated_at
    }
    symbols_payload = {
        "generatedAt": generated_at,
        "symbols": output.get("symbols", {"KRX": {}, "US": {}})
    }
    return prices_payload, symbols_payload


def write_temp_file(target, content):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(
        dir=target.parent,
        prefix=f".{target.name}.",
        suffix=".tmp",
        text=True
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as temp_file:
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())
    except Exception:
        Path(temp_name).unlink(missing_ok=True)
        raise
    return Path(temp_name)


def atomic_write_price_artifacts(prices_payload, symbols_payload, output_path, symbols_output_path):
    output_path = Path(output_path)
    symbols_output_path = Path(symbols_output_path)
    if output_path.absolute() == symbols_output_path.absolute():
        raise ValueError("price and symbol outputs must use different paths")

    prices_text = json.dumps(
        prices_payload,
        ensure_ascii=False,
        indent=2,
        sort_keys=True
    ) + "\n"
    symbols_text = json.dumps(
        symbols_payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True
    )

    temp_files = {}
    try:
        temp_files[output_path] = write_temp_file(output_path, prices_text)
        temp_files[symbols_output_path] = write_temp_file(symbols_output_path, symbols_text)

        # The symbol dependency is replaced first and the prices manifest last.
        # Each replace is atomic, so readers never observe a partially written JSON file.
        os.replace(temp_files.pop(symbols_output_path), symbols_output_path)
        os.replace(temp_files.pop(output_path), output_path)
    finally:
        for temp_path in temp_files.values():
            temp_path.unlink(missing_ok=True)


def publish_price_artifacts(
    output,
    tickers,
    output_path,
    symbols_output_path,
    quality_options=None
):
    quality = validate_price_quality(output, tickers, **(quality_options or {}))
    prices_payload, symbols_payload = build_price_artifacts(
        output,
        output_path,
        symbols_output_path
    )
    atomic_write_price_artifacts(
        prices_payload,
        symbols_payload,
        output_path,
        symbols_output_path
    )
    return quality


def clean_name(value):
    if value is None:
        return None
    if hasattr(value, "empty") and value.empty:
        return None
    text = str(value).strip()
    if not text or text.startswith("Empty DataFrame"):
        return None
    return text


def fetch_naver_krx_name(ticker):
    response = requests.get(
        f"https://finance.naver.com/item/main.naver?code={ticker}",
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=10
    )
    response.raise_for_status()
    page = response.text

    match = re.search(r"<title>(.*?)</title>", page, re.IGNORECASE | re.DOTALL)
    if not match:
        return None

    title = html.unescape(re.sub(r"\s+", " ", match.group(1))).strip()
    name = re.sub(r"\s*:\s*(Npay|네이버페이)\s*증권\s*$", "", title).strip()
    return name or None


def fetch_krx_market_state():
    response = requests.get(
        NAVER_KOSPI_BASIC_URL,
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"},
        timeout=20
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("KRX market state response is invalid")

    exchange = payload.get("stockExchangeType")
    market_end = parse_market_time(exchange.get("endTime")) if isinstance(exchange, dict) else None
    trade_date = parse_trade_date(payload.get("localTradedAt"))
    market_status = str(payload.get("marketStatus") or "").strip().upper()
    if not market_end or not trade_date or not market_status:
        raise RuntimeError("KRX market state is incomplete")
    return {
        "marketStatus": market_status,
        "tradeDate": trade_date,
        "marketEnd": market_end
    }


def krx_market_cutoff_at(session_date, market_end):
    return datetime.combine(
        session_date,
        market_end,
        tzinfo=KST
    ).astimezone(timezone.utc) + KRX_CLOSE_CONFIRMATION_DELAY


def fetch_latest_completed_krx_session_evidence(now=None, lookback_days=14):
    instant = resolve_aware_now(now)
    local_now = instant.astimezone(KST)
    end_date = local_now.date()
    start_date = end_date - timedelta(days=max(lookback_days, 7))
    response = requests.get(
        NAVER_KOSPI_CHART_URL,
        params={
            "startDateTime": start_date.strftime("%Y%m%d0000"),
            "endDateTime": end_date.strftime("%Y%m%d2359")
        },
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"},
        timeout=20
    )
    response.raise_for_status()
    rows = response.json()
    if not isinstance(rows, list):
        raise RuntimeError("KRX session calendar response is invalid")
    sessions = [
        parse_calendar_date(parse_compact_trade_date(row.get("localDate")))
        for row in rows
        if isinstance(row, dict)
    ]
    sessions = sorted({session for session in sessions if session and session <= end_date})
    if not sessions:
        raise RuntimeError("no KRX session was found")

    market_state = fetch_krx_market_state()
    market_trade_date = parse_calendar_date(market_state["tradeDate"])
    today_cutoff = krx_market_cutoff_at(end_date, market_state["marketEnd"])
    today_is_final = (
        end_date in sessions
        and market_trade_date == end_date
        and market_state["marketStatus"] == "CLOSE"
        and instant >= today_cutoff
    )
    if end_date in sessions and instant >= today_cutoff and not today_is_final:
        raise RuntimeError("KRX completed session is not confirmed by the live market state")
    completed = [
        session for session in sessions
        if session < end_date or (session == end_date and today_is_final)
    ]
    if not completed:
        raise RuntimeError("no completed KRX session was found")

    calendar_evidence = exchange_calendar_session_evidence(
        "XKRX",
        now=instant,
        confirmation_delay=KRX_CLOSE_CONFIRMATION_DELAY,
        lookaround_days=max(lookback_days, 14)
    )
    next_cutoff_at = calendar_evidence["nextCutoffAt"]
    # XKRX does not encode every one-off delayed close. The live index state does.
    if end_date in sessions and not today_is_final and today_cutoff > instant:
        next_cutoff_at = utc_iso(today_cutoff)

    return {
        "completedSession": max(completed).isoformat(),
        "nextCutoffAt": next_cutoff_at
    }


def fetch_latest_completed_krx_session(now=None, lookback_days=14):
    return fetch_latest_completed_krx_session_evidence(
        now=now,
        lookback_days=lookback_days
    )["completedSession"]


def build_krx_price_entry(item, source, completed_session_date, now=None):
    ticker = normalize_krx_ticker(item.get("itemCode") or item.get("itemcode") or item.get("reutersCode"))
    close = parse_price(item.get("closePrice") or item.get("nowVal"))
    name = clean_name(item.get("stockName") or item.get("itemname"))
    item_date = parse_trade_date(item.get("localTradedAt"))
    completed_date = parse_calendar_date(completed_session_date)

    if not ticker or not close or not item_date or not completed_date:
        return None

    item_calendar_date = parse_calendar_date(item_date)
    if not item_calendar_date:
        return None
    current_date = resolve_aware_now(now).astimezone(KST).date()
    if (
        item_calendar_date == completed_date
        and item_calendar_date == current_date
        and str(item.get("marketStatus") or "").strip().upper() != "CLOSE"
    ):
        return None
    if item_calendar_date > completed_date:
        if item_calendar_date != current_date:
            return None
        change = parse_number(item.get("compareToPreviousClosePrice"))
        if change is None:
            return None
        close = close - change
        if not is_positive_finite_number(close):
            return None
        item_date = completed_session_date

    return ticker, {
        "close": float(close),
        "date": item_date,
        "kind": kind_from_source(source),
        "name": name,
        "source": source,
        "sessionStatus": FINAL_CLOSE_STATUS
    }


def kind_from_source(source):
    source_text = str(source or "").upper()
    if "ETF" in source_text:
        return "ETF"
    if "ETN" in source_text:
        return "ETN"
    return "STOCK"


def fetch_naver_category_prices(path, source, completed_session_date, now=None):
    prices = {}
    page = 1
    total_count = None

    while total_count is None or len(prices) < total_count:
        response = requests.get(
            f"https://m.stock.naver.com/api/stocks/{path}",
            params={"page": page, "pageSize": NAVER_PAGE_SIZE},
            headers={"User-Agent": "Mozilla/5.0", "Referer": "https://m.stock.naver.com/"},
            timeout=20
        )
        response.raise_for_status()
        data = response.json()
        stocks = data.get("stocks") or []
        total_count = int(data.get("totalCount") or len(stocks))

        if not stocks:
            break

        for item in stocks:
            entry = build_krx_price_entry(item, source, completed_session_date, now=now)
            if entry:
                ticker, price = entry
                prices[ticker] = price

        page += 1

    return prices


def fetch_all_krx_prices(completed_session_date, now=None):
    prices = {}

    for category in NAVER_STOCK_CATEGORIES:
        prices.update(fetch_naver_category_prices(
            f"marketValue/{category}",
            f"KRX {category}",
            completed_session_date,
            now=now
        ))

    for category in NAVER_ETX_CATEGORIES:
        prices.update(fetch_naver_category_prices(
            category,
            f"KRX {category.upper()}",
            completed_session_date,
            now=now
        ))

    return prices


def fetch_krx_name(ticker):
    for fetcher in (stock.get_market_ticker_name, stock.get_etf_ticker_name, stock.get_etn_ticker_name):
        try:
            name = clean_name(fetcher(ticker))
        except Exception:
            name = None
        if name:
            return name

    try:
        return clean_name(fetch_naver_krx_name(ticker))
    except Exception:
        return None


def fetch_krx_close(ticker, lookback_days, completed_session_date):
    end = parse_calendar_date(completed_session_date)
    if not end:
        return None
    start = end.fromordinal(end.toordinal() - lookback_days)
    frame = stock.get_market_ohlcv_by_date(start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), ticker)

    if frame.empty or "종가" not in frame:
        return None

    closes = frame["종가"].dropna()
    closes = closes[closes > 0]
    if closes.empty:
        return None

    last_date = closes.index[-1]
    return {
        "close": float(closes.iloc[-1]),
        "date": last_date.strftime("%Y-%m-%d"),
        "name": fetch_krx_name(ticker),
        "source": "KRX",
        "sessionStatus": FINAL_CLOSE_STATUS
    }


def fetch_us_name(ticker):
    try:
        info = yf.Ticker(ticker).get_info()
    except Exception:
        return None
    return clean_name(info.get("shortName") or info.get("longName"))


def clean_us_symbol_name(name):
    value = clean_name(name)
    if not value:
        return None
    value = re.sub(r"\s+-\s+", " ", value).strip()
    value = re.sub(r"\s+", " ", value).strip()
    return value or None


def us_symbol_from_row(row):
    return normalize_us_ticker(row.get("Symbol") or row.get("ACT Symbol") or row.get("NASDAQ Symbol"))


def us_symbol_kind(row):
    return "ETF" if str(row.get("ETF") or "").strip().upper() == "Y" else "STOCK"


def parse_symbol_rows(text):
    lines = [line for line in text.splitlines() if line and not line.startswith("File Creation Time")]
    if not lines:
        return []

    headers = lines[0].split("|")
    rows = []
    for line in lines[1:]:
        values = line.split("|")
        if len(values) != len(headers):
            continue
        row = dict(zip(headers, values))
        if str(row.get("Test Issue") or "").strip().upper() == "Y":
            continue
        rows.append(row)
    return rows


def fetch_us_symbols():
    symbols = {}
    for url in NASDAQ_SYMBOL_URLS:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        response.raise_for_status()
        for row in parse_symbol_rows(response.text):
            ticker = us_symbol_from_row(row)
            name = clean_us_symbol_name(row.get("Security Name"))
            if not ticker or not name:
                continue
            symbols[ticker] = {
                "kind": us_symbol_kind(row),
                "name": name,
                "source": "Nasdaq Trader"
            }
    return symbols


def close_series_from_frame(frame, symbol=None):
    if frame.empty or "Close" not in frame:
        return None
    closes = frame["Close"]
    if hasattr(closes, "columns"):
        if symbol and symbol in closes.columns:
            closes = closes[symbol]
        elif len(closes.columns) == 1:
            closes = closes.iloc[:, 0]
        else:
            return None
    closes = closes.dropna()
    closes = closes[closes > 0]
    return closes if not closes.empty else None


def select_latest_completed_close(frame, completed_session_date, symbol=None):
    closes = close_series_from_frame(frame, symbol=symbol)
    if closes is None:
        return None
    session_limit = parse_calendar_date(completed_session_date)
    if not session_limit:
        return None
    candidates = []
    for row_index, value in closes.items():
        row_date = row_index.date() if hasattr(row_index, "date") else parse_calendar_date(str(row_index)[:10])
        if not isinstance(row_date, date) or row_date > session_limit:
            continue
        close = value.item() if hasattr(value, "item") else value
        if is_positive_finite_number(close):
            candidates.append((row_date, float(close)))
    if not candidates:
        return None
    trade_date, close = max(candidates, key=lambda candidate: candidate[0])
    return {"close": close, "date": trade_date.isoformat()}


def fetch_us_close(ticker, lookback_days, completed_session_date, us_symbols=None):
    frame = yf.download(
        ticker,
        period=f"{lookback_days}d",
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False
    )

    selected = select_latest_completed_close(frame, completed_session_date, symbol=ticker)
    if not selected:
        return None

    symbol = (us_symbols or {}).get(ticker, {})
    return {
        "close": selected["close"],
        "date": selected["date"],
        "kind": symbol.get("kind") or "STOCK",
        "name": fetch_us_name(ticker),
        "source": "yfinance",
        "sessionStatus": FINAL_CLOSE_STATUS
    }


def fetch_usdkrw(lookback_days, completed_session_date):
    frame = yf.download(
        "KRW=X",
        period=f"{lookback_days}d",
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False
    )

    selected = select_latest_completed_close(frame, completed_session_date, symbol="KRW=X")
    if not selected:
        return None

    return {
        "date": selected["date"],
        "rate": selected["close"],
        "source": "yfinance KRW=X",
        "sessionStatus": FINAL_CLOSE_STATUS
    }


def fetch_yfinance_index_benchmark(
    name,
    symbol,
    lookback_days,
    quote_currency,
    completed_session_date
):
    """Fetch an unadjusted price-index close from Yahoo Finance."""
    frame = yf.download(
        symbol,
        period=f"{lookback_days}d",
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False
    )

    selected = select_latest_completed_close(frame, completed_session_date, symbol=symbol)
    if not selected:
        return None

    return build_benchmark_entry(
        name,
        symbol,
        selected["close"],
        selected["date"],
        f"yfinance {symbol}",
        quote_currency
    )


def fetch_kospi_benchmark(lookback_days, completed_session_date):
    """Fetch the KOSPI price-index level without requiring a KRX login session."""
    return fetch_yfinance_index_benchmark(
        "KOSPI",
        KOSPI_BENCHMARK_SYMBOL,
        lookback_days,
        "KRW",
        completed_session_date
    )


def fetch_sp500_benchmark(lookback_days, completed_session_date):
    """Fetch the S&P 500 price-index level from Yahoo's unadjusted Close column."""
    return fetch_yfinance_index_benchmark(
        "S&P 500",
        SP500_BENCHMARK_SYMBOL,
        lookback_days,
        "USD",
        completed_session_date
    )


def fetch_benchmarks(lookback_days, completed_sessions, today=None):
    benchmarks = {}
    errors = []
    fetchers = (
        ("KOSPI", "KRX", fetch_kospi_benchmark),
        ("SP500", "US", fetch_sp500_benchmark)
    )

    for benchmark_id, market, fetcher in fetchers:
        try:
            completed_session = completed_sessions.get(market)
            if not completed_session:
                raise RuntimeError(f"{market} completed session unavailable")
            entry = fetcher(lookback_days, completed_session)
            if not is_valid_benchmark_entry(entry, today=today):
                reason = "missing, stale, or invalid price-index level"
                errors.append({
                    "type": "BENCHMARK",
                    "ticker": benchmark_id,
                    "requiredForValuation": False,
                    "error": reason
                })
                continue
            benchmarks[benchmark_id] = entry
        except Exception as error:
            errors.append({
                "type": "BENCHMARK",
                "ticker": benchmark_id,
                "requiredForValuation": False,
                "error": str(error)
            })

    return benchmarks, errors


def build_prices(tickers, lookback_days):
    collection_now = datetime.now(timezone.utc)
    prices = {"KRX": {}, "US": {}}
    symbols = {"KRX": {}, "US": {}}
    fx = {}
    benchmarks = {}
    errors = []
    session_evidence = {}
    completed_sessions = {}

    try:
        session_evidence["KRX"] = fetch_latest_completed_krx_session_evidence(
            now=collection_now,
            lookback_days=lookback_days
        )
        completed_sessions["KRX"] = session_evidence["KRX"]["completedSession"]
        completed_krx_session = completed_sessions["KRX"]
        prices["KRX"] = fetch_all_krx_prices(completed_krx_session, now=collection_now)
        symbols["KRX"] = {
            ticker: {
                "kind": price.get("kind") or kind_from_source(price.get("source")),
                "name": price.get("name"),
                "source": price.get("source")
            }
            for ticker, price in prices["KRX"].items()
            if price.get("name")
        }
    except Exception as error:
        errors.append({"type": "KRX", "ticker": "ALL", "error": str(error)})

    try:
        session_evidence["US"] = latest_completed_us_session_evidence(now=collection_now)
        completed_sessions["US"] = session_evidence["US"]["completedSession"]
    except Exception as error:
        errors.append({"type": "US", "ticker": "SESSION", "error": str(error)})

    try:
        session_evidence["FX"] = fetch_latest_completed_fx_session_evidence(now=collection_now)
        completed_sessions["FX"] = session_evidence["FX"]["completedSession"]
    except Exception as error:
        errors.append({"type": "FX", "ticker": "SESSION", "error": str(error)})

    try:
        symbols["US"] = fetch_us_symbols()
    except Exception as error:
        errors.append({"type": "US", "ticker": "SYMBOLS", "error": str(error)})

    try:
        completed_fx_session = completed_sessions.get("FX")
        if not completed_fx_session:
            raise RuntimeError("FX completed session unavailable")
        fx["USDKRW"] = fetch_usdkrw(lookback_days, completed_fx_session)
    except Exception as error:
        errors.append({"type": "FX", "ticker": "USDKRW", "error": str(error)})

    benchmark_values, benchmark_errors = fetch_benchmarks(
        lookback_days,
        completed_sessions
    )
    benchmarks.update(benchmark_values)
    errors.extend(benchmark_errors)

    for ticker in tickers["KRX"]:
        if ticker in prices["KRX"]:
            continue
        completed_krx_session = completed_sessions.get("KRX")
        if not completed_krx_session:
            errors.append({"type": "KRX", "ticker": ticker, "error": "completed session unavailable"})
            continue
        try:
            price = fetch_krx_close(ticker, lookback_days, completed_krx_session)
            if price:
                prices["KRX"][ticker] = price
            else:
                errors.append({"type": "KRX", "ticker": ticker, "error": "no close price"})
        except Exception as error:
            errors.append({"type": "KRX", "ticker": ticker, "error": str(error)})

    for ticker in tickers["US"]:
        completed_us_session = completed_sessions.get("US")
        if not completed_us_session:
            errors.append({"type": "US", "ticker": ticker, "error": "completed session unavailable"})
            continue
        try:
            price = fetch_us_close(
                ticker,
                lookback_days,
                completed_us_session,
                symbols["US"]
            )
            if price:
                prices["US"][ticker] = price
            else:
                errors.append({"type": "US", "ticker": ticker, "error": "no close price"})
        except Exception as error:
            errors.append({"type": "US", "ticker": ticker, "error": str(error)})

    generated_at = utc_iso(collection_now)
    output = {
        "generatedAt": generated_at,
        "methodology": price_methodology_metadata(),
        "fx": fx,
        "prices": prices,
        "benchmarks": benchmarks,
        "symbols": symbols,
        "errors": errors
    }
    output["finalCloseCertificate"] = build_final_close_certificate(
        output,
        generated_at,
        market_sessions=completed_sessions,
        valid_until_by_market={
            market: evidence["nextCutoffAt"]
            for market, evidence in session_evidence.items()
        },
        now=collection_now
    )
    return output


def main():
    parser = argparse.ArgumentParser(description="Generate AssetTrail prices.json")
    parser.add_argument("--tickers", default="tickers.json")
    parser.add_argument("--output", default="prices.json")
    parser.add_argument(
        "--symbols-output",
        help="Symbol directory output (default: symbols.json next to --output)"
    )
    parser.add_argument("--lookback-days", type=int, default=10)
    args = parser.parse_args()
    symbols_output = args.symbols_output or default_symbols_output(args.output)

    tickers = read_tickers(args.tickers)
    output = build_prices(tickers, args.lookback_days)

    for error in output["errors"]:
        print(f"{error['type']} {error['ticker']}: {error['error']}", file=sys.stderr)

    try:
        quality = publish_price_artifacts(
            output,
            tickers,
            args.output,
            symbols_output
        )
    except PriceQualityError as error:
        print(f"PRICE QUALITY: {error}", file=sys.stderr)
        return 1
    print(
        "Price quality passed: "
        f"KRX {quality['krx']}, "
        f"US {quality['usSucceeded']}/{quality['usRequested']}, "
        f"USDKRW {quality['usdkrw']:.2f}"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
