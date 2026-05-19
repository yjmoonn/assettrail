#!/usr/bin/env python3
import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
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


def parse_trade_date(value):
    text = str(value or "").strip()
    if len(text) >= 10 and re.match(r"^\d{4}-\d{2}-\d{2}", text):
        return text[:10]
    return datetime.now(KST).date().strftime("%Y-%m-%d")


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
        "name": name,
        "source": source
    }


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


def fetch_us_close(ticker, lookback_days):
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

    return {
        "close": float(close),
        "date": last_date.strftime("%Y-%m-%d"),
        "name": fetch_us_name(ticker),
        "source": "yfinance"
    }


def build_prices(tickers, lookback_days):
    prices = {"KRX": {}, "US": {}}
    symbols = {"KRX": {}, "US": {}}
    errors = []

    try:
        prices["KRX"] = fetch_all_krx_prices()
        symbols["KRX"] = {
            ticker: {
                "kind": "ETF" if "ETF" in str(price.get("source") or "") else "STOCK",
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
            price = fetch_us_close(ticker, lookback_days)
            if price:
                prices["US"][ticker] = price
            else:
                errors.append({"type": "US", "ticker": ticker, "error": "no close price"})
        except Exception as error:
            errors.append({"type": "US", "ticker": ticker, "error": str(error)})

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "prices": prices,
        "symbols": symbols,
        "errors": errors
    }


def main():
    parser = argparse.ArgumentParser(description="Generate AssetTrail prices.json")
    parser.add_argument("--tickers", default="tickers.json")
    parser.add_argument("--output", default="prices.json")
    parser.add_argument("--lookback-days", type=int, default=10)
    args = parser.parse_args()

    tickers = read_tickers(args.tickers)
    output = build_prices(tickers, args.lookback_days)
    Path(args.output).write_text(
        json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8"
    )

    for error in output["errors"]:
        print(f"{error['type']} {error['ticker']}: {error['error']}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
