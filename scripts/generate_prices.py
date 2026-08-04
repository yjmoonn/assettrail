#!/usr/bin/env python3
import argparse
import html
import json
import math
import os
import re
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
import yfinance as yf
from pykrx import stock

KST = ZoneInfo("Asia/Seoul")
NAVER_STOCK_CATEGORIES = ("KOSPI", "KOSDAQ")
NAVER_ETX_CATEGORIES = ("etf", "etn")
NAVER_PAGE_SIZE = 100
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
MAX_PRICE_FUTURE_DAYS = 1
DEFAULT_SYMBOLS_FILENAME = "symbols.json"


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
    failures = []
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
        "fx": output.get("fx", {}),
        "prices": output.get("prices", {"KRX": {}, "US": {}}),
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


def build_krx_price_entry(item, source):
    ticker = normalize_krx_ticker(item.get("itemCode") or item.get("itemcode") or item.get("reutersCode"))
    close = parse_price(item.get("closePrice") or item.get("nowVal"))
    name = clean_name(item.get("stockName") or item.get("itemname"))

    if not ticker or not close:
        return None

    return ticker, {
        "close": close,
        "date": parse_trade_date(item.get("localTradedAt")),
        "kind": kind_from_source(source),
        "name": name,
        "source": source
    }


def kind_from_source(source):
    source_text = str(source or "").upper()
    if "ETF" in source_text:
        return "ETF"
    if "ETN" in source_text:
        return "ETN"
    return "STOCK"


def fetch_naver_category_prices(path, source):
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
            entry = build_krx_price_entry(item, source)
            if entry:
                ticker, price = entry
                prices[ticker] = price

        page += 1

    return prices


def fetch_all_krx_prices():
    prices = {}

    for category in NAVER_STOCK_CATEGORIES:
        prices.update(fetch_naver_category_prices(f"marketValue/{category}", f"KRX {category}"))

    for category in NAVER_ETX_CATEGORIES:
        prices.update(fetch_naver_category_prices(category, f"KRX {category.upper()}"))

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


def fetch_krx_close(ticker, lookback_days):
    end = datetime.now(KST).date()
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
        "source": "KRX"
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


def fetch_us_close(ticker, lookback_days, us_symbols=None):
    frame = yf.download(
        ticker,
        period=f"{lookback_days}d",
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False
    )

    if frame.empty or "Close" not in frame:
        return None

    closes = frame["Close"].dropna()
    closes = closes[closes > 0]
    if closes.empty:
        return None

    last_date = closes.index[-1]
    close = closes.iloc[-1]
    if hasattr(close, "item"):
        close = close.item()

    symbol = (us_symbols or {}).get(ticker, {})
    return {
        "close": float(close),
        "date": last_date.strftime("%Y-%m-%d"),
        "kind": symbol.get("kind") or "STOCK",
        "name": fetch_us_name(ticker),
        "source": "yfinance"
    }


def fetch_usdkrw(lookback_days):
    frame = yf.download(
        "KRW=X",
        period=f"{lookback_days}d",
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False
    )

    if frame.empty or "Close" not in frame:
        return None

    closes = frame["Close"].dropna()
    closes = closes[closes > 0]
    if closes.empty:
        return None

    last_date = closes.index[-1]
    close = closes.iloc[-1]
    if hasattr(close, "item"):
        close = close.item()

    return {
        "date": last_date.strftime("%Y-%m-%d"),
        "rate": float(close),
        "source": "yfinance KRW=X"
    }


def build_prices(tickers, lookback_days):
    prices = {"KRX": {}, "US": {}}
    symbols = {"KRX": {}, "US": {}}
    fx = {}
    errors = []

    try:
        prices["KRX"] = fetch_all_krx_prices()
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
        symbols["US"] = fetch_us_symbols()
    except Exception as error:
        errors.append({"type": "US", "ticker": "SYMBOLS", "error": str(error)})

    try:
        fx["USDKRW"] = fetch_usdkrw(lookback_days)
    except Exception as error:
        errors.append({"type": "FX", "ticker": "USDKRW", "error": str(error)})

    for ticker in tickers["KRX"]:
        if ticker in prices["KRX"]:
            continue
        try:
            price = fetch_krx_close(ticker, lookback_days)
            if price:
                prices["KRX"][ticker] = price
            else:
                errors.append({"type": "KRX", "ticker": ticker, "error": "no close price"})
        except Exception as error:
            errors.append({"type": "KRX", "ticker": ticker, "error": str(error)})

    for ticker in tickers["US"]:
        try:
            price = fetch_us_close(ticker, lookback_days, symbols["US"])
            if price:
                prices["US"][ticker] = price
            else:
                errors.append({"type": "US", "ticker": ticker, "error": "no close price"})
        except Exception as error:
            errors.append({"type": "US", "ticker": ticker, "error": str(error)})

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "fx": fx,
        "prices": prices,
        "symbols": symbols,
        "errors": errors
    }


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
