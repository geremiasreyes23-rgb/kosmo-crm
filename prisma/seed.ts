/**
 * Seed inicial de Fase 2 — SOLO roles, permisos base y una cuenta Super Admin
 * para poder entrar por primera vez. A propósito NO se siembran usuarios de
 * ejemplo (Carlos, Ana, Marisol...) como en el mock de Fase 1: el módulo de
 * Configuración → Usuarios ahora es real, así que el equipo de agentes se da
 * de alta desde ahí — pensado para un call center con personal rotativo.
 *
 * Ejecutar con: npm run db:seed  (o automáticamente tras `prisma migrate dev`)
 */
import { PrismaClient, CustomFieldType, RecognitionType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

// Fase 15 (preparación para producción) — antes esto era el nombre y
// correo reales de una persona concreta, hardcodeados en el código fuente
// versionado. Ahora se leen de variables de entorno (ver .env.example) con
// estos mismos valores como default, así que ninguna instalación existente
// cambia de comportamiento — pero un despliegue nuevo (u otra agencia, si
// esto se ofrece a más de un cliente algún día) puede fijar su propio Super
// Admin sin editar el seed.
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "geremiasreyes23@gmail.com";
const SUPER_ADMIN_FIRST_NAME = process.env.SUPER_ADMIN_FIRST_NAME || "Geremias";
const SUPER_ADMIN_LAST_NAME = process.env.SUPER_ADMIN_LAST_NAME || "Valdez";

const RESOURCES = [
  "leads",
  "clients",
  "sales",
  "policies",
  "commissions",
  "activities",
  "tasks",
  "calendar",
  "reports",
  "settings",
  "mail",
  "feed",
] as const;
const CRUD_ACTIONS = ["view", "create", "edit", "delete"] as const;

const EXTRA_PERMISSIONS: [string, string][] = [
  ["reports", "export"],
  ["sensitive_data", "view"],
  ["users", "manage"],
  ["*", "view_all"],
  // Panel de administración de Correo interno (Configuración → Comunicación)
  // — dominio, activar/desactivar, límites de adjuntos, retención, auditoría.
  // Deliberadamente separado de "mail:*" (ver más abajo): usar el correo
  // propio no requiere este permiso, administrar el módulo entero sí.
  ["mail", "admin"],
  // Administración de la tabla de tarifas de comisión (Configuración →
  // Tabla de tarifas) — deliberadamente separado de "commissions:create/
  // edit" (que sí tienen Agent/Manager, para sus propias comisiones por
  // póliza): esto es configuración global del negocio, no un dato propio
  // de una venta, y solo Admin/Super Admin la reciben (vía allKeys).
  ["commissions", "admin"],
  // Revisar (aprobar/rechazar) los reportes diarios de otras personas —
  // separado de "activities:create/edit" (que ya tienen Agent/Manager para
  // sus propios reportes/actividades): quien REGISTRA un reporte nunca
  // debe poder aprobar el suyo propio. Se otorga a Manager además de
  // Admin/Super Admin (vía allKeys) más abajo, porque un supervisor
  // también revisa reportes de su equipo.
  ["activities", "review"],
  // Fase 13 (Auditoría + Seguridad) — ver el registro de auditoría
  // (Configuración → Auditoría). A propósito NO se le da a Manager: un
  // supervisor de equipo revisa reportes y datos de negocio, pero el
  // registro de auditoría (quién cambió qué en todo el sistema, incluidos
  // otros usuarios) queda reservado a Admin/Super Admin vía allKeys.
  ["audit", "view"],
  // Feed de Actividades — fijar/desfijar publicaciones ajenas y editar o
  // eliminar publicaciones de otros usuarios (moderación). Editar/eliminar
  // tu PROPIA publicación nunca requiere este permiso — eso lo valida la
  // Server Action por autoría (feed:create ya lo cubre), igual que un
  // mensaje propio en Mensajería. Se otorga a Manager además de Admin/
  // Super Admin (vía allKeys) porque un supervisor también modera el feed
  // de su equipo.
  ["feed", "moderate"],
];

function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

async function main() {
  console.log("Sembrando roles base...");
  const roleDefs = [
    { name: "Super Admin", description: "Acceso total al sistema, incluida la gestión de usuarios y roles" },
    { name: "Admin", description: "Administración del CRM — usuarios, configuración, todos los módulos" },
    { name: "Manager", description: "Visualización y administración de su equipo" },
    { name: "Agent", description: "Acceso a sus propios leads, clientes, ventas y actividades" },
    { name: "Viewer", description: "Solo lectura" },
  ];
  const roles: Record<string, { id: string }> = {};
  for (const def of roleDefs) {
    roles[def.name] = await prisma.role.upsert({
      where: { name: def.name },
      update: { description: def.description },
      create: { name: def.name, description: def.description, isSystem: true },
    });
  }

  console.log("Sembrando catálogo de permisos...");
  const allPairs: [string, string][] = [
    ...RESOURCES.flatMap((r) => CRUD_ACTIONS.map((a): [string, string] => [r, a])),
    ...EXTRA_PERMISSIONS,
  ];
  const permissions: Record<string, { id: string }> = {};
  for (const [resource, action] of allPairs) {
    const key = `${resource}:${action}`;
    permissions[key] = await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      update: {},
      create: { resource, action },
    });
  }

  const grant = async (roleName: string, keys: string[]) => {
    const role = roles[roleName];
    for (const key of keys) {
      const permission = permissions[key];
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  };

  const allKeys = Object.keys(permissions);
  const businessResources = RESOURCES.filter((r) => r !== "settings" && r !== "mail");

  await grant("Super Admin", allKeys);
  await grant("Admin", allKeys);
  await grant("Manager", [
    "*:view_all",
    ...businessResources.flatMap((r) => [`${r}:view`, `${r}:create`, `${r}:edit`]),
    "reports:export",
    "activities:review",
    "feed:moderate",
  ]);
  await grant("Agent", businessResources.flatMap((r) => [`${r}:view`, `${r}:create`, `${r}:edit`]));
  await grant("Viewer", businessResources.map((r) => `${r}:view`));

  // Correo interno: es una herramienta de comunicación básica, no un "dato
  // de negocio" — todos los roles pueden usar SU PROPIO buzón (enviar, leer,
  // archivar, mover a la papelera). El control real de qué correo ve cada
  // quien lo hace la pertenencia de la fila (InternalMessageRecipient.
  // mailboxId === buzón del usuario), nunca este permiso — ver
  // src/app/(app)/mail/actions.ts. Solo "mail:admin" (arriba, en
  // EXTRA_PERMISSIONS) queda reservado a Super Admin/Admin vía allKeys.
  const mailKeys = ["mail:view", "mail:create", "mail:edit", "mail:delete"];
  await grant("Manager", mailKeys);
  await grant("Agent", mailKeys);
  await grant("Viewer", mailKeys);

  console.log("Sembrando catálogo de líneas de negocio...");
  const lineDefs = [
    { name: "Medicare Advantage", code: "MEDICARE" },
    { name: "Obamacare", code: "OBAMACARE" },
    { name: "Family Heritage", code: "FAMILY_HERITAGE" },
  ];
  const lines: Record<string, { id: string }> = {};
  for (const def of lineDefs) {
    lines[def.name] = await prisma.insuranceLine.upsert({
      where: { code: def.code },
      update: {},
      create: { name: def.name, code: def.code },
    });
  }

  console.log("Sembrando carriers...");
  // Catálogo base de aseguradoras — nombres reales usados ya en la demo de
  // Fase 1 (src/data/mock.ts). Cada carrier queda asociado a las líneas de
  // negocio que efectivamente ofrece, para poder filtrar en cascada al
  // crear una póliza (Línea → Carrier).
  const carrierDefs: { name: string; lines: string[] }[] = [
    { name: "Humana", lines: ["Medicare Advantage"] },
    { name: "CarePlus", lines: ["Medicare Advantage"] },
    { name: "Oscar Health", lines: ["Obamacare"] },
    { name: "Ambetter", lines: ["Obamacare"] },
    { name: "Family Heritage Life", lines: ["Family Heritage"] },
  ];
  for (const def of carrierDefs) {
    const carrier = await prisma.carrier.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name },
    });
    for (const lineName of def.lines) {
      const line = lines[lineName];
      if (!line) continue;
      await prisma.carrierInsuranceLine.upsert({
        where: { carrierId_insuranceLineId: { carrierId: carrier.id, insuranceLineId: line.id } },
        update: {},
        create: { carrierId: carrier.id, insuranceLineId: line.id },
      });
    }
  }

  console.log("Sembrando orígenes de leads...");
  const sourceNames = ["Base de datos", "Referido", "Evento", "Llamada entrante", "Otro"];
  for (const name of sourceNames) {
    await prisma.leadSource.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log("Sembrando pipeline real de Leads...");
  const leadPipeline = await prisma.pipeline.upsert({
    where: { id: "lead-pipeline-default" },
    update: {},
    create: { id: "lead-pipeline-default", name: "Pipeline de Leads", entityType: "LEAD", isDefault: true },
  });
  const leadStageDefs = [
    { name: "Nuevo" },
    { name: "Contactar" },
    { name: "Contactado" },
    { name: "Calificado" },
    { name: "Cita programada" },
    { name: "En proceso" },
    { name: "Oferta presentada" },
    { name: "Documentación pendiente" },
    { name: "Venta cerrada", isWon: true },
    { name: "No interesado", isLost: true },
    { name: "No califica", isLost: true },
    { name: "Perdido", isLost: true },
  ];
  for (const [i, def] of leadStageDefs.entries()) {
    await prisma.pipelineStage.upsert({
      where: { pipelineId_order: { pipelineId: leadPipeline.id, order: i } },
      update: { name: def.name, isWon: !!def.isWon, isLost: !!def.isLost },
      create: {
        pipelineId: leadPipeline.id,
        order: i,
        name: def.name,
        isWon: !!def.isWon,
        isLost: !!def.isLost,
      },
    });
  }

  console.log("Sembrando pipeline real de Ventas...");
  const salesPipeline = await prisma.pipeline.upsert({
    where: { id: "sales-pipeline-default" },
    update: {},
    create: { id: "sales-pipeline-default", name: "Pipeline de Ventas", entityType: "SALE", isDefault: true },
  });
  const saleStageDefs = [
    { name: "Cotización" },
    { name: "Aplicación" },
    { name: "Pendiente" },
    { name: "Aprobada" },
    { name: "Cerrada", isWon: true },
    { name: "Perdida", isLost: true },
  ];
  for (const [i, def] of saleStageDefs.entries()) {
    await prisma.pipelineStage.upsert({
      where: { pipelineId_order: { pipelineId: salesPipeline.id, order: i } },
      update: { name: def.name, isWon: !!def.isWon, isLost: !!def.isLost },
      create: {
        pipelineId: salesPipeline.id,
        order: i,
        name: def.name,
        isWon: !!def.isWon,
        isLost: !!def.isLost,
      },
    });
  }

  console.log("Sembrando campos personalizados de Leads...");
  // Específicos por línea de negocio — solo aparecen cuando ese lead marca
  // interés en esa línea. Ver src/data/customFields.ts (versión mock que
  // este catálogo reemplaza).
  const lineFieldDefs: Record<string, { name: string; label: string; fieldType: CustomFieldType; options?: string[] }[]> = {
    "Medicare Advantage": [
      { name: "medicareNumber", label: "Número de Medicare", fieldType: "TEXT" },
      { name: "hasMedicaid", label: "¿Tiene Medicaid?", fieldType: "BOOLEAN" },
      { name: "currentCarrier", label: "Carrier actual", fieldType: "TEXT" },
      { name: "currentPlanType", label: "Tipo de plan actual", fieldType: "SELECT", options: ["HMO", "PPO", "D-SNP", "C-SNP"] },
    ],
    Obamacare: [
      { name: "householdIncome", label: "Ingresos del hogar (anual)", fieldType: "NUMBER" },
      { name: "householdSize", label: "Personas en el hogar", fieldType: "NUMBER" },
      { name: "hasEmployerCoverage", label: "¿Cobertura por empleador?", fieldType: "BOOLEAN" },
      { name: "planTypeInterest", label: "Tipo de plan de interés", fieldType: "SELECT", options: ["Bronce", "Plata", "Oro"] },
    ],
    "Family Heritage": [
      { name: "planType", label: "Tipo de plan", fieldType: "SELECT", options: ["Elite 8", "Preferred 4", "Standard 2"] },
      { name: "coverageType", label: "Tipo de cobertura", fieldType: "SELECT", options: ["Individual", "Couple", "Single-Parent", "Family"] },
      { name: "rop", label: "¿Interesado en ROP?", fieldType: "BOOLEAN" },
    ],
  };
  for (const [lineName, fields] of Object.entries(lineFieldDefs)) {
    for (const [i, f] of fields.entries()) {
      await prisma.customField.upsert({
        where: { entityType_name: { entityType: "LEAD", name: f.name } },
        update: { label: f.label, fieldType: f.fieldType, options: f.options ?? undefined, order: i, insuranceLineId: lines[lineName].id },
        create: {
          entityType: "LEAD",
          name: f.name,
          label: f.label,
          fieldType: f.fieldType,
          options: f.options ?? undefined,
          order: i,
          insuranceLineId: lines[lineName].id,
        },
      });
    }
  }
  // Catálogo general — el usuario los agrega a mano con "+ Agregar campo",
  // no dependen de ninguna línea de negocio (insuranceLineId null).
  const extraFieldDefs: { name: string; label: string; fieldType: CustomFieldType }[] = [
    { name: "preferredLanguageAlt", label: "Idioma alterno", fieldType: "TEXT" },
    { name: "referredBy", label: "Referido por", fieldType: "TEXT" },
    { name: "bestTimeToCall", label: "Mejor horario para llamar", fieldType: "TEXT" },
    { name: "spouseName", label: "Nombre del cónyuge", fieldType: "TEXT" },
    { name: "hasDentalInterest", label: "¿Interesado en dental?", fieldType: "BOOLEAN" },
    { name: "hasVisionInterest", label: "¿Interesado en visión?", fieldType: "BOOLEAN" },
    { name: "additionalNotes", label: "Comentario adicional", fieldType: "TEXTAREA" },
  ];
  for (const [i, f] of extraFieldDefs.entries()) {
    await prisma.customField.upsert({
      where: { entityType_name: { entityType: "LEAD", name: f.name } },
      update: { label: f.label, fieldType: f.fieldType, order: i },
      create: { entityType: "LEAD", name: f.name, label: f.label, fieldType: f.fieldType, order: i },
    });
  }

  console.log("Creando cuenta Super Admin inicial...");
  const existing = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });

  if (existing) {
    console.log(`Ya existe un usuario con ${SUPER_ADMIN_EMAIL} — no se modifica su contraseña.`);
  } else {
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.create({
      data: {
        firstName: SUPER_ADMIN_FIRST_NAME,
        lastName: SUPER_ADMIN_LAST_NAME,
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        mustChangePassword: true,
        status: "ACTIVE",
        roleId: roles["Super Admin"].id,
      },
    });
    console.log("\n============================================================");
    console.log(" Cuenta Super Admin creada — guarda esta contraseña temporal:");
    console.log(`   Correo:      ${SUPER_ADMIN_EMAIL}`);
    console.log(`   Contraseña:  ${tempPassword}`);
    console.log(" Se pedirá cambiarla en el primer ingreso.");
    console.log("============================================================\n");
  }

  console.log("Vinculando agentes para usuarios existentes sin uno...");
  const usersWithoutAgent = await prisma.user.findMany({ where: { agentId: null } });
  for (const u of usersWithoutAgent) {
    const agent = await prisma.agent.create({
      data: { firstName: u.firstName, lastName: u.lastName, email: u.email, isSeller: true, status: "ACTIVE" },
    });
    await prisma.user.update({ where: { id: u.id }, data: { agentId: agent.id } });
    console.log(`  → ${u.email} vinculado a un nuevo Agente.`);
  }

  console.log("Sembrando reconocimientos de bienvenida...");
  // Solo para que la sección "Reconocimientos" del perfil no se vea vacía
  // en el primer login — de ahí en adelante, los reconocimientos reales se
  // envían desde la propia UI (ver profile/recognition-actions.ts). No se
  // repite en corridas posteriores del seed (se salta si el usuario ya
  // tiene alguno).
  const WELCOME_RECOGNITIONS: RecognitionType[] = ["MILESTONE", "TEAMWORK"];
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const u of allUsers) {
    const existingCount = await prisma.recognition.count({ where: { toUserId: u.id } });
    if (existingCount > 0) continue;
    for (const type of WELCOME_RECOGNITIONS) {
      await prisma.recognition.create({
        data: { type, toUserId: u.id, fromUserId: u.id, note: "Bienvenida al equipo de KOSMO." },
      });
    }
  }

  console.log("Sembrando buzones de correo interno para usuarios existentes...");
  // Backfill: todo usuario debe tener un InternalMailbox. La creación real
  // para usuarios NUEVOS ocurre en users-actions.ts (createUserAction), vía
  // ensureMailboxForUser() en src/lib/mail/mailbox.ts — esa misma función se
  // reusa como backfill perezoso si por algún motivo un usuario llega a
  // /mail sin buzón. Acá se duplica una versión mínima y autocontenida
  // (sin importar "@/lib/...") porque este script corre con su propio
  // PrismaClient fuera del alias de rutas de la app.
  const INTERNAL_DOMAIN = (process.env.INTERNAL_EMAIL_DOMAIN || "alliance.internal").trim();
  function slugifyLocalPart(firstName: string, lastName: string): string {
    const base = `${firstName}.${lastName}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "");
    return base || "usuario";
  }
  const SYSTEM_FOLDER_DEFS: { type: "INBOX" | "SENT" | "DRAFTS" | "ARCHIVE" | "TRASH"; name: string; order: number }[] = [
    { type: "INBOX", name: "Recibidos", order: 0 },
    { type: "SENT", name: "Enviados", order: 1 },
    { type: "DRAFTS", name: "Borradores", order: 2 },
    { type: "ARCHIVE", name: "Archivados", order: 3 },
    { type: "TRASH", name: "Papelera", order: 4 },
  ];
  const usersWithoutMailbox = await prisma.user.findMany({ where: { internalMailbox: null } });
  for (const u of usersWithoutMailbox) {
    const base = slugifyLocalPart(u.firstName, u.lastName);
    let localPart = base;
    for (let suffix = 2; suffix < 100; suffix++) {
      const clash = await prisma.internalMailbox.findUnique({
        where: { localPart_domainAtCreation: { localPart, domainAtCreation: INTERNAL_DOMAIN } },
      });
      if (!clash) break;
      localPart = `${base}${suffix}`;
    }
    const mailbox = await prisma.internalMailbox.create({
      data: { userId: u.id, localPart, domainAtCreation: INTERNAL_DOMAIN },
    });
    for (const f of SYSTEM_FOLDER_DEFS) {
      await prisma.mailFolder.create({
        data: { mailboxId: mailbox.id, type: f.type, name: f.name, isSystem: true, order: f.order },
      });
    }
    console.log(`  → ${u.email} → ${localPart}@${INTERNAL_DOMAIN}`);
  }

  console.log("Sembrando configuración de correo interno...");
  await prisma.mailSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  console.log("Seed completo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
