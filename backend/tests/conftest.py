"""Test-session isolation: every run gets a fresh temp SQLite file.

Must execute before any app import (pytest imports conftest first), since
db.engine and core.config.settings are created at import time.
"""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="ofera-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
