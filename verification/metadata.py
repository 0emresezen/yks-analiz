# -*- coding: utf-8 -*-
"""
Metadata Module
===============
Defines the SourceMetadata class and file hashing helper methods.
"""

import hashlib
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, Any

@dataclass
class SourceMetadata:
    source_name: str
    source_type: str  # E.g. "PDF", "API"
    source_url: str
    publication_year: int
    publication_date: str
    retrieved_at: str
    file_hash: str
    parser_version: str = "2.0.0"
    verified: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SourceMetadata":
        return cls(
            source_name=data["source_name"],
            source_type=data["source_type"],
            source_url=data["source_url"],
            publication_year=int(data["publication_year"]),
            publication_date=data["publication_date"],
            retrieved_at=data["retrieved_at"],
            file_hash=data["file_hash"],
            parser_version=data.get("parser_version", "2.0.0"),
            verified=bool(data.get("verified", True))
        )

def get_file_sha256(filepath: str) -> str:
    """Calculates the SHA256 checksum of a file."""
    if not os.path.exists(filepath):
        return ""
    
    sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception:
        return ""
