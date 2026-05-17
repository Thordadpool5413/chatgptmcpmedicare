from cms_market_mcp.cms_client import local_filter_rows, rows_from_cms_payload


def test_rows_from_cms_payload_with_headers():
    payload = {"meta": {"headers": ["A", "B"], "size": 2}, "data": [["one", "two"], ["three", "four"]]}
    rows, meta = rows_from_cms_payload(payload)
    assert rows == [{"A": "one", "B": "two"}, {"A": "three", "B": "four"}]
    assert meta["size"] == 2


def test_rows_from_provider_payload():
    payload = {"results": [{"State": "FL"}], "count": 1}
    rows, meta = rows_from_cms_payload(payload)
    assert rows == [{"State": "FL"}]
    assert meta["count"] == 1


def test_local_filter_rows_contains():
    rows = [{"State": "FL", "Name": "Brevard Hospital"}, {"State": "GA", "Name": "Other"}]
    filtered = local_filter_rows(rows, {"state": "fl", "name": "brevard"})
    assert len(filtered) == 1
    assert filtered[0]["State"] == "FL"
