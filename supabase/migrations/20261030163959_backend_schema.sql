-- The FastAPI tender pipeline keeps its tables here (backend/db.py). The
-- schema is not exposed through the REST API, and the public API roles get
-- no access to it; only the backend's database connection uses it.
create schema if not exists backend;
revoke all on schema backend from public, anon, authenticated;
alter default privileges in schema backend revoke all on tables from public, anon, authenticated;
alter default privileges in schema backend revoke all on sequences from public, anon, authenticated;
alter default privileges in schema backend revoke all on functions from public, anon, authenticated;
