"""
Export module — SQLite → JSON for the Next.js dashboard.

Generates a JSON file that the dashboard reads at build time or via
static import. Includes both company data and aggregate statistics.
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from pipeline.storage.db import Database

logger = logging.getLogger(__name__)

DEFAULT_EXPORT_PATH = Path(__file__).parent.parent.parent / "data" / "companies.json"


def export_to_json(
    db: Database,
    output_path: Path | str = DEFAULT_EXPORT_PATH,
) -> Path:
    """
    Export all companies and statistics to a JSON file.

    The exported file has the structure:
    {
        "metadata": {
            "exported_at": "ISO datetime",
            "total_companies": int,
            "avg_completeness": float,
            ...
        },
        "companies": [...]
    }

    Args:
        db: Connected Database instance
        output_path: Path for the output JSON file

    Returns:
        Path to the exported file
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    companies = db.get_all_companies()
    stats = db.get_stats()

    export_data = {
        "metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "total_companies": stats["total_companies"],
            "avg_completeness": stats["avg_completeness"],
            "hiring_count": stats["hiring_count"],
            "last_updated": stats["last_updated"],
            "tier_breakdown": stats["tier_breakdown"],
            "tier_percentages": stats["tier_percentages"],
        },
        "companies": [
            _company_to_export_dict(c) for c in companies
        ],
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False, default=str)

    logger.info(
        f"Exported {len(companies)} companies to {output_path} "
        f"(avg completeness: {stats['avg_completeness']:.0%})"
    )

    return output_path


def _company_to_export_dict(company) -> dict:
    """
    Convert a Company model to a JSON-serializable dict.

    Uses Pydantic's model_dump for proper serialization of nested models.
    """
    data = company.model_dump()

    # Ensure datetime is serialized as ISO string
    if isinstance(data.get("last_scraped"), datetime):
        data["last_scraped"] = data["last_scraped"].isoformat()

    return data
