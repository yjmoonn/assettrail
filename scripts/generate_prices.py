#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf
from pykrx import stock


def normalize_krx_ticker(ticker):
    value = str(ticker or "").strip()
    return value.zfill(6) if value.isdigit() else value


def normalize_us_ticker(ticker):
    return str(ticker or "").strip().upper()


def read_tickers(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {
        "KRX": [normalize_krx_ticker(ticker) for ticker in data.get("KRX", []) if str(ticker).strip()],
        "US": [normalize_us_ticker(ticker) for ticker in data.get("US", []) if str(ticker).strip()]
    }


def fetch_krx_close(ticker, lookback_days):
    end = datetime.now(timezone.utc).date()
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
        "source": "KRX"
    }


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
        "source": "yfinance"
    }


def build_prices(tickers, lookback_days):
    prices = {"KRX": {}, "US": {}}
    errors = []

    for ticker in tickers["KRX"]:
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
