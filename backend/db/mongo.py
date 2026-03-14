from pymongo import MongoClient
from datetime import datetime, timedelta
import os

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME   = 'seismowatch'

_client = None
_db     = None

def get_db():
    global _client, _db
    if _db is None:
        _client = MongoClient(MONGO_URI)
        _db     = _client[DB_NAME]
        # Indexes
        _db.predictions.create_index('created_at')
        _db.predictions.create_index('verified')
        _db.feedback.create_index('prediction_id')
        _db.feedback.create_index('created_at')
    return _db

def save_prediction(prediction_data):
    db  = get_db()
    doc = {
        **prediction_data,
        'created_at': datetime.utcnow(),
        'verified':   False,
        'feedback':   None,
    }
    result = db.predictions.insert_one(doc)
    return str(result.inserted_id)

def get_latest_prediction():
    db  = get_db()
    cutoff = datetime.utcnow() - timedelta(hours=24)
    doc = db.predictions.find_one(
        {'created_at': {'$gte': cutoff}},
        sort=[('created_at', -1)]
    )
    if doc:
        doc['_id'] = str(doc['_id'])
    return doc

def get_unverified_predictions():
    db  = get_db()
    cutoff = datetime.utcnow() - timedelta(hours=24)
    docs = list(db.predictions.find({
        'verified':   False,
        'created_at': {'$lte': cutoff}
    }))
    for d in docs:
        d['_id'] = str(d['_id'])
    return docs

def save_feedback(prediction_id, zone, predicted_level,
                  actual_occurred, actual_mag, reward):
    db  = get_db()
    doc = {
        'prediction_id':   prediction_id,
        'zone':            zone,
        'predicted_level': predicted_level,
        'actual_occurred': actual_occurred,
        'actual_mag':      actual_mag,
        'reward':          reward,          # +1 correct, -1 wrong
        'created_at':      datetime.utcnow(),
    }
    db.feedback.insert_one(doc)

def mark_prediction_verified(prediction_id):
    from bson import ObjectId
    db = get_db()
    db.predictions.update_one(
        {'_id': ObjectId(prediction_id)},
        {'$set': {'verified': True}}
    )

def get_feedback_stats():
    db    = get_db()
    total = db.feedback.count_documents({})
    correct = db.feedback.count_documents({'reward': 1})
    return {
        'total':    total,
        'correct':  correct,
        'accuracy': round(correct / total * 100, 1) if total > 0 else 0,
        'recent':   list(db.feedback.find(
            {}, {'_id': 0}
        ).sort('created_at', -1).limit(10))
    }