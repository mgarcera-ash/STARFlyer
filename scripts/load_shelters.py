#!/usr/bin/env python3
"""
Load DFSS Shelter Bed Availability CSV into Supabase.

Usage:
    python scripts/load_shelters.py path/to/DFSS_Shelter_Bed_Availability_YYYYMMDD.csv

Requirements:
    pip install pandas supabase

Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
environment. The service role key is required to bypass RLS.
"""

import re
import sys
import os

import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    sys.exit(1)


def parse_point(wkt: str) -> tuple[float | None, float | None]:
    """Extract (lat, lng) from a WKT POINT string. WKT order is (lng lat)."""
    if not isinstance(wkt, str):
        return None, None
    m = re.search(r"POINT \(([+-]?\d+\.?\d*) ([+-]?\d+\.?\d*)\)", wkt)
    if not m:
        return None, None
    return float(m.group(2)), float(m.group(1))


def clean(val) -> str | None:
    return val.strip() if isinstance(val, str) and val.strip() else None


def to_int(val) -> int | None:
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def load_shelters(csv_path: str) -> None:
    df = pd.read_csv(csv_path)

    df["Date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y")
    df = df.sort_values("Date").drop_duplicates(subset=["Site ID"], keep="last")

    rows = []
    for _, r in df.iterrows():
        lat, lng = parse_point(r.get("Location"))
        rows.append({
            "site_id":      int(r["Site ID"]),
            "agency":       clean(r.get("Agency")),
            "site_name":    clean(r.get("Site Name")),
            "population":   clean(r.get("Population")),
            "shelter_type": clean(r.get("Shelter Type")),
            "address":      clean(r.get("Address")),
            "phone":        clean(r.get("Intake Number")),
            "ward":         to_int(r.get("Ward")),
            "geography":    clean(r.get("Geography")),
            "capacity":     to_int(r.get("Capacity")),
            "lat":          lat,
            "lng":          lng,
            "csv_date":     r["Date"].strftime("%Y-%m-%d"),
        })

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    client.table("shelters").upsert(rows, on_conflict="site_id").execute()
    print(f"✓ Upserted {len(rows)} shelters")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/load_shelters.py <path/to/CSV>")
        sys.exit(1)
    load_shelters(sys.argv[1])
