import { salesPipeline, salesPipelineStages } from "@/data/mock";
import { SalesView } from "./SalesView";

export default function SalesPage() {
  return <SalesView initialSales={salesPipeline} stages={salesPipelineStages} />;
}
