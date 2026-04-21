import { useCarbon } from "@carbon/auth";
import {
  Button,
  Heading,
  HStack,
  IconButton,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  toast,
  VStack
} from "@carbon/react";
import { useLingui } from "@lingui/react/macro";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import Papa from "papaparse";
import {
  LuChevronDown,
  LuChevronUp,
  LuDownload,
  LuFileDown,
  LuFileSpreadsheet,
  LuLoader,
  LuMinus,
  LuPlus,
  LuRectangleHorizontal,
  LuSave,
  LuTrash2,
  LuUpload
} from "react-icons/lu";
import { useFetcher } from "react-router";
import * as XLSX from "xlsx";
import { useUser } from "~/hooks";
import type { BallooningDiagramContent } from "~/modules/quality/types";
import { buildBallooningPdfWithOverlaysBytes } from "./exportBallooningPdfWithOverlays";

type DragState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null;
type DragKind = "selector" | "zoom" | null;

type BalloonDiagramEditorProps = {
  diagramId: string;
  name: string;
  content: BallooningDiagramContent | null;
  selectors: Array<Record<string, unknown>>;
  balloons: Array<Record<string, unknown>>;
};

type PdfMetrics = {
  pageCount: number;
  defaultPageWidth: number;
  defaultPageHeight: number;
};

function toPercent(px: number, total: number) {
  return (px / total) * 100;
}

const EDITOR_SPLITTER_H = 8;
const MIN_PDF_PANE_PX = 160;

/** When the features table is expanded it keeps at least half the editor stack; PDF height is capped accordingly. */
function clampPdfPaneHeight(
  pdfPx: number,
  stackH: number,
  featuresExpanded: boolean
): number {
  if (!featuresExpanded || stackH <= EDITOR_SPLITTER_H + MIN_PDF_PANE_PX) {
    return Math.max(MIN_PDF_PANE_PX, pdfPx);
  }
  const minFeatures = stackH * 0.5;
  const maxPdf = Math.max(
    MIN_PDF_PANE_PX,
    stackH - EDITOR_SPLITTER_H - minFeatures
  );
  return Math.min(maxPdf, Math.max(MIN_PDF_PANE_PX, pdfPx));
}

/** Callout / selector stroke — matches reference (orange border, hollow fill). */
const CALLOUT_STROKE = "#f97316";
const CALLOUT_TEXT = "#171717";

/**
 * Konva 9 does not apply the `cursor` prop to the DOM; Transformer only sets
 * `stage.content.style.cursor` manually. Use these helpers for hover/drag cursors.
 */
function konvaContentFromTarget(target: unknown): HTMLElement | null {
  const t = target as {
    getStage?: () => { content?: HTMLElement } | null;
  } | null;
  return t?.getStage?.()?.content ?? null;
}

function konvaContentFromStageRef(stageRef: {
  current: unknown;
}): HTMLElement | null {
  const st = stageRef.current as { content?: HTMLElement } | null | undefined;
  return st?.content ?? null;
}

/** Liang–Barsky: clip segment (x0,y0)→(x1,y1) to axis-aligned rect; returns [0,1] params or null. */
function liangBarskySegmentRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): { u0: number; u1: number } | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let u0 = 0;
  let u1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - minX, maxX - x0, y0 - minY, maxY - y0];
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        u0 = Math.max(u0, r);
      } else {
        u1 = Math.min(u1, r);
      }
      if (u0 > u1) return null;
    }
  }
  return { u0, u1 };
}

/**
 * Visible connector from balloon edge → toward anchor, stopping before the selector rect interior.
 * u is linear param from B (0) to A (1); balloon occupies u ∈ [0, r/L).
 */
function clippedBalloonToAnchorLine(
  bx: number,
  by: number,
  radiusPx: number,
  ax: number,
  ay: number,
  rect: { x: number; y: number; w: number; h: number }
): [number, number, number, number] | null {
  const L = Math.hypot(ax - bx, ay - by);
  if (L < 1e-6) return null;
  const epsU = Math.max(1e-4, 2 / L);
  const uBalloonExit = Math.min(1 - epsU, radiusPx / L + epsU);
  const { x, y, w, h } = rect;
  const hit = liangBarskySegmentRect(bx, by, ax, ay, x, y, x + w, y + h);
  let uEnd = 1 - epsU;
  if (hit) {
    const uEnter = Math.max(0, Math.min(1, hit.u0));
    if (uEnter > uBalloonExit) {
      uEnd = Math.min(uEnd, uEnter - epsU);
    }
  }
  if (uEnd <= uBalloonExit + 1e-4) return null;
  const x0 = bx + (ax - bx) * uBalloonExit;
  const y0 = by + (ay - by) * uBalloonExit;
  const x1 = bx + (ax - bx) * uEnd;
  const y1 = by + (ay - by) * uEnd;
  return [x0, y0, x1, y1];
}

type SelectorRect = {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isNew: boolean;
  isDirty: boolean;
};

/** One feature row = one balloon + linked selector; table fields mostly from `data` JSONB. */
type FeatureRow = {
  balloonId: string;
  selectorId: string;
  label: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  featureName: string;
  nominalValue: string;
  tolerancePlus: string;
  toleranceMinus: string;
  units: string;
  /** Persisted rows: set when table fields change so Save can PATCH `data`. */
  balloonDirty?: boolean;
};

const BALLOON_W_NORM = 0.04;
const BALLOON_H_NORM = 0.04;
const BALLOON_OFFSET_NORM = 0.02;

function isTempBalloonId(balloonId: string) {
  return balloonId.startsWith("temp-bln-");
}

function isTempSelectorId(selectorId: string) {
  return selectorId.startsWith("temp-");
}

function sanitizeFilenameBase(name: string) {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]+/g, "_");
  return (trimmed.length > 0 ? trimmed : "diagram").slice(0, 120);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type NormBalloonRect = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp01Norm(n: number) {
  return Math.max(0, Math.min(1, n));
}

function overlapsNorm(a: NormBalloonRect, b: NormBalloonRect) {
  if (a.pageNumber !== b.pageNumber) return false;
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function inBoundsNorm(rect: NormBalloonRect) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= 1 &&
    rect.y + rect.height <= 1
  );
}

function clampRectToBoundsNorm(rect: NormBalloonRect): NormBalloonRect {
  const x = clamp01Norm(Math.min(rect.x, 1 - rect.width));
  const y = clamp01Norm(Math.min(rect.y, 1 - rect.height));
  return { ...rect, x, y };
}

const MIN_SELECTOR_DIM_PCT = 1;

type ResizeHandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

function stagePointToPageLocalPercent(
  stageX: number,
  stageY: number,
  pageNumber: number,
  renderedWidth: number,
  overlayHeight: number,
  totalPages: number
): { lx: number; ly: number } {
  const tp = Math.max(1, totalPages);
  const pageHeightPx = overlayHeight / tp;
  const lx = (stageX / renderedWidth) * 100;
  const localYpx = stageY - (pageNumber - 1) * pageHeightPx;
  const ly = (localYpx / pageHeightPx) * 100;
  return {
    lx: Math.max(0, Math.min(100, lx)),
    ly: Math.max(0, Math.min(100, ly))
  };
}

function clampSelectorPagePercentPct(r: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = r;
  width = Math.max(MIN_SELECTOR_DIM_PCT, Math.min(width, 100));
  height = Math.max(MIN_SELECTOR_DIM_PCT, Math.min(height, 100));
  x = Math.max(0, Math.min(x, 100 - width));
  y = Math.max(0, Math.min(y, 100 - height));
  return { x, y, width, height };
}

function applySelectorResizeDelta(
  handle: ResizeHandleId,
  start: { x: number; y: number; width: number; height: number },
  dlx: number,
  dly: number
): { x: number; y: number; width: number; height: number } {
  const { x, y, width, height } = start;
  let nx = x;
  let ny = y;
  let nw = width;
  let nh = height;
  switch (handle) {
    case "e":
      nw = width + dlx;
      break;
    case "w":
      nx = x + dlx;
      nw = width - dlx;
      break;
    case "s":
      nh = height + dly;
      break;
    case "n":
      ny = y + dly;
      nh = height - dly;
      break;
    case "se":
      nw = width + dlx;
      nh = height + dly;
      break;
    case "sw":
      nx = x + dlx;
      nw = width - dlx;
      nh = height + dly;
      break;
    case "ne":
      ny = y + dly;
      nw = width + dlx;
      nh = height - dly;
      break;
    case "nw":
      nx = x + dlx;
      ny = y + dly;
      nw = width - dlx;
      nh = height - dly;
      break;
    default:
      break;
  }
  return clampSelectorPagePercentPct({ x: nx, y: ny, width: nw, height: nh });
}

function cursorForResizeHandle(handle: ResizeHandleId): string {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    default:
      return "pointer";
  }
}

function featureRowToOccupiedNorm(row: FeatureRow): NormBalloonRect {
  return {
    pageNumber: row.pageNumber,
    x: row.x / 100,
    y: row.y / 100,
    width: row.width / 100,
    height: row.height / 100
  };
}

/** Mirrors server `createBalloonsForSelectors` placement candidates. */
function computeBalloonPlacementFromSelector(
  selector: {
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  },
  occupied: NormBalloonRect[]
): NormBalloonRect {
  const balloonWidth = BALLOON_W_NORM;
  const balloonHeight = BALLOON_H_NORM;
  const offset = BALLOON_OFFSET_NORM;
  const s = selector;
  const candidates: NormBalloonRect[] = [
    {
      pageNumber: s.pageNumber,
      x: s.x + s.width + offset,
      y: s.y,
      width: balloonWidth,
      height: balloonHeight
    },
    {
      pageNumber: s.pageNumber,
      x: s.x + s.width + offset,
      y: s.y - balloonHeight - offset,
      width: balloonWidth,
      height: balloonHeight
    },
    {
      pageNumber: s.pageNumber,
      x: s.x + s.width + offset,
      y: s.y + s.height + offset,
      width: balloonWidth,
      height: balloonHeight
    },
    {
      pageNumber: s.pageNumber,
      x: s.x,
      y: s.y - balloonHeight - offset,
      width: balloonWidth,
      height: balloonHeight
    },
    {
      pageNumber: s.pageNumber,
      x: s.x,
      y: s.y + s.height + offset,
      width: balloonWidth,
      height: balloonHeight
    },
    {
      pageNumber: s.pageNumber,
      x: s.x - balloonWidth - offset,
      y: s.y,
      width: balloonWidth,
      height: balloonHeight
    }
  ];

  const placed =
    candidates.find(
      (candidate) =>
        inBoundsNorm(candidate) &&
        !occupied.some((other) => overlapsNorm(candidate, other))
    ) ?? clampRectToBoundsNorm(candidates[0]!);

  return placed;
}

function nextBalloonLabel(rows: FeatureRow[]): string {
  const nums = rows
    .map((r) => parseInt(r.label, 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1);
}

function buildBalloonDataForSave(
  row: FeatureRow,
  sel: SelectorRect | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source: "client-save",
    pageNumber: row.pageNumber,
    placement: {
      width: row.width / 100,
      height: row.height / 100,
      offset: BALLOON_OFFSET_NORM
    },
    featureName: row.featureName
  };
  if (sel) {
    out.selector = {
      x: sel.x / 100,
      y: sel.y / 100,
      width: sel.width / 100,
      height: sel.height / 100
    };
  }
  if (row.nominalValue.trim()) out.nominalValue = row.nominalValue.trim();
  if (row.tolerancePlus.trim()) out.tolerancePlus = row.tolerancePlus.trim();
  if (row.toleranceMinus.trim()) out.toleranceMinus = row.toleranceMinus.trim();
  if (row.units.trim()) out.units = row.units.trim();
  return out;
}

function mapSelectorRecord(s: Record<string, unknown>): SelectorRect {
  return {
    id: String(s.id),
    pageNumber: Number(s.pageNumber ?? 1),
    x: Number(s.xCoordinate ?? 0) * 100,
    y: Number(s.yCoordinate ?? 0) * 100,
    width: Number(s.width ?? 0) * 100,
    height: Number(s.height ?? 0) * 100,
    isNew: false,
    isDirty: false
  };
}

function strFromData(data: Record<string, unknown>, key: string) {
  const v = data[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

function mapFeatureRowFromBalloon(b: Record<string, unknown>): FeatureRow {
  const data = (
    typeof b.data === "object" && b.data !== null
      ? (b.data as Record<string, unknown>)
      : {}
  ) as Record<string, unknown>;

  const desc =
    b.description != null && String(b.description).trim() !== ""
      ? String(b.description)
      : "";
  const featureName =
    strFromData(data, "featureName") ||
    strFromData(data, "feature") ||
    desc ||
    `Feature ${String(b.label ?? "")}`;

  const raw = b as Record<string, unknown>;
  const selectorIdRaw = raw.selectorId ?? raw.selector_id;

  return {
    balloonId: String(b.id),
    selectorId:
      typeof selectorIdRaw === "string"
        ? selectorIdRaw
        : selectorIdRaw != null
          ? String(selectorIdRaw)
          : "",
    label: String(b.label ?? ""),
    pageNumber: Number(data.pageNumber ?? 1),
    x: Number(b.xCoordinate ?? 0) * 100,
    y: Number(b.yCoordinate ?? 0) * 100,
    width:
      Number(
        (data.placement as { width?: number } | undefined)?.width ?? 0.04
      ) * 100,
    height:
      Number(
        (data.placement as { height?: number } | undefined)?.height ?? 0.04
      ) * 100,
    anchorX: Number(b.anchorX ?? 0) * 100,
    anchorY: Number(b.anchorY ?? 0) * 100,
    featureName,
    nominalValue: strFromData(data, "nominalValue"),
    tolerancePlus: strFromData(data, "tolerancePlus"),
    toleranceMinus: strFromData(data, "toleranceMinus"),
    units: strFromData(data, "units"),
    balloonDirty: false
  };
}

export default function BalloonDiagramEditor({
  diagramId,
  name,
  content,
  selectors,
  balloons
}: BalloonDiagramEditorProps) {
  const { t } = useLingui();
  const fetcher = useFetcher<{
    success: boolean;
    message?: string;
    selectorIdMap?: Record<string, string>;
    selectors?: Array<Record<string, unknown>>;
    balloons?: Array<Record<string, unknown>>;
  }>();
  const { carbon } = useCarbon();
  const user = useUser();
  const companyId = user.company.id;

  const [pdfUrl, setPdfUrl] = useState<string>(content?.pdfUrl ?? "");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectorRects, setSelectorRects] = useState<SelectorRect[]>(
    selectors.map(mapSelectorRecord)
  );
  const [featureRows, setFeatureRows] = useState<FeatureRow[]>(() =>
    balloons.map(mapFeatureRowFromBalloon)
  );
  const [placing, setPlacing] = useState(false);
  const [zoomBoxMode, setZoomBoxMode] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfMetrics, setPdfMetrics] = useState<PdfMetrics | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [drag, setDrag] = useState<DragState>(null);
  const [dragKind, setDragKind] = useState<DragKind>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [overlayHeight, setOverlayHeight] = useState<number>(0);
  /** Expanded: full table. Collapsed: header + one data row (more room for PDF). */
  const [featuresTableExpanded, setFeaturesTableExpanded] = useState(true);
  /** Height of PDF block when table is expanded (px); drag the splitter to adjust. */
  const [pdfPaneHeightPx, setPdfPaneHeightPx] = useState(360);
  const [editorStackHeightPx, setEditorStackHeightPx] = useState(0);
  const [isResizingPdfFeatures, setIsResizingPdfFeatures] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<unknown>(null);
  const editorStackRef = useRef<HTMLDivElement>(null);
  const splitDragRef = useRef<{ startY: number; startPdfPx: number } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Only the explicit Save button should show "Diagram saved" — not auto-persist after selector draw. */
  const manualSaveToastRef = useRef(false);
  /** Persisted ids to soft-delete on next Save (cleared after successful reload). */
  const pendingBalloonDeleteIdsRef = useRef(new Set<string>());
  const pendingSelectorDeleteIdsRef = useRef(new Set<string>());

  const [selectedBalloonId, setSelectedBalloonId] = useState<string | null>(
    null
  );
  const [selectedSelectorId, setSelectedSelectorId] = useState<string | null>(
    null
  );

  type BalloonDragSession = {
    balloonId: string;
    startPointer: { x: number; y: number };
    startRow: { x: number; y: number; width: number; height: number };
    renderedWidth: number;
    pageHeightPx: number;
  };

  type SelectorResizeSession = {
    selectorId: string;
    handle: ResizeHandleId;
    startRect: { x: number; y: number; width: number; height: number };
    pageNumber: number;
    startPointerLocal: { lx: number; ly: number };
    renderedWidth: number;
    overlayHeight: number;
    totalPages: number;
  };

  const balloonDragSessionRef = useRef<BalloonDragSession | null>(null);
  const selectorResizeSessionRef = useRef<SelectorResizeSession | null>(null);
  const onBalloonDragMoveRef = useRef<(ev: MouseEvent) => void>(() => {});
  const onBalloonDragUpRef = useRef<(ev: MouseEvent) => void>(() => {});
  const onSelectorResizeMoveRef = useRef<(ev: MouseEvent) => void>(() => {});
  const onSelectorResizeUpRef = useRef<(ev: MouseEvent) => void>(() => {});

  const finalizeBalloonDrag = useCallback(() => {
    const session = balloonDragSessionRef.current;
    window.removeEventListener("mousemove", onBalloonDragMoveRef.current);
    window.removeEventListener("mouseup", onBalloonDragUpRef.current);
    balloonDragSessionRef.current = null;
    const stageContent = konvaContentFromStageRef(stageRef);
    if (stageContent) stageContent.style.cursor = "";
    if (!session) return;
    setFeatureRows((prev) =>
      prev.map((r) => {
        if (r.balloonId !== session.balloonId) return r;
        if (isTempBalloonId(r.balloonId)) return r;
        const moved =
          Math.abs(r.x - session.startRow.x) > 0.05 ||
          Math.abs(r.y - session.startRow.y) > 0.05;
        return moved ? { ...r, balloonDirty: true } : r;
      })
    );
  }, []);

  const finalizeSelectorResize = useCallback(() => {
    window.removeEventListener("mousemove", onSelectorResizeMoveRef.current);
    window.removeEventListener("mouseup", onSelectorResizeUpRef.current);
    selectorResizeSessionRef.current = null;
    const stageContent = konvaContentFromStageRef(stageRef);
    if (stageContent) stageContent.style.cursor = "";
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!editorStackRef.current) return;
    const el = editorStackRef.current;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight;
      setEditorStackHeightPx(h);
      setPdfPaneHeightPx((prev) =>
        clampPdfPaneHeight(prev, h, featuresTableExpanded)
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [featuresTableExpanded]);

  useEffect(() => {
    if (!isResizingPdfFeatures) return;
    const onMove = (e: MouseEvent) => {
      const start = splitDragRef.current;
      if (!start) return;
      const dy = e.clientY - start.startY;
      setPdfPaneHeightPx(
        clampPdfPaneHeight(
          start.startPdfPx + dy,
          editorStackHeightPx,
          featuresTableExpanded
        )
      );
    };
    const onUp = () => {
      setIsResizingPdfFeatures(false);
      splitDragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingPdfFeatures, editorStackHeightPx, featuresTableExpanded]);

  const onSplitResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!featuresTableExpanded) return;
      e.preventDefault();
      splitDragRef.current = {
        startY: e.clientY,
        startPdfPx: pdfPaneHeightPx
      };
      setIsResizingPdfFeatures(true);
    },
    [featuresTableExpanded, pdfPaneHeightPx]
  );

  // Measure container width and keep it up to date on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setOverlayHeight(h);
    });
    ro.observe(overlayRef.current);
    return () => ro.disconnect();
  }, [numPages, containerWidth, pdfUrl, pdfFile]);

  useEffect(() => {
    if (fetcher.data?.success === true) {
      setSelectorRects((fetcher.data.selectors ?? []).map(mapSelectorRecord));
      setFeatureRows(
        (fetcher.data.balloons ?? []).map(mapFeatureRowFromBalloon)
      );
      pendingBalloonDeleteIdsRef.current.clear();
      pendingSelectorDeleteIdsRef.current.clear();
      if (manualSaveToastRef.current) {
        toast.success(t`Diagram saved`);
        manualSaveToastRef.current = false;
      }
    } else if (fetcher.data?.success === false) {
      manualSaveToastRef.current = false;
      toast.error(fetcher.data.message ?? t`Failed to save diagram`);
    }
  }, [fetcher.data, t]);

  const getRelativePosFromStage = useCallback(() => {
    const stage = stageRef.current as {
      getPointerPosition: () => { x: number; y: number } | null;
      width: () => number;
      height: () => number;
    } | null;
    const pos = stage?.getPointerPosition?.() ?? null;
    if (!pos || !stage) return { x: 0, y: 0 };
    const w = stage.width();
    const h = stage.height();
    return { x: toPercent(pos.x, w), y: toPercent(pos.y, h) };
  }, []);

  const getStagePointerPx = useCallback(() => {
    const stage = stageRef.current as {
      getPointerPosition: () => { x: number; y: number } | null;
    } | null;
    return stage?.getPointerPosition?.() ?? null;
  }, []);

  const beginBalloonPointerDrag = useCallback(
    (
      balloonId: string,
      rowSnapshot: { x: number; y: number; width: number; height: number },
      renderedWidth: number,
      overlayHeight: number,
      totalPages: number
    ) => {
      if (
        balloonDragSessionRef.current ||
        selectorResizeSessionRef.current ||
        !renderedWidth ||
        !overlayHeight
      ) {
        return;
      }
      const pos = getStagePointerPx();
      if (!pos) return;
      const tp = Math.max(1, totalPages);
      const pageHeightPx = overlayHeight / tp;
      balloonDragSessionRef.current = {
        balloonId,
        startPointer: { x: pos.x, y: pos.y },
        startRow: { ...rowSnapshot },
        renderedWidth,
        pageHeightPx
      };
      const onMove = () => {
        const session = balloonDragSessionRef.current;
        if (!session) return;
        const p = getStagePointerPx();
        if (!p) return;
        const dx =
          ((p.x - session.startPointer.x) / session.renderedWidth) * 100;
        const dy =
          ((p.y - session.startPointer.y) / session.pageHeightPx) * 100;
        const nx = Math.max(
          0,
          Math.min(100 - session.startRow.width, session.startRow.x + dx)
        );
        const ny = Math.max(
          0,
          Math.min(100 - session.startRow.height, session.startRow.y + dy)
        );
        setFeatureRows((prev) =>
          prev.map((r) =>
            r.balloonId === session.balloonId ? { ...r, x: nx, y: ny } : r
          )
        );
      };
      const onUp = () => {
        finalizeBalloonDrag();
      };
      onBalloonDragMoveRef.current = onMove;
      onBalloonDragUpRef.current = onUp;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      const stageContent = konvaContentFromStageRef(stageRef);
      if (stageContent) stageContent.style.cursor = "grabbing";
    },
    [getStagePointerPx, finalizeBalloonDrag]
  );

  const beginSelectorResize = useCallback(
    (
      selectorId: string,
      handle: ResizeHandleId,
      startRect: { x: number; y: number; width: number; height: number },
      pageNumber: number,
      renderedWidth: number,
      overlayHeight: number,
      totalPages: number
    ) => {
      if (
        balloonDragSessionRef.current ||
        selectorResizeSessionRef.current ||
        !renderedWidth ||
        !overlayHeight
      ) {
        return;
      }
      const pos = getStagePointerPx();
      if (!pos) return;
      const local = stagePointToPageLocalPercent(
        pos.x,
        pos.y,
        pageNumber,
        renderedWidth,
        overlayHeight,
        totalPages
      );
      selectorResizeSessionRef.current = {
        selectorId,
        handle,
        startRect: { ...startRect },
        pageNumber,
        startPointerLocal: { lx: local.lx, ly: local.ly },
        renderedWidth,
        overlayHeight,
        totalPages
      };
      const onMove = () => {
        const session = selectorResizeSessionRef.current;
        if (!session) return;
        const p = getStagePointerPx();
        if (!p) return;
        const cur = stagePointToPageLocalPercent(
          p.x,
          p.y,
          session.pageNumber,
          session.renderedWidth,
          session.overlayHeight,
          session.totalPages
        );
        const dlx = cur.lx - session.startPointerLocal.lx;
        const dly = cur.ly - session.startPointerLocal.ly;
        const next = applySelectorResizeDelta(
          session.handle,
          session.startRect,
          dlx,
          dly
        );
        setSelectorRects((prev) =>
          prev.map((s) =>
            s.id === session.selectorId
              ? {
                  ...s,
                  x: next.x,
                  y: next.y,
                  width: next.width,
                  height: next.height,
                  isDirty: !s.isNew ? true : s.isDirty
                }
              : s
          )
        );
        const anchorX = next.x + next.width / 2;
        const anchorY = next.y + next.height / 2;
        setFeatureRows((prev) =>
          prev.map((r) =>
            r.selectorId !== session.selectorId
              ? r
              : {
                  ...r,
                  anchorX,
                  anchorY,
                  balloonDirty: isTempBalloonId(r.balloonId)
                    ? r.balloonDirty
                    : true
                }
          )
        );
      };
      const onUp = () => {
        finalizeSelectorResize();
      };
      onSelectorResizeMoveRef.current = onMove;
      onSelectorResizeUpRef.current = onUp;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      const stageContent = konvaContentFromStageRef(stageRef);
      if (stageContent) {
        stageContent.style.cursor = cursorForResizeHandle(handle);
      }
    },
    [getStagePointerPx, finalizeSelectorResize]
  );

  useEffect(
    () => () => {
      window.removeEventListener("mousemove", onBalloonDragMoveRef.current);
      window.removeEventListener("mouseup", onBalloonDragUpRef.current);
      window.removeEventListener("mousemove", onSelectorResizeMoveRef.current);
      window.removeEventListener("mouseup", onSelectorResizeUpRef.current);
      balloonDragSessionRef.current = null;
      selectorResizeSessionRef.current = null;
    },
    []
  );

  const finalizeDragAt = useCallback(
    (x: number, y: number) => {
      if (!drag || !dragKind) return;

      const rx = Math.min(drag.startX, x);
      const ry = Math.min(drag.startY, y);
      const rw = Math.abs(x - drag.startX);
      const rh = Math.abs(y - drag.startY);

      if (rw < 0.5 || rh < 0.5) {
        setDragKind(null);
        setDrag(null);
        return;
      }

      if (dragKind === "zoom") {
        if (!containerRef.current || !overlayRef.current) {
          setDragKind(null);
          setDrag(null);
          return;
        }
        const overlayRect = overlayRef.current.getBoundingClientRect();
        const boxWidthPx = (rw / 100) * overlayRect.width;
        const boxHeightPx = (rh / 100) * overlayRect.height;
        if (boxWidthPx < 8 || boxHeightPx < 8) {
          setDragKind(null);
          setDrag(null);
          return;
        }
        const fitX = containerRef.current.clientWidth / boxWidthPx;
        const fitY = containerRef.current.clientHeight / boxHeightPx;
        const nextZoom = Math.max(
          0.5,
          Math.min(3, Number((zoomScale * Math.min(fitX, fitY)).toFixed(2)))
        );
        const zoomRatio = nextZoom / zoomScale;
        const centerXPx = ((rx + rw / 2) / 100) * overlayRect.width;
        const centerYPx = ((ry + rh / 2) / 100) * overlayHeight;
        setZoomScale(nextZoom);
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          containerRef.current.scrollLeft =
            centerXPx * zoomRatio - containerRef.current.clientWidth / 2;
          containerRef.current.scrollTop =
            centerYPx * zoomRatio - containerRef.current.clientHeight / 2;
        });
        setDragKind(null);
        setDrag(null);
        return;
      }

      const totalPages = Math.max(1, pdfMetrics?.pageCount ?? numPages ?? 1);
      const pageHeightPct = 100 / totalPages;
      const pageNumber = Math.min(
        totalPages,
        Math.max(1, Math.floor(ry / pageHeightPct) + 1)
      );
      const pageStartPct = (pageNumber - 1) * pageHeightPct;
      const localY = ((ry - pageStartPct) / pageHeightPct) * 100;
      const localHeight = (rh / pageHeightPct) * 100;
      const clippedLocalHeight = Math.min(localHeight, 100 - localY);

      if (clippedLocalHeight < 0.5) {
        setDragKind(null);
        setDrag(null);
        return;
      }

      const tempId = `temp-${nanoid()}`;

      const normSelector = {
        pageNumber,
        x: rx / 100,
        y: localY / 100,
        width: rw / 100,
        height: clippedLocalHeight / 100
      };
      const anchorXNorm = clamp01Norm(normSelector.x + normSelector.width / 2);
      const anchorYNorm = clamp01Norm(normSelector.y + normSelector.height / 2);

      setFeatureRows((prev) => {
        const occupied = prev.map(featureRowToOccupiedNorm);
        const placed = computeBalloonPlacementFromSelector(
          normSelector,
          occupied
        );
        const label = nextBalloonLabel(prev);
        const tempBalloonId = `temp-bln-${nanoid()}`;
        const row: FeatureRow = {
          balloonId: tempBalloonId,
          selectorId: tempId,
          label,
          pageNumber,
          x: placed.x * 100,
          y: placed.y * 100,
          width: BALLOON_W_NORM * 100,
          height: BALLOON_H_NORM * 100,
          anchorX: anchorXNorm * 100,
          anchorY: anchorYNorm * 100,
          featureName: `Feature ${label}`,
          nominalValue: "",
          tolerancePlus: "",
          toleranceMinus: "",
          units: ""
        };
        return [...prev, row];
      });

      setSelectorRects((prev) => [
        ...prev,
        {
          id: tempId,
          pageNumber,
          x: rx,
          y: localY,
          width: rw,
          height: clippedLocalHeight,
          isNew: true,
          isDirty: false
        }
      ]);
      setDragKind(null);
      setDrag(null);
    },
    [drag, pdfMetrics, numPages, dragKind, zoomScale, overlayHeight]
  );

  const handleStageMouseDown = useCallback(
    (e: unknown) => {
      const ke = e as {
        evt?: MouseEvent;
        target?: unknown;
        cancelBubble?: boolean;
        getTarget?: () => unknown;
      };
      const evt = ke.evt;
      if (!evt) return;

      if (!placing && !zoomBoxMode) {
        const target = ke.target;
        if (target && target === stageRef.current) {
          setSelectedBalloonId(null);
          setSelectedSelectorId(null);
        }
      }

      if (placing) {
        evt.preventDefault();
        const { x, y } = getRelativePosFromStage();
        setDragKind("selector");
        setDrag({ startX: x, startY: y, currentX: x, currentY: y });
        return;
      }
      if (zoomBoxMode) {
        evt.preventDefault();
        const { x, y } = getRelativePosFromStage();
        setDragKind("zoom");
        setDrag({ startX: x, startY: y, currentX: x, currentY: y });
        return;
      }
    },
    [placing, zoomBoxMode, getRelativePosFromStage]
  );

  const handleStageMouseMove = useCallback(
    (e: unknown) => {
      const evt = (e as { evt?: MouseEvent }).evt;
      if (!evt) return;

      if (!drag) return;
      const { x, y } = getRelativePosFromStage();
      setDrag((d) => (d ? { ...d, currentX: x, currentY: y } : null));
    },
    [drag, getRelativePosFromStage]
  );

  const handleStageMouseUp = useCallback(
    (e: unknown) => {
      const evt = (e as { evt?: MouseEvent }).evt;
      if (!evt) return;

      if (!drag || !dragKind) return;

      const { x, y } = getRelativePosFromStage();
      finalizeDragAt(x, y);
    },
    [drag, dragKind, getRelativePosFromStage, finalizeDragAt]
  );

  const handleSave = useCallback(() => {
    manualSaveToastRef.current = true;
    const formData = new FormData();
    formData.set("name", name);
    if (pdfUrl) formData.set("pdfUrl", pdfUrl);
    const createSelectors = selectorRects
      .filter((s) => s.isNew)
      .map((s) => ({
        tempId: s.id,
        pageNumber: s.pageNumber,
        xCoordinate: s.x / 100,
        yCoordinate: s.y / 100,
        width: s.width / 100,
        height: s.height / 100
      }));
    const updateSelectors = selectorRects
      .filter((s) => !s.isNew && s.isDirty)
      .map((s) => ({
        id: s.id,
        pageNumber: s.pageNumber,
        xCoordinate: s.x / 100,
        yCoordinate: s.y / 100,
        width: s.width / 100,
        height: s.height / 100
      }));
    formData.set(
      "selectors",
      JSON.stringify({
        create: createSelectors,
        update: updateSelectors,
        delete: [...pendingSelectorDeleteIdsRef.current]
      })
    );

    const balloonsCreate = featureRows
      .filter((r) => isTempBalloonId(r.balloonId))
      .map((r) => {
        const sel = selectorRects.find((s) => s.id === r.selectorId);
        return {
          tempSelectorId: r.selectorId,
          label: r.label,
          xCoordinate: r.x / 100,
          yCoordinate: r.y / 100,
          anchorX: r.anchorX / 100,
          anchorY: r.anchorY / 100,
          data: buildBalloonDataForSave(r, sel),
          description: r.featureName.trim() || null
        };
      });

    const balloonsUpdate = featureRows
      .filter((r) => !isTempBalloonId(r.balloonId) && r.balloonDirty)
      .map((r) => {
        const sel = selectorRects.find((s) => s.id === r.selectorId);
        return {
          id: r.balloonId,
          label: r.label,
          xCoordinate: r.x / 100,
          yCoordinate: r.y / 100,
          anchorX: r.anchorX / 100,
          anchorY: r.anchorY / 100,
          data: buildBalloonDataForSave(r, sel),
          description: r.featureName.trim() || null
        };
      });

    formData.set(
      "balloons",
      JSON.stringify({
        create: balloonsCreate,
        update: balloonsUpdate,
        delete: [...pendingBalloonDeleteIdsRef.current]
      })
    );

    if (pdfMetrics) {
      formData.set("pageCount", String(pdfMetrics.pageCount));
      formData.set("defaultPageWidth", String(pdfMetrics.defaultPageWidth));
      formData.set("defaultPageHeight", String(pdfMetrics.defaultPageHeight));
    }
    fetcher.submit(formData, {
      method: "post",
      action: `/x/ballooning-diagram/${diagramId}/save`
    });
  }, [
    diagramId,
    name,
    pdfUrl,
    selectorRects,
    featureRows,
    pdfMetrics,
    fetcher
  ]);

  const handlePdfUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !carbon) return;

      setUploading(true);
      setPdfFile(file);

      const storagePath = `${companyId}/ballooning/${diagramId}/${nanoid()}.pdf`;
      const result = await carbon.storage
        .from("private")
        .upload(storagePath, file);

      setUploading(false);

      if (result.error) {
        toast.error(t`Failed to upload PDF`);
        setPdfFile(null);
        return;
      }

      setPdfUrl(`/file/preview/private/${result.data.path}`);
      setPdfFile(null);
    },
    [carbon, companyId, diagramId, t]
  );

  const hasPdf = pdfFile !== null || pdfUrl !== "";

  const handleDeleteFeature = useCallback((balloonId: string) => {
    let selectorIdToRemove: string | undefined;
    setFeatureRows((prev) => {
      const row = prev.find((r) => r.balloonId === balloonId);
      selectorIdToRemove = row?.selectorId;
      if (row) {
        if (!isTempBalloonId(row.balloonId)) {
          pendingBalloonDeleteIdsRef.current.add(row.balloonId);
        }
        if (row.selectorId && !isTempSelectorId(row.selectorId)) {
          pendingSelectorDeleteIdsRef.current.add(row.selectorId);
        }
      }
      const nextRows = prev.filter((r) => r.balloonId !== balloonId);
      const keptSelectorIds = new Set(
        nextRows
          .map((r) => r.selectorId)
          .filter((id): id is string => id.length > 0)
      );
      setSelectorRects((sels) => {
        for (const s of sels) {
          if (!keptSelectorIds.has(s.id) && !isTempSelectorId(s.id)) {
            pendingSelectorDeleteIdsRef.current.add(s.id);
          }
        }
        return sels.filter((sel) => keptSelectorIds.has(sel.id));
      });
      return nextRows;
    });
    setSelectedBalloonId((cur) => (cur === balloonId ? null : cur));
    setSelectedSelectorId((cur) =>
      selectorIdToRemove && cur === selectorIdToRemove ? null : cur
    );
  }, []);

  const updateFeatureField = useCallback(
    (
      balloonId: string,
      field:
        | "label"
        | "featureName"
        | "nominalValue"
        | "tolerancePlus"
        | "toleranceMinus"
        | "units",
      value: string
    ) => {
      setFeatureRows((prev) =>
        prev.map((r) =>
          r.balloonId !== balloonId
            ? r
            : {
                ...r,
                [field]: value,
                balloonDirty: isTempBalloonId(r.balloonId)
                  ? r.balloonDirty
                  : true
              }
        )
      );
    },
    []
  );

  const handleExportFeaturesCsv = useCallback(() => {
    if (featureRows.length === 0) {
      toast.error(t`Nothing to export`);
      return;
    }
    const cols = [
      t`Balloon #`,
      t`Feature`,
      t`Nom`,
      t`Tol+`,
      t`Tol-`,
      t`Units`
    ] as const;
    const objects = featureRows.map((r) => ({
      [cols[0]]: r.label,
      [cols[1]]: r.featureName,
      [cols[2]]: r.nominalValue,
      [cols[3]]: r.tolerancePlus,
      [cols[4]]: r.toleranceMinus,
      [cols[5]]: r.units
    }));
    const csv = Papa.unparse(objects, { columns: [...cols] });
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;"
    });
    triggerDownload(blob, `${sanitizeFilenameBase(name)}-features.csv`);
  }, [featureRows, name, t]);

  const handleExportFeaturesXlsx = useCallback(() => {
    if (featureRows.length === 0) {
      toast.error(t`Nothing to export`);
      return;
    }
    const cols = [
      t`Balloon #`,
      t`Feature`,
      t`Nom`,
      t`Tol+`,
      t`Tol-`,
      t`Units`
    ] as const;
    const aoa: string[][] = [
      [...cols],
      ...featureRows.map((r) => [
        r.label,
        r.featureName,
        r.nominalValue,
        r.tolerancePlus,
        r.toleranceMinus,
        r.units
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Features");
    XLSX.writeFile(wb, `${sanitizeFilenameBase(name)}-features.xlsx`);
  }, [featureRows, name, t]);

  const handleDownloadPdfWithBalloons = useCallback(async () => {
    if (!hasPdf) {
      toast.error(t`Upload a PDF first`);
      return;
    }
    setPdfExporting(true);
    try {
      let bytes: ArrayBuffer;
      if (pdfFile) {
        bytes = await pdfFile.arrayBuffer();
      } else {
        const res = await fetch(pdfUrl, { credentials: "include" });
        if (!res.ok) {
          throw new Error(String(res.status));
        }
        bytes = await res.arrayBuffer();
      }
      const outBytes = await buildBallooningPdfWithOverlaysBytes({
        pdfBytes: bytes,
        featureRows,
        selectorRects,
        scale: 2
      });
      triggerDownload(
        new Blob([outBytes], { type: "application/pdf" }),
        `${sanitizeFilenameBase(name)}-with-balloons.pdf`
      );
      toast.success(t`PDF downloaded`);
    } catch {
      toast.error(t`Could not build PDF. Try again.`);
    } finally {
      setPdfExporting(false);
    }
  }, [hasPdf, pdfFile, pdfUrl, name, featureRows, selectorRects, t]);

  const previewRect = drag
    ? {
        x: Math.min(drag.startX, drag.currentX),
        y: Math.min(drag.startY, drag.currentY),
        width: Math.abs(drag.currentX - drag.startX),
        height: Math.abs(drag.currentY - drag.startY)
      }
    : null;
  const renderedWidth =
    containerWidth > 0 ? Math.max(1, containerWidth * zoomScale) : 0;
  const totalPagesStage = Math.max(1, pdfMetrics?.pageCount ?? numPages ?? 1);
  const pdfOverlayInteract =
    hasPdf &&
    !placing &&
    !zoomBoxMode &&
    renderedWidth > 0 &&
    overlayHeight > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePdfUpload}
        disabled={uploading}
      />

      {/* Header bar — min-height only so controls are not clipped when the row wraps */}
      <div className="flex min-h-[50px] flex-shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 overflow-x-auto border-b border-border bg-card px-4 py-2 scrollbar-hide dark:border-none dark:shadow-[inset_0_0_1px_rgb(255_255_255_/_0.24),_0_0_0_0.5px_rgb(0,0,0,1),0px_0px_4px_rgba(0,_0,_0,_0.08)]">
        <VStack spacing={0} className="min-w-0 flex-1 pr-2">
          <HStack>
            <Heading size="h4" className="flex min-w-0 items-center gap-2">
              <span className="truncate">{name}</span>
              {content?.drawingNumber && (
                <span className="shrink-0 text-sm font-normal text-muted-foreground">
                  {content.drawingNumber}
                  {content.revision ? ` Rev ${content.revision}` : ""}
                </span>
              )}
            </Heading>
          </HStack>
        </VStack>
        <HStack spacing={2} className="flex-shrink-0 flex-wrap justify-end">
          <Button
            variant={placing ? "primary" : "secondary"}
            leftIcon={<LuRectangleHorizontal />}
            onClick={() => {
              setPlacing((v) => {
                const next = !v;
                if (next) {
                  setZoomBoxMode(false);
                  setSelectedBalloonId(null);
                  setSelectedSelectorId(null);
                  finalizeBalloonDrag();
                  finalizeSelectorResize();
                }
                return next;
              });
            }}
            isDisabled={!hasPdf}
          >
            {placing ? t`Drag to create selector` : t`Add Selector`}
          </Button>
          <Button
            variant={zoomBoxMode ? "primary" : "secondary"}
            onClick={() => {
              setZoomBoxMode((v) => {
                const next = !v;
                if (next) {
                  setPlacing(false);
                  setSelectedBalloonId(null);
                  setSelectedSelectorId(null);
                  finalizeBalloonDrag();
                  finalizeSelectorResize();
                }
                return next;
              });
            }}
            isDisabled={!hasPdf}
          >
            {zoomBoxMode ? t`Drag to zoom` : t`Zoom Box`}
          </Button>
          {hasPdf && (
            <Button
              variant="secondary"
              leftIcon={<LuUpload />}
              onClick={() => fileInputRef.current?.click()}
              isDisabled={uploading}
            >
              {uploading ? t`Uploading…` : t`Replace PDF`}
            </Button>
          )}
          {hasPdf && (
            <Button
              type="button"
              variant="secondary"
              leftIcon={<LuFileDown className="h-4 w-4" />}
              onClick={handleDownloadPdfWithBalloons}
              isDisabled={pdfExporting}
              isLoading={pdfExporting}
            >
              {t`Download PDF`}
            </Button>
          )}
          <Button
            leftIcon={<LuSave />}
            onClick={handleSave}
            isDisabled={fetcher.state !== "idle"}
          >
            {t`Save`}
          </Button>
          <HStack className="ml-1 rounded-md border bg-background px-1 py-1">
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t`Zoom out`}
              icon={<LuMinus />}
              onClick={() =>
                setZoomScale((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))
              }
            />
            <span className="min-w-14 select-none text-center text-sm font-medium">
              {Math.round(zoomScale * 100)}%
            </span>
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t`Zoom in`}
              icon={<LuPlus />}
              onClick={() =>
                setZoomScale((z) => Math.min(3, Number((z + 0.1).toFixed(2))))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setZoomScale(1);
                requestAnimationFrame(() => {
                  if (!containerRef.current) return;
                  containerRef.current.scrollLeft = 0;
                  containerRef.current.scrollTop = 0;
                });
              }}
            >
              {t`Reset View`}
            </Button>
          </HStack>
        </HStack>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
        <div
          ref={editorStackRef}
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          {/* PDF viewer — outer measures width, inner fills container */}
          <div
            ref={containerRef}
            className={`min-w-full overflow-auto rounded-lg border bg-muted ${
              featuresTableExpanded
                ? "min-h-0 shrink-0"
                : "min-h-[220px] flex-1"
            }`}
            style={{
              ...(featuresTableExpanded
                ? { height: pdfPaneHeightPx }
                : undefined),
              ...(placing || zoomBoxMode ? { cursor: "crosshair" } : {}),
              minWidth: "100%"
            }}
          >
            {hasPdf ? (
              <div
                ref={overlayRef}
                className="relative select-none"
                style={{ width: renderedWidth > 0 ? renderedWidth : "100%" }}
                onMouseLeave={() => {
                  if (drag) setDrag(null);
                  if (dragKind) setDragKind(null);
                  finalizeBalloonDrag();
                  finalizeSelectorResize();
                  const el = konvaContentFromStageRef(stageRef);
                  if (el) el.style.cursor = "";
                }}
              >
                {isMounted && (
                  <div className="pointer-events-none">
                    <Document
                      file={pdfFile ?? pdfUrl}
                      onLoadSuccess={async (pdf) => {
                        setNumPages(pdf.numPages);
                        try {
                          const page = await pdf.getPage(1);
                          const viewport = page.getViewport({ scale: 1 });
                          setPdfMetrics({
                            pageCount: pdf.numPages,
                            defaultPageWidth: viewport.width,
                            defaultPageHeight: viewport.height
                          });
                        } catch {
                          setPdfMetrics(null);
                        }
                      }}
                      onLoadError={(err) =>
                        toast.error(`PDF error: ${err.message}`)
                      }
                    >
                      {Array.from({ length: numPages }, (_, i) => (
                        <Page
                          key={i + 1}
                          pageNumber={i + 1}
                          width={renderedWidth > 0 ? renderedWidth : undefined}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="w-full"
                        />
                      ))}
                    </Document>
                  </div>
                )}

                {containerWidth > 0 && overlayHeight > 0 && (
                  <div className="pointer-events-auto absolute inset-0 z-[9]">
                    <Stage
                      ref={stageRef as never}
                      width={renderedWidth}
                      height={overlayHeight}
                      listening
                      onMouseDown={handleStageMouseDown as never}
                      onMouseMove={handleStageMouseMove as never}
                      onMouseUp={handleStageMouseUp as never}
                    >
                      <Layer>
                        {selectorRects.map((s) => {
                          const pageHeightPx = overlayHeight / totalPagesStage;
                          const x = (s.x / 100) * renderedWidth;
                          const y =
                            (s.pageNumber - 1) * pageHeightPx +
                            (s.y / 100) * pageHeightPx;
                          const width = (s.width / 100) * renderedWidth;
                          const height = (s.height / 100) * pageHeightPx;
                          const isSel = selectedSelectorId === s.id;

                          return (
                            <Rect
                              key={`konva-rect-${s.id}`}
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              stroke={CALLOUT_STROKE}
                              strokeWidth={isSel ? 3 : 2}
                              fillEnabled={false}
                              hitStrokeWidth={8}
                              listening={pdfOverlayInteract}
                              onMouseEnter={(e) => {
                                if (!pdfOverlayInteract) return;
                                const el = konvaContentFromTarget(e.target);
                                if (el) el.style.cursor = "pointer";
                              }}
                              onMouseLeave={(e) => {
                                const el = konvaContentFromTarget(e.target);
                                if (el) el.style.cursor = "";
                              }}
                              onMouseDown={(e) => {
                                if (!pdfOverlayInteract) return;
                                e.cancelBubble = true;
                                setSelectedSelectorId(s.id);
                                const linked = featureRows.find(
                                  (r) => r.selectorId === s.id
                                );
                                setSelectedBalloonId(linked?.balloonId ?? null);
                              }}
                            />
                          );
                        })}
                        {featureRows.map((b) => {
                          const pageHeightPx = overlayHeight / totalPagesStage;
                          const pageOffsetY = (b.pageNumber - 1) * pageHeightPx;
                          const balloonWidthPx =
                            (b.width / 100) * renderedWidth;
                          const balloonHeightPx =
                            (b.height / 100) * pageHeightPx;
                          const balloonX = (b.x / 100) * renderedWidth;
                          const balloonY =
                            pageOffsetY + (b.y / 100) * pageHeightPx;
                          const balloonCenterX = balloonX + balloonWidthPx / 2;
                          const balloonCenterY = balloonY + balloonHeightPx / 2;
                          const anchorX = (b.anchorX / 100) * renderedWidth;
                          const anchorY =
                            pageOffsetY + (b.anchorY / 100) * pageHeightPx;
                          const radius = Math.max(
                            8,
                            Math.min(balloonWidthPx, balloonHeightPx) / 2
                          );
                          const balloonSelected =
                            selectedBalloonId === b.balloonId;

                          const linkedSelector = selectorRects.find(
                            (s) => s.id === b.selectorId
                          );
                          let linePoints:
                            | [number, number, number, number]
                            | null = null;
                          if (linkedSelector) {
                            const sx = (linkedSelector.x / 100) * renderedWidth;
                            const sy =
                              (linkedSelector.pageNumber - 1) * pageHeightPx +
                              (linkedSelector.y / 100) * pageHeightPx;
                            const sw =
                              (linkedSelector.width / 100) * renderedWidth;
                            const sh =
                              (linkedSelector.height / 100) * pageHeightPx;
                            linePoints = clippedBalloonToAnchorLine(
                              balloonCenterX,
                              balloonCenterY,
                              radius,
                              anchorX,
                              anchorY,
                              { x: sx, y: sy, w: sw, h: sh }
                            );
                          } else {
                            const L = Math.hypot(
                              anchorX - balloonCenterX,
                              anchorY - balloonCenterY
                            );
                            if (L > 1e-6) {
                              const epsU = Math.max(1e-4, 2 / L);
                              const u0 = Math.min(1 - epsU, radius / L + epsU);
                              linePoints = [
                                balloonCenterX +
                                  (anchorX - balloonCenterX) * u0,
                                balloonCenterY +
                                  (anchorY - balloonCenterY) * u0,
                                anchorX,
                                anchorY
                              ];
                            }
                          }

                          return (
                            <Group
                              key={`balloon-group-${b.balloonId}`}
                              x={balloonX}
                              y={balloonY}
                              listening={pdfOverlayInteract}
                            >
                              {/* Hit target: children use listening={false}, so without this rect
                                the group receives no pointer events (no hover cursor, no drag). */}
                              <Rect
                                x={0}
                                y={0}
                                width={balloonWidthPx}
                                height={balloonHeightPx}
                                fill="rgba(0,0,0,0.001)"
                                listening={pdfOverlayInteract}
                                onMouseEnter={(e) => {
                                  if (!pdfOverlayInteract) return;
                                  const el = konvaContentFromTarget(e.target);
                                  if (el) el.style.cursor = "grab";
                                }}
                                onMouseLeave={(e) => {
                                  const el = konvaContentFromTarget(e.target);
                                  if (el) el.style.cursor = "";
                                }}
                                onMouseDown={(e) => {
                                  if (!pdfOverlayInteract) return;
                                  e.cancelBubble = true;
                                  setSelectedBalloonId(b.balloonId);
                                  setSelectedSelectorId(b.selectorId);
                                  beginBalloonPointerDrag(
                                    b.balloonId,
                                    {
                                      x: b.x,
                                      y: b.y,
                                      width: b.width,
                                      height: b.height
                                    },
                                    renderedWidth,
                                    overlayHeight,
                                    totalPagesStage
                                  );
                                }}
                              />
                              {linePoints && (
                                <Line
                                  key={`balloon-line-${b.balloonId}`}
                                  points={[
                                    linePoints[0] - balloonX,
                                    linePoints[1] - balloonY,
                                    linePoints[2] - balloonX,
                                    linePoints[3] - balloonY
                                  ]}
                                  stroke={CALLOUT_STROKE}
                                  strokeWidth={2}
                                  listening={false}
                                />
                              )}
                              <Circle
                                key={`balloon-circle-${b.balloonId}`}
                                x={balloonWidthPx / 2}
                                y={balloonHeightPx / 2}
                                radius={radius}
                                fillEnabled={false}
                                stroke={CALLOUT_STROKE}
                                strokeWidth={balloonSelected ? 3.5 : 2}
                                listening={false}
                              />
                              <Text
                                key={`balloon-text-${b.balloonId}`}
                                x={balloonWidthPx / 2 - radius}
                                y={balloonHeightPx / 2 - radius}
                                width={radius * 2}
                                height={radius * 2}
                                text={b.label}
                                align="center"
                                verticalAlign="middle"
                                fill={CALLOUT_TEXT}
                                fontStyle="bold"
                                fontSize={12}
                                listening={false}
                              />
                            </Group>
                          );
                        })}
                        {pdfOverlayInteract &&
                          selectedSelectorId &&
                          (() => {
                            const s = selectorRects.find(
                              (x) => x.id === selectedSelectorId
                            );
                            if (!s) return null;
                            const pageHeightPx =
                              overlayHeight / totalPagesStage;
                            const bx = (s.x / 100) * renderedWidth;
                            const by =
                              (s.pageNumber - 1) * pageHeightPx +
                              (s.y / 100) * pageHeightPx;
                            const bw = (s.width / 100) * renderedWidth;
                            const bh = (s.height / 100) * pageHeightPx;
                            const hitR = 7;
                            const handles: {
                              handle: ResizeHandleId;
                              cx: number;
                              cy: number;
                            }[] = [
                              { handle: "nw", cx: bx, cy: by },
                              { handle: "n", cx: bx + bw / 2, cy: by },
                              { handle: "ne", cx: bx + bw, cy: by },
                              {
                                handle: "e",
                                cx: bx + bw,
                                cy: by + bh / 2
                              },
                              { handle: "se", cx: bx + bw, cy: by + bh },
                              {
                                handle: "s",
                                cx: bx + bw / 2,
                                cy: by + bh
                              },
                              { handle: "sw", cx: bx, cy: by + bh },
                              {
                                handle: "w",
                                cx: bx,
                                cy: by + bh / 2
                              }
                            ];
                            return handles.map(({ handle, cx, cy }) => (
                              <Circle
                                key={`rh-${selectedSelectorId}-${handle}`}
                                x={cx}
                                y={cy}
                                radius={hitR}
                                fill="#ffffff"
                                stroke={CALLOUT_STROKE}
                                strokeWidth={2}
                                onMouseEnter={(e) => {
                                  if (!pdfOverlayInteract) return;
                                  const el = konvaContentFromTarget(e.target);
                                  if (el) {
                                    el.style.cursor =
                                      cursorForResizeHandle(handle);
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  const el = konvaContentFromTarget(e.target);
                                  if (el) el.style.cursor = "";
                                }}
                                onMouseDown={(e) => {
                                  if (!pdfOverlayInteract) return;
                                  e.cancelBubble = true;
                                  beginSelectorResize(
                                    s.id,
                                    handle,
                                    {
                                      x: s.x,
                                      y: s.y,
                                      width: s.width,
                                      height: s.height
                                    },
                                    s.pageNumber,
                                    renderedWidth,
                                    overlayHeight,
                                    totalPagesStage
                                  );
                                }}
                              />
                            ));
                          })()}
                        {previewRect && (
                          <Rect
                            x={(previewRect.x / 100) * renderedWidth}
                            y={(previewRect.y / 100) * overlayHeight}
                            width={(previewRect.width / 100) * renderedWidth}
                            height={(previewRect.height / 100) * overlayHeight}
                            stroke={
                              dragKind === "zoom" ? "#2563eb" : CALLOUT_STROKE
                            }
                            strokeWidth={2}
                            fillEnabled={false}
                          />
                        )}
                      </Layer>
                    </Stage>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center min-w-full h-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <VStack className="items-center gap-2">
                  {uploading ? (
                    <LuLoader className="h-12 w-12 opacity-30 animate-spin" />
                  ) : (
                    <LuUpload className="h-12 w-12 opacity-30" />
                  )}
                  <p>
                    {uploading
                      ? t`Uploading…`
                      : t`Click to upload a PDF drawing`}
                  </p>
                </VStack>
              </button>
            )}
          </div>

          {featuresTableExpanded ? (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label={t`Drag to resize diagram and features`}
              className={`group flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center rounded-md px-2 hover:bg-muted/80 ${
                isResizingPdfFeatures ? "bg-muted" : ""
              }`}
              onMouseDown={onSplitResizeMouseDown}
            >
              <span className="h-1 w-14 shrink-0 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground/65" />
            </div>
          ) : null}

          {/* Features table — form fields map to balloon `data` JSONB; persisted on Save */}
          <div
            className={
              featuresTableExpanded
                ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                : "flex max-h-[8.75rem] min-w-0 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm"
            }
            style={
              featuresTableExpanded && editorStackHeightPx > 0
                ? { minHeight: editorStackHeightPx * 0.5 }
                : undefined
            }
          >
            <div className="flex min-h-10 flex-shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-2 py-2 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {t`Features`} ({featureRows.length})
              </span>
              <HStack spacing={1} className="flex-shrink-0 items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<LuDownload className="h-4 w-4" />}
                  onClick={handleExportFeaturesCsv}
                  isDisabled={featureRows.length === 0}
                >
                  {t`CSV`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<LuFileSpreadsheet className="h-4 w-4" />}
                  onClick={handleExportFeaturesXlsx}
                  isDisabled={featureRows.length === 0}
                >
                  {t`XLSX`}
                </Button>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={featuresTableExpanded}
                  aria-label={
                    featuresTableExpanded
                      ? t`Collapse features table`
                      : t`Expand features table`
                  }
                  icon={
                    featuresTableExpanded ? (
                      <LuChevronDown className="h-4 w-4" />
                    ) : (
                      <LuChevronUp className="h-4 w-4" />
                    )
                  }
                  onClick={() => setFeaturesTableExpanded((v) => !v)}
                />
              </HStack>
            </div>
            <div
              className={
                featuresTableExpanded
                  ? "min-h-0 flex-1 overflow-auto"
                  : "overflow-hidden"
              }
            >
              <Table>
                <Thead>
                  <Tr>
                    <Th className="w-20">{t`Balloon #`}</Th>
                    <Th>{t`Feature`}</Th>
                    <Th className="w-28">{t`Nom`}</Th>
                    <Th className="w-28">{t`Tol+`}</Th>
                    <Th className="w-28">{t`Tol-`}</Th>
                    <Th className="w-24">{t`Units`}</Th>
                    <Th className="w-14 text-right">{t` `}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {featureRows.map((row) => (
                    <Tr
                      key={row.balloonId}
                      className={`cursor-pointer hover:bg-muted/40${
                        selectedBalloonId === row.balloonId
                          ? " bg-muted/50"
                          : ""
                      }`}
                      onClick={(e) => {
                        if (
                          e.target instanceof HTMLInputElement ||
                          e.target instanceof HTMLButtonElement
                        ) {
                          return;
                        }
                        setSelectedBalloonId(row.balloonId);
                        setSelectedSelectorId(row.selectorId);
                      }}
                    >
                      <Td className="align-middle">
                        <input
                          type="text"
                          className="h-9 w-full min-w-[2.5rem] rounded-md border border-border bg-background px-2 text-sm font-medium tabular-nums"
                          value={row.label}
                          onChange={(e) =>
                            updateFeatureField(
                              row.balloonId,
                              "label",
                              e.target.value
                            )
                          }
                          aria-label={t`Balloon number`}
                        />
                      </Td>
                      <Td className="align-middle">
                        <input
                          type="text"
                          className="h-9 w-full max-w-md rounded-md border border-border bg-background px-3 text-sm"
                          value={row.featureName}
                          placeholder={t`Feature name`}
                          onChange={(e) =>
                            updateFeatureField(
                              row.balloonId,
                              "featureName",
                              e.target.value
                            )
                          }
                          aria-label={t`Feature`}
                        />
                      </Td>
                      <Td className="align-middle">
                        <input
                          type="text"
                          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums"
                          value={row.nominalValue}
                          onChange={(e) =>
                            updateFeatureField(
                              row.balloonId,
                              "nominalValue",
                              e.target.value
                            )
                          }
                          aria-label={t`Nominal`}
                        />
                      </Td>
                      <Td className="align-middle">
                        <input
                          type="text"
                          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums"
                          value={row.tolerancePlus}
                          onChange={(e) =>
                            updateFeatureField(
                              row.balloonId,
                              "tolerancePlus",
                              e.target.value
                            )
                          }
                          aria-label={t`Tolerance plus`}
                        />
                      </Td>
                      <Td className="align-middle">
                        <input
                          type="text"
                          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums"
                          value={row.toleranceMinus}
                          onChange={(e) =>
                            updateFeatureField(
                              row.balloonId,
                              "toleranceMinus",
                              e.target.value
                            )
                          }
                          aria-label={t`Tolerance minus`}
                        />
                      </Td>
                      <Td className="align-middle">
                        <input
                          type="text"
                          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                          value={row.units}
                          onChange={(e) =>
                            updateFeatureField(
                              row.balloonId,
                              "units",
                              e.target.value
                            )
                          }
                          aria-label={t`Units`}
                        />
                      </Td>
                      <Td className="align-middle text-right">
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={t`Remove selector and balloon`}
                          icon={
                            <LuTrash2 className="h-4 w-4 text-destructive" />
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFeature(row.balloonId);
                          }}
                        />
                      </Td>
                    </Tr>
                  ))}
                  {featureRows.length === 0 && (
                    <Tr>
                      <Td
                        colSpan={7}
                        className="text-center text-muted-foreground py-4 text-sm leading-snug"
                      >
                        {t`No features yet. Draw a selector to add a balloon, then use Save to persist. Open a saved diagram to load existing balloons.`}
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
