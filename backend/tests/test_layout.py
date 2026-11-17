"""Shared backend code never imports from a business area.

Only the files that put the app together may: main.py, seed.py and
migrations/env.py.
"""

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
NOT_AREAS = {"migrations", "tests", "__pycache__"}
MAY_IMPORT_AREAS = {
    BACKEND / "main.py",
    BACKEND / "seed.py",
    BACKEND / "migrations" / "env.py",
}


def _areas() -> set[str]:
    return {
        p.name
        for p in BACKEND.iterdir()
        if p.is_dir() and p.name not in NOT_AREAS and (p / "__init__.py").exists()
    }


def _shared_files() -> list[Path]:
    files = list(BACKEND.glob("*.py")) + list((BACKEND / "migrations").rglob("*.py"))
    return [f for f in files if f not in MAY_IMPORT_AREAS]


def _imported_areas(path: Path, areas: set[str]) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(), filename=str(path))):
        modules: list[str] = []
        if isinstance(node, ast.Import):
            modules = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:  # relative import from inside backend/
                base = "backend." + base if base else "backend"
            modules = [base] + [f"{base}.{alias.name}" for alias in node.names]
        for module in modules:
            parts = module.split(".")
            if len(parts) >= 2 and parts[0] == "backend" and parts[1] in areas:
                found.add(parts[1])
    return found


def test_the_crm_is_an_area():
    assert "crm" in _areas()


def test_shared_files_never_import_an_area():
    areas = _areas()
    offenders = {
        str(path.relative_to(BACKEND)): sorted(_imported_areas(path, areas))
        for path in _shared_files()
        if _imported_areas(path, areas)
    }
    assert offenders == {}
