import { Award, Crown, Gem, Handshake, Sparkles, Target, Trophy, GraduationCap } from "lucide-react";
import type { RecognitionType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

export interface RecognitionTypeConfig {
  label: string;
  icon: LucideIcon;
  /** Color de marca (hex) — se usa tanto para el fondo suave como el ícono,
   * variando solo la opacidad, así todas las insignias se sienten de la
   * misma familia visual en vez de un arcoíris genérico de redes sociales. */
  color: string;
}

export const RECOGNITION_TYPE_CONFIG: Record<RecognitionType, RecognitionTypeConfig> = {
  PERFORMANCE: { label: "Rendimiento", icon: Trophy, color: "#eda100" },
  LEADERSHIP: { label: "Liderazgo", icon: Crown, color: "#4a3aa7" },
  EXCELLENCE: { label: "Excelencia", icon: Sparkles, color: "#2a78d6" },
  GOALS: { label: "Objetivos", icon: Target, color: "#eb6834" },
  TEAMWORK: { label: "Trabajo en equipo", icon: Handshake, color: "#1baf7a" },
  MENTOR: { label: "Mentoría", icon: GraduationCap, color: "#20b6ac" },
  MILESTONE: { label: "Hito alcanzado", icon: Gem, color: "#e87ba4" },
  GRATITUDE: { label: "Reconocimiento", icon: Award, color: "#3987e5" },
};

export const RECOGNITION_TYPE_ORDER: RecognitionType[] = [
  "PERFORMANCE",
  "LEADERSHIP",
  "EXCELLENCE",
  "GOALS",
  "TEAMWORK",
  "MENTOR",
  "MILESTONE",
  "GRATITUDE",
];
