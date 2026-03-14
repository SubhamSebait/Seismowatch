from flask import Blueprint, jsonify, request
import pandas as pd
import numpy as np
import os

cities_bp = Blueprint('cities', __name__)

EQ_PATH  = os.path.join(os.path.dirname(__file__), '../data/Significant_Earthquake_Dataset_1900-2023.csv')
POP_PATH = os.path.join(os.path.dirname(__file__), '../data/world_population.csv')

def get_eq():
    df = pd.read_csv(EQ_PATH)
    df.columns = df.columns.str.strip()
    df['lat']   = pd.to_numeric(df['Latitude'],  errors='coerce')
    df['lng']   = pd.to_numeric(df['Longitude'], errors='coerce')
    df['mag']   = pd.to_numeric(df['Mag'],       errors='coerce')
    df['depth'] = pd.to_numeric(df['Depth'],     errors='coerce')
    df['place'] = df['Place'].fillna('Unknown')
    df.dropna(subset=['lat','lng','mag','depth'], inplace=True)
    return df


# ── City definitions with bounding boxes ──────────────────────────────────
CITIES = [
    { 'city': 'Tokyo',         'country': 'Japan',       'lat': 35.68, 'lng': 139.69, 'radius': 3.0 },
    { 'city': 'Istanbul',      'country': 'Turkey',      'lat': 41.01, 'lng': 28.95,  'radius': 2.5 },
    { 'city': 'San Francisco', 'country': 'USA',         'lat': 37.77, 'lng': -122.41,'radius': 2.5 },
    { 'city': 'Lima',          'country': 'Peru',        'lat': -12.04,'lng': -77.03, 'radius': 3.0 },
    { 'city': 'Mexico City',   'country': 'Mexico',      'lat': 19.43, 'lng': -99.13, 'radius': 3.0 },
    { 'city': 'London',        'country': 'UK',          'lat': 51.50, 'lng': -0.12,  'radius': 2.0 },
    { 'city': 'Jakarta',       'country': 'Indonesia',   'lat': -6.21, 'lng': 106.84, 'radius': 3.0 },
    { 'city': 'Santiago',      'country': 'Chile',       'lat': -33.45,'lng': -70.66, 'radius': 3.0 },
    { 'city': 'Tehran',        'country': 'Iran',        'lat': 35.69, 'lng': 51.39,  'radius': 3.0 },
    { 'city': 'Kathmandu',     'country': 'Nepal',       'lat': 27.70, 'lng': 85.31,  'radius': 2.5 },
    { 'city': 'Los Angeles',   'country': 'USA',         'lat': 34.05, 'lng': -118.24,'radius': 2.5 },
    { 'city': 'Manila',        'country': 'Philippines', 'lat': 14.59, 'lng': 120.98, 'radius': 3.0 },
    { 'city': 'Bucharest',     'country': 'Romania',     'lat': 44.43, 'lng': 26.10,  'radius': 2.0 },
    { 'city': 'Islamabad',     'country': 'Pakistan',    'lat': 33.72, 'lng': 73.04,  'radius': 2.5 },
    { 'city': 'Delhi',         'country': 'India',       'lat': 28.61, 'lng': 77.20,  'radius': 3.0 },
    { 'city': 'Mumbai',        'country': 'India',       'lat': 19.07, 'lng': 72.87,  'radius': 2.5 },
]

# ── Population lookup ──────────────────────────────────────────────────────
_pop_df = None

def get_pop():
    global _pop_df
    if _pop_df is None:
        df = pd.read_csv(POP_PATH)
        df.columns = df.columns.str.strip()
        _pop_df = df
    return _pop_df

# ── Load earthquakes ───────────────────────────────────────────────────────
_eq_df = None

def get_eq():
    global _eq_df
    if _eq_df is None:
        df = pd.read_csv(EQ_PATH)
        df.columns = df.columns.str.strip()
        df['lat'] = pd.to_numeric(df['Latitude'],  errors='coerce')
        df['lng'] = pd.to_numeric(df['Longitude'], errors='coerce')
        df['mag'] = pd.to_numeric(df['Mag'],       errors='coerce')
        df['year'] = pd.to_datetime(df['Time'], errors='coerce').dt.year
        df.dropna(subset=['lat', 'lng', 'mag', 'year'], inplace=True)
        _eq_df = df
    return _eq_df

# ── Risk score formula ─────────────────────────────────────────────────────
def compute_risk(eq_count, avg_mag, max_mag, pop_density):
    # Normalize each factor 0-100
    freq_score    = min(100, (eq_count / 50) * 100)
    mag_score     = min(100, ((avg_mag - 5.5) / 3.5) * 100)
    max_mag_score = min(100, ((max_mag - 5.5) / 3.5) * 100)
    pop_score     = min(100, (np.log10(pop_density + 1) / 4) * 100)

    # Weighted composite
    risk = (
        freq_score    * 0.35 +
        mag_score     * 0.25 +
        max_mag_score * 0.25 +
        pop_score     * 0.15
    )
    return round(float(risk), 1)

def risk_label(score):
    if score >= 65: return 'high'
    if score >= 35: return 'medium'
    return 'low'

# ── GET /api/cities ────────────────────────────────────────────────────────
@cities_bp.route('/', methods=['GET'])
def get_cities():
    eq_df  = get_eq()
    pop_df = get_pop()

    results = []

    for c in CITIES:
        # Filter earthquakes within radius (simple bbox)
        r    = c['radius']
        mask = (
            (eq_df['lat'].between(c['lat'] - r, c['lat'] + r)) &
            (eq_df['lng'].between(c['lng'] - r, c['lng'] + r))
        )
        nearby = eq_df[mask]

        eq_count = int(len(nearby))
        avg_mag  = round(float(nearby['mag'].mean()), 2) if eq_count > 0 else 0
        max_mag  = round(float(nearby['mag'].max()),  2) if eq_count > 0 else 0

        # Yearly trend for chart (2015-2023)
        trend = (
            nearby[nearby['year'].between(2015, 2023)]
            .groupby('year')
            .agg(count=('mag', 'count'), avgMag=('mag', 'mean'))
            .reset_index()
        )
        trend['avgMag'] = trend['avgMag'].round(2)

        # Population density from world_population.csv
        pop_row = pop_df[pop_df['Country/Territory'].str.contains(
            c['country'], case=False, na=False
        )]
        pop_density = float(pop_row['Density (per km²)'].values[0]) \
            if len(pop_row) > 0 else 100

        # Risk factors for radar chart
        soil_vuln   = min(100, round(float(nearby['mag'].std() or 0) * 15, 1))
        infra_age   = round(float(np.random.uniform(40, 85)), 1)  # placeholder
        bldg_codes  = round(100 - (eq_count / 10), 1)
        bldg_codes  = max(10, min(95, bldg_codes))

        risk_score = compute_risk(eq_count, avg_mag, max_mag, pop_density)

        results.append({
            'city':            c['city'],
            'country':         c['country'],
            'lat':             c['lat'],
            'lng':             c['lng'],
            'riskScore':       risk_score,
            'riskLevel':       risk_label(risk_score),
            'eqCount':         eq_count,
            'avgMag':          avg_mag,
            'maxMag':          max_mag,
            'popDensity':      round(pop_density, 1),
            'soilVulnerability': soil_vuln,
            'buildingCodes':   bldg_codes,
            'infrastructureAge': infra_age,
            'trend':           trend.to_dict(orient='records'),
            'radarData': [
                { 'factor': 'Seismic Activity', 'value': min(100, round(eq_count / 8, 1)) },
                { 'factor': 'Soil Vulnerability','value': soil_vuln },
                { 'factor': 'Population Density','value': min(100, round(pop_density / 10, 1)) },
                { 'factor': 'Infrastructure Age','value': infra_age },
                { 'factor': 'Building Codes',    'value': bldg_codes },
            ]
        })

    # Sort by risk score
    results.sort(key=lambda x: x['riskScore'], reverse=True)
    return jsonify(results)


# ── GET /api/cities/<name> ── single city detail ───────────────────────────
@cities_bp.route('/<city_name>', methods=['GET'])
def get_city(city_name):
    eq_df = get_eq()

    match = next((c for c in CITIES
                  if c['city'].lower() == city_name.lower()), None)
    if not match:
        return jsonify({'error': 'City not found'}), 404

    r    = match['radius']
    mask = (
        (eq_df['lat'].between(match['lat'] - r, match['lat'] + r)) &
        (eq_df['lng'].between(match['lng'] - r, match['lng'] + r))
    )
    nearby = eq_df[mask].sort_values('mag', ascending=False)

    return jsonify({
        'city':   match['city'],
        'recent': nearby.head(20)[['Time','Place','lat','lng','mag','depth']]\
                        .rename(columns={'Time':'time','Place':'place'})\
                        .to_dict(orient='records')
    })

# ── GET /api/cities/live-risks ── from MongoDB (updated by scheduler) ──────
@cities_bp.route('/live-risks', methods=['GET'])
def get_live_risks():
    try:
        from db.mongo import get_db
        db   = get_db()
        docs = list(db.city_risks.find({}, {'_id': 0}))
        if not docs:
            return jsonify({'status': 'no_data',
                           'message': 'Run /api/predict/update-cities first'})
        return jsonify(docs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# ── GET /api/cities/top-seismic ── auto-extracted from CSV ────────────────
@cities_bp.route('/seismic-cities', methods=['GET'])
def get_seismic_cities():
    try:
        limit  = int(request.args.get('limit', 50))
        min_eq = int(request.args.get('min_eq', 50))

        df = get_eq()

        # Extract city from place string
        df['city_name'] = df['place'].str.extract(r'of (.+)$')[0]
        df['city_name'] = df['city_name'].fillna(df['place']).str.strip()

        # Group by city
        grouped = df.groupby('city_name').agg(
            eq_count      = ('mag', 'count'),
            avg_mag       = ('mag', 'mean'),
            max_mag       = ('mag', 'max'),
            avg_depth     = ('depth', 'mean'),
            shallow_ratio = ('depth', lambda x: (x < 70).sum() / len(x)),
            avg_lat       = ('lat', 'mean'),
            avg_lng       = ('lng', 'mean'),
        ).reset_index()

        # Filter and sort
        grouped = grouped[grouped['eq_count'] >= min_eq]
        grouped = grouped.sort_values('eq_count', ascending=False).head(limit)

        # Round
        grouped['avg_mag']       = grouped['avg_mag'].round(2)
        grouped['max_mag']       = grouped['max_mag'].round(2)
        grouped['avg_depth']     = grouped['avg_depth'].round(1)
        grouped['shallow_ratio'] = grouped['shallow_ratio'].round(3)
        grouped['avg_lat']       = grouped['avg_lat'].round(4)
        grouped['avg_lng']       = grouped['avg_lng'].round(4)

        # Risk label
        def risk_label(row):
            score = 0
            if row['eq_count'] >= 200:  score += 3
            elif row['eq_count'] >= 100:score += 2
            elif row['eq_count'] >= 50: score += 1
            if row['avg_mag'] >= 6.5:   score += 3
            elif row['avg_mag'] >= 6.0: score += 2
            elif row['avg_mag'] >= 5.8: score += 1
            if row['max_mag'] >= 8.0:   score += 2
            elif row['max_mag'] >= 7.0: score += 1
            if row['shallow_ratio'] >= 0.8: score += 1
            if score >= 6:   return 'high'
            elif score >= 3: return 'medium'
            return 'low'

        grouped['risk_level'] = grouped.apply(risk_label, axis=1)

        return jsonify({
            'total':  len(grouped),
            'cities': grouped.to_dict(orient='records')
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500