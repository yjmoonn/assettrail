import importlib.util
from pathlib import Path


spec = importlib.util.spec_from_file_location("generate_prices", Path("scripts/generate_prices.py"))
generate_prices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_prices)


def test_merge_tickers_deduplicates_and_sorts():
    merged = generate_prices.merge_tickers(
        {"KRX": ["005930"], "US": ["AAPL", "TSLA"]},
        {"US": ["tsla", "MSFT"]}
    )

    assert merged == {
        "KRX": ["005930"],
        "US": ["AAPL", "MSFT", "TSLA"]
    }


def test_parse_firestore_string_array():
    document = {
        "fields": {
            "tickers": {
                "arrayValue": {
                    "values": [
                        {"stringValue": "TSLA"},
                        {"stringValue": "msft"},
                        {"integerValue": "123"}
                    ]
                }
            }
        }
    }

    assert generate_prices.parse_firestore_string_array(document, "tickers") == ["TSLA", "msft"]


def test_read_firebase_project_id():
    assert generate_prices.read_firebase_project_id() == "assettrail-6f676"


if __name__ == "__main__":
    test_merge_tickers_deduplicates_and_sorts()
    test_parse_firestore_string_array()
    test_read_firebase_project_id()
