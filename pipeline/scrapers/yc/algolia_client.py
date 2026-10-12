"""
Algolia client for fetching YC company data.

Uses the public Algolia index that powers the YC company directory.
Handles pagination, rate limiting, retries, and key expiry.

YC issues short-lived search keys (they expire about a day after the
directory page is served), so the key is read from the directory page at
runtime instead of being hardcoded.
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

# The directory page embeds the current public search credentials as
#   window.AlgoliaOpts = {"app": "...", "key": "...", "valid_until": ...};
YC_DIRECTORY_URL = "https://www.ycombinator.com/companies"
ALGOLIA_OPTS_RE = re.compile(r"AlgoliaOpts\s*=\s*(\{.*?\})\s*;", re.DOTALL)
INDEX_NAME = "YCCompany_production"

HITS_PER_PAGE = 100
PAGE_DELAY_SECONDS = 0.3

# The page is served to browsers; a bare client UA is more likely to be refused.
PAGE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

RETRYABLE = (httpx.TransportError, httpx.TimeoutException)


@dataclass(frozen=True)
class AlgoliaCredentials:
    app_id: str
    api_key: str

    @property
    def query_url(self) -> str:
        return f"https://{self.app_id.lower()}-dsn.algolia.net/1/indexes/*/queries"

    @property
    def headers(self) -> dict[str, str]:
        return {
            "x-algolia-application-id": self.app_id,
            "x-algolia-api-key": self.api_key,
            "Content-Type": "application/json",
        }


class AlgoliaKeyDiscoveryError(Exception):
    """Raised when the search key cannot be read from the YC directory page."""


class AlgoliaKeyRotatedError(Exception):
    """
    Raised when Algolia still returns 403 with a key freshly read from the
    directory page. The pipeline should alert operators and halt gracefully.
    """

    def __init__(self):
        super().__init__(
            "Algolia returned 403 Forbidden with a key freshly read from "
            f"{YC_DIRECTORY_URL}. YC has probably changed how the directory "
            "authenticates its search requests; check the page's network "
            "requests and update algolia_client.py."
        )


def parse_algolia_opts(html: str) -> AlgoliaCredentials:
    """Extract the Algolia app id and search key from the directory page HTML."""
    match = ALGOLIA_OPTS_RE.search(html)
    if not match:
        raise AlgoliaKeyDiscoveryError(
            f"window.AlgoliaOpts not found in {YC_DIRECTORY_URL}"
        )
    try:
        opts = json.loads(match.group(1))
        return AlgoliaCredentials(app_id=opts["app"], api_key=opts["key"])
    except (ValueError, KeyError, TypeError) as exc:
        raise AlgoliaKeyDiscoveryError(
            f"Could not parse window.AlgoliaOpts from {YC_DIRECTORY_URL}: {exc!r}"
        ) from exc


class AlgoliaClient:
    """
    Async client for querying the YC Algolia index.

    Usage:
        client = AlgoliaClient()
        companies = await client.fetch_all_companies()
    """

    def __init__(self):
        self._credentials: AlgoliaCredentials | None = None

    @retry(
        retry=retry_if_exception_type(RETRYABLE),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def _refresh_credentials(self, client: httpx.AsyncClient) -> None:
        """Read the current search key from the YC directory page."""
        response = await client.get(
            YC_DIRECTORY_URL,
            headers=PAGE_HEADERS,
            follow_redirects=True,
            timeout=30.0,
        )
        if response.status_code != 200:
            raise AlgoliaKeyDiscoveryError(
                f"{YC_DIRECTORY_URL} returned HTTP {response.status_code}"
            )
        self._credentials = parse_algolia_opts(response.text)
        logger.info("Algolia: loaded search key from the YC directory page")

    def _build_query_payload(
        self, page: int, filters: dict[str, Any] | None = None
    ) -> dict:
        """Build the Algolia multi-query request body."""
        # Build facet filter string
        filter_parts = []
        if filters:
            for key, value in filters.items():
                if isinstance(value, bool):
                    filter_parts.append(f"{key}:{str(value).lower()}")
                elif isinstance(value, str):
                    filter_parts.append(f'{key}:"{value}"')
                else:
                    filter_parts.append(f"{key}:{value}")
        else:
            # Default: only active companies
            filter_parts.append('status:"Active"')

        return {
            "requests": [
                {
                    "indexName": INDEX_NAME,
                    "params": (
                        f"hitsPerPage={HITS_PER_PAGE}"
                        f"&page={page}"
                        f"&facetFilters=[]"
                        f"&filters={' AND '.join(filter_parts)}"
                    ),
                }
            ]
        }

    @retry(
        retry=retry_if_exception_type(RETRYABLE),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        page: int,
        filters: dict[str, Any] | None = None,
    ) -> dict:
        """Fetch a single page of results from Algolia."""
        payload = self._build_query_payload(page, filters)

        if self._credentials is None:
            await self._refresh_credentials(client)

        response = await self._post(client, payload)

        if response.status_code == 403:
            # Keys expire, possibly in the middle of a long run. Get a new one
            # and try once more before giving up.
            logger.warning("Algolia returned 403; refreshing the search key")
            await self._refresh_credentials(client)
            response = await self._post(client, payload)
            if response.status_code == 403:
                raise AlgoliaKeyRotatedError()

        response.raise_for_status()
        return response.json()

    async def _post(self, client: httpx.AsyncClient, payload: dict) -> httpx.Response:
        assert self._credentials is not None
        return await client.post(
            self._credentials.query_url,
            json=payload,
            headers=self._credentials.headers,
            timeout=30.0,
        )

    @staticmethod
    def _strip_highlight(hit: dict) -> dict:
        """Remove Algolia's _highlightResult metadata from a hit."""
        hit.pop("_highlightResult", None)
        hit.pop("_snippetResult", None)
        hit.pop("_rankingInfo", None)
        return hit

    async def fetch_all_companies(
        self, filters: dict[str, Any] | None = None
    ) -> list[dict]:
        """
        Fetch all companies from the Algolia index, handling pagination.

        Args:
            filters: Optional dict of Algolia filters. If None, defaults to
                     status="Active". Example: {"isHiring": True, "status": "Active"}

        Returns:
            List of raw company dicts with highlight metadata stripped.

        Raises:
            AlgoliaKeyDiscoveryError: If the key can't be read from the directory page.
            AlgoliaKeyRotatedError: If Algolia rejects a freshly read key (403).
        """
        all_hits: list[dict] = []

        async with httpx.AsyncClient() as client:
            # Fetch first page to get total page count
            page = 0
            first_result = await self._fetch_page(client, page, filters)
            results = first_result.get("results", [{}])[0]
            nb_pages = results.get("nbPages", 1)
            nb_hits = results.get("nbHits", 0)

            logger.info(
                f"Algolia: {nb_hits} total hits across {nb_pages} pages"
            )

            hits = results.get("hits", [])
            all_hits.extend(self._strip_highlight(h) for h in hits)

            # Fetch remaining pages
            for page in range(1, nb_pages):
                await asyncio.sleep(PAGE_DELAY_SECONDS)
                result = await self._fetch_page(client, page, filters)
                hits = result.get("results", [{}])[0].get("hits", [])
                all_hits.extend(self._strip_highlight(h) for h in hits)
                logger.info(
                    f"Algolia: fetched page {page + 1}/{nb_pages} "
                    f"({len(all_hits)} hits so far)"
                )

        logger.info(f"Algolia: fetched {len(all_hits)} companies total")
        return all_hits
