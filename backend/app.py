from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes.earthquakes import earthquakes_bp
from routes.cities      import cities_bp
from routes.map         import map_bp
from routes.population  import population_bp
from routes.predict     import predict_bp
from scheduler          import start_scheduler, stop_scheduler, get_scheduler_status

load_dotenv()
app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(earthquakes_bp, url_prefix='/api/earthquakes')
app.register_blueprint(cities_bp,      url_prefix='/api/cities')
app.register_blueprint(map_bp,         url_prefix='/api/map')
app.register_blueprint(population_bp,  url_prefix='/api/population')
app.register_blueprint(predict_bp,     url_prefix='/api/predict')

@app.route('/api/health')
def health():
    scheduler_status = get_scheduler_status()
    return {
        'status':    'ok',
        'message':   'Seismowatch API running 🌍',
        'scheduler': scheduler_status,
    }

@app.route('/api/scheduler/status')
def scheduler_status():
    return get_scheduler_status()

if __name__ == '__main__':
    # Start background scheduler
    start_scheduler()
    try:
        app.run(debug=False, port=5000)
    finally:
        stop_scheduler()