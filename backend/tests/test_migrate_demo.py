"""Demo DB reset is backup-first and refuses missing files."""

from pathlib import Path

import pytest


def test_backup_and_reset_moves_db_to_timestamped_backup(tmp_path: Path) -> None:
    from backend.scripts.migrate_demo import backup_and_reset

    db = tmp_path / "app.db"
    db.write_bytes(b"old-data")
    backup = backup_and_reset(db)
    assert not db.exists()
    assert backup.read_bytes() == b"old-data"
    assert backup.name.startswith("app.db.bak-")


def test_backup_and_reset_refuses_missing_db(tmp_path: Path) -> None:
    from backend.scripts.migrate_demo import backup_and_reset

    with pytest.raises(FileNotFoundError):
        backup_and_reset(tmp_path / "app.db")
