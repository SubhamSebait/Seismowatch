from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger('scheduler')

_scheduler = None

def run_forecast_job():
    try:
        log.info("⏰ Scheduler: Running forecast...")
        from ml.forecaster import run_forecast
        # Force fresh forecast by clearing cache
        from db.mongo import get_db
        db = get_db()
        db.predictions.update_many({}, {'$set': {'_force_refresh': True}})
        result = run_forecast()
        log.info(f"✅ Forecast done — {result.get('total_live_events',0)} events")
    except Exception as e:
        log.error(f"❌ Forecast job failed: {e}")

def run_verify_job():
    try:
        log.info("⏰ Scheduler: Running verification + RL feedback...")
        from ml.forecaster import verify_and_feedback
        verify_and_feedback()
        log.info("✅ Verification done")
    except Exception as e:
        log.error(f"❌ Verification job failed: {e}")

def run_city_update_job():
    try:
        log.info("⏰ Scheduler: Updating city risks...")
        from ml.forecaster import update_city_risks
        update_city_risks()
        log.info("✅ City risks updated")
    except Exception as e:
        log.error(f"❌ City update job failed: {e}")

def run_retrain_job():
    try:
        log.info("⏰ Scheduler: Retraining model with feedback...")
        from ml.retrain import retrain_with_feedback
        from db.mongo import get_feedback_stats
        stats = get_feedback_stats()
        if stats['total'] < 10:
            log.info(f"   Only {stats['total']} feedback samples — skipping retrain")
            return
        result = retrain_with_feedback()
        log.info(f"✅ Retrain done — accuracy: {result['accuracy']}")
    except Exception as e:
        log.error(f"❌ Retrain job failed: {e}")

def start_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = BackgroundScheduler(timezone='UTC')

    # Run forecast every 24 hours
    _scheduler.add_job(
        run_forecast_job,
        trigger=IntervalTrigger(hours=24),
        id='forecast',
        name='USGS Forecast',
        replace_existing=True,
    )

    # Verify predictions every 24 hours (offset by 1hr)
    _scheduler.add_job(
        run_verify_job,
        trigger=IntervalTrigger(hours=24),
        id='verify',
        name='RL Verification',
        replace_existing=True,
    )

    # Update city risks every 6 hours
    _scheduler.add_job(
        run_city_update_job,
        trigger=IntervalTrigger(hours=6),
        id='city_update',
        name='City Risk Update',
        replace_existing=True,
    )

    # Retrain model every 7 days
    _scheduler.add_job(
        run_retrain_job,
        trigger=IntervalTrigger(days=7),
        id='retrain',
        name='Model Retrain',
        replace_existing=True,
    )

    _scheduler.start()
    log.info("✅ Scheduler started:")
    log.info("   📡 Forecast    — every 24 hours")
    log.info("   🔁 Verify      — every 24 hours")
    log.info("   🏙️  City update — every 6 hours")
    log.info("   🤖 Retrain     — every 7 days")

def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown()
        log.info("Scheduler stopped")

def get_scheduler_status():
    global _scheduler
    if not _scheduler or not _scheduler.running:
        return {'running': False, 'jobs': []}
    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            'id':       job.id,
            'name':     job.name,
            'next_run': str(job.next_run_time),
        })
    return {'running': True, 'jobs': jobs}