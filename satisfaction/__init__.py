# -*- coding: utf-8 -*-
"""
Satisfaction Package
====================
Verifiable, source-backed university satisfaction querying and parsing.
"""

from satisfaction.models import UniversitySatisfaction
from satisfaction.matcher import UniversityMatcher
from satisfaction.parser import UNIARPDFParser
from satisfaction.validator import SatisfactionValidator
from satisfaction.loader import SatisfactionLoader
from satisfaction.repository import SatisfactionRepository
from satisfaction.downloader import UNIARDownloader
