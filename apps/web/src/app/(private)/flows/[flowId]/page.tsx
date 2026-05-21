import { retrieveFlow } from "@/app/actions/flows";
import { FlowEditor } from "./flow-editor";
import { notFound } from "next/navigation";

interface FlowEditorPageProps {
  params: Promise<{ flowId: string }>;
}

export default async function FlowEditorPage({ params }: FlowEditorPageProps) {
  const { flowId } = await params;

  const [flow, flowError] = await retrieveFlow({ flowId });

  if (flowError || !flow) {
    notFound();
  }

  return <FlowEditor flow={flow} />;
}
