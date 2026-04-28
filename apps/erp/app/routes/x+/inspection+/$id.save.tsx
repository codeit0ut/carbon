import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import {
  createBalloonsForAnchors,
  createBalloonsFromPayload,
  deleteBalloons,
  getBalloons,
  updateBalloons,
  upsertInspectionDocument
} from "~/modules/quality";

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

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, userId, companyId } = await requirePermissions(request, {
    update: "quality"
  });

  const { id } = params;
  if (!id)
    return data({ success: false, message: "Missing id" }, { status: 400 });

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const pdfUrl = formData.get("pdfUrl") as string | null;
  const anchorsRaw = formData.get("anchors") as string | null;
  const balloonsRaw = formData.get("balloons") as string | null;
  const pageCountRaw = formData.get("pageCount");
  const defaultPageWidthRaw = formData.get("defaultPageWidth");
  const defaultPageHeightRaw = formData.get("defaultPageHeight");

  const pageCount =
    typeof pageCountRaw === "string" && pageCountRaw
      ? Number(pageCountRaw)
      : undefined;
  const defaultPageWidth =
    typeof defaultPageWidthRaw === "string" && defaultPageWidthRaw
      ? Number(defaultPageWidthRaw)
      : undefined;
  const defaultPageHeight =
    typeof defaultPageHeightRaw === "string" && defaultPageHeightRaw
      ? Number(defaultPageHeightRaw)
      : undefined;

  const result = await upsertInspectionDocument(client, {
    id,
    name,
    pdfUrl: pdfUrl ?? undefined,
    pageCount,
    defaultPageWidth,
    defaultPageHeight,
    companyId: "",
    createdBy: userId,
    updatedBy: userId
  });

  if (result.error) {
    return data(
      {
        success: false,
        message: getErrorMessage(
          result.error,
          "Failed to save balloon document"
        )
      },
      { status: 400 }
    );
  }

  // ── Parse balloons payload ────────────────────────────────────────────────

  type BalloonCreatePayload = {
    tempBalloonAnchorId: string;
    label: string;
    xCoordinate: number;
    yCoordinate: number;
    data: Record<string, unknown>;
    description?: string | null;
  };
  type BalloonUpdatePayload = {
    id: string;
    label?: string;
    xCoordinate?: number;
    yCoordinate?: number;
    data?: Record<string, unknown>;
    description?: string | null;
  };

  let balloonsParsed: {
    create: BalloonCreatePayload[];
    update: BalloonUpdatePayload[];
  } | null = null;
  let balloonDeleteIds: string[] = [];

  if (balloonsRaw) {
    try {
      const json = JSON.parse(balloonsRaw) as unknown;
      if (typeof json !== "object" || json === null) {
        throw new Error("Invalid balloons payload");
      }
      const deleteJson = (json as { delete?: unknown }).delete;
      if (Array.isArray(deleteJson)) {
        balloonDeleteIds = deleteJson.filter(
          (x): x is string => typeof x === "string" && x.length > 0
        );
      }
      const createJson = (json as { create?: unknown }).create;
      const updateJson = (json as { update?: unknown }).update;
      const create: BalloonCreatePayload[] = [];
      const update: BalloonUpdatePayload[] = [];

      if (Array.isArray(createJson)) {
        for (const item of createJson) {
          if (
            typeof item === "object" &&
            item !== null &&
            typeof (item as { tempBalloonAnchorId?: unknown })
              .tempBalloonAnchorId === "string" &&
            typeof (item as { label?: unknown }).label === "string" &&
            typeof (item as { xCoordinate?: unknown }).xCoordinate ===
              "number" &&
            typeof (item as { yCoordinate?: unknown }).yCoordinate ===
              "number" &&
            typeof (item as { data?: unknown }).data === "object" &&
            (item as { data?: unknown }).data !== null
          ) {
            create.push({
              tempBalloonAnchorId: (item as { tempBalloonAnchorId: string })
                .tempBalloonAnchorId,
              label: (item as { label: string }).label,
              xCoordinate: (item as { xCoordinate: number }).xCoordinate,
              yCoordinate: (item as { yCoordinate: number }).yCoordinate,
              data: (item as { data: Record<string, unknown> }).data,
              description:
                (item as { description?: unknown }).description === undefined
                  ? undefined
                  : (item as { description: string | null }).description
            });
          }
        }
      }

      if (Array.isArray(updateJson)) {
        for (const item of updateJson) {
          if (
            typeof item === "object" &&
            item !== null &&
            typeof (item as { id?: unknown }).id === "string"
          ) {
            const u = item as Record<string, unknown>;
            update.push({
              id: String(u.id),
              ...(typeof u.label === "string" ? { label: u.label } : {}),
              ...(typeof u.xCoordinate === "number"
                ? { xCoordinate: u.xCoordinate }
                : {}),
              ...(typeof u.yCoordinate === "number"
                ? { yCoordinate: u.yCoordinate }
                : {}),
              ...(typeof u.data === "object" &&
              u.data !== null &&
              !Array.isArray(u.data)
                ? { data: u.data as Record<string, unknown> }
                : {}),
              ...(u.description !== undefined
                ? { description: u.description as string | null }
                : {})
            });
          }
        }
      }

      balloonsParsed = { create, update };
    } catch {
      return data(
        { success: false, message: "Invalid balloons payload" },
        { status: 400 }
      );
    }
  }

  // ── Parse anchors payload ─────────────────────────────────────────────────

  type AnchorCreateSpec = {
    tempId: string;
    pageNumber: number;
    xCoordinate: number;
    yCoordinate: number;
    width: number;
    height: number;
  };
  type AnchorUpdateSpec = {
    id: string;
    pageNumber?: number;
    xCoordinate?: number;
    yCoordinate?: number;
    width?: number;
    height?: number;
  };

  let anchorsParsed: {
    create: AnchorCreateSpec[];
    update: AnchorUpdateSpec[];
    delete: string[];
  } = { create: [], update: [], delete: [] };

  if (anchorsRaw) {
    try {
      const json = JSON.parse(anchorsRaw) as unknown;
      if (typeof json !== "object" || json === null) {
        throw new Error("Invalid anchors payload");
      }

      const selDeleteJson = (json as { delete?: unknown }).delete;
      if (Array.isArray(selDeleteJson)) {
        anchorsParsed.delete = selDeleteJson.filter(
          (x): x is string => typeof x === "string" && x.length > 0
        );
      }

      const createJson = (json as { create?: unknown }).create;
      const updateJson = (json as { update?: unknown }).update;

      if (Array.isArray(createJson)) {
        anchorsParsed.create = createJson.filter(
          (s): s is AnchorCreateSpec =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as { tempId?: unknown }).tempId === "string" &&
            typeof (s as { pageNumber?: unknown }).pageNumber === "number" &&
            typeof (s as { xCoordinate?: unknown }).xCoordinate === "number" &&
            typeof (s as { yCoordinate?: unknown }).yCoordinate === "number" &&
            typeof (s as { width?: unknown }).width === "number" &&
            typeof (s as { height?: unknown }).height === "number"
        );
      }

      if (Array.isArray(updateJson)) {
        anchorsParsed.update = updateJson.filter(
          (s): s is AnchorUpdateSpec =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as { id?: unknown }).id === "string"
        );
      }
    } catch {
      return data(
        { success: false, message: "Invalid anchors payload" },
        { status: 400 }
      );
    }
  }

  // ── Deletes ───────────────────────────────────────────────────────────────
  // Anchor deletes and balloon deletes both target balloon rows (same table).
  const allDeleteIds = [
    ...new Set([...balloonDeleteIds, ...anchorsParsed.delete])
  ];
  if (allDeleteIds.length > 0) {
    const delResult = await deleteBalloons(client, {
      inspectionDocumentId: id,
      companyId,
      updatedBy: userId,
      ids: allDeleteIds
    });
    if (delResult.error) {
      return data(
        { success: false, message: "Failed to delete balloons" },
        { status: 400 }
      );
    }
  }

  // ── Creates ───────────────────────────────────────────────────────────────
  let balloonAnchorIdMap: Record<string, string> = {};

  if (anchorsParsed.create.length > 0) {
    if (balloonsParsed?.create?.length) {
      // Explicit balloon positions provided — merge anchor region + balloon circle data.
      const fromPayload = await createBalloonsFromPayload(client, {
        inspectionDocumentId: id,
        companyId,
        createdBy: userId,
        balloons: balloonsParsed.create.map((b) => {
          const anchor = anchorsParsed.create.find(
            (a) => a.tempId === b.tempBalloonAnchorId
          );
          return {
            pageNumber: anchor?.pageNumber ?? 1,
            regionX: anchor?.xCoordinate ?? 0,
            regionY: anchor?.yCoordinate ?? 0,
            regionWidth: anchor?.width ?? 0.1,
            regionHeight: anchor?.height ?? 0.1,
            label: b.label,
            xCoordinate: b.xCoordinate,
            yCoordinate: b.yCoordinate,
            data: b.data,
            description:
              b.description ??
              (typeof b.data.featureName === "string"
                ? b.data.featureName
                : null)
          };
        })
      });

      if (fromPayload.error) {
        return data(
          { success: false, message: "Failed to create balloons" },
          { status: 400 }
        );
      }
    } else {
      // No explicit balloon positions — auto-position circles.
      const createResult = await createBalloonsForAnchors(client, {
        inspectionDocumentId: id,
        companyId,
        createdBy: userId,
        anchors: anchorsParsed.create.map((s) => ({
          pageNumber: s.pageNumber,
          regionX: s.xCoordinate,
          regionY: s.yCoordinate,
          regionWidth: s.width,
          regionHeight: s.height
        }))
      });

      if (createResult.error) {
        return data(
          { success: false, message: "Failed to create balloons" },
          { status: 400 }
        );
      }

      // Build tempId → real balloon id map for the UI to reconcile state.
      const inserted = (createResult.data ?? []) as Record<string, unknown>[];
      for (let i = 0; i < anchorsParsed.create.length; i++) {
        const tempId = anchorsParsed.create[i]?.tempId;
        const realId = inserted[i] ? String(inserted[i].id) : undefined;
        if (tempId && realId) {
          balloonAnchorIdMap[tempId] = realId;
        }
      }
    }
  }

  // ── Updates ───────────────────────────────────────────────────────────────
  // Merge anchor region updates + balloon circle updates by id.
  const updateMap = new Map<string, Record<string, unknown>>();

  for (const a of anchorsParsed.update) {
    const entry = updateMap.get(a.id) ?? { id: a.id };
    if (typeof a.pageNumber === "number") entry.pageNumber = a.pageNumber;
    if (typeof a.xCoordinate === "number") entry.regionX = a.xCoordinate;
    if (typeof a.yCoordinate === "number") entry.regionY = a.yCoordinate;
    if (typeof a.width === "number") entry.regionWidth = a.width;
    if (typeof a.height === "number") entry.regionHeight = a.height;
    updateMap.set(a.id, entry);
  }

  if (balloonsParsed?.update) {
    for (const b of balloonsParsed.update) {
      const entry = updateMap.get(b.id) ?? { id: b.id };
      if (typeof b.label === "string") entry.label = b.label;
      if (typeof b.xCoordinate === "number") entry.xCoordinate = b.xCoordinate;
      if (typeof b.yCoordinate === "number") entry.yCoordinate = b.yCoordinate;
      if (b.data !== undefined) entry.data = b.data;
      if (b.description !== undefined) entry.description = b.description;
      updateMap.set(b.id, entry);
    }
  }

  if (updateMap.size > 0) {
    const updateResult = await updateBalloons(client, {
      inspectionDocumentId: id,
      companyId,
      updatedBy: userId,
      balloons: [...updateMap.values()] as Parameters<
        typeof updateBalloons
      >[1]["balloons"]
    });

    if (updateResult.error) {
      return data(
        { success: false, message: "Failed to update balloons" },
        { status: 400 }
      );
    }
  }

  // ── Reload and return ─────────────────────────────────────────────────────
  const balloonsResult = await getBalloons(client, id);

  if (balloonsResult.error) {
    return data(
      {
        success: false,
        message: "Saved but failed to reload persisted balloon document data"
      },
      { status: 500 }
    );
  }

  const balloons = balloonsResult.data ?? [];
  const anchors = balloons.map((b) => ({
    id: b.id,
    pageNumber: b.pageNumber,
    xCoordinate: b.regionX,
    yCoordinate: b.regionY,
    width: b.regionWidth,
    height: b.regionHeight
  }));

  return {
    success: true,
    balloonAnchorIdMap,
    anchors,
    balloons
  };
}
