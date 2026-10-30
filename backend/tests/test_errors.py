from backend.core.errors import error_summary


def test_error_summary_handles_empty_and_multiline_messages():
    assert error_summary(TimeoutError()) == "TimeoutError"
    assert error_summary(ValueError("first\nsecond")) == "ValueError: first"
