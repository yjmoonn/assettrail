import importlib.util
import json
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

import pandas as pd


spec = importlib.util.spec_from_file_location("generate_prices", Path("scripts/generate_prices.py"))
generate_prices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_prices)

QUALITY_TODAY = date(2026, 8, 4)
FRESH_TRADE_DATE = "2026-07-29"
REQUIRED_US_PORTFOLIO_TICKERS = {
    "ADI", "AVGO", "BE", "COHR", "INTC", "MU", "NVDA", "SNDK", "WDC"
}


def valid_output(krx_count=3, us_tickers=("AAPL", "MSFT", "TSLA")):
    return {
        "generatedAt": "2026-07-29T22:30:47Z",
        "methodology": generate_prices.price_methodology_metadata(),
        "fx": {
            "USDKRW": {
                "date": FRESH_TRADE_DATE,
                "rate": 1385.25,
                "sessionStatus": generate_prices.FINAL_CLOSE_STATUS
            }
        },
        "prices": {
            "KRX": {
                f"{index:06d}": {
                    "close": index + 1000,
                    "date": FRESH_TRADE_DATE,
                    "sessionStatus": generate_prices.FINAL_CLOSE_STATUS
                }
                for index in range(krx_count)
            },
            "US": {
                ticker: {
                    "close": index + 100,
                    "date": FRESH_TRADE_DATE,
                    "sessionStatus": generate_prices.FINAL_CLOSE_STATUS
                }
                for index, ticker in enumerate(us_tickers)
            }
        },
        "finalCloseCertificate": {
            "status": generate_prices.FINAL_CLOSE_STATUS,
            "checkedAt": "2026-07-29T22:30:47Z",
            "validUntil": "2026-07-30T06:40:00Z",
            "validUntilByMarket": {
                "KRX": "2026-07-30T06:40:00Z",
                "US": "2026-07-30T20:15:00Z",
                "FX": "2026-07-30T21:15:00Z"
            },
            "marketSessions": {
                "KRX": FRESH_TRADE_DATE,
                "US": FRESH_TRADE_DATE,
                "FX": FRESH_TRADE_DATE
            }
        },
        "benchmarks": {
            "KOSPI": generate_prices.build_benchmark_entry(
                "KOSPI",
                generate_prices.KOSPI_BENCHMARK_SYMBOL,
                3210.25,
                FRESH_TRADE_DATE,
                "yfinance ^KS11",
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
    output["finalCloseCertificate"]["marketSessions"][market] = value


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


def test_trusted_ticker_file_covers_required_us_portfolio():
    tickers = generate_prices.read_tickers("tickers.json")
    assert tickers["US"] == sorted(set(tickers["US"]))
    assert REQUIRED_US_PORTFOLIO_TICKERS <= set(tickers["US"])


def test_parse_trade_date_rejects_malformed_and_invalid_calendar_dates():
    assert generate_prices.parse_trade_date("2026-08-04T15:30:00+09:00") == "2026-08-04"
    assert generate_prices.parse_trade_date("2026-02-30T15:30:00+09:00") is None
    assert generate_prices.parse_trade_date("2026-8-4") is None
    assert generate_prices.parse_trade_date("javascript:alert(1)") is None
    assert generate_prices.parse_trade_date(None) is None


def yahoo_fx_metadata(session_start, session_end, timezone_name="Europe/London"):
    return {
        "symbol": "KRW=X",
        "instrumentType": "CURRENCY",
        "exchangeTimezoneName": timezone_name,
        "currentTradingPeriod": {
            "regular": {
                "start": int(session_start.timestamp()),
                "end": int(session_end.timestamp())
            }
        }
    }


def test_fx_session_uses_yahoo_market_period_instead_of_new_york_cutoff():
    metadata = yahoo_fx_metadata(
        datetime(2026, 9, 6, 23, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 7, 22, 59, tzinfo=timezone.utc)
    )

    before_confirmation = generate_prices.fx_session_evidence_from_metadata(
        metadata,
        now=datetime(2026, 9, 7, 21, 20, tzinfo=timezone.utc)
    )
    after_confirmation = generate_prices.fx_session_evidence_from_metadata(
        metadata,
        now=datetime(2026, 9, 7, 23, 15, tzinfo=timezone.utc)
    )

    assert before_confirmation == {
        "completedSession": "2026-09-04",
        "nextCutoffAt": "2026-09-07T23:15:00Z"
    }
    assert after_confirmation == {
        "completedSession": "2026-09-07",
        "nextCutoffAt": "2026-09-08T23:15:00Z"
    }


def test_fx_session_cutoff_follows_london_standard_time():
    metadata = yahoo_fx_metadata(
        datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 12, 1, 23, 59, tzinfo=timezone.utc)
    )

    evidence = generate_prices.fx_session_evidence_from_metadata(
        metadata,
        now=datetime(2026, 12, 1, 23, 30, tzinfo=timezone.utc)
    )

    assert evidence == {
        "completedSession": "2026-11-30",
        "nextCutoffAt": "2026-12-02T00:15:00Z"
    }


def test_fx_session_rollover_does_not_certify_previous_day_during_buffer():
    next_day_metadata = yahoo_fx_metadata(
        datetime(2026, 9, 7, 23, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 8, 22, 59, tzinfo=timezone.utc)
    )

    during_buffer = generate_prices.fx_session_evidence_from_metadata(
        next_day_metadata,
        now=datetime(2026, 9, 7, 23, 5, tzinfo=timezone.utc)
    )
    after_buffer = generate_prices.fx_session_evidence_from_metadata(
        next_day_metadata,
        now=datetime(2026, 9, 7, 23, 16, tzinfo=timezone.utc)
    )

    assert during_buffer == {
        "completedSession": "2026-09-04",
        "nextCutoffAt": "2026-09-07T23:15:00Z"
    }
    assert after_buffer == {
        "completedSession": "2026-09-07",
        "nextCutoffAt": "2026-09-08T23:15:00Z"
    }


def test_fx_session_metadata_probe_is_separate_from_daily_quote_rows():
    metadata = yahoo_fx_metadata(
        datetime(2026, 9, 6, 23, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 7, 22, 59, tzinfo=timezone.utc)
    )

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"chart": {"result": [{"meta": metadata}]}}

    with patch.object(generate_prices.requests, "get", return_value=Response()) as request:
        evidence = generate_prices.fetch_latest_completed_fx_session_evidence(
            now=datetime(2026, 9, 7, 5, 0, tzinfo=timezone.utc)
        )

    assert evidence["completedSession"] == "2026-09-04"
    assert evidence["nextCutoffAt"] == "2026-09-07T23:15:00Z"
    assert request.call_args.kwargs["params"] == {"interval": "1d", "range": "5d"}


def test_krx_intraday_row_is_rewound_to_the_latest_completed_session():
    item = {
        "itemCode": "005930",
        "stockName": "삼성전자",
        "closePrice": "74,000",
        "compareToPreviousClosePrice": "1,000",
        "localTradedAt": "2026-08-04T13:00:00+09:00",
        "marketStatus": "OPEN"
    }
    entry = generate_prices.build_krx_price_entry(
        item,
        "KRX KOSPI",
        "2026-08-03",
        now=datetime(2026, 8, 4, 4, 0, tzinfo=timezone.utc)
    )

    assert entry == ("005930", {
        "close": 73000.0,
        "date": "2026-08-03",
        "kind": "STOCK",
        "name": "삼성전자",
        "source": "KRX KOSPI",
        "sessionStatus": "FINAL_CLOSE"
    })

    falling_item = {
        **item,
        "closePrice": "70,000",
        "compareToPreviousClosePrice": "-3,000"
    }
    falling_entry = generate_prices.build_krx_price_entry(
        falling_item,
        "KRX KOSPI",
        "2026-08-03",
        now=datetime(2026, 8, 4, 4, 0, tzinfo=timezone.utc)
    )
    assert falling_entry[1]["close"] == 73000.0


def test_krx_completed_row_keeps_the_reported_close():
    item = {
        "itemCode": "005930",
        "stockName": "삼성전자",
        "closePrice": "74,000",
        "compareToPreviousClosePrice": "1,000",
        "localTradedAt": "2026-08-04T15:40:00+09:00",
        "marketStatus": "CLOSE"
    }
    entry = generate_prices.build_krx_price_entry(
        item,
        "KRX KOSPI",
        "2026-08-04",
        now=datetime(2026, 8, 4, 6, 45, tzinfo=timezone.utc)
    )
    assert entry[1]["close"] == 74000.0
    assert entry[1]["date"] == "2026-08-04"
    assert entry[1]["sessionStatus"] == "FINAL_CLOSE"


def test_krx_open_row_is_never_certified_as_the_current_completed_session():
    item = {
        "itemCode": "005930",
        "stockName": "삼성전자",
        "closePrice": "74,000",
        "compareToPreviousClosePrice": "1,000",
        "localTradedAt": "2026-11-19T15:45:00+09:00",
        "marketStatus": "OPEN"
    }
    assert generate_prices.build_krx_price_entry(
        item,
        "KRX KOSPI",
        "2026-11-19",
        now=datetime(2026, 11, 19, 6, 45, tzinfo=timezone.utc)
    ) is None


def test_krx_intraday_row_without_previous_change_is_not_certified():
    item = {
        "itemCode": "005930",
        "stockName": "삼성전자",
        "closePrice": "74,000",
        "localTradedAt": "2026-08-04T13:00:00+09:00",
        "marketStatus": "OPEN"
    }
    assert generate_prices.build_krx_price_entry(
        item,
        "KRX KOSPI",
        "2026-08-03",
        now=datetime(2026, 8, 4, 4, 0, tzinfo=timezone.utc)
    ) is None


def krx_session_response(url, *args, market_status="OPEN", end_time="1530", **kwargs):
    class Response:
        @staticmethod
        def raise_for_status():
            return None

        @staticmethod
        def json():
            if url == generate_prices.NAVER_KOSPI_CHART_URL:
                return [
                    {"localDate": "20260801"},
                    {"localDate": "20260803"},
                    {"localDate": "20260804"}
                ]
            if url == generate_prices.NAVER_KOSPI_BASIC_URL:
                return {
                    "marketStatus": market_status,
                    "localTradedAt": "2026-08-04T15:30:00+09:00",
                    "stockExchangeType": {"endTime": end_time}
                }
            raise AssertionError(f"unexpected URL: {url}")

    return Response()


def test_krx_completed_session_uses_calendar_rows_and_live_close_state():
    with patch.object(
        generate_prices.requests,
        "get",
        side_effect=lambda url, *args, **kwargs: krx_session_response(
            url,
            *args,
            market_status="OPEN",
            **kwargs
        )
    ):
        before_close = generate_prices.fetch_latest_completed_krx_session(
            now=datetime(2026, 8, 4, 4, 0, tzinfo=timezone.utc)
        )

    with patch.object(
        generate_prices.requests,
        "get",
        side_effect=lambda url, *args, **kwargs: krx_session_response(
            url,
            *args,
            market_status="CLOSE",
            **kwargs
        )
    ):
        after_close = generate_prices.fetch_latest_completed_krx_session(
            now=datetime(2026, 8, 4, 6, 45, tzinfo=timezone.utc)
        )

    assert before_close == "2026-08-03"
    assert after_close == "2026-08-04"


def test_krx_delayed_close_stays_on_previous_session_while_market_is_open():
    def response(url, *args, **kwargs):
        result = krx_session_response(
            url,
            *args,
            market_status="OPEN",
            end_time="1630",
            **kwargs
        )
        if url == generate_prices.NAVER_KOSPI_CHART_URL:
            result.json = lambda: [
                {"localDate": "20261118"},
                {"localDate": "20261119"}
            ]
        elif url == generate_prices.NAVER_KOSPI_BASIC_URL:
            result.json = lambda: {
                "marketStatus": "OPEN",
                "localTradedAt": "2026-11-19T15:45:00+09:00",
                "stockExchangeType": {"endTime": "1630", "closePriceSendTime": "1730"}
            }
        return result

    with patch.object(generate_prices.requests, "get", side_effect=response):
        evidence = generate_prices.fetch_latest_completed_krx_session_evidence(
            now=datetime(2026, 11, 19, 6, 45, tzinfo=timezone.utc)
        )

    assert evidence == {
        "completedSession": "2026-11-18",
        "nextCutoffAt": "2026-11-19T07:40:00Z"
    }


def test_krx_session_fails_closed_when_dynamic_cutoff_passes_without_close_state():
    def response(url, *args, **kwargs):
        result = krx_session_response(url, *args, market_status="OPEN", end_time="1630", **kwargs)
        if url == generate_prices.NAVER_KOSPI_CHART_URL:
            result.json = lambda: [
                {"localDate": "20261118"},
                {"localDate": "20261119"}
            ]
        elif url == generate_prices.NAVER_KOSPI_BASIC_URL:
            result.json = lambda: {
                "marketStatus": "OPEN",
                "localTradedAt": "2026-11-19T16:41:00+09:00",
                "stockExchangeType": {"endTime": "1630"}
            }
        return result

    with patch.object(generate_prices.requests, "get", side_effect=response):
        try:
            generate_prices.fetch_latest_completed_krx_session_evidence(
                now=datetime(2026, 11, 19, 7, 41, tzinfo=timezone.utc)
            )
        except RuntimeError as error:
            assert "not confirmed" in str(error)
        else:
            raise AssertionError("unconfirmed KRX close was unexpectedly certified")


def test_us_calendar_recognizes_early_close_and_confirmation_delay():
    before_confirmation = generate_prices.latest_completed_us_session_evidence(
        now=datetime(2026, 11, 27, 18, 14, tzinfo=timezone.utc)
    )
    after_confirmation = generate_prices.latest_completed_us_session_evidence(
        now=datetime(2026, 11, 27, 18, 16, tzinfo=timezone.utc)
    )

    assert before_confirmation == {
        "completedSession": "2026-11-25",
        "nextCutoffAt": "2026-11-27T18:15:00Z"
    }
    assert after_confirmation["completedSession"] == "2026-11-27"


def test_quote_rows_are_bounded_by_independently_completed_sessions():
    frame = pd.DataFrame(
        {"Close": [100.0, 110.0]},
        index=pd.to_datetime(["2026-08-03", "2026-08-04"])
    )

    us_before = generate_prices.select_latest_completed_close(
        frame,
        "2026-08-03",
        symbol="AAPL"
    )
    us_after = generate_prices.select_latest_completed_close(
        frame,
        "2026-08-04",
        symbol="AAPL"
    )
    fx_before = generate_prices.select_latest_completed_close(
        frame,
        "2026-08-03",
        symbol="KRW=X"
    )
    fx_after = generate_prices.select_latest_completed_close(
        frame,
        "2026-08-04",
        symbol="KRW=X"
    )

    assert us_before == {"close": 100.0, "date": "2026-08-03"}
    assert us_after == {"close": 110.0, "date": "2026-08-04"}
    assert fx_before == {"close": 100.0, "date": "2026-08-03"}
    assert fx_after == {"close": 110.0, "date": "2026-08-04"}


def test_price_quality_rejects_missing_final_close_certification():
    output = valid_output()
    output.pop("finalCloseCertificate")
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "final close certificate is missing or invalid"
    )

    output = valid_output()
    output["methodology"].pop("valuationTiming")
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "methodology valuation timing is not certified"
    )

    output = valid_output()
    output["prices"]["KRX"]["000000"].pop("sessionStatus")
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "KRX contains uncertified price entries"
    )

    output = valid_output()
    output["fx"]["USDKRW"].pop("sessionStatus")
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "USDKRW is missing, stale, or outside the valid date/rate range"
    )


def test_certificate_uses_independent_sessions_instead_of_output_max_dates():
    output = valid_output()
    output["prices"]["US"]["AAPL"]["date"] = "2026-07-30"
    certificate = generate_prices.build_final_close_certificate(
        output,
        output["generatedAt"],
        market_sessions={
            "KRX": FRESH_TRADE_DATE,
            "US": FRESH_TRADE_DATE,
            "FX": FRESH_TRADE_DATE
        },
        valid_until_by_market={
            "KRX": "2026-07-30T06:40:00Z",
            "US": "2026-07-30T20:15:00Z",
            "FX": "2026-07-30T21:15:00Z"
        },
        now=datetime(2026, 7, 29, 22, 30, tzinfo=timezone.utc)
    )

    assert certificate["marketSessions"]["US"] == FRESH_TRADE_DATE
    assert certificate["validUntil"] == "2026-07-30T06:40:00Z"
    assert certificate["validUntilByMarket"] == {
        "KRX": "2026-07-30T06:40:00Z",
        "US": "2026-07-30T20:15:00Z",
        "FX": "2026-07-30T21:15:00Z"
    }


def test_price_quality_requires_market_specific_certificate_validity():
    output = valid_output()
    output["finalCloseCertificate"].pop("validUntilByMarket")
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "final close certificate market validity timestamps are missing"
    )


def test_price_quality_requires_latest_row_for_independently_verified_session():
    output = valid_output()
    output["finalCloseCertificate"]["marketSessions"]["US"] = "2026-07-30"
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "US certified session is after the certificate check date"
    )
    assert_quality_fails(
        output,
        {"US": ["AAPL", "MSFT", "TSLA"]},
        "US latest price date does not match independently verified session"
    )


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
        "valuationTiming": "LATEST_COMPLETED_SESSION",
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
        assert benchmark["sessionStatus"] == "FINAL_CLOSE"


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
            {"KRX": FRESH_TRADE_DATE, "US": FRESH_TRADE_DATE},
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
    kospi_frame = pd.DataFrame({"Close": [3210.25]}, index=trade_index)
    sp500_frame = pd.DataFrame({"Close": [6345.5]}, index=trade_index)

    with patch.object(
        generate_prices.yf,
        "download",
        return_value=kospi_frame
    ) as fetch_kospi:
        kospi = generate_prices.fetch_kospi_benchmark(10, FRESH_TRADE_DATE)

    with patch.object(
        generate_prices.yf,
        "download",
        return_value=sp500_frame
    ) as fetch_sp500:
        sp500 = generate_prices.fetch_sp500_benchmark(10, FRESH_TRADE_DATE)

    assert fetch_kospi.call_args.args == ("^KS11",)
    assert fetch_kospi.call_args.kwargs["auto_adjust"] is False
    assert fetch_kospi.call_args.kwargs["interval"] == "1d"
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


def test_kospi_benchmark_handles_yahoo_multi_index_without_calling_krx_index():
    trade_index = pd.to_datetime([FRESH_TRADE_DATE])
    columns = pd.MultiIndex.from_tuples([("Close", "^KS11")])
    kospi_frame = pd.DataFrame([[3210.25]], index=trade_index, columns=columns)

    with (
        patch.object(
            generate_prices.stock,
            "get_index_ohlcv_by_date",
            side_effect=AssertionError("KRX index endpoint must not be called")
        ) as fetch_krx,
        patch.object(
            generate_prices.yf,
            "download",
            return_value=kospi_frame
        ) as fetch_yahoo
    ):
        kospi = generate_prices.fetch_kospi_benchmark(10, FRESH_TRADE_DATE)

    fetch_krx.assert_not_called()
    assert fetch_yahoo.call_args.args == ("^KS11",)
    assert fetch_yahoo.call_args.kwargs["auto_adjust"] is False
    assert fetch_yahoo.call_args.kwargs["interval"] == "1d"
    assert kospi["level"] == 3210.25
    assert kospi["date"] == FRESH_TRADE_DATE
    assert kospi["symbol"] == "^KS11"
    assert kospi["source"] == "yfinance ^KS11"
    assert kospi["priceBasis"] == "price_index_level"
    assert kospi["distributionTreatment"] == "excluded"
    assert kospi["totalReturn"] is False


def test_yahoo_benchmark_rejects_empty_or_non_positive_close():
    trade_index = pd.to_datetime([FRESH_TRADE_DATE])
    invalid_frames = (
        pd.DataFrame(),
        pd.DataFrame({"Close": [float("nan")]}, index=trade_index),
        pd.DataFrame({"Close": [0]}, index=trade_index),
        pd.DataFrame({"Close": [-1]}, index=trade_index)
    )

    for frame in invalid_frames:
        with patch.object(generate_prices.yf, "download", return_value=frame):
            assert generate_prices.fetch_kospi_benchmark(10, FRESH_TRADE_DATE) is None


def test_invalid_benchmark_is_not_published_as_a_valid_level():
    stale_kospi = generate_prices.build_benchmark_entry(
        "KOSPI",
        "^KS11",
        3210.25,
        "2026-07-27",
        "yfinance ^KS11",
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
            {"KRX": FRESH_TRADE_DATE, "US": FRESH_TRADE_DATE},
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


def test_price_quality_accepts_seven_days_old():
    output = valid_output()
    set_all_market_dates(output, "KRX", "2026-07-28")
    set_all_market_dates(output, "US", "2026-07-28")
    output["fx"]["USDKRW"]["date"] = "2026-07-28"
    output["finalCloseCertificate"]["marketSessions"]["FX"] = "2026-07-28"

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


def test_price_quality_rejects_any_future_date():
    output = valid_output()
    set_all_market_dates(output, "KRX", "2026-08-05")

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
            "finalCloseCertificate",
            "fx",
            "prices",
            "benchmarks",
            "errors",
            "symbolFile",
            "symbolsGeneratedAt"
        }
        assert prices_payload["methodology"] == generate_prices.price_methodology_metadata()
        assert prices_payload["finalCloseCertificate"] == output["finalCloseCertificate"]
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
    test_trusted_ticker_file_covers_required_us_portfolio()
    test_parse_trade_date_rejects_malformed_and_invalid_calendar_dates()
    test_fx_session_uses_yahoo_market_period_instead_of_new_york_cutoff()
    test_fx_session_cutoff_follows_london_standard_time()
    test_fx_session_rollover_does_not_certify_previous_day_during_buffer()
    test_fx_session_metadata_probe_is_separate_from_daily_quote_rows()
    test_krx_intraday_row_is_rewound_to_the_latest_completed_session()
    test_krx_completed_row_keeps_the_reported_close()
    test_krx_open_row_is_never_certified_as_the_current_completed_session()
    test_krx_intraday_row_without_previous_change_is_not_certified()
    test_krx_completed_session_uses_calendar_rows_and_live_close_state()
    test_krx_delayed_close_stays_on_previous_session_while_market_is_open()
    test_krx_session_fails_closed_when_dynamic_cutoff_passes_without_close_state()
    test_us_calendar_recognizes_early_close_and_confirmation_delay()
    test_quote_rows_are_bounded_by_independently_completed_sessions()
    test_price_quality_rejects_missing_final_close_certification()
    test_certificate_uses_independent_sessions_instead_of_output_max_dates()
    test_price_quality_requires_market_specific_certificate_validity()
    test_price_quality_requires_latest_row_for_independently_verified_session()
    test_price_quality_accepts_healthy_output()
    test_methodology_explicitly_excludes_distributions_and_total_return()
    test_benchmark_partial_failure_is_structured_and_keeps_healthy_result()
    test_benchmark_fetchers_use_unadjusted_price_index_closes()
    test_kospi_benchmark_handles_yahoo_multi_index_without_calling_krx_index()
    test_yahoo_benchmark_rejects_empty_or_non_positive_close()
    test_invalid_benchmark_is_not_published_as_a_valid_level()
    test_benchmark_failure_does_not_change_required_valuation_quality()
    test_price_quality_accepts_seven_days_old()
    test_price_quality_rejects_small_krx_market()
    test_price_quality_excludes_stale_krx_entries()
    test_price_quality_rejects_invalid_calendar_dates()
    test_price_quality_rejects_any_future_date()
    test_price_quality_rejects_invalid_or_stale_fx()
    test_price_quality_rejects_low_us_coverage()
    test_price_quality_excludes_stale_us_entries()
    test_price_and_symbol_artifacts_are_separated_and_minified()
    test_price_quality_failure_preserves_existing_artifacts()
