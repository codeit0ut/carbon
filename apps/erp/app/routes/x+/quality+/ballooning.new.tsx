import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate } from "react-router";
import { upsertBallooningDiagram } from "~/modules/quality";
import { ballooningDiagramValidator } from "~/modules/quality/quality.models";
import { BallooningForm } from "~/modules/quality/ui/Ballooning";
import { path } from "~/utils/path";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePermissions(request, { create: "quality" });
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "quality"
  });

  const formData = await request.formData();
  const validation = await validator(ballooningDiagramValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const result = await upsertBallooningDiagram(client, {
    ...validation.data,
    companyId,
    createdBy: userId
  });

  if (result.error || !result.data?.id) {
    throw redirect(
      path.to.ballooningDiagrams,
      await flash(
        request,
        error(result.error, "Failed to create ballooning diagram")
      )
    );
  }

  throw redirect(
    path.to.ballooningDiagram(result.data.id),
    await flash(request, success("Ballooning diagram created"))
  );
}

export default function BallooningNewRoute() {
  const navigate = useNavigate();

  return (
    <BallooningForm
      initialValues={{ name: "", drawingNumber: "", revision: "" }}
      onClose={() => navigate(-1)}
    />
  );
}
