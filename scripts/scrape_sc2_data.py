#!/usr/bin/env python3
"""
SC2 Data Scraper
Scrapes unit data from Liquipedia and generates sc2units.json

Usage:
    pip install requests beautifulsoup4
    python scrape_sc2_data.py
"""

import json
import requests
from bs4 import BeautifulSoup

def scrape_liquipedia_units(race):
    """Scrape unit data from Liquipedia"""
    url = f"https://liquipedia.net/starcraft2/{race.capitalize()}_Units"

    headers = {
        'User-Agent': 'SC2BuildLabBot/1.0 (Educational purposes)'
    }

    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.content, 'html.parser')

    units = {}

    # Find unit info boxes
    infoboxes = soup.find_all('div', class_='infobox-wrapper')

    for box in infoboxes:
        try:
            name_elem = box.find('div', class_='infobox-header')
            if not name_elem:
                continue

            name = name_elem.text.strip()

            # Extract stats
            stats = {}
            rows = box.find_all('tr')

            for row in rows:
                th = row.find('th')
                td = row.find('td')

                if th and td:
                    key = th.text.strip().lower()
                    value = td.text.strip()
                    stats[key] = value

            # Parse into our format
            unit_data = {
                "name": name,
                "cost": {
                    "mineral": int(stats.get('minerals', '0').replace(',', '')),
                    "gas": int(stats.get('gas', '0').replace(',', ''))
                },
                "supply": {
                    "required": int(stats.get('supply', '0'))
                },
                "time": int(stats.get('build time', '0').replace('s', '')),
                "tech_tree": {
                    "requires": parse_requirements(stats.get('built from', ''))
                }
            }

            units[name.lower().replace(' ', '')] = unit_data

        except Exception as e:
            print(f"Error parsing unit: {e}")
            continue

    return units

def parse_requirements(req_string):
    """Parse requirement string into list"""
    if not req_string:
        return []

    # Simple parsing - split by common delimiters
    reqs = req_string.replace(' and ', ',').replace('/', ',').split(',')
    return [r.strip() for r in reqs if r.strip()]

def scrape_all_races():
    """Scrape data for all three races"""
    data = {}

    for race in ['protoss', 'terran', 'zerg']:
        print(f"Scraping {race} data...")

        data[race] = {
            "units": scrape_liquipedia_units(race),
            "buildings": {},  # Similar scraping for buildings
            "upgrades": {}    # Similar scraping for upgrades
        }

    return data

def main():
    print("SC2 Data Scraper")
    print("=" * 50)

    # Scrape data
    data = scrape_all_races()

    # Save to JSON
    with open('sc2units.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("\n✓ Data saved to sc2units.json")
    print(f"  Protoss units: {len(data['protoss']['units'])}")
    print(f"  Terran units: {len(data['terran']['units'])}")
    print(f"  Zerg units: {len(data['zerg']['units'])}")

if __name__ == '__main__':
    main()
