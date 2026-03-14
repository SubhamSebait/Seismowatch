from flask import Blueprint, jsonify
import json
import os

map_bp = Blueprint('map', __name__)

GEO_PATH = os.path.join(os.path.dirname(__file__), '../data/custom_geo.json')

_geojson = None

def get_geojson():
    global _geojson
    if _geojson is None:
        with open(GEO_PATH, 'r', encoding='utf-8') as f:
            _geojson = json.load(f)
    return _geojson


# ── GET /api/map ── full geojson ───────────────────────────────────────────
@map_bp.route('/', methods=['GET'])
def get_map():
    geo = get_geojson()
    return jsonify(geo)


# ── GET /api/map/countries ── simplified country list ─────────────────────
@map_bp.route('/countries', methods=['GET'])
def get_countries():
    geo = get_geojson()
    countries = []
    for feature in geo['features']:
        props = feature['properties']
        countries.append({
            'name':      props.get('name', ''),
            'iso_a3':    props.get('iso_a3', ''),
            'continent': props.get('continent', ''),
        })
    return jsonify(countries)