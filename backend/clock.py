"""The one source of today's date and the time.

Call `clock.today()` and `clock.now()` through the module, never import the
functions by name, so tests can fix the date with `set_now`.
"""

from datetime import date, datetime

_fixed: datetime | None = None


def now() -> datetime:
    """Local time, to the second, with no time zone."""
    if _fixed is not None:
        return _fixed
    return datetime.now().replace(microsecond=0)


def today() -> date:
    return now().date()


def set_now(value: datetime | None) -> None:
    """Fix the time for tests. `None` goes back to the computer's clock."""
    global _fixed
    _fixed = value
