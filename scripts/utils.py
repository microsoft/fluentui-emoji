# utils.py

import csv
from pathlib import Path

"""
Utilities for scripts
"""

groups = [
    'Objects',
    'People & Body',
    'Smileys & Emotion',
    'Animals & Nature',
    'Food & Drink',
    'Symbols',
    'Travel & Places',
    'Activities',
    'Flags',
    ]

styles = ["3D", "Color", "Flat", "High Contrast"]


def get_popular(max_rank: int):
    # parse the ranked list file and return a set with the first 'max_rank' names
    popular = set()
    rankfilepath = Path("data") / "2021_ranked.tsv"
    with open(rankfilepath, 'r') as rf:
        reader = csv.DictReader(rf, delimiter='\t')
        for row in reader:
            if int(row['Rank']) <= max_rank:
                popular.add(row['Name'])

    return popular
