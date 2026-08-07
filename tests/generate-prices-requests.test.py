import importlib.util
import json
import sys
import tempfile
from datetime import date
from pathlib import Path
from unittest.mock import patch

import pandas as pd


spec = importlib.util.spec_from_file_location("generate_prices", Path("scripts/generate_prices.py"))
generate_prices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_prices)

QUALITY_TODAY = date(2026, 8, 4)
FRESH_TRADE_DATE = "2026-07-29"


def valid_output(krx_count=3, us_tickers=("AAPL", "MSFT", "TSLA")):
    return {
        "generatedAt": "2026-07-29T22:30:47Z",
        "methodology": generate_prices.price_methodology_metadata(),
        "fx": {
            "USDKRW": {
                "date": FRESH_TRADE_DATE,
                "rate": 1385.25
            }
        },
        "prices": {
            "KRX": {
                f"{index:06d}": {
                    "close": index + 1000,
                    "date": FRESH_TRADE_DATE
                }
                for index in range(krx_count)
            },
            "US": {
                ticker: {
                    "close": index + 100,
                    "date": FRESH_TRADE_DATE
                }
                for index, ticker in enumerate(us_tickers)
            }
        },
        "benchmarks": {
            "KOSPI": generate_prices.build_benchmark_entry(
                "KOSPI",
                generate_prices.KOSPI_BENCHMARK_SYMBOL,
                3210.25,
                FRESH_TRADE_DATE,
                "pykrx KRX index 1001",
                "KRW"
            ),
            "SP500": generate_prices.build_benchmark_entry(
                "S&P 500",
                generate_prices.SP500_BENCHMARK_SYMBOL,
                6345.5,
                FRESH_TRADE_DATE,
                "yfinance ^GSPC",
                "USD"
            )
        },
        "symbols": {
            "KRX": {
                "000000": {
                    "kind": "STOCK",
                    "name": "테스트 주식",
                    "source": "KRX KOSPI"
                }
            },
            "US": {
                "AAPL": {
                    "kind": "STOCK",
                    "name": "Apple Inc.",
                    "source": "Nasdaq Trader"
                }
            }
        },
        "errors": []
    }


def set_all_market_dates(output, market, value):
    for entry in output["prices"][market].values():
        entry["date"] = value


def assert_quality_fails(output, tickers, expected_message):
    try:
        generate_prices.validate_price_quality(
            output,
            tickers,
            min_krx_count=3,
            today=QUALITY_TODAY
        )
    except generate_prices.PriceQualityError as error:
        assert expected_message in str(error)
    else:
        raise AssertionError("price quality validation unexpectedly passed")


def test_main_uses_only_the_trusted_ticker_file():
    baseline = {
        "KRX": ["005930"],
        "US": ["AAPL", "MSFT", "TSLA"]
    }
    output = valid_output()
    quality = {
        "krx": 3,
        "usdkrw": 1385.25,
        "usRequested": 3,
        "usSucceeded": 3,
        "usRequired": 3
    }

    with (
        patch.object(generate_prices, "read_tickers", return_value=baseline) as read_tickers,
        patch.object(generate_prices, "build_prices", return_value=output) as build_prices,
        patch.object(generate_prices, "publish_price_artifacts", return_value=quality) as publish,
        patch.object(
            generate_prices.requests,
            "get",
            side_effect=AssertionError("main must not fetch untrusted Firestore price requests")
        ),
        patch.object(sys, "argv", ["generate_prices.py"])
    ):
        assert generate_prices.main() == 0

    read_tickers.assert_called_once_with("tickers.json")
    build_prices.assert_called_once_with(baseline, 10)
    assert publish.call_args.args[1] is baseline
    assert not hasattr(generate_prices, "fetch_requested_us_tickers")
    assert not hasattr(generate_prices, "parse_firestore_string_array")


def test_parse_trade_date_rejects_malformed_and_invalid_calendar_dates():
    assert generate_prices.parse_trade_date("2026-08-04T15:30:00+09:00") == "2026-08-04"
    assert generate_prices.parse_trade_date("2026-02-30T15:30:00+09:00") is None
    assert generate_prices.parse_trade_date("2026-8-4") is None
    assert generate_prices.parse_trade_date("javascript:alert(1)") is None
    assert generate_prices.parse_trade_date(None) is None


def test_price_quality_accepts_healthy_output():
    summary = generate_prices.validate_price_quality(
        valid_output(),
        {"US": ["AAPL", "MSFT", "TSLA"]},
        min_krx_count=3,
        today=QUALITY_TODAY
    )

    assert summary == {
        "krx": 3,
        "usdkrw": 1385.25,
        "usRequested": 3,
        "usSucceeded": 3,
        "usRequired": 3
    }


def test_methodology_explicitly_excludes_distributions_and_total_return():
    methodology = generate_prices.price_methodology_metadata()

    assert methodology == {
        "priceBasis": "unadjusted_close",
        "distributionTreatment": "excluded",
        "totalReturn": False,
        "benchmarkBasis": "price_index_level",
        "quoteCurrencyByMarket": {
            "KRX": "KRW",
            "US": "USD"
        }
    }

    for benchmark in valid_output()["benchmarks"].values():
        assert benchmark["priceBasis"] == "price_index_level"
        assert benchmark["distributionTreatment"] == "excluded"
        assert benchmark["totalReturn"] is False


def test_benchmark_partial_failure_is_structured_and_keeps_healthy_result():
    sp500 = generate_prices.build_benchmark_entry(
        "S&P 500",
        "^GSPC",
        6345.5,
        FRESH_TRADE_DATE,
        "yfinance ^GSPC",
        "USD"
    )

    with (
        patch.object(
            generate_prices,
            "fetch_kospi_benchmark",
            side_effect=RuntimeError("upstream unavailable")
        ),
        patch.object(generate_prices, "fetch_sp500_benchmark", return_value=sp500)
    ):
        benchmarks, errors = generate_prices.fetch_benchmarks(
            10,
            today=QUALITY_TODAY
        )

    assert benchmarks == {"SP500": sp500}
    assert errors == [{
        "type": "BENCHMARK",
        "ticker": "KOSPI",
        "requiredForValuation": False,
        "error": "upstream unavailable"
    }]


def test_benchmark_fetchers_use_unadjusted_price_index_closes():
    trade_index = pd.to_datetime([FRESH_TRADE_DATE])
    kospi_frame = pd.DataFrame({"종가": [3210.25]}, index=trade_index)
    sp500_frame = pd.DataFrame({"Close": [6345.5]}, index=trade_index)

    with patch.object(
        generate_prices.stock,
        "get_index_ohlcv_by_date",
        return_value=kospi_frame
    ) as fetch_kospi:
        kospi = generate_prices.fetch_kospi_benchmark(10)

    with patch.object(
        generate_prices.yf,
        "download",
        return_value=sp500_frame
    ) as fetch_sp500:
        sp500 = generate_prices.fetch_sp500_benchmark(10)

    assert fetch_kospi.call_args.args[2] == "1001"
    assert kospi["level"] == 3210.25
    assert kospi["date"] == FRESH_TRADE_DATE
    assert kospi["priceBasis"] == "price_index_level"
    assert kospi["distributionTreatment"] == "excluded"
    assert kospi["quoteCurrency"] == "KRW"
    assert kospi["levelUnit"] == "index_points"

    assert fetch_sp500.call_args.args == ("^GSPC",)
    assert fetch_sp500.call_args.kwargs["auto_adjust"] is False
    assert fetch_sp500.call_args.kwargs["interval"] == "1d"
    assert sp500["level"] == 6345.5
    assert sp500["date"] == FRESH_TRADE_DATE
    assert sp500["totalReturn"] is False
    assert sp500["quoteCurrency"] == "USD"


def test_invalid_benchmark_is_not_published_as_a_valid_level():
    stale_kospi = generate_prices.build_benchmark_entry(
        "KOSPI",
        "1001",
        3210.25,
        "2026-07-27",
        "pykrx KRX index 1001",
        "KRW"
    )
    sp500 = generate_prices.build_benchmark_entry(
        "S&P 500",
        "^GSPC",
        6345.5,
        FRESH_TRADE_DATE,
        "yfinance ^GSPC",
        "USD"
    )

    with (
        patch.object(generate_prices, "fetch_kospi_benchmark", return_value=stale_kospi),
        patch.object(generate_prices, "fetch_sp500_benchmark", return_value=sp500)
    ):
        benchmarks, errors = generate_prices.fetch_benchmarks(
            10,
            today=QUALITY_TODAY
        )

    assert benchmarks == {"SP500": sp500}
    assert errors == [{
        "type": "BENCHMARK",
        "ticker": "KOSPI",
        "requiredForValuation": False,
        "error": "missing, stale, or invalid price-index level"
    }]


def test_benchmark_failure_does_not_change_required_valuation_quality():
    output = valid_output()
    output["benchmarks"] = {}
    output["errors"] = [{
        "type": "BENCHMARK",
        "ticker": "KOSPI",
        "requiredForValuation": False,
        "error": "upstream unavailable"
    }]

    summary = generate_prices.validate_price_quality(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        min_krx_count=3,
        today=QUALITY_TODAY
    )

    assert summary["krx"] == 3
    assert summary["usSucceeded"] == 3


def test_price_quality_accepts_seven_days_old_and_one_day_future():
    output = valid_output()
    set_all_market_dates(output, "KRX", "2026-07-28")
    set_all_market_dates(output, "US", "2026-08-05")
    output["fx"]["USDKRW"]["date"] = "2026-07-28"

    summary = generate_prices.validate_price_quality(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        min_krx_count=3,
        today=QUALITY_TODAY
    )

    assert summary["krx"] == 3
    assert summary["usSucceeded"] == 3


def test_price_quality_rejects_small_krx_market():
    assert_quality_fails(
        valid_output(krx_count=2),
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "KRX fresh price count 2 is below minimum 3"
    )


def test_price_quality_excludes_stale_krx_entries():
    output = valid_output()
    set_all_market_dates(output, "KRX", "2026-07-27")

    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "KRX fresh price count 0 is below minimum 3"
    )


def test_price_quality_rejects_invalid_calendar_dates():
    output = valid_output()
    set_all_market_dates(output, "KRX", "2026-02-30")
    set_all_market_dates(output, "US", "2026-02-30")
    output["fx"]["USDKRW"]["date"] = "2026-02-30"

    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "KRX fresh price count 0 is below minimum 3"
    )
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "USDKRW is missing, stale, or outside the valid date/rate range"
    )
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "US baseline fresh price coverage 0/3 is below required 3/3"
    )


def test_price_quality_rejects_dates_more_than_one_day_in_future():
    output = valid_output()
    set_all_market_dates(output, "KRX", "2026-08-06")

    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "KRX fresh price count 0 is below minimum 3"
    )


def test_price_quality_rejects_invalid_or_stale_fx():
    output = valid_output()
    output["fx"]["USDKRW"] = {
        "date": "2026-07-27",
        "rate": float("inf")
    }

    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "USDKRW is missing, stale, or outside the valid date/rate range"
    )


def test_price_quality_rejects_low_us_coverage():
    output = valid_output(us_tickers=("AAPL", "MSFT"))

    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA", "GOOG"]},
        "US baseline fresh price coverage 2/4 is below required 3/4"
    )


def test_price_quality_excludes_stale_us_entries():
    output = valid_output(us_tickers=("AAPL", "MSFT", "TSLA", "GOOG"))
    output["prices"]["US"]["TSLA"]["date"] = "2026-07-27"
    output["prices"]["US"]["GOOG"]["date"] = "2026-07-27"

    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA", "GOOG"]},
        "US baseline fresh price coverage 2/4 is below required 3/4"
    )


def test_price_and_symbol_artifacts_are_separated_and_minified():
    with tempfile.TemporaryDirectory() as directory:
        output_path = Path(directory) / "prices.json"
        symbols_output_path = generate_prices.default_symbols_output(output_path)
        output = valid_output()

        generate_prices.publish_price_artifacts(
            output,
            {"US": ["AAPL", "MSFT", "TSLA"]},
            output_path,
            symbols_output_path,
            quality_options={"min_krx_count": 3, "today": QUALITY_TODAY}
        )

        prices_payload = json.loads(output_path.read_text(encoding="utf-8"))
        symbols_text = symbols_output_path.read_text(encoding="utf-8")
        symbols_payload = json.loads(symbols_text)

        assert set(prices_payload) == {
            "generatedAt",
            "methodology",
            "fx",
            "prices",
            "benchmarks",
            "errors",
            "symbolFile",
            "symbolsGeneratedAt"
        }
        assert prices_payload["methodology"] == generate_prices.price_methodology_metadata()
        assert prices_payload["benchmarks"] == output["benchmarks"]
        assert prices_payload["symbolFile"] == "symbols.json"
        assert prices_payload["symbolsGeneratedAt"] == output["generatedAt"]
        assert "symbols" not in prices_payload
        assert symbols_payload == {
            "generatedAt": output["generatedAt"],
            "symbols": output["symbols"]
        }
        assert symbols_text == (
            json.dumps(
                symbols_payload,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True
            )
        )


def test_price_quality_failure_preserves_existing_artifacts():
    with tempfile.TemporaryDirectory() as directory:
        output_path = Path(directory) / "prices.json"
        symbols_output_path = Path(directory) / "symbols.json"
        output_path.write_text("existing prices\n", encoding="utf-8")
        symbols_output_path.write_text("existing symbols\n", encoding="utf-8")

        output = valid_output(krx_count=2)
        try:
            generate_prices.publish_price_artifacts(
                output,
                {"US": ["AAPL", "MSFT", "TSLA"]},
                output_path,
                symbols_output_path,
                quality_options={"min_krx_count": 3, "today": QUALITY_TODAY}
            )
        except generate_prices.PriceQualityError:
            pass
        else:
            raise AssertionError("price quality validation unexpectedly passed")

        assert output_path.read_text(encoding="utf-8") == "existing prices\n"
        assert symbols_output_path.read_text(encoding="utf-8") == "existing symbols\n"


if __name__ == "__main__":
    test_main_uses_only_the_trusted_ticker_file()
    test_parse_trade_date_rejects_malformed_and_invalid_calendar_dates()
    test_price_quality_accepts_healthy_output()
    test_methodology_explicitly_excludes_distributions_and_total_return()
    test_benchmark_partial_failure_is_structured_and_keeps_healthy_result()
    test_benchmark_fetchers_use_unadjusted_price_index_closes()
    test_invalid_benchmark_is_not_published_as_a_valid_level()
    test_benchmark_failure_does_not_change_required_valuation_quality()
    test_price_quality_accepts_seven_days_old_and_one_day_future()
    test_price_quality_rejects_small_krx_market()
    test_price_quality_excludes_stale_krx_entries()
    test_price_quality_rejects_invalid_calendar_dates()
    test_price_quality_rejects_dates_more_than_one_day_in_future()
    test_price_quality_rejects_invalid_or_stale_fx()
    test_price_quality_rejects_low_us_coverage()
    test_price_quality_excludes_stale_us_entries()
    test_price_and_symbol_artifacts_are_separated_and_minified()
    test_price_quality_failure_preserves_existing_artifacts()
