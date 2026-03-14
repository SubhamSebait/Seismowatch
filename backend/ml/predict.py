from flask import Blueprint, jsonify, request
import pandas as pd
import os
from ml import predict as ml_predict
from ml.forecaster import run_forecast, verify_and_feedback, get_model_feedback_stats
import requests
from datetime import datetime, timedelta
from collections import defaultdict

predict_bp = Blueprint('predict', __name__)

DATA_PATH = os.path.join(os.path.dirname(__file__), '../data/Significant_Earthquake_Dataset_1900-2023.csv')

_eq_df = None

def get_eq():
    global _eq_df
    if _eq_df is None:
        df = pd.read_csv(DATA_PATH)
        df.columns = df.columns.str.strip()
        df['lat']   = pd.to_numeric(df['Latitude'],  errors='coerce')
        df['lng']   = pd.to_numeric(df['Longitude'], errors='coerce')
        df['mag']   = pd.to_numeric(df['Mag'],       errors='coerce')
        df['depth'] = pd.to_numeric(df['Depth'],     errors='coerce')
        df['year']  = pd.to_datetime(df['Time'], errors='coerce').dt.year
        df.dropna(subset=['lat', 'lng', 'mag', 'depth', 'year'], inplace=True)
        _eq_df = df
    return _eq_df


# ── POST /api/predict ── predict risk for any lat/lng ─────────────────────
@predict_bp.route('/', methods=['POST'])
def predict():
    body = request.get_json()
    lat  = body.get('lat')
    lng  = body.get('lng')
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400
    result = ml_predict.predict_city(float(lat), float(lng), get_eq())
    return jsonify(result)


# ── GET /api/predict/city/<name> ── predict using live USGS data ──────────
@predict_bp.route('/city/<name>', methods=['GET'])
def predict_named(name):
    KNOWN = {
        'tokyo':         (35.68,  139.69),
        'istanbul':      (41.01,   28.95),
        'san-francisco': (37.77, -122.41),
        'lima':          (-12.04, -77.03),
        'mexico-city':   (19.43,  -99.13),
        'london':        (51.50,   -0.12),
        'jakarta':       (-6.21,  106.84),
        'santiago':      (-33.45, -70.66),
        'tehran':        (35.69,   51.39),
        'kathmandu':     (27.70,   85.31),
        'los-angeles':   (34.05, -118.24),
        'manila':        (14.59,  120.98),
        'delhi':         (28.61,   77.20),
        'mumbai':        (19.07,   72.87),
    }
    key = name.lower().replace(' ', '-')
    if key not in KNOWN:
        return jsonify({'error': 'City not found'}), 404

    lat, lng = KNOWN[key]

    # Fetch live USGS events near this city
    end   = datetime.utcnow()
    start = end - timedelta(days=30)
    url = (
        f"https://earthquake.usgs.gov/fdsnws/event/1/query"
        f"?format=geojson"
        f"&starttime={start.strftime('%Y-%m-%d')}"
        f"&endtime={end.strftime('%Y-%m-%d')}"
        f"&latitude={lat}&longitude={lng}"
        f"&maxradiuskm=500"
        f"&minmagnitude=3.0"
        f"&orderby=magnitude"
        f"&limit=50"
    )
    try:
        resp   = requests.get(url, timeout=10)
        feats  = resp.json().get('features', [])
        recent = [{
            'place': f['properties']['place'],
            'mag':   f['properties']['mag'],
            'time':  datetime.utcfromtimestamp(
                         f['properties']['time'] / 1000
                     ).strftime('%Y-%m-%d %H:%M'),
            'lat':   f['geometry']['coordinates'][1],
            'lng':   f['geometry']['coordinates'][0],
            'depth': f['geometry']['coordinates'][2],
        } for f in feats]
    except Exception:
        recent = []

    result = ml_predict.predict_city(lat, lng, get_eq())
    result['city']            = name.replace('-', ' ').title()
    result['recent_activity'] = recent
    return jsonify(result)


# ── GET /api/predict/model-info ── model metadata ─────────────────────────
@predict_bp.route('/model-info', methods=['GET'])
def model_info():
    return jsonify(ml_predict.get_model_info())


# ── GET /api/predict/forecast ── live 24hr forecast ───────────────────────
@predict_bp.route('/forecast', methods=['GET'])
def forecast():
    try:
        result = run_forecast()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── POST /api/predict/verify ── run RL verification ───────────────────────
@predict_bp.route('/verify', methods=['POST'])
def verify():
    try:
        verify_and_feedback()
        return jsonify({'status': 'verification complete'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── GET /api/predict/feedback-stats ── RL accuracy stats ──────────────────
@predict_bp.route('/feedback-stats', methods=['GET'])
def feedback_stats():
    try:
        return jsonify(get_model_feedback_stats())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── GET /api/predict/active-cities ── live most active regions ────────────
@predict_bp.route('/active-cities', methods=['GET'])
def active_cities():
    try:
        end   = datetime.utcnow()
        start = end - timedelta(days=7)
        url = (
            f"https://earthquake.usgs.gov/fdsnws/event/1/query"
            f"?format=geojson"
            f"&starttime={start.strftime('%Y-%m-%d')}"
            f"&endtime={end.strftime('%Y-%m-%d')}"
            f"&minmagnitude=4.5"
            f"&orderby=magnitude"
            f"&limit=200"
        )
        resp  = requests.get(url, timeout=15)
        feats = resp.json().get('features', [])

        regions = defaultdict(lambda: {
            'count': 0, 'max_mag': 0,
            'events': [], 'lat': 0, 'lng': 0
        })

        for f in feats:
            p      = f['properties']
            c      = f['geometry']['coordinates']
            place  = p.get('place', 'Unknown')
            region = place.split(' of ')[-1].strip() \
                     if ' of ' in place else place
            mag    = float(p.get('mag') or 0)

            regions[region]['count'] += 1
            regions[region]['lat']    = c[1]
            regions[region]['lng']    = c[0]
            if mag > regions[region]['max_mag']:
                regions[region]['max_mag'] = mag
            regions[region]['events'].append({
                'place': place,
                'mag':   mag,
                'time':  datetime.utcfromtimestamp(
                             p['time'] / 1000
                         ).strftime('%Y-%m-%d %H:%M'),
                'depth': c[2],
            })

        sorted_regions = sorted(
            [{'region': k, **v} for k, v in regions.items()],
            key=lambda x: x['max_mag'],
            reverse=True
        )[:15]

        for r in sorted_regions:
            r['events'] = sorted(
                r['events'], key=lambda x: x['mag'], reverse=True
            )[:5]

        return jsonify({
            'generated_at':   end.strftime('%Y-%m-%d %H:%M UTC'),
            'total_events':   len(feats),
            'active_regions': sorted_regions,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500