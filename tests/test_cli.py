from cms_market_mcp.cli import parse_filter_pairs


def test_parse_filter_pairs_returns_none_for_empty():
    assert parse_filter_pairs(None) is None
    assert parse_filter_pairs([]) is None


def test_parse_filter_pairs_parses_repeated_key_value_pairs():
    assert parse_filter_pairs(["State=FL", "City=Melbourne"]) == {"State": "FL", "City": "Melbourne"}
