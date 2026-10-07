# Visibilidad por usuario y panel de Envíos

## Visibilidad por usuario

Configuración → **Visibilidad por usuario** (solo Admin / Super Admin).

Para cada persona se decide qué ve dentro del CRM, por encima de su rol:

```
Módulo del menú → Pestaña del CRM → Sección → Campo
```

- Cada elemento tiene tres opciones: **Según rol / Predeterminado**, **Ver**, **Ocultar**.
- Ocultar algo oculta todo lo que cuelga de ello (ocultar "SOA, grabación e inscripción"
  oculta sus campos).
- Lo oculto **no se muestra ni se exige** al crear/editar un lead; al editar, el servidor
  conserva el valor guardado de lo que la persona no ve.
- Un módulo oculto tampoco se puede abrir escribiendo la URL.
- El Super Admin siempre ve todo. Solo un Super Admin configura a un Admin.
- "Copiar configuración de…" replica las excepciones de otra persona.

Dónde vive:

- Catálogo de elementos: `src/lib/visibility.ts` (el árbol de Leads se genera desde
  `src/lib/leads/lineSchema.ts`, así que un campo nuevo aparece solo).
- Cálculo por petición: `src/lib/visibility-server.ts` (`getUserVisibility`).
- En el navegador: `VisibilityProvider` / `useHiddenKeys()`.
- Base de datos: `UserVisibilityOverride` (solo excepciones; sin fila = lo del rol).

## Panel Envíos (submisiones)

Módulo `/submissions`, **oculto por defecto** para todos los roles. Se habilita por rol
(Roles y permisos → Visibilidad de módulos) o por persona.

1. En la ficha del lead, **Enviar a Envíos** → estado *Pendiente* y aviso a quienes ven el panel.
2. En Envíos, quien somete llena los campos de envío de la línea y marca
   *Sometido* → *Aprobado* / *Rechazado*. Cada cambio avisa al vendedor.
3. Si se rechaza, el vendedor puede **Reenviar a Envíos**.

Campos de envío por línea: `SUBMISSION_FIELDS` en `src/lib/leads/lineSchema.ts`
(Medicare: SOA, grabación, fecha efectiva, confirmación · Obamacare: ID Marketplace,
consentimiento, fecha efectiva · Family Heritage: póliza, fecha efectiva).

Migración: `prisma/migrations/20261007120000_visibilidad_por_usuario_y_envios`.
