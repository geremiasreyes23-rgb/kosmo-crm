import "server-only";

/**
 * Fase 13 (Auditoría + Seguridad) — límite de intentos de login en memoria.
 * Antes de esto, loginAction no tenía ningún freno: un script podía probar
 * contraseñas sin límite contra cualquier correo (o dirección interna, ver
 * resolveLoginUser en login/actions.ts). Se limita por la combinación
 * IP+identificador (no el identificador solo, para no dejar que alguien
 * bloquee el acceso de otra persona con solo escribir su correo mal a
 * propósito desde cualquier lado) y también de forma más laxa por IP sola
 * (para frenar a quien prueba muchos correos distintos desde la misma
 * máquina).
 *
 * Mismo supuesto de instancia única que notificationScheduler.ts/
 * messengerEvents.ts — un solo proceso de Node. Si el día de mañana esto
 * corre en varias instancias detrás de un balanceador, cada una llevaría su
 * propio contador (el límite real efectivo sería intentos × instancias). No
 * es grave para el volumen actual de una sola agencia; ese día conviene
 * mover esto a un store compartido (Redis, o una tabla en Postgres).
 */
const MAX_ATTEMPTS_PER_KEY = 5; // por IP+correo
const MAX_ATTEMPTS_PER_IP = 20; // por IP sola, contra múltiples correos
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const SWEEP_INTERVAL_MS = 30 * 60 * 1000; // limpieza periódica de entradas vencidas

interface AttemptRecord {
  count: number;
  windowStartedAt: number;
}

const globalForRateLimit = globalThis as unknown as {
  loginAttemptsByKey?: Map<string, AttemptRecord>;
  loginAttemptsByIp?: Map<string, AttemptRecord>;
  loginRateLimitSweepStarted?: boolean;
};

const attemptsByKey = globalForRateLimit.loginAttemptsByKey ?? new Map<string, AttemptRecord>();
globalForRateLimit.loginAttemptsByKey = attemptsByKey;
const attemptsByIp = globalForRateLimit.loginAttemptsByIp ?? new Map<string, AttemptRecord>();
globalForRateLimit.loginAttemptsByIp = attemptsByIp;

function isExpired(record: AttemptRecord, now: number): boolean {
  return now - record.windowStartedAt > WINDOW_MS;
}

function checkMap(map: Map<string, AttemptRecord>, key: string, max: number): RateLimitCheck {
  const record = map.get(key);
  if (!record) return { allowed: true };
  const now = Date.now();
  if (isExpired(record, now)) {
    map.delete(key);
    return { allowed: true };
  }
  if (record.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - record.windowStartedAt)) / 1000) };
  }
  return { allowed: true };
}

function recordInMap(map: Map<string, AttemptRecord>, key: string) {
  const now = Date.now();
  const record = map.get(key);
  if (!record || isExpired(record, now)) {
    map.set(key, { count: 1, windowStartedAt: now });
    return;
  }
  record.count += 1;
}

export interface RateLimitCheck {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** Revisa si un intento de login puede proceder — no cuenta el intento en
 * sí, solo consulta el estado actual de ambos contadores (IP+correo, e IP
 * sola). Se llama ANTES de resolver el usuario o verificar la contraseña. */
export function checkLoginRateLimit(ip: string, identifier: string): RateLimitCheck {
  const byIp = checkMap(attemptsByIp, ip, MAX_ATTEMPTS_PER_IP);
  if (!byIp.allowed) return byIp;
  return checkMap(attemptsByKey, `${ip}:${identifier}`, MAX_ATTEMPTS_PER_KEY);
}

/** Registra un intento fallido en ambos contadores. */
export function recordFailedLoginAttempt(ip: string, identifier: string): void {
  recordInMap(attemptsByIp, ip);
  recordInMap(attemptsByKey, `${ip}:${identifier}`);
}

/** Limpia el contador de IP+correo tras un login exitoso — un usuario
 * legítimo que se equivocó un par de veces no debería quedar "caliente". El
 * contador por IP sola no se limpia a propósito: sigue sirviendo para
 * frenar a quien, desde esa IP, ya haya fallado contra otros correos. */
export function resetLoginRateLimit(ip: string, identifier: string): void {
  attemptsByKey.delete(`${ip}:${identifier}`);
}

if (!globalForRateLimit.loginRateLimitSweepStarted) {
  globalForRateLimit.loginRateLimitSweepStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attemptsByKey) if (isExpired(record, now)) attemptsByKey.delete(key);
    for (const [key, record] of attemptsByIp) if (isExpired(record, now)) attemptsByIp.delete(key);
  }, SWEEP_INTERVAL_MS);
}
