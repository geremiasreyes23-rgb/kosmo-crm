"use client";

import { useState } from "react";
import { ProfileHeader } from "./ProfileHeader";
import { ContactInformationCard } from "./ContactInformationCard";
import { StatusCard } from "./StatusCard";
import { RecognitionCard } from "./RecognitionCard";
import { ActivityTimeline } from "./ActivityTimeline";
import { ProfileModal } from "./ProfileModal";
import type { ProfileViewData } from "@/app/(app)/profile/data";

/**
 * Composición de toda la página de perfil — el page.tsx (Server Component)
 * solo llama a getProfileViewData() y le pasa el resultado a este
 * componente, que arma el layout y guarda el único estado interactivo real
 * de la página: si el drawer de "Editar perfil" está abierto.
 */
export function ProfileView({ data }: { data: ProfileViewData }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl">
      <ProfileHeader
        firstName={data.firstName}
        lastName={data.lastName}
        jobTitle={data.jobTitle}
        roleName={data.roleName}
        avatarUrl={data.avatarUrl}
        coverPhotoUrl={data.coverPhotoUrl}
        online={data.online}
        onEditProfile={() => setEditOpen(true)}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContactInformationCard fields={data.contactFields} />
        </div>
        <div className="flex flex-col gap-6">
          <StatusCard online={data.online} lastActiveLabel={data.lastActiveLabel} />
          <RecognitionCard counts={data.recognitionCounts} />
        </div>
      </div>

      <div className="mt-6">
        <ActivityTimeline items={data.activity} />
      </div>

      <ProfileModal open={editOpen} onClose={() => setEditOpen(false)} data={data} />
    </div>
  );
}
