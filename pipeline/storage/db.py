"""
SQLite database layer for the startup discovery pipeline.

Handles schema creation, upserts, and queries using stdlib sqlite3.
No ORM — raw SQL for maximum transparency and control.
"""

import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path

from pipeline.storage.models import Company, Founder, JobBoardResult

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path(__file__).parent.parent.parent / "data" / "startups.db"


class Database:
    """
    SQLite database wrapper for the startup discovery pipeline.

    Schema is auto-created on initialization. Supports upsert semantics
    to handle re-scraping without duplicates.
    """

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH):
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: sqlite3.Connection | None = None

    def connect(self) -> None:
        """Open the database connection and ensure schema exists."""
        self._conn = sqlite3.connect(str(self._db_path))
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._create_schema()
        logger.info(f"Database connected: {self._db_path}")

    def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _create_schema(self) -> None:
        """Create tables if they don't exist."""
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS companies (
                yc_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                logo_url TEXT,
                website TEXT,
                location TEXT,
                description TEXT,
                long_description TEXT,
                industry TEXT,
                industries TEXT,        -- JSON array
                subindustry TEXT,
                batch TEXT,
                is_hiring INTEGER DEFAULT 0,
                is_top_company INTEGER DEFAULT 0,
                status TEXT,
                stage TEXT,
                team_size INTEGER,
                tags TEXT,              -- JSON array
                regions TEXT,           -- JSON array
                source_vc TEXT DEFAULT 'Y Combinator',
                founders TEXT,          -- JSON array of founder objects
                job_board TEXT,         -- JSON object
                last_scraped TEXT,
                data_completeness REAL DEFAULT 0.0
            );

            CREATE INDEX IF NOT EXISTS idx_companies_batch
                ON companies(batch);
            CREATE INDEX IF NOT EXISTS idx_companies_industry
                ON companies(industry);
            CREATE INDEX IF NOT EXISTS idx_companies_is_hiring
                ON companies(is_hiring);
            CREATE INDEX IF NOT EXISTS idx_companies_slug
                ON companies(slug);
            CREATE INDEX IF NOT EXISTS idx_companies_completeness
                ON companies(data_completeness);
            """
        )
        self._conn.commit()

    def get_founders_cached(self, slug: str, max_age_days: int = 7) -> list[Founder] | None:
        """
        Returns cached founders if fresh, None if missing or stale.
        Query:
          SELECT founders, last_scraped FROM companies WHERE slug = ?
          If row exists
            AND last_scraped > (now - max_age_days)
            AND founders IS NOT NULL
            AND founders != '[]':
              return deserialize founders → list[Founder]
          Else: return None
        """
        cursor = self._conn.execute(
            "SELECT founders, last_scraped FROM companies WHERE slug = ?", (slug,)
        )
        row = cursor.fetchone()
        if not row:
            return None
        
        last_scraped_str = row["last_scraped"]
        founders_json = row["founders"]
        
        if not founders_json or founders_json == "[]":
            return None
            
        try:
            last_scraped = datetime.fromisoformat(last_scraped_str)
            age_days = (datetime.utcnow() - last_scraped).days
            if age_days > max_age_days:
                return None
                
            founders_data = json.loads(founders_json)
            return [Founder(**f) for f in founders_data]
        except Exception as e:
            logger.debug(f"Failed to read cached founders for {slug}: {e}")
            return None

    def upsert_company(self, company: Company) -> None:
        """
        Insert or update a company record.

        Uses SQLite's ON CONFLICT (upsert) to handle re-scraping.
        Always updates last_scraped = datetime.utcnow().
        """
        # Calculate completeness before storing
        company.data_completeness = company.calculate_completeness()
        company.last_scraped = datetime.utcnow()

        self._conn.execute(
            """
            INSERT INTO companies (
                yc_id, name, slug, logo_url, website, location,
                description, long_description, industry, industries,
                subindustry, batch, is_hiring, is_top_company,
                status, stage, team_size, tags, regions, source_vc,
                founders, job_board, last_scraped, data_completeness
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?
            )
            ON CONFLICT(yc_id) DO UPDATE SET
                name=excluded.name,
                slug=excluded.slug,
                logo_url=excluded.logo_url,
                website=excluded.website,
                location=excluded.location,
                description=excluded.description,
                long_description=excluded.long_description,
                industry=excluded.industry,
                industries=excluded.industries,
                subindustry=excluded.subindustry,
                batch=excluded.batch,
                is_hiring=excluded.is_hiring,
                is_top_company=excluded.is_top_company,
                status=excluded.status,
                stage=excluded.stage,
                team_size=excluded.team_size,
                tags=excluded.tags,
                regions=excluded.regions,
                source_vc=excluded.source_vc,
                founders=excluded.founders,
                job_board=excluded.job_board,
                last_scraped=excluded.last_scraped,
                data_completeness=excluded.data_completeness
            """,
            (
                company.yc_id,
                company.name,
                company.slug,
                company.logo_url,
                company.website,
                company.location,
                company.description,
                company.long_description,
                company.industry,
                json.dumps(company.industries),
                company.subindustry,
                company.batch,
                int(company.is_hiring),
                int(company.is_top_company),
                company.status,
                company.stage,
                company.team_size,
                json.dumps(company.tags),
                json.dumps(company.regions),
                company.source_vc,
                json.dumps(
                    [f.model_dump() for f in company.founders]
                ),
                json.dumps(
                    company.job_board.model_dump()
                    if company.job_board
                    else None
                ),
                company.last_scraped.isoformat(),
                company.data_completeness,
            ),
        )
        self._conn.commit()

    def upsert_companies(self, companies: list[Company]) -> int:
        """Batch upsert companies. Returns count of upserted records."""
        count = 0
        for company in companies:
            try:
                self.upsert_company(company)
                count += 1
            except Exception as e:
                logger.error(
                    f"Failed to upsert {company.name}: {e}"
                )
        return count

    def get_all_companies(self) -> list[Company]:
        """Retrieve all companies from the database."""
        cursor = self._conn.execute(
            "SELECT * FROM companies ORDER BY data_completeness DESC"
        )
        return [self._row_to_company(row) for row in cursor.fetchall()]

    def get_company_by_slug(self, slug: str) -> Company | None:
        """Retrieve a single company by its slug."""
        cursor = self._conn.execute(
            "SELECT * FROM companies WHERE slug = ?", (slug,)
        )
        row = cursor.fetchone()
        return self._row_to_company(row) if row else None

    def get_stats(self) -> dict:
        """Get aggregate statistics for the dashboard."""
        cursor = self._conn.execute(
            """
            SELECT
                COUNT(*) as total,
                AVG(data_completeness) as avg_completeness,
                SUM(CASE WHEN is_hiring = 1 THEN 1 ELSE 0 END) as hiring_count,
                MAX(last_scraped) as last_updated
            FROM companies
            """
        )
        row = cursor.fetchone()

        # Tier breakdown from job_board data
        tier_stats = {"ats_api": 0, "html_heuristic": 0, "llm_extracted": 0, "manual_visit": 0}
        cursor2 = self._conn.execute("SELECT job_board FROM companies WHERE job_board IS NOT NULL")
        for r in cursor2.fetchall():
            try:
                jb = json.loads(r["job_board"])
                if jb and "source_type" in jb:
                    tier_stats[jb["source_type"]] = tier_stats.get(jb["source_type"], 0) + 1
            except (json.JSONDecodeError, TypeError):
                pass

        total_with_jobs = sum(tier_stats.values())

        return {
            "total_companies": row["total"],
            "avg_completeness": round(row["avg_completeness"] or 0, 2),
            "hiring_count": row["hiring_count"],
            "last_updated": row["last_updated"],
            "tier_breakdown": tier_stats,
            "tier_percentages": {
                k: round(v / total_with_jobs * 100, 1) if total_with_jobs > 0 else 0
                for k, v in tier_stats.items()
            },
        }

    @staticmethod
    def _row_to_company(row: sqlite3.Row) -> Company:
        """Convert a database row to a Company model."""
        founders_data = json.loads(row["founders"]) if row["founders"] else []
        founders = [Founder(**f) for f in founders_data]

        job_board_data = json.loads(row["job_board"]) if row["job_board"] else None
        job_board = JobBoardResult(**job_board_data) if job_board_data else None

        return Company(
            yc_id=row["yc_id"],
            name=row["name"],
            slug=row["slug"],
            logo_url=row["logo_url"],
            website=row["website"],
            location=row["location"],
            description=row["description"],
            long_description=row["long_description"],
            industry=row["industry"],
            industries=json.loads(row["industries"]) if row["industries"] else [],
            subindustry=row["subindustry"],
            batch=row["batch"],
            is_hiring=bool(row["is_hiring"]),
            is_top_company=bool(row["is_top_company"]),
            status=row["status"],
            stage=row["stage"],
            team_size=row["team_size"],
            tags=json.loads(row["tags"]) if row["tags"] else [],
            regions=json.loads(row["regions"]) if row["regions"] else [],
            source_vc=row["source_vc"],
            founders=founders,
            job_board=job_board,
            last_scraped=datetime.fromisoformat(row["last_scraped"]),
            data_completeness=row["data_completeness"],
        )
