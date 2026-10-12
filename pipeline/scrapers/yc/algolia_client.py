"""
Algolia client for fetching YC company data.

Uses the public Algolia index that powers the YC company directory.
Handles pagination, rate limiting, retries, and key expiry.

YC issues short-lived search keys (they expire about a day after the
directory page is served), so the key is read from the directory page at
runtime instead of being hardcoded.

Algolia only pages through the first 1000 hits of any query, and the
directory has several thousand companies. To get all of them the client
splits the query by batch, so each slice stays under that limit.
"""

import asyncio
import json
import logging
import re
import urllib.parse
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

# Algolia stops paginating after this many hits (paginationLimitedTo).
MAX_PAGINATED_HITS = 1000
# Facets used to split a query that matches more than that. Every company
# has exactly one value for each, so the slices cover the index without
# overlapping. Later entries are only used if a slice is still too big.
SPLIT_FACETS = ("batch", "industry", "subindustry")
MAX_FACET_VALUES = 1000

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


def build_filter_string(filters: dict[str, Any] | None = None) -> str:
    """Turn a filters dict into an Algolia filter expression."""
    if not filters:
        # Default: only active companies
        return 'status:"Active"'
    parts = []
    for key, value in filters.items():
        if isinstance(value, bool):
            parts.append(f"{key}:{str(value).lower()}")
        elif isinstance(value, str):
            parts.append(f"{key}:{quote_filter_value(value)}")
        else:
            parts.append(f"{key}:{value}")
    return " AND ".join(parts)


def quote_filter_value(value: str) -> str:
    """Quote a string for use as a value in an Algolia filter expression."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


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

    @staticmethod
    def _build_query_payload(
        page: int, filter_string: str, facet: str | None = None
    ) -> dict:
        """Build the Algolia multi-query request body."""
        params: dict[str, Any] = {
            "hitsPerPage": HITS_PER_PAGE,
            "page": page,
            "facetFilters": "[]",
            "filters": filter_string,
        }
        if facet:
            # Ask for the facet counts too, so an oversized result can be split.
            params["facets"] = json.dumps([facet])
            params["maxValuesPerFacet"] = MAX_FACET_VALUES
        return {
            "requests": [
                {
                    "indexName": INDEX_NAME,
                    "params": urllib.parse.urlencode(params),
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
        filter_string: str,
        facet: str | None = None,
    ) -> dict:
        """Fetch a single page of results from Algolia."""
        payload = self._build_query_payload(page, filter_string, facet)

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
        return response.json().get("results", [{}])[0]

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

    async def _fetch_slice(
        self,
        client: httpx.AsyncClient,
        filter_string: str,
        split_facets: tuple[str, ...],
    ) -> tuple[list[dict], int]:
        """
        Fetch every hit matching filter_string.

        If the query matches more hits than Algolia will paginate, split it
        on the next facet in split_facets and fetch each value separately.

        Returns the hits and the number of hits Algolia reports for the query.
        """
        facet = split_facets[0] if split_facets else None
        first = await self._fetch_page(client, 0, filter_string, facet)
        nb_hits = first.get("nbHits", 0)

        if nb_hits > MAX_PAGINATED_HITS and facet:
            values = first.get("facets", {}).get(facet, {})
            covered = sum(values.values())
            if covered < nb_hits:
                logger.warning(
                    f"Algolia: {nb_hits - covered} of {nb_hits} hits for "
                    f"[{filter_string}] have no {facet} and will be missed"
                )
            logger.info(
                f"Algolia: {nb_hits} hits for [{filter_string}], "
                f"fetching them as {len(values)} {facet} slices"
            )
            hits: list[dict] = []
            for value in sorted(values):
                await asyncio.sleep(PAGE_DELAY_SECONDS)
                slice_hits, _ = await self._fetch_slice(
                    client,
                    f"{filter_string} AND {facet}:{quote_filter_value(value)}",
                    split_facets[1:],
                )
                hits.extend(slice_hits)
            return hits, nb_hits

        if nb_hits > MAX_PAGINATED_HITS:
            logger.warning(
                f"Algolia: {nb_hits} hits for [{filter_string}] but only the "
                f"first {MAX_PAGINATED_HITS} can be fetched"
            )

        hits = [self._strip_highlight(h) for h in first.get("hits", [])]
        for page in range(1, first.get("nbPages", 1)):
            await asyncio.sleep(PAGE_DELAY_SECONDS)
            result = await self._fetch_page(client, page, filter_string)
            hits.extend(self._strip_highlight(h) for h in result.get("hits", []))
        logger.debug(f"Algolia: {len(hits)}/{nb_hits} hits for [{filter_string}]")
        return hits, nb_hits

    async def fetch_all_companies(
        self, filters: dict[str, Any] | None = None
    ) -> list[dict]:
        """
        Fetch all companies from the Algolia index.

        Args:
            filters: Optional dict of Algolia filters. If None, defaults to
                     status="Active". Example: {"isHiring": True, "status": "Active"}

        Returns:
            List of raw company dicts with highlight metadata stripped.

        Raises:
            AlgoliaKeyDiscoveryError: If the key can't be read from the directory page.
            AlgoliaKeyRotatedError: If Algolia rejects a freshly read key (403).
        """
        filter_string = build_filter_string(filters)

        async with httpx.AsyncClient() as client:
            hits, expected = await self._fetch_slice(
                client, filter_string, SPLIT_FACETS
            )

        # Slices don't overlap, but the index can change between requests.
        unique: dict[Any, dict] = {}
        for hit in hits:
            unique.setdefault(hit.get("objectID", id(hit)), hit)
        companies = list(unique.values())

        if len(companies) < expected:
            logger.warning(
                f"Algolia: fetched {len(companies)} companies but the index "
                f"reports {expected}"
            )
        logger.info(f"Algolia: fetched {len(companies)} of {expected} companies")
        return companies
