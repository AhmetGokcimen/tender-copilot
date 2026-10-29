"""One-way demo reset for the multi-tenant migration (v0.2.0 -> v0.3.0).

The old database holds a single shared demo company with no User or
membership rows. Rather than guessing a data migration, this script takes
the blessed path: timestamped backup first, then delete, then print the
three commands that rebuild (sync + onboard). The backup is never touched
again, so nothing is unrecoverable.

Usage (from repo root):
    python -m backend.scripts.migrate_demo [optional/path/to/app.db]
"""

import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path


def backup_and_reset(db_path: Path) -> Path:
    """Copy db_path to a timestamped sibling, delete the original, return
    the backup path. Raises FileNotFoundError when there is nothing to do."""
    if not db_path.exists():
        raise FileNotFoundError(f"No database at {db_path} — nothing to reset")
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    backup = db_path.with_name(f"{db_path.name}.bak-{stamp}")
    shutil.copy2(db_path, backup)
    db_path.unlink()
    return backup


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parent.parent  # backend/
    db_path = Path(argv[1]) if len(argv) > 1 else root / "data" / "app.db"
    try:
        backup = backup_and_reset(db_path)
    except FileNotFoundError as e:
        print(f"{e}. Start the server and onboard — no reset needed.")
        return 0
    print(f"Backed up to {backup} and removed {db_path}.")
    print("Next: start the API (tables + demo user are created on demand),")
    print("POST /api/tenders/sync/romania to re-sync, then onboard the demo")
    print("company via POST /api/company.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
