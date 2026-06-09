"""add hidden_categories to tenants

Revision ID: 004
Revises: 003
Create Date: 2026-06-04
"""
from alembic import op

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS hidden_categories JSONB"
    )


def downgrade():
    op.drop_column('tenants', 'hidden_categories')
