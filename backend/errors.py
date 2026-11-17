"""The error shapes every area uses.

- 422: {"message": "Check the highlighted fields.", "errors": {field: message}}
- 409: {"message": "...", "details": {...}}
- 404: {"message": "That deal no longer exists."}
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

CHECK_FIELDS = "Check the highlighted fields."


class AppError(Exception):
    status = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message

    def body(self) -> dict[str, Any]:
        return {"message": self.message}


class Invalid(AppError):
    """Invalid input, with a message per field."""

    status = 422

    def __init__(self, errors: dict[str, str], message: str = CHECK_FIELDS):
        super().__init__(message)
        self.errors = errors

    def body(self) -> dict[str, Any]:
        return {"message": self.message, "errors": self.errors}


class Refused(AppError):
    """A delete, move or reopening the rules don't allow."""

    status = 409

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.details = details or {}

    def body(self) -> dict[str, Any]:
        return {"message": self.message, "details": self.details}


class NotFound(AppError):
    status = 404

    def __init__(self, kind: str):
        super().__init__(f"That {kind} no longer exists.")


def _field_name(loc: tuple) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return ".".join(parts) or "body"


def _plain_words(error: dict[str, Any]) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    if kind == "missing":
        return "This field is required."
    if kind in ("int_parsing", "int_type", "int_from_float"):
        return "Enter a whole number."
    if kind in ("date_parsing", "date_from_datetime_parsing", "date_type"):
        return "Enter a date."
    if kind in ("datetime_parsing", "datetime_from_date_parsing", "datetime_type"):
        return "Enter a date and time."
    if kind == "string_too_long":
        return f"Use {ctx.get('max_length')} characters or fewer."
    if kind == "string_type":
        return "Enter text."
    if kind in ("bool_parsing", "bool_type"):
        return "Choose yes or no."
    if kind in ("literal_error", "enum"):
        return "Choose one of the options."
    if kind == "json_invalid":
        return "The request couldn't be read."
    if kind == "model_attributes_type" or kind == "dict_type":
        return "The request couldn't be read."
    if kind in ("greater_than_equal", "less_than_equal"):
        return "Enter a number in the allowed range."
    if kind == "extra_forbidden":
        return "This field isn't allowed."
    if kind == "value_error":
        # Our own validators raise ValueError with a sentence for the user.
        message = str(ctx.get("error") or error.get("msg", ""))
        return message.removeprefix("Value error, ")
    return "Check this field."


def validation_errors(errors: list[dict[str, Any]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for error in errors:
        name = _field_name(tuple(error.get("loc", ())))
        out.setdefault(name, _plain_words(error))
    return out


async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content=exc.body())


async def _request_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"message": CHECK_FIELDS, "errors": validation_errors(list(exc.errors()))},
    )


def install(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _request_validation_error)  # type: ignore[arg-type]
