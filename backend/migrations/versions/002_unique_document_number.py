"""Add unique constraint on document_number per tenant

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000
"""
from alembic import op

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Índice único parcial: único por tenant solo cuando document_number no es NULL ni vacío
    op.execute("""
        CREATE UNIQUE INDEX uq_clients_tenant_document
        ON clients (tenant_id, document_number)
        WHERE document_number IS NOT NULL AND document_number != ''
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_clients_tenant_document")
