-- Grants for the least-privilege runtime role used through APP_DATABASE_URL.
-- Create the role first with a generated password: CREATE ROLE portfolio_app LOGIN PASSWORD '...';
-- Matches every statement in lib/persistence.ts; no row removal or schema changes.
GRANT USAGE ON SCHEMA portfolio TO portfolio_app;
GRANT SELECT, INSERT, UPDATE ON portfolio.state TO portfolio_app;
GRANT SELECT, INSERT ON portfolio.feedback TO portfolio_app;
