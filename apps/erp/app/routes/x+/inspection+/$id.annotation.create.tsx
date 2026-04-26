import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { createBalloonAnnotations } from "~/modules/quality";

type AnnotationCreateItem = {
  pageNumber: number;
  xCoordinate: number;
  yCoordinate: number;
  text: string;
  width?: number;
  height?: number;
  rotation?: number;
  style?: Record<string, unknown>;
};

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

function parseCreateItems(
  raw: FormDataEntryValue | null
): AnnotationCreateItem[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is AnnotationCreateItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { pageNumber?: unknown }).pageNumber === "number" &&
        typeof (item as { xCoordinate?: unknown }).xCoordinate === "number" &&
        typeof (item as { yCoordinate?: unknown }).yCoordinate === "number" &&
        typeof (item as { text?: unknown }).text === "string"
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
  const items = parseCreateItems(formData.get("items"));
  if (!items) {
    return data(
      { success: false, message: "Invalid items payload" },
      { status: 400 }
    );
  }

  const result = await createBalloonAnnotations(client, {
    inspectionDocumentId: id,
    companyId,
    createdBy: userId,
    annotations: items
  });

  if (result.error) {
    return data(
      {
        success: false,
        message: getErrorMessage(result.error, "Failed to create annotations")
      },
      { status: 400 }
    );
  }

  return data({ success: true, data: result.data ?? [] });
}
