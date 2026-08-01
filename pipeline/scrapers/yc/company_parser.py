"""
Company parser for normalizing raw Algolia hits into Company models.

This module contains the field mapping from Algolia's schema to our
canonical Company model. All YC-specific field name translations live here.
"""

from datetime import datetime

from pipeline.storage.models import Company


def parse_algolia_hit(raw: dict) -> Company:
    """
    Parse a raw Algolia hit dict into a canonical Company model.

    Algolia field name → Company field name mapping:
    - objectID → yc_id
    - name → name
    - slug → slug
    - small_logo_thumb_url → logo_url
    - website → website
    - all_locations → location
    - one_liner → description
    - long_description → long_description
    - industry → industry (primary string)
    - industries → industries (array)
    - subindustry → subindustry
    - batch_name → batch
    - isHiring → is_hiring
    - top_company → is_top_company
    - status → status
    - stage → stage
    - team_size → team_size
    - tags → tags
    - regions → regions
    """
    # Extract yc_id — Algolia uses objectID as string, we need int
    yc_id_raw = raw.get("objectID", raw.get("id", 0))
    try:
        yc_id = int(yc_id_raw)
    except (ValueError, TypeError):
        yc_id = hash(yc_id_raw) % (10**9)

    # Parse team_size — can be a string like "11-50" or an int
    team_size_raw = raw.get("team_size")
    team_size = None
    if team_size_raw is not None:
        if isinstance(team_size_raw, int):
            team_size = team_size_raw
        elif isinstance(team_size_raw, str):
            # Handle range format like "11-50" → take lower bound
            try:
                team_size = int(team_size_raw.split("-")[0].strip())
            except (ValueError, IndexError):
                team_size = None

    return Company(
        yc_id=yc_id,
        name=raw.get("name", "Unknown"),
        slug=raw.get("slug", ""),
        logo_url=raw.get("small_logo_thumb_url"),
        website=raw.get("website"),
        location=raw.get("all_locations"),
        description=raw.get("one_liner"),
        long_description=raw.get("long_description"),
        industry=raw.get("industry"),
        industries=raw.get("industries") or [],
        subindustry=raw.get("subindustry"),
        batch=raw.get("batch_name"),
        is_hiring=bool(raw.get("isHiring", False)),
        is_top_company=bool(raw.get("top_company", False)),
        status=raw.get("status"),
        stage=raw.get("stage"),
        team_size=team_size,
        tags=raw.get("tags") or [],
        regions=raw.get("regions") or [],
        source_vc="Y Combinator",
        last_scraped=datetime.utcnow(),
    )
