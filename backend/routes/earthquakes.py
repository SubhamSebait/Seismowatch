from flask import Blueprint, jsonify, request
import pandas as pd
import os

earthquakes_bp = Blueprint('earthquakes', __name__)

DATA_PATH = os.path.join(os.path.dirname(__file__), '../data/Significant_Earthquake_Dataset_1900-2023.csv')

# Cache so we only read CSV once
_df = None

def get_df():
    global _df
    if _df is None:
        df = pd.read_csv(DATA_PATH)
        df.columns = df.columns.str.strip()
        df = df[['Time', 'Place', 'Latitude', 'Longitude', 'Depth', 'Mag']].copy()
        df.rename(columns={
            'Time':      'time',
            'Place':     'place',
            'Latitude':  'lat',
            'Longitude': 'lng',
            'Depth':     'depth',
            'Mag':       'mag'
        }, inplace=True)
        df['year']  = pd.to_datetime(df['time'], errors='coerce').dt.year
        df['depth'] = pd.to_numeric(df['depth'], errors='coerce').fillna(0)
        df['mag']   = pd.to_numeric(df['mag'],   errors='coerce')
        df['lat']   = pd.to_numeric(df['lat'],   errors='coerce')
        df['lng']   = pd.to_numeric(df['lng'],   errors='coerce')
        df.dropna(subset=['year', 'mag', 'lat', 'lng'], inplace=True)
        df['year'] = df['year'].astype(int)
        _df = df
    return _df


# ── GET /api/earthquakes ── paginated, filterable ──────────────────────────
@earthquakes_bp.route('/', methods=['GET'])
def get_all():
    df = get_df().copy()

    search  = request.args.get('search', '').lower()
    min_mag = float(request.args.get('minMag', 0))
    max_mag = float(request.args.get('maxMag', 10))
    page    = int(request.args.get('page', 1))
    limit   = int(request.args.get('limit', 100))

    if search:
        df = df[df['place'].str.lower().str.contains(search, na=False)]
    df = df[(df['mag'] >= min_mag) & (df['mag'] <= max_mag)]

    total     = len(df)
    paginated = df.iloc[(page - 1) * limit : page * limit]

    return jsonify({
        'total': total,
        'page':  page,
        'limit': limit,
        'data':  paginated.to_dict(orient='records')
    })


# ── GET /api/earthquakes/stats ── dashboard KPIs ───────────────────────────
@earthquakes_bp.route('/stats', methods=['GET'])
def get_stats():
    df = get_df()

    # Yearly stats 2015-2023
    yearly = (
        df[df['year'].between(2015, 2023)]
        .groupby('year')
        .agg(count=('mag', 'count'), avgMag=('mag', 'mean'))
        .reset_index()
    )
    yearly['avgMag'] = yearly['avgMag'].round(2)

    # Magnitude buckets
    bins   = [5.5, 6.0, 6.5, 7.0, 7.5, 10]
    labels = ['5.5-6.0', '6.0-6.5', '6.5-7.0', '7.0-7.5', '7.5+']
    df['mag_bucket'] = pd.cut(df['mag'], bins=bins, labels=labels, right=False)
    mag_buckets = df['mag_bucket'].value_counts().sort_index().to_dict()

    # Top regions
    df['region'] = df['place'].str.split(',').str[-1].str.strip()
    top_regions = (
        df['region'].value_counts()
        .head(10)
        .reset_index()
        .rename(columns={'region': 'region', 'count': 'count'})
        .to_dict(orient='records')
    )

    return jsonify({
        'total':       int(len(df)),
        'avgMag':      round(float(df['mag'].mean()), 2),
        'maxMag':      round(float(df['mag'].max()), 2),
        'avgDepth':    round(float(df['depth'].mean()), 1),
        'yearlyStats': yearly.to_dict(orient='records'),
        'magBuckets':  mag_buckets,
        'topRegions':  top_regions,
    })


# ── GET /api/earthquakes/heatmap ── lat/lng/mag for map ────────────────────
@earthquakes_bp.route('/heatmap', methods=['GET'])
def get_heatmap():
    df       = get_df()
    min_year = int(request.args.get('minYear', 2000))
    filtered = df[df['year'] >= min_year][['lat', 'lng', 'mag', 'year', 'place']]

    return jsonify({
        'total':  len(filtered),
        'points': filtered.to_dict(orient='records')
    })


# ── GET /api/earthquakes/recent ── last N years sorted by mag ──────────────
@earthquakes_bp.route('/recent', methods=['GET'])
def get_recent():
    df    = get_df()
    years = int(request.args.get('years', 5))
    max_y = int(df['year'].max())
    recent = (
        df[df['year'] >= max_y - years]
        .sort_values('mag', ascending=False)
        .head(50)
    )
    return jsonify(recent.to_dict(orient='records'))