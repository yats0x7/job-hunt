"""
Source registry — maps slug → VCSource instance.

To add a new VC source, import it here and add to the SOURCES dict.
The pipeline orchestrator uses this registry to discover available sources.
"""

from pipeline.scrapers.yc.source import YCSource
from pipeline.scrapers.antler.source import AntlerSource

SOURCES: dict[str, type] = {
    "yc": YCSource,
    "antler": AntlerSource,
    # Adding a new VC = one line here + one new source file
    # "lightspeed": LightspeedSource,
}

def get_source(slug: str):
    if slug not in SOURCES:
        raise ValueError(f'Unknown VC source: {slug}. Available: {list(SOURCES.keys())}')
    return SOURCES[slug]()

def list_sources() -> list[str]:
    """Return list of all registered source slugs."""
    return list(SOURCES.keys())
