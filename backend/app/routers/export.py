"""Export router — Generación de reportes Excel contables"""
import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.database import get_db
from app.auth.jwt import get_current_active_user
from app.models.payment import Payment
from app.models.client import Client
from app.models.space import Space
from app.models.tenant import Tenant

router = APIRouter(prefix="/export", tags=["Exportar"])

# ── Labels ────────────────────────────────────────────────────────────────────

CATEGORY_LABELS: dict[str, str] = {
    "clase_grupal": "Clase grupal",
    "clase_privada": "Clase privada",
    "paquete_sesiones": "Paquete de sesiones",
    "membresia": "Membresía",
    "inscripcion": "Inscripción / matrícula",
    "otro_ingreso": "Otro ingreso",
    "arriendo": "Arriendo",
    "servicios_publicos": "Servicios públicos",
    "nomina_instructores": "Nómina instructores",
    "nomina_admin": "Nómina administrativa",
    "mantenimiento": "Mantenimiento",
    "equipamiento": "Equipamiento",
    "marketing": "Marketing y publicidad",
    "contabilidad": "Contabilidad",
    "tecnologia": "Software / tecnología",
    "seguros": "Seguros",
    "otros_gastos": "Otros gastos",
    # legacy
    "class_fee": "Cobro de clase",
    "membership": "Membresía",
    "package": "Paquete",
    "equipment": "Equipamiento",
    "rent": "Arriendo",
    "salary": "Nómina",
    "other": "Otro",
}

METHOD_LABELS: dict[str, str] = {
    "cash": "Efectivo",
    "transfer": "Transferencia",
    "card": "Tarjeta",
    "nequi": "Nequi",
    "daviplata": "Daviplata",
}

# ── Style helpers ─────────────────────────────────────────────────────────────

_BORDER_COLOR = "D0D0D0"


def _thin_border() -> Border:
    s = Side(border_style="thin", color=_BORDER_COLOR)
    return Border(left=s, right=s, top=s, bottom=s)


def _fill(hex_color: str) -> PatternFill:
    return PatternFill(start_color=hex_color, end_color=hex_color, fill_type="solid")


def _font(size: int = 10, bold: bool = False, color: str = "000000") -> Font:
    return Font(name="Calibri", size=size, bold=bold, color=color)


def _align(h: str = "left", v: str = "center", wrap: bool = False) -> Alignment:
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)


def _cop(value) -> int:
    """Return integer peso value for Excel number format."""
    try:
        return int(Decimal(str(value)))
    except Exception:
        return 0


def _style_header_row(ws, row: int, cols: int, bg: str = "1F4E79", fg: str = "FFFFFF", size: int = 10):
    """Apply dark-header style to a full row."""
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = _font(size, bold=True, color=fg)
        cell.fill = _fill(bg)
        cell.alignment = _align("center")
        cell.border = _thin_border()


def _style_total_row(ws, row: int, cols: int, bg: str = "E8EAF6"):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = _font(10, bold=True)
        cell.fill = _fill(bg)
        cell.border = _thin_border()


def _autofit(ws, min_width: int = 10, max_width: int = 50):
    for col_cells in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col_cells[0].column)
        for cell in col_cells:
            try:
                max_len = max(max_len, len(str(cell.value or "")))
            except Exception:
                pass
        ws.column_dimensions[col_letter].width = min(max_width, max(min_width, max_len + 2))


# ── Sheet builders ────────────────────────────────────────────────────────────


def _build_resumen(ws, payments: list[Payment], tenant_name: str, start: str, end: str, space_names: dict):
    """Hoja 1: Resumen Ejecutivo — Estado de resultados del período."""
    ws.freeze_panes = "A6"

    # ── Title block ──
    ws.merge_cells("A1:F1")
    ws["A1"] = tenant_name
    ws["A1"].font = _font(14, bold=True, color="1F4E79")
    ws["A1"].alignment = _align("center")

    ws.merge_cells("A2:F2")
    ws["A2"] = f"Reporte Contable — {start}  →  {end}"
    ws["A2"].font = _font(10, color="555555")
    ws["A2"].alignment = _align("center")

    ws.merge_cells("A3:F3")
    ws["A3"] = f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    ws["A3"].font = _font(9, color="888888")
    ws["A3"].alignment = _align("center")

    # ── Section: INGRESOS ──
    row = 5
    ws.merge_cells(f"A{row}:F{row}")
    ws[f"A{row}"] = "INGRESOS"
    ws[f"A{row}"].font = _font(10, bold=True, color="FFFFFF")
    ws[f"A{row}"].fill = _fill("2E7D32")
    ws[f"A{row}"].alignment = _align("center")

    row += 1
    headers = ["Categoría", "Barre", "Pilates", "General", "Otros espacios", "TOTAL"]
    for c, h in enumerate(headers, 1):
        ws.cell(row=row, column=c, value=h)
    _style_header_row(ws, row, len(headers), bg="43A047", fg="FFFFFF")

    # Aggregate incomes by category + space
    inc_data: dict[str, dict[str, Decimal]] = {}
    exp_data: dict[str, dict[str, Decimal]] = {}

    for p in payments:
        label = CATEGORY_LABELS.get(p.category, p.category)
        space = space_names.get(p.space_id, "General") if p.space_id else "General"
        bucket = inc_data if p.type == "income" else exp_data
        if label not in bucket:
            bucket[label] = {"Barre": Decimal(0), "Pilates": Decimal(0), "General": Decimal(0), "__other__": Decimal(0)}
        if space in ("Barre", "Pilates", "General"):
            bucket[label][space] += p.amount
        else:
            bucket[label]["__other__"] += p.amount

    row += 1
    inc_start_row = row
    total_inc = {"Barre": Decimal(0), "Pilates": Decimal(0), "General": Decimal(0), "__other__": Decimal(0)}
    for cat, spaces in inc_data.items():
        total_row = spaces["Barre"] + spaces["Pilates"] + spaces["General"] + spaces["__other__"]
        values = [cat, _cop(spaces["Barre"]), _cop(spaces["Pilates"]), _cop(spaces["General"]), _cop(spaces["__other__"]), _cop(total_row)]
        for c, v in enumerate(values, 1):
            cell = ws.cell(row=row, column=c, value=v)
            cell.border = _thin_border()
            cell.font = _font(10)
            cell.alignment = _align("right") if c > 1 else _align("left")
            if c > 1:
                cell.number_format = '#,##0'
            if row % 2 == 0:
                cell.fill = _fill("F1F8E9")
        for k in ("Barre", "Pilates", "General", "__other__"):
            total_inc[k] += spaces[k]
        row += 1

    # Income total row
    grand_inc = sum(total_inc.values())
    _style_total_row(ws, row, 6, bg="C8E6C9")
    ws.cell(row=row, column=1, value="TOTAL INGRESOS").font = _font(10, bold=True)
    for c, k in enumerate(["Barre", "Pilates", "General", "__other__"], 2):
        cell = ws.cell(row=row, column=c, value=_cop(total_inc[k]))
        cell.number_format = '#,##0'
        cell.font = _font(10, bold=True, color="1B5E20")
        cell.alignment = _align("right")
        cell.fill = _fill("C8E6C9")
        cell.border = _thin_border()
    cell = ws.cell(row=row, column=6, value=_cop(grand_inc))
    cell.number_format = '#,##0'
    cell.font = _font(11, bold=True, color="1B5E20")
    cell.alignment = _align("right")
    cell.fill = _fill("A5D6A7")
    cell.border = _thin_border()
    row += 2

    # ── Section: EGRESOS ──
    ws.merge_cells(f"A{row}:F{row}")
    ws[f"A{row}"] = "EGRESOS"
    ws[f"A{row}"].font = _font(10, bold=True, color="FFFFFF")
    ws[f"A{row}"].fill = _fill("C62828")
    ws[f"A{row}"].alignment = _align("center")
    row += 1
    for c, h in enumerate(headers, 1):
        ws.cell(row=row, column=c, value=h)
    _style_header_row(ws, row, len(headers), bg="E53935", fg="FFFFFF")

    row += 1
    total_exp = {"Barre": Decimal(0), "Pilates": Decimal(0), "General": Decimal(0), "__other__": Decimal(0)}
    for cat, spaces in exp_data.items():
        total_row = spaces["Barre"] + spaces["Pilates"] + spaces["General"] + spaces["__other__"]
        values = [cat, _cop(spaces["Barre"]), _cop(spaces["Pilates"]), _cop(spaces["General"]), _cop(spaces["__other__"]), _cop(total_row)]
        for c, v in enumerate(values, 1):
            cell = ws.cell(row=row, column=c, value=v)
            cell.border = _thin_border()
            cell.font = _font(10)
            cell.alignment = _align("right") if c > 1 else _align("left")
            if c > 1:
                cell.number_format = '#,##0'
            if row % 2 == 0:
                cell.fill = _fill("FFEBEE")
        for k in ("Barre", "Pilates", "General", "__other__"):
            total_exp[k] += spaces[k]
        row += 1

    grand_exp = sum(total_exp.values())
    _style_total_row(ws, row, 6, bg="FFCDD2")
    ws.cell(row=row, column=1, value="TOTAL EGRESOS").font = _font(10, bold=True)
    for c, k in enumerate(["Barre", "Pilates", "General", "__other__"], 2):
        cell = ws.cell(row=row, column=c, value=_cop(total_exp[k]))
        cell.number_format = '#,##0'
        cell.font = _font(10, bold=True, color="B71C1C")
        cell.alignment = _align("right")
        cell.fill = _fill("FFCDD2")
        cell.border = _thin_border()
    cell = ws.cell(row=row, column=6, value=_cop(grand_exp))
    cell.number_format = '#,##0'
    cell.font = _font(11, bold=True, color="B71C1C")
    cell.alignment = _align("right")
    cell.fill = _fill("EF9A9A")
    cell.border = _thin_border()
    row += 2

    # ── Balance neto ──
    neto = grand_inc - grand_exp
    ws.merge_cells(f"A{row}:E{row}")
    ws[f"A{row}"] = "BALANCE NETO DEL PERÍODO"
    ws[f"A{row}"].font = _font(11, bold=True)
    ws[f"A{row}"].fill = _fill("E3F2FD")
    ws[f"A{row}"].alignment = _align("right")
    ws[f"A{row}"].border = _thin_border()
    neto_color = "1565C0" if neto >= 0 else "B71C1C"
    neto_bg = "BBDEFB" if neto >= 0 else "FFCDD2"
    cell = ws.cell(row=row, column=6, value=_cop(neto))
    cell.number_format = '#,##0'
    cell.font = _font(12, bold=True, color=neto_color)
    cell.fill = _fill(neto_bg)
    cell.alignment = _align("right")
    cell.border = _thin_border()

    _autofit(ws)


def _build_detalle(ws, payments: list[Payment], tipo: str, client_names: dict, space_names: dict):
    """Hoja 2/3: Detalle de ingresos o egresos."""
    ws.freeze_panes = "A3"
    filtrado = [p for p in payments if p.type == tipo]

    headers = ["Fecha", "Descripción", "Cliente", "Categoría", "Espacio", "Método de pago", "Monto (COP)"]
    for c, h in enumerate(headers, 1):
        ws.cell(row=1, column=c, value=h)
    _style_header_row(ws, 1, len(headers))

    total = Decimal(0)
    for i, p in enumerate(filtrado, 2):
        space = space_names.get(p.space_id, "General") if p.space_id else "General"
        values = [
            p.payment_date.strftime("%d/%m/%Y") if p.payment_date else "",
            p.description or "",
            client_names.get(p.client_id, "") if p.client_id else "",
            CATEGORY_LABELS.get(p.category, p.category),
            space,
            METHOD_LABELS.get(p.payment_method, p.payment_method),
            _cop(p.amount),
        ]
        for c, v in enumerate(values, 1):
            cell = ws.cell(row=i, column=c, value=v)
            cell.border = _thin_border()
            cell.font = _font(10)
            cell.alignment = _align("right") if c == 7 else _align("left")
            if c == 7:
                cell.number_format = '#,##0'
            if i % 2 == 0:
                cell.fill = _fill("F5F5F5")
        total += p.amount

    # Total row
    total_row = len(filtrado) + 2
    bg = "C8E6C9" if tipo == "income" else "FFCDD2"
    txt_color = "1B5E20" if tipo == "income" else "B71C1C"
    _style_total_row(ws, total_row, len(headers), bg=bg)
    ws.merge_cells(f"A{total_row}:F{total_row}")
    ws[f"A{total_row}"] = "TOTAL"
    ws[f"A{total_row}"].font = _font(10, bold=True)
    ws[f"A{total_row}"].alignment = _align("right")
    ws[f"A{total_row}"].fill = _fill(bg)
    ws[f"A{total_row}"].border = _thin_border()
    cell = ws.cell(row=total_row, column=7, value=_cop(total))
    cell.number_format = '#,##0'
    cell.font = _font(11, bold=True, color=txt_color)
    cell.alignment = _align("right")
    cell.fill = _fill(bg)
    cell.border = _thin_border()

    _autofit(ws)


def _build_kpis(ws, payments: list[Payment], space_names: dict):
    """Hoja 4: KPIs del período."""
    ws.freeze_panes = "A4"

    incomes = [p for p in payments if p.type == "income"]
    expenses = [p for p in payments if p.type == "expense"]
    total_inc = sum(p.amount for p in incomes)
    total_exp = sum(p.amount for p in expenses)
    neto = total_inc - total_exp
    margen = (neto / total_inc * 100) if total_inc else Decimal(0)

    # Title
    ws.merge_cells("A1:C1")
    ws["A1"] = "KPIs DEL PERÍODO"
    ws["A1"].font = _font(12, bold=True, color="1F4E79")
    ws["A1"].alignment = _align("center")
    ws["A1"].fill = _fill("E3F2FD")

    headers = ["Indicador", "Valor", "Nota"]
    for c, h in enumerate(headers, 1):
        ws.cell(row=2, column=c, value=h)
    _style_header_row(ws, 2, 3)

    kpis = [
        ("Total ingresos del período", _cop(total_inc), "COP"),
        ("Total egresos del período", _cop(total_exp), "COP"),
        ("Balance neto", _cop(neto), "COP — positivo = utilidad"),
        ("Margen operacional", f"{float(margen):.1f}%", "Neto / Ingresos × 100"),
        ("Número de ingresos registrados", len(incomes), "transacciones"),
        ("Número de egresos registrados", len(expenses), "transacciones"),
        ("Ticket promedio por ingreso", _cop(total_inc / len(incomes)) if incomes else 0, "COP por transacción"),
    ]

    # Por categoría de ingreso
    inc_by_cat: dict[str, Decimal] = {}
    for p in incomes:
        label = CATEGORY_LABELS.get(p.category, p.category)
        inc_by_cat[label] = inc_by_cat.get(label, Decimal(0)) + p.amount
    for cat, val in sorted(inc_by_cat.items(), key=lambda x: x[1], reverse=True):
        pct = float(val / total_inc * 100) if total_inc else 0.0
        kpis.append((f"  Ingreso — {cat}", _cop(val), f"{pct:.1f}% del total ingresos"))

    # Por categoría de egreso
    exp_by_cat: dict[str, Decimal] = {}
    for p in expenses:
        label = CATEGORY_LABELS.get(p.category, p.category)
        exp_by_cat[label] = exp_by_cat.get(label, Decimal(0)) + p.amount
    for cat, val in sorted(exp_by_cat.items(), key=lambda x: x[1], reverse=True):
        pct = float(val / total_exp * 100) if total_exp else 0.0
        kpis.append((f"  Egreso — {cat}", _cop(val), f"{pct:.1f}% del total egresos"))

    # Por espacio
    space_inc: dict[str, Decimal] = {}
    space_exp: dict[str, Decimal] = {}
    for p in payments:
        space = space_names.get(p.space_id, "General") if p.space_id else "General"
        if p.type == "income":
            space_inc[space] = space_inc.get(space, Decimal(0)) + p.amount
        else:
            space_exp[space] = space_exp.get(space, Decimal(0)) + p.amount
    all_spaces = set(list(space_inc.keys()) + list(space_exp.keys()))
    for sp in sorted(all_spaces):
        inc_sp = space_inc.get(sp, Decimal(0))
        exp_sp = space_exp.get(sp, Decimal(0))
        net_sp = inc_sp - exp_sp
        kpis.append((f"  {sp} — Ingresos", _cop(inc_sp), "COP"))
        kpis.append((f"  {sp} — Egresos", _cop(exp_sp), "COP"))
        kpis.append((f"  {sp} — Neto", _cop(net_sp), "COP"))

    for i, (nombre, valor, nota) in enumerate(kpis, 3):
        bg = "F5F5F5" if i % 2 == 0 else "FFFFFF"
        # Highlight balance row
        if "Balance neto" in nombre:
            bg = "BBDEFB" if neto >= 0 else "FFCDD2"
        ws.cell(row=i, column=1, value=nombre).font = _font(10)
        val_cell = ws.cell(row=i, column=2, value=valor)
        val_cell.font = _font(10, bold=True)
        val_cell.alignment = _align("right")
        if isinstance(valor, int):
            val_cell.number_format = '#,##0'
        ws.cell(row=i, column=3, value=nota).font = _font(9, color="666666")
        for c in range(1, 4):
            ws.cell(row=i, column=c).fill = _fill(bg)
            ws.cell(row=i, column=c).border = _thin_border()

    _autofit(ws)


def _build_por_espacio(ws, payments: list[Payment], space_names: dict):
    """Hoja 5: Desglose por espacio."""
    ws.freeze_panes = "A3"

    headers = ["Espacio", "Ingresos (COP)", "Egresos (COP)", "Neto (COP)", "% Ingresos totales"]
    for c, h in enumerate(headers, 1):
        ws.cell(row=1, column=c, value=h)
    _style_header_row(ws, 1, len(headers))

    space_data: dict[str, dict] = {}
    for p in payments:
        space = space_names.get(p.space_id, "General") if p.space_id else "General"
        if space not in space_data:
            space_data[space] = {"income": Decimal(0), "expense": Decimal(0)}
        space_data[space][p.type] += p.amount

    total_inc_all = sum(d["income"] for d in space_data.values())

    for i, (space, data) in enumerate(sorted(space_data.items()), 2):
        inc = data["income"]
        exp = data["expense"]
        neto = inc - exp
        pct = float(inc / total_inc_all * 100) if total_inc_all else 0.0
        neto_color = "1B5E20" if neto >= 0 else "B71C1C"
        bg = "F5F5F5" if i % 2 == 0 else "FFFFFF"
        values = [space, _cop(inc), _cop(exp), _cop(neto), f"{pct:.1f}%"]
        for c, v in enumerate(values, 1):
            cell = ws.cell(row=i, column=c, value=v)
            cell.border = _thin_border()
            cell.fill = _fill(bg)
            if c == 1:
                cell.font = _font(10, bold=True)
                cell.alignment = _align("left")
            elif c == 4:
                cell.font = _font(10, bold=True, color=neto_color)
                cell.alignment = _align("right")
                cell.number_format = '#,##0'
            else:
                cell.font = _font(10)
                cell.alignment = _align("right")
                if c in (2, 3):
                    cell.number_format = '#,##0'

    # Grand total
    total_row = len(space_data) + 2
    total_exp_all = sum(d["expense"] for d in space_data.values())
    grand_neto = total_inc_all - total_exp_all
    _style_total_row(ws, total_row, len(headers), bg="E8EAF6")
    ws.cell(row=total_row, column=1, value="TOTAL").font = _font(10, bold=True)
    for c, v in enumerate([_cop(total_inc_all), _cop(total_exp_all), _cop(grand_neto), "100%"], 2):
        cell = ws.cell(row=total_row, column=c, value=v)
        cell.font = _font(10, bold=True)
        cell.alignment = _align("right")
        cell.fill = _fill("E8EAF6")
        cell.border = _thin_border()
        if c in (2, 3, 4) and isinstance(v, int):
            cell.number_format = '#,##0'

    _autofit(ws)


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.get("/contabilidad")
async def export_contabilidad(
    start: Optional[str] = Query(None, description="Fecha inicio YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="Fecha fin YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Genera y descarga un archivo Excel con el reporte contable del período.
    Hojas: Resumen Ejecutivo | Ingresos Detalle | Egresos Detalle | KPIs | Por Espacio
    """
    from fastapi import HTTPException
    if not current_user.tenant_id:
        raise HTTPException(403, "Sin tenant")

    # ── Fetch data ──
    q = select(Payment).where(Payment.tenant_id == current_user.tenant_id)
    if start:
        q = q.where(Payment.payment_date >= date.fromisoformat(start))
    if end:
        q = q.where(Payment.payment_date <= date.fromisoformat(end))
    result = await db.execute(q.order_by(Payment.payment_date.asc()))
    payments_list = result.scalars().all()

    # Bulk-load spaces and clients for name resolution
    spaces_result = await db.execute(select(Space).where(Space.tenant_id == current_user.tenant_id))
    space_names: dict[uuid.UUID, str] = {s.id: s.name for s in spaces_result.scalars().all()}

    # Collect unique client IDs
    client_ids = {p.client_id for p in payments_list if p.client_id}
    client_names: dict[uuid.UUID, str] = {}
    if client_ids:
        clients_result = await db.execute(
            select(Client).where(Client.id.in_(list(client_ids)))
        )
        client_names = {c.id: c.full_name for c in clients_result.scalars().all()}

    # Tenant name
    tenant = await db.get(Tenant, current_user.tenant_id)
    tenant_name = tenant.name if tenant else "Estudio"

    # ── Build workbook ──
    wb = openpyxl.Workbook()

    # Sheet order matches navigation order
    ws_resumen = wb.active
    ws_resumen.title = "Resumen Ejecutivo"
    ws_ingresos = wb.create_sheet("Ingresos Detalle")
    ws_egresos = wb.create_sheet("Egresos Detalle")
    ws_kpis = wb.create_sheet("KPIs del Período")
    ws_espacios = wb.create_sheet("Por Espacio")

    _build_resumen(ws_resumen, payments_list, tenant_name, start or "—", end or "—", space_names)
    _build_detalle(ws_ingresos, payments_list, "income", client_names, space_names)
    _build_detalle(ws_egresos, payments_list, "expense", client_names, space_names)
    _build_kpis(ws_kpis, payments_list, space_names)
    _build_por_espacio(ws_espacios, payments_list, space_names)

    # ── Stream response ──
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    start_label = (start or "inicio").replace("-", "")
    end_label = (end or "fin").replace("-", "")
    filename = f"Contabilidad_{tenant_name.replace(' ', '_')}_{start_label}_{end_label}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
