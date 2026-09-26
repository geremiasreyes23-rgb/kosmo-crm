import "server-only";

import { prisma } from "@/lib/db";
import { formatRelativeTime } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import type { RecognitionType } from "@prisma/client";

/** Textos de "Actividad reciente" — solo la etiqueta, el ícono/color vive en
 * el componente cliente (ActivityTimeline) junto a los demás iconos de UI. */
export type ProfileActivityKind =
  | "login"
  | "avatar"
  | "profile"
  | "recognition_sent"
  | "other";

export interface ProfileActivityItem {
  kind: ProfileActivityKind;
  description: string;
  when: string;
}

export interface ProfileContactField {
  label: string;
  value: string | null;
}

export interface ProfileViewData {
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  jobTitle: string | null;
  online: boolean;
  lastActiveLabel: string;
  contactFields: ProfileContactField[];
  recognitionCounts: { type: RecognitionType; count: number }[];
  activity: ProfileActivityItem[];
  /** Forma que espera <ProfileModal> ("Editar perfil") — se arma acá para no
   * repetir la consulta en el page. */
  modalUser: {
    firstName: string;
    lastName: string;
    email: string;
    roleName: string;
    avatarUrl: string | null;
    coverPhotoUrl: string | null;
    phone: string;
    jobTitle: string;
    birthday: string;
  };
}

const RECOGNITION_TYPES: RecognitionType[] = [
  "PERFORMANCE",
  "LEADERSHIP",
  "EXCELLENCE",
  "GOALS",
  "TEAMWORK",
  "MENTOR",
  "MILESTONE",
  "GRATITUDE",
];

function formatBirthdayShort(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    date
  );
}

function auditRowToActivity(row: {
  entityType: string;
  fieldName: string | null;
  createdAt: Date;
}): ProfileActivityItem | null {
  const at = row.createdAt.toISOString();
  if (row.entityType === "User" && row.fieldName === "avatarUrl") {
    return { kind: "avatar", description: "Actualizó su foto de perfil", when: at };
  }
  if (row.entityType === "User" && row.fieldName === "coverPhotoUrl") {
    return { kind: "avatar", description: "Actualizó la portada de su perfil", when: at };
  }
  if (row.entityType === "User" && row.fieldName === "profile") {
    return { kind: "profile", description: "Actualizó su información de contacto", when: at };
  }
  if (row.entityType === "Recognition") {
    return { kind: "recognition_sent", description: "Envió un reconocimiento", when: at };
  }
  return null;
}

/**
 * Arma todos los datos de la página de perfil en una sola función — la
 * página web es un Server Component "tonto" que solo llama esto y pasa el
 * resultado a <ProfileView>. Cuando se conecten más fuentes reales (p. ej.
 * AuditLog cubriendo más módulos), solo se toca este archivo.
 */
export async function getProfileViewData(sessionUser: SessionUser): Promise<ProfileViewData> {
  const [user, recognitionGroups, auditRows, activeSession] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        coverPhotoUrl: true,
        phone: true,
        phoneExtension: true,
        jobTitle: true,
        department: true,
        city: true,
        notificationLanguage: true,
        workFormat: true,
        birthday: true,
        lastLoginAt: true,
        createdAt: true,
        supervisor: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.recognition.groupBy({ by: ["type"], where: { toUserId: sessionUser.id }, _count: true }),
    prisma.auditLog.findMany({
      where: { userId: sessionUser.id, entityType: { in: ["User", "Recognition"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { entityType: true, fieldName: true, createdAt: true },
    }),
    prisma.session.findFirst({ where: { userId: sessionUser.id, expiresAt: { gt: new Date() } } }),
  ]);

  const countByType = new Map(recognitionGroups.map((g) => [g.type, g._count]));
  const recognitionCounts = RECOGNITION_TYPES.filter((t) => (countByType.get(t) ?? 0) > 0).map((t) => ({
    type: t,
    count: countByType.get(t) ?? 0,
  }));

  const lastLogin = user.lastLoginAt ?? user.createdAt;
  const loginActivity: ProfileActivityItem = {
    kind: "login",
    description: "Inició sesión en KOSMO",
    when: lastLogin.toISOString(),
  };
  const activity = [loginActivity, ...auditRows.map(auditRowToActivity).filter((a): a is ProfileActivityItem => a !== null)]
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, 6)
    .map((a) => ({ ...a, when: formatRelativeTime(a.when) }));

  const supervisorName = user.supervisor ? `${user.supervisor.firstName} ${user.supervisor.lastName}` : null;

  const contactFields: ProfileContactField[] = [
    { label: "Nombre", value: user.firstName },
    { label: "Apellido", value: user.lastName },
    { label: "Cargo", value: user.jobTitle },
    { label: "Departamento", value: user.department },
    { label: "Supervisor", value: supervisorName },
    { label: "Fecha de nacimiento", value: formatBirthdayShort(user.birthday) },
    { label: "Teléfono interno", value: user.phoneExtension ?? user.phone },
    { label: "Ciudad", value: user.city },
    { label: "Idioma de las notificaciones", value: user.notificationLanguage },
    { label: "Formato de trabajo", value: user.workFormat },
    { label: "Correo electrónico", value: user.email },
    { label: "Rol del sistema", value: sessionUser.roleName },
  ];

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    roleName: sessionUser.roleName,
    avatarUrl: user.avatarUrl,
    coverPhotoUrl: user.coverPhotoUrl,
    jobTitle: user.jobTitle,
    online: !!activeSession,
    lastActiveLabel: formatRelativeTime(lastLogin.toISOString()),
    contactFields,
    recognitionCounts,
    activity,
    modalUser: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleName: sessionUser.roleName,
      avatarUrl: user.avatarUrl,
      coverPhotoUrl: user.coverPhotoUrl,
      phone: user.phone ?? "",
      jobTitle: user.jobTitle ?? "",
      birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : "",
    },
  };
}
