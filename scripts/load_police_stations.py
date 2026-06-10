#!/usr/bin/env python3
"""
Load Chicago Police Stations CSV into Supabase.

Usage:
    python scripts/load_police_stations.py path/to/Police_Stations_YYYYMMDD.csv

Requirements:
    pip install pandas supabase

Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
The service role key is required to bypass RLS.
"""

from __future__ import annotations
import sys
import os

import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    sys.exit(1)


def clean(val) -> str | None:
    return val.strip() if isinstance(val, str) and val.strip() else None


def load_stations(csv_path: str) -> None:
    df = pd.read_csv(csv_path)

    rows = []
    for _, r in df.iterrows():
        lat = float(r["LATITUDE"])  if pd.notna(r.get("LATITUDE"))  else None
        lng = float(r["LONGITUDE"]) if pd.notna(r.get("LONGITUDE")) else None
        zip_val = str(int(r["ZIP"])) if pd.notna(r.get("ZIP")) else None
        rows.append({
            "district":      clean(str(r["DISTRICT"])),
            "district_name": clean(r.get("DISTRICT NAME")),
            "address":       clean(r.get("ADDRESS")),
            "zip":           zip_val,
            "website":       clean(r.get("WEBSITE")),
            "phone":         clean(r.get("PHONE")),
            "lat":           lat,
            "lng":           lng,
        })

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    client.table("police_stations").upsert(rows, on_conflict="district").execute()
    print(f"✓ Upserted {len(rows)} police stations")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/load_police_stations.py <path/to/CSV>")
        sys.exit(1)
    load_stations(sys.argv[1])
