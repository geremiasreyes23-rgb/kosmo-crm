"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LeadFormDrawer } from "@/components/leads/form/LeadFormDrawer";
import type { LeadEditData, LeadFormOptions } from "@/app/(app)/leads/data";

export function EditLeadButton({
  initial,
  formOptions,
  canAssignOthers,
  currentUserName,
  currentAgentId,
}: {
  initial: LeadEditData;
  formOptions: LeadFormOptions;
  canAssignOthers: boolean;
  currentUserName: string;
  currentAgentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Editar lead
      </Button>
      <LeadFormDrawer
        open={open}
        onClose={() => setOpen(false)}
        mode="edit"
        initial={initial}
        formOptions={formOptions}
        canAssignOthers={canAssignOthers}
        currentUserName={currentUserName}
        currentAgentId={currentAgentId}
      />
    </>
  );
}
