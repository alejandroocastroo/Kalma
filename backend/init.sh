#!/bin/bash
set -e

echo "==> Running Alembic migrations..."
alembic upgrade head

echo "==> Running SQL migrations..."
export PGPASSWORD="${POSTGRES_PASSWORD:-kalmapassword}"
PG_HOST="db"
PG_USER="${POSTGRES_USER:-kalma}"
PG_DB="${POSTGRES_DB:-kalma}"
set +e
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_spaces.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_schedule.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/make_class_type_optional.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_space_to_payments.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_session_custom_name.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_plans_memberships.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_membership_schedule.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_cobros_v2.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_appointment_debt.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_plan_space.sql
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f migrations/add_performance_indexes.sql
set -e

echo "==> Running seed..."
python seed.py

echo "==> Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
