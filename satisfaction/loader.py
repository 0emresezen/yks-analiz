# -*- coding: utf-8 -*-
"""
Loader Module
=============
Handles PDF file discovery, coordinates parsing, validates output,
and saves/loads from the validated cache directory.
"""

import os
import json
import logging
import re
from datetime import datetime
from typing import List
from satisfaction.models import UniversitySatisfaction
from satisfaction.parser import UNIARPDFParser
from satisfaction.validator import SatisfactionValidator

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s - %(message)s")

class SatisfactionLoader:
    CACHE_PATH = "satisfaction/satisfaction_cache.json"
    VALIDATED_PATH = "validated/satisfaction_validated.json"
    DATA_DIR = "raw/pdf"  # Configured to look inside the raw/pdf staging directory

    @classmethod
    def load_all_satisfaction_data(cls, rebuild: bool = False) -> List[UniversitySatisfaction]:
        """
        Loads all university satisfaction records.
        If rebuild is True or cache is missing, scans the PDF directory and rebuilds cache.
        Otherwise, loads from the local cache file directly.
        """
        records: List[UniversitySatisfaction] = []

        # Try validated path first, fallback to CACHE_PATH
        target_path = cls.VALIDATED_PATH if os.path.exists(cls.VALIDATED_PATH) else cls.CACHE_PATH

        if not rebuild and os.path.exists(target_path):
            try:
                with open(target_path, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    records = [UniversitySatisfaction.from_dict(d) for d in cached_data]
                    logging.info(f"Loaded {len(records)} satisfaction records from {target_path}")
                    return records
            except Exception as e:
                logging.error(f"Error loading satisfaction cache: {e}. Falling back to parsing.")

        # Rebuild cache by parsing PDFs
        records = cls.parse_pdf_directory()

        if records:
            # Run validator and generate validation report
            SatisfactionValidator.generate_report(records)
            
            # Save to cache and validated stage folders
            cls.save_to_cache(records)
        else:
            # If no PDFs were found/parsed, try loading existing cache as a last resort
            fallback_path = cls.CACHE_PATH
            if os.path.exists(fallback_path):
                try:
                    with open(fallback_path, "r", encoding="utf-8") as f:
                        cached_data = json.load(f)
                        records = [UniversitySatisfaction.from_dict(d) for d in cached_data]
                        logging.info(f"Fallback: Loaded {len(records)} satisfaction records from cache.")
                        # Copy to validated folder
                        cls.save_to_cache(records)
                except Exception as e:
                    logging.error(f"Error loading fallback satisfaction cache: {e}")
            else:
                logging.warning("No PDF reports or cache found. satisfaction data will be empty.")

        return records

    @classmethod
    def parse_pdf_directory(cls) -> List[UniversitySatisfaction]:
        """Scans the data directory for any year-based PDF files and parses them."""
        records: List[UniversitySatisfaction] = []
        
        # Check raw/pdf first, check data/satisfaction as fallback
        search_dirs = [cls.DATA_DIR, "data/satisfaction"]
        
        parser = UNIARPDFParser(use_ocr=True)

        for s_dir in search_dirs:
            if not os.path.exists(s_dir):
                continue
                
            for filename in os.listdir(s_dir):
                if filename.endswith(".pdf"):
                    file_path = os.path.join(s_dir, filename)
                    year_match = re.search(r"(\d{4})", filename)
                    year = int(year_match.group(1)) if year_match else 2024
                    
                    logging.info(f"Parsing PDF file: {file_path} for year {year}")
                    parsed_records = parser.parse_pdf(file_path, year)
                    logging.info(f"Extracted {len(parsed_records)} records from {filename}.")
                    records.extend(parsed_records)

        return records

    @classmethod
    def save_to_cache(cls, records: List[UniversitySatisfaction]):
        """Saves a list of satisfaction records to the JSON cache file and validated storage."""
        serialized = [r.to_dict() for r in records]
        
        # Write to local cache path
        try:
            os.makedirs(os.path.dirname(cls.CACHE_PATH), exist_ok=True)
            with open(cls.CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(serialized, f, ensure_ascii=False, indent=2)
            logging.info(f"Successfully saved {len(records)} records to cache: {cls.CACHE_PATH}")
        except Exception as e:
            logging.error(f"Failed to save satisfaction cache: {e}")
            
        # Write to validated stage path
        try:
            os.makedirs(os.path.dirname(cls.VALIDATED_PATH), exist_ok=True)
            with open(cls.VALIDATED_PATH, "w", encoding="utf-8") as f:
                json.dump(serialized, f, ensure_ascii=False, indent=2)
            logging.info(f"Successfully saved {len(records)} records to validated: {cls.VALIDATED_PATH}")
        except Exception as e:
            logging.error(f"Failed to save validated satisfaction cache: {e}")
