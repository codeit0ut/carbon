import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate } from "react-router";
import { upsertBalloonDocument } from "~/modules/quality";
import { balloonDocumentValidator } from "~/modules/quality/quality.models";
import { BalloonDocumentForm } from "~/modules/quality/ui/BalloonDocument";
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
  const validation = await validator(balloonDocumentValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const result = await upsertBalloonDocument(client, {
    ...validation.data,
    companyId,
    createdBy: userId
  });

  if (result.error || !result.data?.id) {
    throw redirect(
      path.to.balloonDocuments,
      await flash(
        request,
        error(result.error, "Failed to create balloon document")
      )
    );
  }

  throw redirect(
    path.to.balloonDocument(result.data.id),
    await flash(request, success("Balloon document created"))
  );
}

export default function BalloonNewRoute() {
  const navigate = useNavigate();

  return (
    <BalloonDocumentForm
      initialValues={{ name: "", drawingNumber: "", revision: "" }}
      onClose={() => navigate(-1)}
    />
  );
}
