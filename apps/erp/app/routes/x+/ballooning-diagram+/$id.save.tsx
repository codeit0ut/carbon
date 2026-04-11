import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { upsertBallooningDiagram } from "~/modules/quality";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, userId } = await requirePermissions(request, {
    update: "quality"
  });

  const { id } = params;
  if (!id)
    return data({ success: false, message: "Missing id" }, { status: 400 });

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const pdfUrl = formData.get("pdfUrl") as string | null;
  const annotations = formData.get("annotations") as string | null;
  const features = formData.get("features") as string | null;

  const result = await upsertBallooningDiagram(client, {
    id,
    name,
    pdfUrl: pdfUrl ?? undefined,
    annotations: annotations ?? undefined,
    features: features ?? undefined,
    companyId: "",
    createdBy: userId,
    updatedBy: userId
  });

  if (result.error) {
    return data(
      { success: false, message: result.error.message },
      { status: 400 }
    );
  }

  return { success: true };
}
