#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_goatcounter.py のリトライ挙動のテスト（標準ライブラリのみ・実APIには一切アクセスしない）。

urllib.request.urlopen と time.sleep を差し替えて、
GoatCounter APIの一時的な障害（404/429/5xx・ネットワーク断）と、
再試行してはいけない認証エラー（401/403）を模擬する。

実行方法：
  python3 tools/growth/test_fetch_goatcounter_retry.py
  または: python3 -m unittest tools.growth.test_fetch_goatcounter_retry -v
"""
import importlib.util
import io
import json
import os
import sys
import unittest
import urllib.error
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
MODULE_PATH = os.path.join(HERE, "fetch_goatcounter.py")

_spec = importlib.util.spec_from_file_location("fetch_goatcounter", MODULE_PATH)
fetch_goatcounter = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fetch_goatcounter)


def http_error(code, body=b'{"error":"not found"}'):
    return urllib.error.HTTPError(
        url="https://example.goatcounter.com/api/v0/stats/hits",
        code=code,
        msg="error",
        hdrs=None,
        fp=io.BytesIO(body),
    )


class FakeResponse:
    def __init__(self, payload):
        self._body = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self._body


class RetryLogicTests(unittest.TestCase):
    def setUp(self):
        # 実際にsleepしないようにする（テストを高速化・確実に実APIへ到達させない）。
        self.sleep_patcher = mock.patch.object(fetch_goatcounter.time, "sleep")
        self.mock_sleep = self.sleep_patcher.start()
        self.addCleanup(self.sleep_patcher.stop)

    def test_succeeds_on_first_attempt_without_retry(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request, "urlopen", return_value=FakeResponse({"hits": []})
        ) as mock_urlopen:
            result = fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(result, {"hits": []})
        self.assertEqual(mock_urlopen.call_count, 1)
        self.mock_sleep.assert_not_called()

    def test_retries_on_404_then_succeeds(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request,
            "urlopen",
            side_effect=[http_error(404), FakeResponse({"hits": ["ok"]})],
        ) as mock_urlopen:
            result = fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(result, {"hits": ["ok"]})
        self.assertEqual(mock_urlopen.call_count, 2)
        self.mock_sleep.assert_called_once()

    def test_retries_on_429_then_5xx_then_succeeds(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request,
            "urlopen",
            side_effect=[http_error(429), http_error(503), FakeResponse({"hits": []})],
        ) as mock_urlopen:
            result = fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(result, {"hits": []})
        self.assertEqual(mock_urlopen.call_count, 3)
        self.assertEqual(self.mock_sleep.call_count, 2)

    def test_gives_up_after_max_attempts_and_exits_1(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request,
            "urlopen",
            side_effect=[http_error(503), http_error(503), http_error(503)],
        ) as mock_urlopen:
            with self.assertRaises(SystemExit) as ctx:
                fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(ctx.exception.code, 1)
        self.assertEqual(mock_urlopen.call_count, fetch_goatcounter.RETRY_MAX_ATTEMPTS)
        self.assertEqual(self.mock_sleep.call_count, fetch_goatcounter.RETRY_MAX_ATTEMPTS - 1)

    def test_401_fails_immediately_without_retry(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request, "urlopen", side_effect=[http_error(401)]
        ) as mock_urlopen:
            with self.assertRaises(SystemExit) as ctx:
                fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(ctx.exception.code, 1)
        self.assertEqual(mock_urlopen.call_count, 1)
        self.mock_sleep.assert_not_called()

    def test_403_fails_immediately_without_retry(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request, "urlopen", side_effect=[http_error(403)]
        ) as mock_urlopen:
            with self.assertRaises(SystemExit):
                fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(mock_urlopen.call_count, 1)
        self.mock_sleep.assert_not_called()

    def test_non_retryable_4xx_fails_immediately(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request, "urlopen", side_effect=[http_error(400)]
        ) as mock_urlopen:
            with self.assertRaises(SystemExit):
                fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(mock_urlopen.call_count, 1)
        self.mock_sleep.assert_not_called()

    def test_network_error_retries_then_succeeds(self):
        network_error = urllib.error.URLError("connection reset")
        with mock.patch.object(
            fetch_goatcounter.urllib.request,
            "urlopen",
            side_effect=[network_error, FakeResponse({"hits": []})],
        ) as mock_urlopen:
            result = fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(result, {"hits": []})
        self.assertEqual(mock_urlopen.call_count, 2)
        self.mock_sleep.assert_called_once()

    def test_network_error_exhausts_retries_and_exits_1(self):
        network_error = urllib.error.URLError("connection reset")
        with mock.patch.object(
            fetch_goatcounter.urllib.request,
            "urlopen",
            side_effect=[network_error, network_error, network_error],
        ) as mock_urlopen:
            with self.assertRaises(SystemExit) as ctx:
                fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        self.assertEqual(ctx.exception.code, 1)
        self.assertEqual(mock_urlopen.call_count, fetch_goatcounter.RETRY_MAX_ATTEMPTS)

    def test_backoff_is_short_and_increasing(self):
        with mock.patch.object(
            fetch_goatcounter.urllib.request,
            "urlopen",
            side_effect=[http_error(500), http_error(500), FakeResponse({"hits": []})],
        ):
            fetch_goatcounter.api_get("example", "dummy-token", "/stats/hits", {})
        waited = [call.args[0] for call in self.mock_sleep.call_args_list]
        self.assertEqual(len(waited), 2)
        # 短い・増加するbackoff（1s, 2s）であること。長時間待たせない。
        self.assertTrue(all(0 < w <= 5 for w in waited))
        self.assertLess(waited[0], waited[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
