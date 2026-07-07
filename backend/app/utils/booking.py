"""Reserva atómica de cupo en sesiones de clase.

Evita el overbooking por condición de carrera: el patrón anterior
(leer `enrolled_count`, comparar con `capacity`, luego `+= 1`) permite que
dos peticiones concurrentes pasen ambas la validación y sobrecupen la clase.

`reserve_seat` reemplaza ese check-then-act por un UPDATE condicional único.
Bajo READ COMMITTED, PostgreSQL toma un lock de fila en el UPDATE y serializa
las peticiones concurrentes sobre la misma sesión: la segunda re-evalúa el
WHERE contra el valor ya incrementado y falla si no hay cupo.
"""
import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_session import ClassSession


async def reserve_seat(db: AsyncSession, session_id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
    """Incrementa `enrolled_count` en +1 de forma atómica, solo si hay cupo.

    Devuelve True si se reservó un cupo, False si la sesión está llena.

    IMPORTANTE: no modificar `session.enrolled_count` en Python después de
    llamar a esto. El objeto ORM queda con el valor viejo en memoria
    (expire_on_commit=False), pero el incremento real ya quedó hecho aquí y se
    persiste con el commit del router. Tocarlo en Python causaría doble conteo.
    """
    result = await db.execute(
        update(ClassSession)
        .where(
            ClassSession.id == session_id,
            ClassSession.tenant_id == tenant_id,
            ClassSession.enrolled_count < ClassSession.capacity,
        )
        .values(enrolled_count=ClassSession.enrolled_count + 1)
        .returning(ClassSession.id)
    )
    return result.first() is not None
