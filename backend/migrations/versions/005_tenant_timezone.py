"""add timezone to tenants

Revision ID: 005
Revises: 004
Create Date: 2026-06-06
"""
from alembic import op

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'America/Bogota'"
    )


def downgrade():
    op.drop_column('tenants', 'timezone')
