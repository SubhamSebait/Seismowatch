import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix
import xgboost as xgb
import lightgbm as lgb
import joblib
import os

DATA_PATH  = os.path.join(os.path.dirname(__file__), '../data/Significant_Earthquake_Dataset_1900-2023.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), '../data/risk_model.pkl')
ENCODER_PATH = os.path.join(os.path.dirname(__file__), '../data/label_encoder.pkl')

# ── Step 1: Load & clean ───────────────────────────────────────────────────
def load_data():
    df = pd.read_csv(DATA_PATH)
    df.columns = df.columns.str.strip()
    df['lat']   = pd.to_numeric(df['Latitude'],  errors='coerce')
    df['lng']   = pd.to_numeric(df['Longitude'], errors='coerce')
    df['mag']   = pd.to_numeric(df['Mag'],       errors='coerce')
    df['depth'] = pd.to_numeric(df['Depth'],     errors='coerce')
    df['year']  = pd.to_datetime(df['Time'], errors='coerce').dt.year
    df.dropna(subset=['lat', 'lng', 'mag', 'depth', 'year'], inplace=True)
    return df

# ── Step 2: Build city-level feature matrix ────────────────────────────────
# We use a grid-based approach — divide world into 5°x5° cells
# Each cell = one "region sample" with aggregated features
def build_features(df):
    # Round to 5-degree grid
    df['grid_lat'] = (df['lat'] // 5) * 5
    df['grid_lng'] = (df['lng'] // 5) * 5

    grouped = df.groupby(['grid_lat', 'grid_lng'])

    features = []
    for (glat, glng), group in grouped:
        if len(group) < 3:  # skip cells with too few quakes
            continue

        eq_count      = len(group)
        avg_mag       = group['mag'].mean()
        max_mag       = group['mag'].max()
        min_mag       = group['mag'].min()
        std_mag       = group['mag'].std()
        avg_depth     = group['depth'].mean()
        min_depth     = group['depth'].min()
        year_range    = group['year'].max() - group['year'].min() + 1
        freq_per_year = eq_count / max(year_range, 1)

        # Magnitude trend — is avg mag increasing over time?
        yearly_mag = group.groupby('year')['mag'].mean()
        if len(yearly_mag) >= 3:
            mag_trend = np.polyfit(yearly_mag.index, yearly_mag.values, 1)[0]
        else:
            mag_trend = 0.0

        # Shallow quakes ratio (depth < 70km = more dangerous)
        shallow_ratio = (group['depth'] < 70).sum() / eq_count

        features.append({
            'grid_lat':     glat,
            'grid_lng':     glng,
            'eq_count':     eq_count,
            'avg_mag':      round(avg_mag, 3),
            'max_mag':      round(max_mag, 3),
            'min_mag':      round(min_mag, 3),
            'std_mag':      round(std_mag, 3),
            'avg_depth':    round(avg_depth, 3),
            'min_depth':    round(min_depth, 3),
            'freq_per_year':round(freq_per_year, 3),
            'mag_trend':    round(mag_trend, 5),
            'shallow_ratio':round(shallow_ratio, 3),
        })

    return pd.DataFrame(features)

# ── Step 3: Label generation (your logic) ─────────────────────────────────
def assign_risk_label(row):
    freq  = row['freq_per_year']
    mag   = row['avg_mag']
    maxm  = row['max_mag']
    shallow = row['shallow_ratio']

    # Score-based labeling
    score = 0

    # Frequency score
    if freq >= 5:    score += 3
    elif freq >= 2:  score += 2
    elif freq >= 0.5:score += 1

    # Magnitude score — YOUR LOGIC: intense = more dangerous
    if mag >= 7.0:   score += 4
    elif mag >= 6.5: score += 3
    elif mag >= 6.0: score += 2
    elif mag >= 5.8: score += 1

    # Max magnitude — worst event matters
    if maxm >= 8.0:  score += 3
    elif maxm >= 7.0:score += 2
    elif maxm >= 6.5:score += 1

    # Shallow quakes = more surface damage
    if shallow >= 0.8: score += 2
    elif shallow >= 0.5: score += 1

    if score >= 8:   return 'high'
    elif score >= 4: return 'medium'
    else:            return 'low'

# ── Step 4: Train models ───────────────────────────────────────────────────
def train():
    print("📂 Loading data...")
    df = load_data()
    print(f"   {len(df)} records loaded")

    print("🔧 Building features...")
    feat_df = build_features(df)
    print(f"   {len(feat_df)} grid cells created")

    print("🏷️  Assigning risk labels...")
    feat_df['risk_label'] = feat_df.apply(assign_risk_label, axis=1)
    print(feat_df['risk_label'].value_counts().to_string())

    # Features and target
    FEATURE_COLS = [
        'eq_count', 'avg_mag', 'max_mag', 'min_mag', 'std_mag',
        'avg_depth', 'min_depth', 'freq_per_year', 'mag_trend', 'shallow_ratio'
    ]
    X = feat_df[FEATURE_COLS]
    y = feat_df['risk_label']

    # Encode labels
    le = LabelEncoder()
    y_enc = le.fit_transform(y)
    print(f"\n🏷️  Classes: {le.classes_}")

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )
    print(f"\n📊 Train: {len(X_train)} | Test: {len(X_test)}")

    # ── Models ──────────────────────────────────────────────────────────
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )

    xgb_model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
        eval_metric='mlogloss',
        verbosity=0
    )

    lgb_model = lgb.LGBMClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        random_state=42,
        verbose=-1
    )

    # ── Ensemble ─────────────────────────────────────────────────────────
    ensemble = VotingClassifier(
        estimators=[
            ('rf',  rf),
            ('xgb', xgb_model),
            ('lgb', lgb_model),
        ],
        voting='soft'
    )

    print("\n🚀 Training Random Forest...")
    rf.fit(X_train, y_train)
    rf_score = rf.score(X_test, y_test)
    print(f"   Accuracy: {rf_score:.3f}")

    print("🚀 Training XGBoost...")
    xgb_model.fit(X_train, y_train)
    xgb_score = xgb_model.score(X_test, y_test)
    print(f"   Accuracy: {xgb_score:.3f}")

    print("🚀 Training LightGBM...")
    lgb_model.fit(X_train, y_train)
    lgb_score = lgb_model.score(X_test, y_test)
    print(f"   Accuracy: {lgb_score:.3f}")

    print("🚀 Training Ensemble (RF + XGBoost + LightGBM)...")
    ensemble.fit(X_train, y_train)
    ens_score = ensemble.score(X_test, y_test)
    print(f"   Accuracy: {ens_score:.3f}")

    # ── Cross validation on best model ──────────────────────────────────
    print("\n🔁 Cross-validation (5-fold) on Ensemble...")
    cv_scores = cross_val_score(ensemble, X, y_enc, cv=5, scoring='accuracy')
    print(f"   CV Scores: {cv_scores}")
    print(f"   Mean: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # ── Classification report ────────────────────────────────────────────
    y_pred = ensemble.predict(X_test)
    print("\n📋 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    # ── Feature importance (from RF) ─────────────────────────────────────
    print("📊 Feature Importances (Random Forest):")
    for feat, imp in sorted(
        zip(FEATURE_COLS, rf.feature_importances_),
        key=lambda x: x[1], reverse=True
    ):
        bar = '█' * int(imp * 50)
        print(f"   {feat:<20} {bar} {imp:.3f}")

    # ── Save best model ──────────────────────────────────────────────────
    print(f"\n💾 Saving ensemble model to {MODEL_PATH}")
    joblib.dump({
        'model':        ensemble,
        'label_encoder':le,
        'feature_cols': FEATURE_COLS,
        'accuracies': {
            'random_forest': rf_score,
            'xgboost':       xgb_score,
            'lightgbm':      lgb_score,
            'ensemble':      ens_score,
        }
    }, MODEL_PATH)
    joblib.dump(le, ENCODER_PATH)

    print("✅ Training complete!")
    return ensemble, le, FEATURE_COLS

if __name__ == '__main__':
    train()