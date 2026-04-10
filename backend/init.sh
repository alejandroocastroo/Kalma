#!/bin/bash
set -e

echo "==> Running Alembic migrations..."
alembic upgrade head

echo "==> Running SQL migrations..."
DB_URL="postgresql://kalma:kalmapassword@db:5432/kalma"
psql "$DB_URL" -f migrations/add_spaces.sql
psql "$DB_URL" -f migrations/add_schedule.sql
psql "$DB_URL" -f migrations/make_class_type_optional.sql
psql "$DB_URL" -f migrations/add_space_to_payments.sql
psql "$DB_URL" -f migrations/add_session_custom_name.sql
psql "$DB_URL" -f migrations/add_plans_memberships.sql
psql "$DB_URL" -f migrations/add_membership_schedule.sql

echo "==> Running seed..."
python seed.py

echo "==> Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
