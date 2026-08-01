"""
Abstract base class for VC sources.

To add a new VC: create one file implementing VCSource, then register it
in registry.py. Nothing else in the codebase needs to change.
"""

import asyncio
from abc import ABC, abstractmethod

from pipeline.storage.models import Company, Founder


class VCSource(ABC):
    """
    Every VC scraper implements this interface. Adding a new VC = one new
    file implementing this class. Nothing else changes.
    """

    name: str  # Human-readable, e.g. "Y Combinator"
    slug: str  # Used in registry, e.g. "yc"

    @abstractmethod
    async def list_companies_raw(self) -> list[dict]:
        """
        Fetch raw company data from this VC's source.
        Returns list of raw dicts — no normalization yet.
        """

    @abstractmethod
    def parse_company(self, raw: dict) -> Company:
        """
        Normalize a raw dict into our canonical Company model.
        Field mapping is VC-specific and lives here, not in shared code.
        """

    @abstractmethod
    async def get_founders(self, company: Company) -> list[Founder]:
        """
        Fetch founder data for a company. May require page scraping.
        Returns list of Founder objects.
        """

    async def fetch_all(self) -> list[Company]:
        """
        Default orchestration: list → parse → get_founders.
        VCSources can override if needed.
        """
        raw_list = await self.list_companies_raw()
        companies = [self.parse_company(r) for r in raw_list]

        # Fetch founders concurrently with semaphore to avoid hammering
        sem = asyncio.Semaphore(5)

        async def enrich(c: Company) -> Company:
            async with sem:
                c.founders = await self.get_founders(c)
                return c

        return await asyncio.gather(*[enrich(c) for c in companies])
