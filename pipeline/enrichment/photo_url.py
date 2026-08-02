"""
Normalize founder photo URLs for durable storage and dashboard use.

YC Bookface embeds S3 presigned avatar URLs that expire (~1 hour). The same
objects are publicly readable without the signature query string, so we strip
query/fragment before persisting. Relative placeholders (e.g. /avatars/thumb/missing.png)
are treated as missing.
"""

from __future__ import annotations

from urllib.parse import urlparse, urlunparse


def normalize_photo_url(url: str | None) -> str | None:
    if not url or not isinstance(url, str):
        return None
    trimmed = url.strip()
    if not trimmed:
        return None
    if trimmed.startswith("/"):
        return None
    lower = trimmed.lower()
    if "missing.png" in lower or "missing.jpg" in lower:
        return None

    try:
        parsed = urlparse(trimmed)
    except Exception:
        return None

    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None

    # Drop AWS signature / session query params and fragments
    clean = parsed._replace(query="", fragment="")
    return urlunparse(clean)
