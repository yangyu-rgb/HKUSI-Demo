CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crowdsource_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    port TEXT NOT NULL,
    actual_wait_time INTEGER NOT NULL CHECK(actual_wait_time >= 0),
    crowd_level TEXT NOT NULL CHECK(crowd_level IN ('low', 'medium', 'high')),
    effective_at TEXT NOT NULL,
    time_label TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_port_created
ON crowdsource_reports(port, created_at);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    origin_id TEXT NOT NULL,
    destination_id TEXT NOT NULL,
    days_json TEXT NOT NULL,
    arrival_deadline TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('fastest', 'cheapest', 'balanced')),
    advance_reminder INTEGER NOT NULL,
    anomaly_alert INTEGER NOT NULL,
    better_route_alert INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user
ON subscriptions(user_id, created_at);

CREATE TABLE IF NOT EXISTS subscription_evaluations (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    evaluated_at TEXT NOT NULL,
    evaluation_time TEXT NOT NULL,
    commute_date TEXT NOT NULL,
    target_time TEXT NOT NULL,
    recommended_port TEXT NOT NULL,
    recommended_port_id TEXT NOT NULL,
    latest_departure TEXT NOT NULL,
    next_alert TEXT,
    alternative_port TEXT,
    alerts_json TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_evaluations_subscription
ON subscription_evaluations(subscription_id, evaluated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS batch_plans (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    service_date TEXT NOT NULL,
    request_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_plans_company
ON batch_plans(company, created_at);

CREATE TABLE IF NOT EXISTS shadow_model_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at TEXT NOT NULL,
    target_time TEXT NOT NULL,
    port_id TEXT NOT NULL,
    port_name TEXT NOT NULL,
    statistical_wait_minutes REAL NOT NULL,
    shadow_wait_minutes REAL,
    difference_minutes REAL,
    status TEXT NOT NULL,
    model_version TEXT,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_shadow_model_observations_generated
ON shadow_model_observations(generated_at, id);

CREATE TABLE IF NOT EXISTS forecast_runs (
    id TEXT PRIMARY KEY,
    generated_at TEXT NOT NULL,
    target_time TEXT NOT NULL,
    query_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    data_version TEXT NOT NULL,
    data_sources_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_generated
ON forecast_runs(generated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS forecast_run_ports (
    forecast_run_id TEXT NOT NULL,
    port_id TEXT NOT NULL,
    port_name TEXT NOT NULL,
    target_time TEXT NOT NULL,
    statistical_wait_minutes REAL NOT NULL,
    shadow_wait_minutes REAL,
    shadow_status TEXT NOT NULL,
    shadow_reason TEXT,
    features_json TEXT NOT NULL,
    observed_wait_minutes REAL,
    observed_report_id TEXT UNIQUE,
    observed_at TEXT,
    observed_quality_score INTEGER,
    label_status TEXT NOT NULL DEFAULT 'unlabeled',
    PRIMARY KEY(forecast_run_id, port_id),
    FOREIGN KEY(forecast_run_id) REFERENCES forecast_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forecast_run_ports_label
ON forecast_run_ports(label_status, port_id, target_time);

CREATE TABLE IF NOT EXISTS forecast_feedback_links (
    report_id TEXT PRIMARY KEY,
    forecast_run_id TEXT NOT NULL,
    port_id TEXT NOT NULL,
    linked_at TEXT NOT NULL,
    FOREIGN KEY(forecast_run_id, port_id)
        REFERENCES forecast_run_ports(forecast_run_id, port_id)
);
