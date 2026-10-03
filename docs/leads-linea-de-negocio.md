# Leads: Cliente Común + Línea de negocio

Regla del módulo:

```
Lead = CLIENTE COMÚN (siempre visible)  +  campos de UNA línea de negocio
```

| Línea              | Código            | Secciones                                                                 |
|--------------------|-------------------|---------------------------------------------------------------------------|
| Medicare Advantage | `MEDICARE`        | Medicare y Medicaid · Salud · Doctores, citas y farmacia · Plan · SOA, grabación e inscripción · POA · Agente, autorización y firma (incluye Alerta Turning 65) |
| Obamacare          | `OBAMACARE`       | Hogar y elegibilidad · Plan y Marketplace · Dependientes                  |
| Family Heritage    | `FAMILY_HERITAGE` | Plan y póliza · Miembros cubiertos · Información bancaria (restringida)    |

## Dónde vive cada cosa

- **Contrato de campos y validación**: `src/lib/leads/lineSchema.ts`. Única fuente de
  verdad, la importan el formulario y las Server Actions. Para agregar, quitar o volver
  opcional un campo se edita solo este archivo (`optional: true`, `visibleIf`, etc.).
- **Cliente Común**: columnas de `Lead` (nombre, apellido, fecha de nacimiento, contacto,
  dirección, idioma, origen, vendedor, AOR). Obligatorios en `COMMON_REQUIRED`.
- **Campos de la línea**: `Lead.lineDetails` (JSON `{ line, values }`). El servidor
  descarta toda clave que no pertenezca a la línea activa y los campos dependientes que
  quedaron ocultos (ej. "Número de Medicaid" con Medicaid = No).
- **Datos restringidos** (SSN, clave de seguridad Alliance, SSN de dependientes/miembros,
  información bancaria): cifrados (AES-256-GCM) en `SensitiveField.leadId`. Nunca viajan
  al navegador después de guardarse; se muestran enmascarados y revelarlos exige
  `sensitive_data:view` y queda en `SensitiveDataAccessLog`.
- **UI**: `src/components/leads/form/LeadFormDrawer.tsx` (crear y editar),
  `src/components/leads/LeadLineDetails.tsx` (detalle de solo lectura).

## Comportamiento

- Crear Lead: 1) Información del cliente → 2) Línea de negocio → 3) Información de la línea.
  Solo se muestran los campos de la línea seleccionada.
- Todos los campos visibles de la línea son obligatorios (las listas aceptan "No aplica":
  "No toma medicamentos", "Sin citas programadas", etc.). El nombre del agente de récord
  actual es opcional.
- Editar Lead: misma estructura. Si se cambia la línea, Cliente Común se conserva; al
  guardar, los datos de la línea anterior se reemplazan y sus datos restringidos se
  archivan (no se borran, para conservar la auditoría).
- Alerta Turning 65: se calcula sola desde la fecha de nacimiento (aviso destacado si
  cumple 65 en los próximos 6 meses); aparece en el formulario, el detalle y la tarjeta del
  Kanban.
- Convertir a cliente: los datos de la línea se copian al perfil correspondiente del
  cliente (`MedicareProfile`, `ObamacareProfile`, `FamilyHeritageProfile`) y los datos
  restringidos cifrados se copian a `SensitiveField` del cliente.

## Migración

`prisma/migrations/20261003200000_leads_linea_de_negocio`: agrega `Lead.leadNumber`
(ID visible `L-000123`), `Lead.lineDetails`, `SensitiveField.leadId`, y oculta los campos
personalizados por línea que sembraba el seed (ahora son campos nativos).
