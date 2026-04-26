import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import {
  createBalloonsForAnchors,
  createBalloonsFromPayload
} from "~/modules/quality";

type AnchorCreateItem = {
  pageNumber: number;
  regionX: number;
  regionY: number;
  regionWidth: number;
  regionHeight: number;
};

type BalloonCreateItem = AnchorCreateItem & {
  label: string;
  xCoordinate: number;
  yCoordinate: number;
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

function isAnchorItem(item: unknown): item is AnchorCreateItem {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as { pageNumber?: unknown }).pageNumber === "number" &&
    typeof (item as { regionX?: unknown }).regionX === "number" &&
    typeof (item as { regionY?: unknown }).regionY === "number" &&
    typeof (item as { regionWidth?: unknown }).regionWidth === "number" &&
    typeof (item as { regionHeight?: unknown }).regionHeight === "number"
  );
}

function isBalloonItem(item: unknown): item is BalloonCreateItem {
  return (
    isAnchorItem(item) &&
    typeof (item as { label?: unknown }).label === "string" &&
    typeof (item as { xCoordinate?: unknown }).xCoordinate === "number" &&
    typeof (item as { yCoordinate?: unknown }).yCoordinate === "number" &&
    typeof (item as { data?: unknown }).data === "object" &&
    (item as { data?: unknown }).data !== null &&
    !Array.isArray((item as { data?: unknown }).data)
  );
}

function parseItems(
  raw: FormDataEntryValue | null
): (AnchorCreateItem | BalloonCreateItem)[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed.filter(isAnchorItem);
    return items.length === parsed.length ? items : null;
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
  const items = parseItems(formData.get("items"));
  if (!items) {
    return data(
      { success: false, message: "Invalid items payload" },
      { status: 400 }
    );
  }

  const fullItems = items.filter(isBalloonItem);
  const anchorItems = items.filter(
    (item): item is AnchorCreateItem => !isBalloonItem(item)
  );

  const results: unknown[] = [];

  if (fullItems.length > 0) {
    const result = await createBalloonsFromPayload(client, {
      inspectionDocumentId: id,
      companyId,
      createdBy: userId,
      balloons: fullItems.map((item) => ({
        pageNumber: item.pageNumber,
        regionX: item.regionX,
        regionY: item.regionY,
        regionWidth: item.regionWidth,
        regionHeight: item.regionHeight,
        label: item.label,
        xCoordinate: item.xCoordinate,
        yCoordinate: item.yCoordinate,
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
    results.push(...(result.data ?? []));
  }

  if (anchorItems.length > 0) {
    const result = await createBalloonsForAnchors(client, {
      inspectionDocumentId: id,
      companyId,
      createdBy: userId,
      anchors: anchorItems.map((item) => ({
        pageNumber: item.pageNumber,
        regionX: item.regionX,
        regionY: item.regionY,
        regionWidth: item.regionWidth,
        regionHeight: item.regionHeight
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
    results.push(...(result.data ?? []));
  }

  return data({ success: true, data: results });
}
