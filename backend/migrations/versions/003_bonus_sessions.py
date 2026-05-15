"""add bonus_sessions to client_memberships

Revision ID: 003
Revises: 002
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE client_memberships ADD COLUMN IF NOT EXISTS bonus_sessions INTEGER NOT NULL DEFAULT 0"
    )


def downgrade():
    op.drop_column('client_memberships', 'bonus_sessions')
