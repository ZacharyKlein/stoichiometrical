"""Stoichiometrical web server.

Run with:

    python3 app.py

Then open http://127.0.0.1:8000 in a browser.
"""

from __future__ import annotations

import json
import mimetypes
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from stoichiometrical.conversions import (
    ConversionError,
    FormulaError,
    analyze_element_mass_percent,
    convert_amount,
    serialize_element_analysis,
    serialize_result,
)


ROOT = Path(__file__).parent.resolve()
STATIC_ROOT = ROOT / "static"
HOST = "127.0.0.1"
PORT = 8000


class StoichiometricalHandler(SimpleHTTPRequestHandler):
    """Serve the UI and the conversion JSON API."""

    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)

        if parsed_url.path == "/":
            self._send_file(STATIC_ROOT / "index.html", "text/html; charset=utf-8")
            return

        if parsed_url.path == "/api/convert":
            self._handle_convert(parse_qs(parsed_url.query))
            return

        if parsed_url.path == "/api/element":
            self._handle_element_analysis(parse_qs(parsed_url.query))
            return

        requested_path = (STATIC_ROOT / parsed_url.path.lstrip("/")).resolve()
        if STATIC_ROOT not in requested_path.parents and requested_path != STATIC_ROOT:
            self._send_json({"error": "File not found."}, HTTPStatus.NOT_FOUND)
            return

        if requested_path.is_file():
            content_type = mimetypes.guess_type(str(requested_path))[0] or "text/plain"
            self._send_file(requested_path, content_type)
            return

        self._send_json({"error": "File not found."}, HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: object) -> None:
        """Keep local server output quiet during classroom use."""

    def _handle_convert(self, params: dict) -> None:
        try:
            formula = _first(params, "formula", "H2O")
            value = _parse_amount(_first(params, "value", "18.015"))
            from_unit = _first(params, "fromUnit", "mass")
            to_unit = _first(params, "toUnit", "particles")
            result = convert_amount(formula, value, from_unit, to_unit)
        except (FormulaError, ConversionError) as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        self._send_json(serialize_result(result))

    def _handle_element_analysis(self, params: dict) -> None:
        try:
            formula = _first(params, "formula", "HCl")
            element = _first(params, "element", "Cl")
            result = analyze_element_mass_percent(formula, element)
        except (FormulaError, ConversionError) as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        self._send_json(serialize_element_analysis(result))

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, content_type: str) -> None:
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _first(params: dict, key: str, default: str) -> str:
    values = params.get(key)
    if not values:
        return default
    return values[0]


def _parse_amount(raw_value: str) -> float:
    try:
        return float(raw_value)
    except ValueError as exc:
        raise ConversionError("Enter the amount as a number.") from exc


def run() -> None:
    server = ThreadingHTTPServer((HOST, PORT), StoichiometricalHandler)
    print(f"Stoichiometrical is running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run()
