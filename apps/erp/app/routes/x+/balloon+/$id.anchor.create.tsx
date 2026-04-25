import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { createBalloonAnchors } from "~/modules/quality";

type AnchorCreateItem = {
  pageNumber: number;
  xCoordinate: number;
  yCoordinate: number;
  width: number;
  height: number;
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
): AnchorCreateItem[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is AnchorCreateItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { pageNumber?: unknown }).pageNumber === "number" &&
        typeof (item as { xCoordinate?: unknown }).xCoordinate === "number" &&
        typeof (item as { yCoordinate?: unknown }).yCoordinate === "number" &&
        typeof (item as { width?: unknown }).width === "number" &&
        typeof (item as { height?: unknown }).height === "number"
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

  const result = await createBalloonAnchors(client, {
    balloonDocumentId: id,
    companyId,
    createdBy: userId,
    anchors: items
  });

  if (result.error) {
    return data(
      {
        success: false,
        message: getErrorMessage(
          result.error,
          "Failed to create balloon anchors"
        )
      },
      { status: 400 }
    );
  }

  return data({ success: true, data: result.data ?? [] });
}
