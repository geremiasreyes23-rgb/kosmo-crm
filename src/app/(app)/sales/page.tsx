import { requireUser, canViewAll } from "@/lib/auth";
import { getSalesPipelineStages, getSalesForUser, getSaleFormOptions } from "./data";
import { getRelatedEntityOptions } from "@/lib/relatedRecords";
import { SalesView } from "./SalesView";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const user = await requireUser();
  const [stages, sales, formOptions, relatedOptions] = await Promise.all([
    getSalesPipelineStages(),
    getSalesForUser(user),
    getSaleFormOptions(),
    getRelatedEntityOptions(user),
  ]);

  return (
    <SalesView
      initialSales={sales}
      stages={stages}
      formOptions={formOptions}
      relatedOptions={relatedOptions}
      canAssignOthers={canViewAll(user)}
    />
  );
}
