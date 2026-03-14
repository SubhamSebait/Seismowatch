from flask import Blueprint, jsonify, request
import pandas as pd
import os

population_bp = Blueprint('population', __name__)

POP_PATH = os.path.join(os.path.dirname(__file__), '../data/world_population.csv')

_df = None

def get_df():
    global _df
    if _df is None:
        df = pd.read_csv(POP_PATH)
        df.columns = df.columns.str.strip()
        _df = df
    return _df


# ── GET /api/population ── all countries ──────────────────────────────────
@population_bp.route('/', methods=['GET'])
def get_all():
    df = get_df()
    return jsonify(df.to_dict(orient='records'))


# ── GET /api/population/<country> ─────────────────────────────────────────
@population_bp.route('/<country>', methods=['GET'])
def get_country(country):
    df  = get_df()
    row = df[df['Country/Territory'].str.contains(country, case=False, na=False)]
    if len(row) == 0:
        return jsonify({'error': 'Country not found'}), 404
    return jsonify(row.iloc[0].to_dict())