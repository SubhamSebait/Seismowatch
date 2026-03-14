import pandas as pd
import numpy as np
import requests
import joblib
import os
from datetime import datetime, timedelta
from db.mongo import (
    save_prediction, get_latest_prediction,
    get_unverified_predictions, save_feedback,
    mark_prediction_verified, get_feedback_stats
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), '../data/risk_model.pkl')
DATA_PATH  = os.path.join(os.path.dirname(__file__), '../data/Significant_Earthquake_Dataset_1900-2023.csv')

_model_data = None
_hist_df    = None

# ── Load model ─────────────────────────────────────────────────────────────
def load_model():
    global _model_data
    if _model_data is None:
        _model_data = joblib.load(MODEL_PATH)
    return _model_data

# ── Load historical data ────────────────────────────────────────────────────
def load_hist():
    global _hist_df
    if _hist_df is None:
        df = pd.read_csv(DATA_PATH)
        df.columns = df.columns.str.strip()
        df['lat']   = pd.to_numeric(df['Latitude'],  errors='coerce')
        df['lng']   = pd.to_numeric(df['Longitude'], errors='coerce')
        df['mag']   = pd.to_numeric(df['Mag'],       errors='coerce')
        df['depth'] = pd.to_numeric(df['Depth'],     errors='coerce')
        df['year']  = pd.to_datetime(df['Time'], errors='coerce').dt.year
        df.dropna(subset=['lat','lng','mag','depth','year'], inplace=True)

        # Pre-compute historical grid stats
        df['grid_lat'] = (df['lat'] // 3) * 3
        df['grid_lng'] = (df['lng'] // 3) * 3
        _hist_df = df
    return _hist_df

# ── Fetch USGS live data ────────────────────────────────────────────────────
def fetch_live_events(hours=24, min_mag=2.5):
    end   = datetime.utcnow()
    start = end - timedelta(hours=hours)
    url = (
        f"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
        f"?format=geojson"
        f"&starttime={start.strftime('%Y-%m-%dT%H:%M:%S')}"
        f"&endtime={end.strftime('%Y-%m-%dT%H:%M:%S')}"
        f"&minmagnitude={min_mag}"
        f"&limit=1000"
    )
    resp     = requests.get(url, timeout=15)
    features = resp.json().get('features', [])
    events   = []
    for f in features:
        p = f['properties']
        c = f['geometry']['coordinates']
        events.append({
            'place': p.get('place', 'Unknown'),
            'mag':   float(p.get('mag') or 0),
            'time':  p.get('time', 0),
            'lat':   float(c[1]),
            'lng':   float(c[0]),
            'depth': float(c[2]),
        })
    return events

# ── Build features for prediction ──────────────────────────────────────────
def build_live_features(live_events, hist_df):
    if not live_events:
        return pd.DataFrame()

    live_df = pd.DataFrame(live_events)
    live_df['grid_lat'] = (live_df['lat'] // 3) * 3
    live_df['grid_lng'] = (live_df['lng'] // 3) * 3

    # Live grid stats
    live_grid = live_df.groupby(['grid_lat','grid_lng']).agg(
        shock_count  = ('mag', 'count'),
        live_max_mag = ('mag', 'max'),
        live_avg_mag = ('mag', 'mean'),
        live_depth   = ('depth', 'mean'),
        sample_place = ('place', 'first'),
        sample_lat   = ('lat', 'mean'),
        sample_lng   = ('lng', 'mean'),
    ).reset_index()

    # Only keep grids with 2+ shocks (swarm activity)
    live_grid = live_grid[live_grid['shock_count'] >= 2]
    if live_grid.empty:
        live_grid = live_df.groupby(['grid_lat','grid_lng']).agg(
            shock_count  = ('mag', 'count'),
            live_max_mag = ('mag', 'max'),
            live_avg_mag = ('mag', 'mean'),
            live_depth   = ('depth', 'mean'),
            sample_place = ('place', 'first'),
            sample_lat   = ('lat', 'mean'),
            sample_lng   = ('lng', 'mean'),
        ).reset_index().nlargest(10, 'live_max_mag')

    # Historical grid stats
    hist_grid = hist_df.groupby(['grid_lat','grid_lng']).agg(
        hist_count    = ('mag', 'count'),
        hist_avg_mag  = ('mag', 'mean'),
        hist_max_mag  = ('mag', 'max'),
        hist_min_mag  = ('mag', 'min'),
        hist_std_mag  = ('mag', 'std'),
        hist_avg_depth= ('depth', 'mean'),
        hist_min_depth= ('depth', 'min'),
        shallow_ratio = ('depth', lambda x: (x < 70).sum() / len(x)),
        year_range    = ('year',  lambda x: x.max() - x.min() + 1),
    ).reset_index()

    # Merge
    merged = live_grid.merge(hist_grid, on=['grid_lat','grid_lng'], how='left')
    merged = merged.fillna({
        'hist_count':     0,
        'hist_avg_mag':   merged['live_avg_mag'],
        'hist_max_mag':   merged['live_max_mag'],
        'hist_min_mag':   merged['live_avg_mag'],
        'hist_std_mag':   0.3,
        'hist_avg_depth': merged['live_depth'],
        'hist_min_depth': merged['live_depth'],
        'shallow_ratio':  0.5,
        'year_range':     1,
    })

    # Frequency surge
    merged['freq_per_year'] = (
        merged['hist_count'] /
        merged['year_range'].clip(lower=1)
    )

    # Mag trend — use live max as proxy
    merged['mag_trend'] = (
        merged['live_max_mag'] - merged['hist_avg_mag']
    ).clip(-2, 2)

    return merged

# ── Omori Law surge score ───────────────────────────────────────────────────
def omori_surge_score(row):
    expected_daily = row['hist_count'] / max(row['year_range'] * 365, 1)
    surge          = row['shock_count'] / max(expected_daily, 0.1)
    surge_score    = min(100, surge * 8)

    mag_score  = min(100, ((row['live_max_mag'] - 2.5) / 6) * 100)
    hist_score = min(100, ((row['hist_avg_mag'] - 5.0) / 4) * 100) \
                 if row['hist_avg_mag'] > 0 else 0
    depth_score = float(row['shallow_ratio']) * 100

    return round(float(
        surge_score * 0.40 +
        mag_score   * 0.25 +
        hist_score  * 0.25 +
        depth_score * 0.10
    ), 1)

# ── Main forecast function ──────────────────────────────────────────────────
def run_forecast():
    # Check cache first
    cached = get_latest_prediction()
    if cached:
        cached['source'] = 'cache'
        return cached

    print("🔄 Running fresh forecast...")

    # Load data
    data      = load_model()
    model     = data['model']
    le        = data['label_encoder']
    feat_cols = data['feature_cols']
    hist_df   = load_hist()

    # Fetch live
    try:
        live_events = fetch_live_events(hours=24, min_mag=2.5)
    except Exception as e:
        return {'error': f'USGS API failed: {str(e)}'}

    if not live_events:
        return {'error': 'No live events available'}

    # Build features
    features_df = build_live_features(live_events, hist_df)
    if features_df.empty:
        return {'error': 'Could not build features'}

    # ML features
    ML_FEATS = feat_cols
    X = features_df[[
        'hist_count',     # eq_count
        'hist_avg_mag',   # avg_mag
        'hist_max_mag',   # max_mag
        'hist_min_mag',   # min_mag
        'hist_std_mag',   # std_mag
        'hist_avg_depth', # avg_depth
        'hist_min_depth', # min_depth
        'freq_per_year',  # freq_per_year
        'mag_trend',      # mag_trend
        'shallow_ratio',  # shallow_ratio
    ]].copy()
    X.columns = feat_cols

    # Predict
    preds      = model.predict(X)
    proba      = model.predict_proba(X)
    labels     = le.inverse_transform(preds)
    confidence = proba.max(axis=1) * 100

    # Surge scores
    features_df['omori_score']  = features_df.apply(omori_surge_score, axis=1)
    features_df['ml_risk']      = labels
    features_df['ml_confidence']= confidence.round(1)
    features_df['proba_high']   = (proba[:, list(le.classes_).index('high')] * 100).round(1)
    features_df['proba_medium'] = (proba[:, list(le.classes_).index('medium')] * 100).round(1)
    features_df['proba_low']    = (proba[:, list(le.classes_).index('low')] * 100).round(1)

    # Combined score
    features_df['final_score'] = (
        features_df['omori_score']   * 0.5 +
        features_df['proba_high']    * 0.3 +
        features_df['ml_confidence'] * 0.2
    ).round(1)

    # Top zones
    top = features_df.nlargest(10, 'final_score')[[
        'grid_lat','grid_lng','sample_place','sample_lat','sample_lng',
        'shock_count','live_max_mag','live_avg_mag',
        'omori_score','ml_risk','ml_confidence',
        'proba_high','proba_medium','proba_low','final_score',
        'hist_avg_mag','shallow_ratio',
    ]].to_dict(orient='records')

    result = {
        'generated_at':      datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC'),
        'total_live_events': len(live_events),
        'zones_analyzed':    len(features_df),
        'top_zones':         top,
        'live_events':       live_events[:200],
        'source':            'fresh',
        'disclaimer': (
            'Statistical sequence analysis using Omori Law + ML ensemble. '
            'NOT a scientific earthquake prediction. '
            'Elevated scores = increased probability based on recent activity patterns.'
        )
    }

    # Save to MongoDB
    save_prediction(result)
    print(f"✅ Forecast complete — {len(top)} elevated zones found")
    return result

# ── Verify past predictions (RL feedback) ──────────────────────────────────
def verify_and_feedback():
    unverified = get_unverified_predictions()
    if not unverified:
        print("No unverified predictions to check")
        return

    # Fetch last 48hrs from USGS to verify
    try:
        recent = fetch_live_events(hours=48, min_mag=4.5)
    except Exception as e:
        print(f"USGS fetch failed: {e}")
        return

    recent_df = pd.DataFrame(recent) if recent else pd.DataFrame()

    for pred in unverified:
        pred_id = pred['_id']
        zones   = pred.get('top_zones', [])

        for zone in zones:
            glat = zone['grid_lat']
            glng = zone['grid_lng']

            # Check if M4.5+ quake occurred in this grid cell
            actual_occurred = False
            actual_mag      = 0.0

            if not recent_df.empty:
                nearby = recent_df[
                    (recent_df['lat'].between(glat, glat + 3)) &
                    (recent_df['lng'].between(glng, glng + 3)) &
                    (recent_df['mag'] >= 4.5)
                ]
                if len(nearby) > 0:
                    actual_occurred = True
                    actual_mag      = float(nearby['mag'].max())

            # Reward
            predicted_high = zone['ml_risk'] == 'high'
            if predicted_high and actual_occurred:
                reward = 1    # True positive
            elif not predicted_high and not actual_occurred:
                reward = 1    # True negative
            else:
                reward = -1   # Wrong prediction

            save_feedback(
                prediction_id   = pred_id,
                zone            = f"{glat},{glng}",
                predicted_level = zone['ml_risk'],
                actual_occurred = actual_occurred,
                actual_mag      = actual_mag,
                reward          = reward,
            )

        mark_prediction_verified(pred_id)
        print(f"✅ Verified prediction {pred_id}")

def get_model_feedback_stats():
    return get_feedback_stats()
def update_city_risks():
    from db.mongo import get_db
    db = get_db()

    CITIES = [
        {'city': 'Tokyo',         'country': 'Japan',       'lat': 35.68, 'lng': 139.69},
        {'city': 'Istanbul',      'country': 'Turkey',      'lat': 41.01, 'lng': 28.95},
        {'city': 'San Francisco', 'country': 'USA',         'lat': 37.77, 'lng': -122.41},
        {'city': 'Lima',          'country': 'Peru',        'lat': -12.04,'lng': -77.03},
        {'city': 'Mexico City',   'country': 'Mexico',      'lat': 19.43, 'lng': -99.13},
        {'city': 'London',        'country': 'UK',          'lat': 51.50, 'lng': -0.12},
        {'city': 'Jakarta',       'country': 'Indonesia',   'lat': -6.21, 'lng': 106.84},
        {'city': 'Santiago',      'country': 'Chile',       'lat': -33.45,'lng': -70.66},
        {'city': 'Tehran',        'country': 'Iran',        'lat': 35.69, 'lng': 51.39},
        {'city': 'Kathmandu',     'country': 'Nepal',       'lat': 27.70, 'lng': 85.31},
        {'city': 'Los Angeles',   'country': 'USA',         'lat': 34.05, 'lng': -118.24},
        {'city': 'Manila',        'country': 'Philippines', 'lat': 14.59, 'lng': 120.98},
        {'city': 'Delhi',         'country': 'India',       'lat': 28.61, 'lng': 77.20},
        {'city': 'Mumbai',        'country': 'India',       'lat': 19.07, 'lng': 72.87},
    ]

    try:
        live = fetch_live_events(hours=24, min_mag=2.0)
    except Exception as e:
        print(f"Could not fetch live events: {e}")
        return []

    live_df  = pd.DataFrame(live) if live else pd.DataFrame()
    hist_df  = load_hist()
    data     = load_model()
    model    = data['model']
    le       = data['label_encoder']
    feat_cols= data['feature_cols']

    updated = []
    for c in CITIES:
        r = 5.0
        live_count = 0
        live_max   = 0.0
        if not live_df.empty:
            nearby_live = live_df[
                (live_df['lat'].between(c['lat']-r, c['lat']+r)) &
                (live_df['lng'].between(c['lng']-r, c['lng']+r))
            ]
            live_count = len(nearby_live)
            live_max   = float(nearby_live['mag'].max()) if live_count > 0 else 0.0

        nearby_hist = hist_df[
            (hist_df['lat'].between(c['lat']-r, c['lat']+r)) &
            (hist_df['lng'].between(c['lng']-r, c['lng']+r))
        ]
        if len(nearby_hist) < 3:
            continue

        eq_count      = len(nearby_hist)
        avg_mag       = nearby_hist['mag'].mean()
        max_mag       = max(float(nearby_hist['mag'].max()), live_max)
        min_mag       = nearby_hist['mag'].min()
        std_mag       = nearby_hist['mag'].std()
        avg_depth     = nearby_hist['depth'].mean()
        min_depth     = nearby_hist['depth'].min()
        year_range    = nearby_hist['year'].max() - nearby_hist['year'].min() + 1
        freq_per_year = eq_count / max(year_range, 1)
        yearly_mag    = nearby_hist.groupby('year')['mag'].mean()
        mag_trend     = float(np.polyfit(yearly_mag.index, yearly_mag.values, 1)[0]) \
                        if len(yearly_mag) >= 3 else 0.0
        shallow_ratio = (nearby_hist['depth'] < 70).sum() / eq_count

        X = pd.DataFrame([{
            'eq_count':      eq_count,
            'avg_mag':       round(avg_mag, 3),
            'max_mag':       round(max_mag, 3),
            'min_mag':       round(min_mag, 3),
            'std_mag':       round(std_mag, 3),
            'avg_depth':     round(avg_depth, 3),
            'min_depth':     round(min_depth, 3),
            'freq_per_year': round(freq_per_year, 3),
            'mag_trend':     round(mag_trend, 5),
            'shallow_ratio': round(float(shallow_ratio), 3),
        }])[feat_cols]

        pred_enc   = model.predict(X)[0]
        pred_proba = model.predict_proba(X)[0]
        pred_label = le.inverse_transform([pred_enc])[0]
        confidence = float(pred_proba.max()) * 100
        proba_dict = {
            le.classes_[i]: round(float(pred_proba[i]) * 100, 1)
            for i in range(len(le.classes_))
        }

        city_doc = {
            'city':            c['city'],
            'country':         c['country'],
            'lat':             c['lat'],
            'lng':             c['lng'],
            'ml_risk':         pred_label,
            'ml_confidence':   round(confidence, 1),
            'probabilities':   proba_dict,
            'live_shocks_24h': live_count,
            'live_max_mag':    live_max,
            'hist_eq_count':   int(eq_count),
            'hist_avg_mag':    round(float(avg_mag), 2),
            'updated_at':      pd.Timestamp.utcnow().isoformat(),
        }

        db.city_risks.update_one(
            {'city': c['city']},
            {'$set': city_doc},
            upsert=True
        )
        updated.append(city_doc)
        print(f"  {c['city']}: {pred_label} ({confidence:.1f}%) [{live_count} live shocks]")

    print(f"Updated {len(updated)} city risk scores")
    return updated
