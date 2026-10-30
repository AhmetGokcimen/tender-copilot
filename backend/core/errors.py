def error_summary(e: BaseException, limit: int = 300) -> str:
    """One safe line about an exception: its class and the first line of its
    message (which may be empty). Never includes tracebacks or URLs' secrets
    beyond what the message itself carries."""
    first = next(iter(str(e).splitlines()), "")
    return f"{type(e).__name__}: {first[:limit]}" if first else type(e).__name__
