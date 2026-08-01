"""
LLM fallback utilities for the enrichment pipeline.

Provides helper functions for interacting with local Ollama instance
when structured API/scraping approaches fail.
"""

import json
import logging
import re
import ollama

logger = logging.getLogger(__name__)

# Module-level disable flag — controlled at startup, not per call-site
_LLM_DISABLED = False

def disable_llm() -> None:
    """
    Call once at startup if --no-llm flag is set.
    After calling this, ALL LLM functions return None immediately
    with zero network attempts. Never call ollama after this is set.
    """
    global _LLM_DISABLED
    _LLM_DISABLED = True

def extract_college_from_bio(bio_text: str) -> str | None:
    """SYNCHRONOUS. Called via asyncio.to_thread() from async code."""
    if _LLM_DISABLED:
        return None  # immediate return — no HTTP, no import, no timeout

    if not bio_text or len(bio_text.strip()) < 10:
        return None  # don't waste LLM call on empty/trivial text

    try:
        response = ollama.chat(
            model='llama3.2:1b',
            messages=[{
                'role': 'user',
                'content': (
                    'Extract the university or college this founder attended. '
                    'Return ONLY valid JSON: {"college": "Name"} or {"college": null}. '
                    'Do not include any explanation or markdown. '
                    f'Bio: {bio_text}'
                )
            }],
            options={'num_predict': 50},  # college name is short, cap tokens
        )
        raw = response['message']['content'].strip()
        # Strip markdown fences if model adds them despite instruction
        raw = raw.replace('```json', '').replace('```', '').strip()
        parsed = json.loads(raw)
        college = parsed.get('college')
        return college if isinstance(college, str) else None
    except Exception:
        return None  # NEVER raise — always degrade gracefully

def extract_job_count_from_text(page_text: str) -> int | None:
    """
    SYNCHRONOUS. Tier 3 of job_resolver.py cascade.
    Called via asyncio.to_thread() from async code.
    """
    if _LLM_DISABLED:
        return None  # immediate return

    if not page_text:
        return None

    # Truncate to 2000 chars — model doesn't need more for counting
    truncated = page_text[:2000]

    try:
        response = ollama.chat(
            model='llama3.2:1b',
            messages=[{
                'role': 'user',
                'content': (
                    'Count the number of distinct open job listings on this '
                    'careers page. Return ONLY valid JSON: {"job_count": integer}. '
                    'If you cannot determine a count, return {"job_count": null}. '
                    'Do not include any explanation. '
                    f'Page text: {truncated}'
                )
            }],
            options={'num_predict': 20},  # just a number, cap aggressively
        )
        raw = response['message']['content'].strip()
        raw = raw.replace('```json', '').replace('```', '').strip()
        parsed = json.loads(raw)
        count = parsed.get('job_count')
        return int(count) if isinstance(count, (int, float)) and count is not None else None
    except Exception:
        return None
