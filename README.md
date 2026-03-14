# 🌍 SeismoWatch — Earthquake Risk Intelligence Platform

A full-stack seismic risk analysis platform with ML-powered forecasting.

## Features
- 📊 Dashboard with real-time USGS data
- 🏙️ City risk analysis with radar charts
- 🗺️ Interactive world risk heatmap
- 🔍 Seismic data explorer (37,331 records)
- 🤖 ML ensemble forecast (96% accuracy)
- 🔁 Automated RL feedback loop

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Recharts |
| Backend | Python 3.13 + Flask |
| ML | scikit-learn + XGBoost + LightGBM |
| Database | MongoDB |
| Data | USGS FDSN API + Historical CSV |

## ML Model
- **Algorithm**: Voting Ensemble (RF + XGBoost + LightGBM)
- **Accuracy**: 96% (5-fold cross validation: 95.3% ± 2.4%)
- **Features**: eq_count, avg_mag, max_mag, freq_per_year, shallow_ratio, mag_trend
- **Labels**: high / medium / low risk

## Architecture
```
USGS Live API → Feature Engineering → ML Ensemble
      ↓                                    ↓
  MongoDB ←── Prediction Cache ←── Risk Scores
      ↓
  Verify 24hrs later → Feedback → Retrain weekly
```

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
python ml/train.py        # train model once
python app.py             # start server
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints
| Endpoint | Description |
|----------|-------------|
| GET /api/earthquakes/stats | Dashboard KPIs |
| GET /api/cities | City risk scores |
| GET /api/predict/forecast | Live ML forecast |
| GET /api/predict/active-cities | Most active regions |
| POST /api/predict/update-cities | Refresh city risks |

## Disclaimer
This platform provides **risk analysis**, not earthquake prediction.
Earthquake prediction is scientifically unsolved.