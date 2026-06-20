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
    # La tabla client_memberships no se crea en Alembic, sino en el script SQL
    # add_plans_memberships.sql que corre DESPUÉS de las migraciones de Alembic.
    # En una base limpia la tabla aún no existe aquí, así que omitimos el ALTER;
    # add_bonus_sessions.sql añade esta misma columna en la fase de scripts SQL.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("client_memberships"):
        op.execute(
            "ALTER TABLE client_memberships ADD COLUMN IF NOT EXISTS bonus_sessions INTEGER NOT NULL DEFAULT 0"
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("client_memberships"):
        op.drop_column('client_memberships', 'bonus_sessions')
