# Control Financiero

Segunda vista del Dashboard (`/dashboard?vista=finanzas`). El selector
**Dashboard General | Control Financiero** aparece arriba del dashboard solo para
quien tiene acceso.

## Acceso

| Rol | Acceso |
|---|---|
| Super Admin | Ve y administra todo |
| Admin | `finance:view` + `finance:manage` (ve y registra/edita) |
| Manager | `finance:view` (solo ve) |
| Agent / Viewer | Sin acceso: no ven el selector |

Se ajusta en Configuración → Roles y permisos. Por persona se puede ocultar con
Configuración → Visibilidad por usuario → Dashboard → "Vista Control Financiero".

## De dónde salen los números

- **Ingresos**: ingresos registrados a mano (estado *Cobrado*) + comisiones de
  aseguradoras con fecha de cobro (`Commission.carrierCommission` + `carrierPaymentDate`).
- **Gastos**: gastos registrados (pagados, pendientes y programados) con fecha en el
  periodo + comisiones a agentes (`agentAmount + managerAmount + aorAmount` de
  Commission; pagadas en su fecha de pago, pendientes en la fecha de venta). Los
  chargebacks no cuentan.
- **Ganancia neta** = Ingresos − Gastos. **Margen neto** = Ganancia / Ingresos × 100.
- **Por pagar**: todos los gastos pendientes o programados (cualquier fecha).
- **Proyección de cierre**: ritmo diario de ingresos y gastos variables hasta hoy
  (desde el 3er día del periodo) + gastos recurrentes que faltan por vencer.
- **Resumen del negocio**: frases generadas con los datos; si no hay movimientos, no se muestra.

Todos los cálculos viven en `src/lib/finance/calc.ts` (funciones puras, compartidas por
servidor y navegador). Los filtros (categoría, estado, tipo, método, proveedor, rango de
fechas, búsqueda) recalculan todo al instante.

## Datos

- `FinanceTransaction`: gastos e ingresos (descripción, categoría, monto, fecha, método,
  estado, proveedor, notas, comprobante, persona del equipo, tipo de pago, recurrente de origen,
  creado por/cuándo).
- `FinanceRecurringExpense`: gastos que se repiten (frecuencia semanal/mensual/anual/personalizada,
  próxima fecha de pago, estado activo/pausado). "Registrar pago" crea el movimiento y avanza la fecha.
- Comprobantes: data URL en la fila; se sirven por `/api/finance/receipt?id=…` solo a quien puede ver finanzas.
- Categorías, métodos, estados y frecuencias: `src/lib/finance/constants.ts`.

Migración: `prisma/migrations/20261008120000_control_financiero` (tablas + permisos
`finance:view` / `finance:manage` para Admin y Manager).
