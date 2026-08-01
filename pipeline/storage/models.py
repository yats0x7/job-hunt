"""
Data models for the startup discovery pipeline.

Uses Pydantic v2 for validation and serialization.
These are the canonical models shared across all pipeline stages.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Founder(BaseModel):
    """Represents a startup founder with optional enrichment data."""

    name: str
    college: str | None = None
    photo_url: str | None = None
    linkedin_url: str | None = None
    raw_bio: str | None = None


class JobBoardResult(BaseModel):
    """
    Result of job board resolution.

    source_type indicates which tier of the resolution cascade produced this result:
    - ats_api: Direct ATS API hit (Tier 1, most reliable)
    - html_heuristic: Parsed from careers page HTML (Tier 2)
    - llm_extracted: Extracted via local LLM (Tier 3)
    - manual_visit: Could not be automatically resolved (Tier 4)
    """

    count: int | None = None
    url: str | None = None
    source_type: Literal[
        "ats_api",  # Tier 1
        "html_heuristic",  # Tier 2
        "llm_extracted",  # Tier 3
        "manual_visit",  # Tier 4
    ]
    ats_platform: str | None = None  # "greenhouse", "lever", "ashby" etc.


class Company(BaseModel):
    """
    Canonical company model.

    Fields are sourced from Algolia (raw scrape) and enriched by the pipeline.
    The `data_completeness` score is calculated post-enrichment and drives
    the quality metrics shown in the dashboard.
    """

    # From Algolia (verified field names — do not change):
    yc_id: int | None = None
    name: str
    slug: str
    logo_url: str | None = None  # Algolia: small_logo_thumb_url
    website: str | None = None
    location: str | None = None  # Algolia: all_locations
    description: str | None = None  # Algolia: one_liner
    long_description: str | None = None
    industry: str | None = None  # Algolia: industry (primary string)
    industries: list[str] = Field(default_factory=list)  # Algolia: industries (array)
    subindustry: str | None = None
    batch: str | None = None  # e.g. "Summer 2013"
    is_hiring: bool = False  # Algolia: isHiring
    is_top_company: bool = False  # Algolia: top_company
    status: str | None = None  # "Active", "Public", "Acquired"
    stage: str | None = None
    team_size: int | None = None
    tags: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    source_vc: str = "Y Combinator"

    # Enriched fields:
    founders: list[Founder] = Field(default_factory=list)
    job_board: JobBoardResult | None = None

    # Pipeline metadata:
    last_scraped: datetime = Field(default_factory=datetime.utcnow)
    data_completeness: float = 0.0  # calculated field, 0.0-1.0

    def calculate_completeness(self) -> float:
        """
        Scores 4 required data points (0.25 each):
        1. Company name + logo (both present)
        2. At least one founder with name + photo
        3. Job count + authoritative URL resolved
        4. Location + industry both present
        """
        score = 0.0
        if self.name and self.logo_url:
            score += 0.25
        if self.founders and self.founders[0].photo_url:
            score += 0.25
        if self.job_board and self.job_board.url:
            score += 0.25
        if self.location and self.industry:
            score += 0.25
        return score
