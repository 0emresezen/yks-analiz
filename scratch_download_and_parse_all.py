import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from satisfaction.downloader import UNIARDownloader
from satisfaction.loader import SatisfactionLoader

print("1. Downloading missing reports...")
results = UNIARDownloader.download_missing_reports([2023, 2024])
print("Download results:", results)

print("\n2. Parsing reports and rebuilding cache...")
records = SatisfactionLoader.load_all_satisfaction_data(rebuild=True)
print(f"Successfully loaded/parsed {len(records)} records.")

if records:
    unis = sorted(list(set(r.university_name for r in records)))
    print(f"\nUnique universities found ({len(unis)}):")
    for u in unis:
        print(f" - {u}")
else:
    print("No records parsed.")
