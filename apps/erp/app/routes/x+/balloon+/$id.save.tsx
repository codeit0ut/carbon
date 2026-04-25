import { assertIsPost } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import {
  createBalloonAnchors,
  createBalloonsForAnchors,
  createBalloonsFromPayload,
  deleteBalloonAnchors,
  deleteBalloons,
  getBalloonAnchors,
  getBalloons,
  updateBalloonAnchors,
  updateBalloons,
  upsertBalloonDocument
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

  const result = await upsertBalloonDocument(client, {
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

  type BalloonCreatePayload = {
    tempBalloonAnchorId: string;
    label: string;
    xCoordinate: number;
    yCoordinate: number;
    anchorX: number;
    anchorY: number;
    data: Record<string, unknown>;
    description?: string | null;
  };
  type BalloonUpdatePayload = {
    id: string;
    label?: string;
    xCoordinate?: number;
    yCoordinate?: number;
    anchorX?: number;
    anchorY?: number;
    data?: Record<string, unknown>;
    description?: string | null;
  };

  let balloonsParsed: {
    create: BalloonCreatePayload[];
    update: BalloonUpdatePayload[];
  } | null = null;

  let balloonDeleteIds: string[] = [];
  let anchorDeleteIds: string[] = [];

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
            typeof (item as { anchorX?: unknown }).anchorX === "number" &&
            typeof (item as { anchorY?: unknown }).anchorY === "number" &&
            typeof (item as { data?: unknown }).data === "object" &&
            (item as { data?: unknown }).data !== null
          ) {
            create.push({
              tempBalloonAnchorId: (item as { tempBalloonAnchorId: string })
                .tempBalloonAnchorId,
              label: (item as { label: string }).label,
              xCoordinate: (item as { xCoordinate: number }).xCoordinate,
              yCoordinate: (item as { yCoordinate: number }).yCoordinate,
              anchorX: (item as { anchorX: number }).anchorX,
              anchorY: (item as { anchorY: number }).anchorY,
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
              ...(typeof u.anchorX === "number" ? { anchorX: u.anchorX } : {}),
              ...(typeof u.anchorY === "number" ? { anchorY: u.anchorY } : {}),
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

  if (balloonDeleteIds.length > 0) {
    const delBalloons = await deleteBalloons(client, {
      balloonDocumentId: id,
      companyId,
      updatedBy: userId,
      ids: balloonDeleteIds
    });
    if (delBalloons.error) {
      return data(
        { success: false, message: "Failed to delete balloons" },
        { status: 400 }
      );
    }
  }

  let balloonAnchorIdMap: Record<string, string> = {};
  if (anchorsRaw) {
    let parsed: {
      create: Array<{
        tempId: string;
        pageNumber: number;
        xCoordinate: number;
        yCoordinate: number;
        width: number;
        height: number;
      }>;
      update: Array<{
        id: string;
        pageNumber?: number;
        xCoordinate?: number;
        yCoordinate?: number;
        width?: number;
        height?: number;
      }>;
    } = {
      create: [],
      update: []
    };

    try {
      const json = JSON.parse(anchorsRaw) as unknown;
      if (typeof json !== "object" || json === null) {
        throw new Error("Invalid anchors payload");
      }

      const selDeleteJson = (json as { delete?: unknown }).delete;
      if (Array.isArray(selDeleteJson)) {
        anchorDeleteIds = selDeleteJson.filter(
          (x): x is string => typeof x === "string" && x.length > 0
        );
      }

      const createJson = (json as { create?: unknown }).create;
      const updateJson = (json as { update?: unknown }).update;

      if (Array.isArray(createJson)) {
        parsed.create = createJson.filter(
          (
            s
          ): s is {
            tempId: string;
            pageNumber: number;
            xCoordinate: number;
            yCoordinate: number;
            width: number;
            height: number;
          } =>
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
        parsed.update = updateJson.filter(
          (
            s
          ): s is {
            id: string;
            pageNumber?: number;
            xCoordinate?: number;
            yCoordinate?: number;
            width?: number;
            height?: number;
          } =>
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

    if (anchorDeleteIds.length > 0) {
      const delSelectors = await deleteBalloonAnchors(client, {
        balloonDocumentId: id,
        companyId,
        updatedBy: userId,
        ids: anchorDeleteIds
      });
      if (delSelectors.error) {
        return data(
          { success: false, message: "Failed to delete anchors" },
          { status: 400 }
        );
      }
    }

    const createSelectorsResult = await createBalloonAnchors(client, {
      balloonDocumentId: id,
      companyId,
      createdBy: userId,
      anchors: parsed.create.map((s) => ({
        pageNumber: s.pageNumber,
        xCoordinate: s.xCoordinate,
        yCoordinate: s.yCoordinate,
        width: s.width,
        height: s.height
      }))
    });

    if (createSelectorsResult.error) {
      return data(
        { success: false, message: "Failed to create anchors" },
        { status: 400 }
      );
    }

    const insertedSelectors = (createSelectorsResult.data ?? []).map((s) => ({
      id: String(s.id),
      pageNumber: Number(s.pageNumber),
      xCoordinate: Number(s.xCoordinate),
      yCoordinate: Number(s.yCoordinate),
      width: Number(s.width),
      height: Number(s.height)
    }));

    for (let i = 0; i < parsed.create.length; i += 1) {
      const tempId = parsed.create[i]?.tempId;
      const inserted = insertedSelectors[i];
      if (tempId && inserted?.id) {
        balloonAnchorIdMap[tempId] = inserted.id;
      }
    }

    if (balloonsParsed?.create?.length) {
      const fromPayload = await createBalloonsFromPayload(client, {
        balloonDocumentId: id,
        companyId,
        createdBy: userId,
        balloonAnchorIdMap,
        balloons: balloonsParsed.create.map((b) => ({
          tempBalloonAnchorId: b.tempBalloonAnchorId,
          label: b.label,
          xCoordinate: b.xCoordinate,
          yCoordinate: b.yCoordinate,
          anchorX: b.anchorX,
          anchorY: b.anchorY,
          data: b.data,
          description:
            b.description ??
            (typeof b.data.featureName === "string" ? b.data.featureName : null)
        }))
      });

      if (fromPayload.error) {
        return data(
          { success: false, message: "Failed to create balloons" },
          { status: 400 }
        );
      }
    } else if (insertedSelectors.length > 0) {
      const createBalloonsResult = await createBalloonsForAnchors(client, {
        balloonDocumentId: id,
        companyId,
        createdBy: userId,
        anchors: insertedSelectors
      });

      if (createBalloonsResult.error) {
        return data(
          { success: false, message: "Failed to create balloons" },
          { status: 400 }
        );
      }
    }

    const updateSelectorsResult = await updateBalloonAnchors(client, {
      balloonDocumentId: id,
      companyId,
      updatedBy: userId,
      anchors: parsed.update
    });

    if (updateSelectorsResult.error) {
      return data(
        { success: false, message: "Failed to update anchors" },
        { status: 400 }
      );
    }
  }

  if (balloonsParsed?.update?.length) {
    const updateBalloonsResult = await updateBalloons(client, {
      balloonDocumentId: id,
      companyId,
      updatedBy: userId,
      balloons: balloonsParsed.update
    });

    if (updateBalloonsResult.error) {
      return data(
        { success: false, message: "Failed to update balloons" },
        { status: 400 }
      );
    }
  }

  const [anchorsResult, balloonsResult] = await Promise.all([
    getBalloonAnchors(client, id),
    getBalloons(client, id)
  ]);

  if (anchorsResult.error || balloonsResult.error) {
    return data(
      {
        success: false,
        message: "Saved but failed to reload persisted balloon document data"
      },
      { status: 500 }
    );
  }

  return {
    success: true,
    balloonAnchorIdMap,
    anchors: anchorsResult.data ?? [],
    balloons: balloonsResult.data ?? []
  };
}
