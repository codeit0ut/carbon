import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { createBalloonsFromPayload } from "~/modules/quality";

type BalloonCreateItem = {
  selectorId: string;
  label: string;
  xCoordinate: number;
  yCoordinate: number;
  anchorX: number;
  anchorY: number;
  data: Record<string, unknown>;
  description?: string | null;
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
): BalloonCreateItem[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is BalloonCreateItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { selectorId?: unknown }).selectorId === "string" &&
        typeof (item as { label?: unknown }).label === "string" &&
        typeof (item as { xCoordinate?: unknown }).xCoordinate === "number" &&
        typeof (item as { yCoordinate?: unknown }).yCoordinate === "number" &&
        typeof (item as { anchorX?: unknown }).anchorX === "number" &&
        typeof (item as { anchorY?: unknown }).anchorY === "number" &&
        typeof (item as { data?: unknown }).data === "object" &&
        (item as { data?: unknown }).data !== null &&
        !Array.isArray((item as { data?: unknown }).data)
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

  const selectorIdMap = Object.fromEntries(
    items.map((item) => [item.selectorId, item.selectorId])
  );

  const result = await createBalloonsFromPayload(client, {
    drawingId: id,
    companyId,
    createdBy: userId,
    selectorIdMap,
    balloons: items.map((item) => ({
      tempSelectorId: item.selectorId,
      label: item.label,
      xCoordinate: item.xCoordinate,
      yCoordinate: item.yCoordinate,
      anchorX: item.anchorX,
      anchorY: item.anchorY,
      data: item.data,
      description: item.description ?? null
    }))
  });

  if (result.error) {
    return data(
      {
        success: false,
        message: getErrorMessage(result.error, "Failed to create balloons")
      },
      { status: 400 }
    );
  }

  return data({ success: true, data: result.data ?? [] });
}
