"""Helpers de aislamiento multi-tenant.

Estos helpers centralizan la verificación de que un recurso referenciado por
su FK pertenece al tenant del usuario autenticado. Se usan en dos escenarios:

- `assert_owned`: al crear/actualizar, para validar que las FKs entrantes
  (client_id, space_id, etc.) sean del tenant actual. Lanza 404 si no.
- `get_if_owned`: al enriquecer respuestas, como defensa en profundidad para
  no exponer nombres de recursos de otro tenant. No lanza: devuelve None.
"""
import uuid
from typing import Optional, Type, TypeVar

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


async def assert_owned(
    db: AsyncSession,
    model: Type[T],
    id_: Optional[uuid.UUID],
    tenant_id: uuid.UUID,
    detail: str = "Recurso no encontrado",
) -> Optional[T]:
    """Carga un recurso por PK y verifica que pertenezca al tenant.

    - Si `id_` es None (FK opcional no provista), devuelve None sin error.
    - Si el recurso no existe o pertenece a otro tenant, lanza 404
      (mismo mensaje para no distinguir "no existe" de "es de otro tenant").
    """
    if id_ is None:
        return None
    obj = await db.get(model, id_)
    if obj is None or getattr(obj, "tenant_id", None) != tenant_id:
        raise HTTPException(404, detail)
    return obj


async def get_if_owned(
    db: AsyncSession,
    model: Type[T],
    id_: Optional[uuid.UUID],
    tenant_id: uuid.UUID,
) -> Optional[T]:
    """Como `assert_owned` pero no lanza: devuelve None si no existe o es de
    otro tenant. Pensado para enriquecimiento de respuestas (defensa en
    profundidad: nunca exponer nombres/datos de recursos ajenos)."""
    if id_ is None:
        return None
    obj = await db.get(model, id_)
    if obj is None or getattr(obj, "tenant_id", None) != tenant_id:
        return None
    return obj
