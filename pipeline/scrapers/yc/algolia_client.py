"""
Algolia client for fetching YC company data.

Uses the public Algolia index that powers the YC company directory.
Handles pagination, rate limiting, retries, and key rotation detection.
"""

import asyncio
import logging
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

# Verified Algolia constants — these are the public keys used by the YC directory
ALGOLIA_APP_ID = "45BWZJ1SGC"
ALGOLIA_API_KEY = (
    "NzllNTY5MzJiZGM2OTY2ZTQwMDEzOTNhYWZiZGRjODlhYzVkNjBmOGRjNzJiMWM4ZTU0ZDlh"
    "YTZjOTJiMjlhMWFuYWx5dGljc1RhZ3M9eWNkYyZyZXN0cmljdEluZGljZXM9WUNDb21wYW55X3"
    "Byb2R1Y3Rpb24lMkNZQ0NvbXBhbnlfQnlfTGF1bmNoX0RhdGVfcHJvZHVjdGlvbiZ0YWdGaWx0"
    "ZXJzPSU1QiUyMnljZGNfcHVibGljJTIyJTVE"
)
INDEX_NAME = "YCCompany_production"
BASE_URL = f"https://{ALGOLIA_APP_ID.lower()}-dsn.algolia.net/1/indexes/*/queries"

HITS_PER_PAGE = 100
PAGE_DELAY_SECONDS = 0.3


class AlgoliaKeyRotatedError(Exception):
    """
    Raised when Algolia returns 403, indicating the API key has been rotated.
    The pipeline should alert operators and halt gracefully.
    """

    def __init__(self):
        super().__init__(
            "Algolia API key returned 403 Forbidden. "
            "The public API key has likely been rotated. "
            "Update ALGOLIA_API_KEY in algolia_client.py with the new key "
            "from the YC company directory's network requests."
        )


class AlgoliaClient:
    """
    Async client for querying the YC Algolia index.

    Usage:
        client = AlgoliaClient()
        companies = await client.fetch_all_companies()
    """

    def __init__(self):
        self._headers = {
            "x-algolia-application-id": ALGOLIA_APP_ID,
            "x-algolia-api-key": ALGOLIA_API_KEY,
            "Content-Type": "application/json",
        }

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
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        page: int,
        filters: dict[str, Any] | None = None,
    ) -> dict:
        """Fetch a single page of results from Algolia."""
        payload = self._build_query_payload(page, filters)

        response = await client.post(
            BASE_URL,
            json=payload,
            headers=self._headers,
            timeout=30.0,
        )

        if response.status_code == 403:
            raise AlgoliaKeyRotatedError()

        response.raise_for_status()
        return response.json()

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
            AlgoliaKeyRotatedError: If the API key has been rotated (403).
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
