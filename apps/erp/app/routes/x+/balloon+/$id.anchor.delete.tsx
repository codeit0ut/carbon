import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { deleteBalloonAnchors } from "~/modules/quality";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function parseIds(raw: FormDataEntryValue | null): string[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );
  } catch {
    return null;
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "quality"
  });

  const { id } = params;
  if (!id)
    return data({ success: false, message: "Missing id" }, { status: 400 });

  const formData = await request.formData();
  const ids = parseIds(formData.get("ids"));
  if (!ids) {
    return data(
      { success: false, message: "Invalid ids payload" },
      { status: 400 }
    );
  }

  const result = await deleteBalloonAnchors(client, {
    drawingId: id,
    companyId,
    updatedBy: userId,
    ids
  });

  if (result.error) {
    return data(
      {
        success: false,
        message: getErrorMessage(
          result.error,
          "Failed to delete balloon anchors"
        )
      },
      { status: 400 }
    );
  }

  return data({ success: true, data: result.data ?? [] });
}
