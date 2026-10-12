CREATE SCHEMA IF NOT EXISTS portfolio;
CREATE TABLE IF NOT EXISTS portfolio.state (
  key TEXT PRIMARY KEY CHECK (key IN ('portfolio_data_v4', 'admin:credentials:v1')),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);
CREATE TABLE IF NOT EXISTS portfolio.feedback (
  source_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at_unix BIGINT NOT NULL CHECK (created_at_unix >= 0)
);
CREATE INDEX IF NOT EXISTS feedback_newest ON portfolio.feedback (created_at_unix DESC);
