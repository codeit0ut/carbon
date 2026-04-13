import { useCarbon } from "@carbon/auth";
import {
  Badge,
  Button,
  Heading,
  HStack,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  LuLoader,
  LuRectangleHorizontal,
  LuSave,
  LuTrash,
  LuUpload
} from "react-icons/lu";
import { useFetcher } from "react-router";
import { useUser } from "~/hooks";
import { balloonCharacteristicType } from "~/modules/quality/quality.models";
import type {
  BalloonAnnotation,
  BalloonFeature,
  BallooningDiagramContent
} from "~/modules/quality/types";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type DragState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null;

type MovingBalloon = {
  id: string;
  // offset from balloon position (%) to mouse position (%) at drag start
  offsetX: number;
  offsetY: number;
} | null;

type BalloonDiagramEditorProps = {
  diagramId: string;
  name: string;
  content: BallooningDiagramContent | null;
};

const BALLOON_RADIUS = 14;

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function toPercent(px: number, total: number) {
  return (px / total) * 100;
}

export default function BalloonDiagramEditor({
  diagramId,
  name,
  content
}: BalloonDiagramEditorProps) {
  const { t } = useLingui();
  const fetcher = useFetcher<{ success: boolean; message?: string }>();
  const { carbon } = useCarbon();
  const user = useUser();
  const companyId = user.company.id;

  const [pdfUrl, setPdfUrl] = useState<string>(content?.pdfUrl ?? "");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [annotations, setAnnotations] = useState<BalloonAnnotation[]>(
    content?.annotations ?? []
  );
  const [features, setFeatures] = useState<BalloonFeature[]>(
    content?.features ?? []
  );
  const [placing, setPlacing] = useState(false);
  const [selectedBalloon, setSelectedBalloon] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const [drag, setDrag] = useState<DragState>(null);
  const [movingBalloon, setMovingBalloon] = useState<MovingBalloon>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    if (fetcher.data?.success === true) {
      toast.success(t`Diagram saved`);
    } else if (fetcher.data?.success === false) {
      toast.error(fetcher.data.message ?? t`Failed to save diagram`);
    }
  }, [fetcher.data, t]);

  const nextBalloonNumber = useCallback(() => {
    if (annotations.length === 0) return 1;
    return Math.max(...annotations.map((a) => a.balloonNumber)) + 1;
  }, [annotations]);

  const getRelativePos = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: toPercent(e.clientX - rect.left, rect.width),
      y: toPercent(e.clientY - rect.top, rect.height)
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placing || movingBalloon) return;
      e.preventDefault();
      const { x, y } = getRelativePos(e);
      setDrag({ startX: x, startY: y, currentX: x, currentY: y });
    },
    [placing, movingBalloon, getRelativePos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (movingBalloon) {
        const { x, y } = getRelativePos(e);
        const newX = x - movingBalloon.offsetX;
        const newY = y - movingBalloon.offsetY;
        setAnnotations((prev) =>
          prev.map((a) => {
            if (a.id !== movingBalloon.id) return a;
            const dx = newX - a.x;
            const dy = newY - a.y;
            return {
              ...a,
              x: newX,
              y: newY,
              rect: a.rect
                ? {
                    ...a.rect,
                    x: a.rect.x + dx,
                    y: a.rect.y + dy
                  }
                : a.rect
            };
          })
        );
        return;
      }
      if (!drag) return;
      const { x, y } = getRelativePos(e);
      setDrag((d) => (d ? { ...d, currentX: x, currentY: y } : null));
    },
    [drag, movingBalloon, getRelativePos]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (movingBalloon) {
        setMovingBalloon(null);
        return;
      }
      if (!drag || !placing) return;
      const { x, y } = getRelativePos(e);

      const rx = Math.min(drag.startX, x);
      const ry = Math.min(drag.startY, y);
      const rw = Math.abs(x - drag.startX);
      const rh = Math.abs(y - drag.startY);

      if (rw < 0.5 || rh < 0.5) {
        setDrag(null);
        return;
      }

      const num = nextBalloonNumber();
      const id = generateId();

      setAnnotations((prev) => [
        ...prev,
        {
          id,
          balloonNumber: num,
          x: rx + rw, // balloon pin at top-right of rect
          y: ry,
          page: 1,
          rect: { x: rx, y: ry, width: rw, height: rh }
        }
      ]);
      setFeatures((prev) => [
        ...prev,
        {
          id,
          balloonNumber: num,
          description: "",
          nominalValue: null,
          tolerancePlus: null,
          toleranceMinus: null,
          unitOfMeasureCode: null,
          characteristicType: null,
          sortOrder: num
        }
      ]);
      setDrag(null);
      setPlacing(false);
    },
    [drag, placing, movingBalloon, getRelativePos, nextBalloonNumber]
  );

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    setSelectedBalloon(null);
  }, []);

  const updateFeature = useCallback(
    (id: string, field: keyof BalloonFeature, value: unknown) => {
      setFeatures((prev) =>
        prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
      );
    },
    []
  );

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("annotations", JSON.stringify(annotations));
    formData.set("features", JSON.stringify(features));
    if (pdfUrl) formData.set("pdfUrl", pdfUrl);
    fetcher.submit(formData, {
      method: "post",
      action: `/x/ballooning-diagram/${diagramId}/save`
    });
  }, [diagramId, name, annotations, features, pdfUrl, fetcher]);

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

  const previewRect = drag
    ? {
        x: Math.min(drag.startX, drag.currentX),
        y: Math.min(drag.startY, drag.currentY),
        width: Math.abs(drag.currentX - drag.startX),
        height: Math.abs(drag.currentY - drag.startY)
      }
    : null;

  const sortedFeatures = [...features].sort(
    (a, b) => a.balloonNumber - b.balloonNumber
  );

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

      {/* Header bar */}
      <div className="flex flex-shrink-0 items-center justify-between px-4 py-2 bg-card border-b border-border h-[50px] overflow-x-auto scrollbar-hide dark:border-none dark:shadow-[inset_0_0_1px_rgb(255_255_255_/_0.24),_0_0_0_0.5px_rgb(0,0,0,1),0px_0px_4px_rgba(0,_0,_0,_0.08)]">
        <VStack spacing={0}>
          <HStack>
            <Heading size="h4" className="flex items-center gap-2">
              <span>{name}</span>
              {content?.drawingNumber && (
                <span className="text-sm font-normal text-muted-foreground">
                  {content.drawingNumber}
                  {content.revision ? ` Rev ${content.revision}` : ""}
                </span>
              )}
            </Heading>
          </HStack>
        </VStack>
        <HStack>
          <Button
            variant={placing ? "primary" : "secondary"}
            leftIcon={<LuRectangleHorizontal />}
            onClick={() => setPlacing((v) => !v)}
            isDisabled={!hasPdf}
          >
            {placing ? t`Drag to highlight a feature` : t`Add Balloon`}
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
          <Button
            leftIcon={<LuSave />}
            onClick={handleSave}
            isDisabled={fetcher.state !== "idle"}
          >
            {t`Save`}
          </Button>
        </HStack>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden p-4 gap-4">
        {/* PDF viewer — outer measures width, inner fills container */}
        <div
          ref={containerRef}
          className="border rounded-lg bg-muted flex-shrink-0 overflow-auto"
          style={{
            height: 540,
            cursor: placing ? "crosshair" : movingBalloon ? "move" : "default",
            minWidth: "100%"
          }}
        >
          {hasPdf ? (
            <div
              ref={overlayRef}
              className="relative select-none"
              style={{ width: containerWidth > 0 ? containerWidth : "100%" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (drag) setDrag(null);
                if (movingBalloon) setMovingBalloon(null);
              }}
            >
              {isMounted && (
                <Document
                  file={pdfFile ?? pdfUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  onLoadError={(err) =>
                    toast.error(`PDF error: ${err.message}`)
                  }
                >
                  {Array.from({ length: numPages }, (_, i) => (
                    <Page
                      key={i + 1}
                      pageNumber={i + 1}
                      width={containerWidth > 0 ? containerWidth : undefined}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="w-full"
                    />
                  ))}
                </Document>
              )}

              {/* Saved highlights */}
              {annotations.map((ann) => (
                <div
                  key={`rect-${ann.id}`}
                  className="absolute border-2 rounded-sm pointer-events-none"
                  style={{
                    left: `${ann.rect!.x}%`,
                    top: `${ann.rect!.y}%`,
                    width: `${ann.rect!.width}%`,
                    height: `${ann.rect!.height}%`,
                    borderColor:
                      ann.id === selectedBalloon
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary) / 0.6)",
                    backgroundColor:
                      ann.id === selectedBalloon
                        ? "hsl(var(--primary) / 0.15)"
                        : "hsl(var(--primary) / 0.07)",
                    zIndex: 8
                  }}
                />
              ))}

              {/* Live drag preview */}
              {previewRect && (
                <div
                  className="absolute border-2 rounded-sm pointer-events-none"
                  style={{
                    left: `${previewRect.x}%`,
                    top: `${previewRect.y}%`,
                    width: `${previewRect.width}%`,
                    height: `${previewRect.height}%`,
                    borderColor: "hsl(var(--primary))",
                    backgroundColor: "hsl(var(--primary) / 0.12)",
                    zIndex: 9
                  }}
                />
              )}

              {/* Balloon number pins */}
              {annotations.map((ann) => (
                <button
                  key={`pin-${ann.id}`}
                  type="button"
                  onMouseDown={(e) => {
                    if (placing) return;
                    e.stopPropagation();
                    e.preventDefault();
                    setSelectedBalloon(ann.id);
                    if (!overlayRef.current) return;
                    const rect = overlayRef.current.getBoundingClientRect();
                    const mouseX = toPercent(e.clientX - rect.left, rect.width);
                    const mouseY = toPercent(e.clientY - rect.top, rect.height);
                    setMovingBalloon({
                      id: ann.id,
                      offsetX: mouseX - ann.x,
                      offsetY: mouseY - ann.y
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="absolute flex items-center justify-center rounded-full border-2 text-xs font-bold transition-colors"
                  style={{
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                    width: BALLOON_RADIUS * 2,
                    height: BALLOON_RADIUS * 2,
                    transform: "translate(-50%, -50%)",
                    cursor: placing ? "crosshair" : "move",
                    backgroundColor:
                      ann.id === selectedBalloon
                        ? "hsl(var(--primary))"
                        : "white",
                    borderColor: "hsl(var(--primary))",
                    color:
                      ann.id === selectedBalloon
                        ? "white"
                        : "hsl(var(--primary))",
                    zIndex: 10
                  }}
                >
                  {ann.balloonNumber}
                </button>
              ))}
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
                  {uploading ? t`Uploading…` : t`Click to upload a PDF drawing`}
                </p>
              </VStack>
            </button>
          )}
        </div>

        {/* Feature table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <Thead>
              <Tr>
                <Th className="w-16">{t`#`}</Th>
                <Th>{t`Description`}</Th>
                <Th className="w-28">{t`Nominal`}</Th>
                <Th className="w-24">{t`+Tol`}</Th>
                <Th className="w-24">{t`-Tol`}</Th>
                <Th className="w-24">{t`Unit`}</Th>
                <Th className="w-32">{t`Characteristic`}</Th>
                <Th className="w-10" />
              </Tr>
            </Thead>
            <Tbody>
              {sortedFeatures.map((feature) => (
                <Tr
                  key={feature.id}
                  onClick={() =>
                    setSelectedBalloon(
                      feature.id === selectedBalloon ? null : feature.id
                    )
                  }
                  className={`cursor-pointer ${selectedBalloon === feature.id ? "bg-primary/10" : ""}`}
                >
                  <Td>
                    <Badge variant="outline">{feature.balloonNumber}</Badge>
                  </Td>
                  <Td>
                    <Input
                      name={`description-${feature.id}`}
                      value={feature.description}
                      onChange={(e) =>
                        updateFeature(feature.id, "description", e.target.value)
                      }
                      placeholder={t`Feature description`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Td>
                  <Td>
                    <Input
                      key={`nominal-${feature.id}`}
                      name={`nominal-${feature.id}`}
                      inputMode="decimal"
                      defaultValue={feature.nominalValue ?? ""}
                      onBlur={(e) =>
                        updateFeature(
                          feature.id,
                          "nominalValue",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      placeholder="0.000"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Td>
                  <Td>
                    <Input
                      key={`tolPlus-${feature.id}`}
                      name={`tolPlus-${feature.id}`}
                      inputMode="decimal"
                      defaultValue={feature.tolerancePlus ?? ""}
                      onBlur={(e) =>
                        updateFeature(
                          feature.id,
                          "tolerancePlus",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      placeholder="+0.005"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Td>
                  <Td>
                    <Input
                      key={`tolMinus-${feature.id}`}
                      name={`tolMinus-${feature.id}`}
                      inputMode="decimal"
                      defaultValue={feature.toleranceMinus ?? ""}
                      onBlur={(e) =>
                        updateFeature(
                          feature.id,
                          "toleranceMinus",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      placeholder="-0.005"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Td>
                  <Td>
                    <Input
                      name={`unit-${feature.id}`}
                      value={feature.unitOfMeasureCode ?? ""}
                      onChange={(e) =>
                        updateFeature(
                          feature.id,
                          "unitOfMeasureCode",
                          e.target.value || null
                        )
                      }
                      placeholder="mm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={feature.characteristicType ?? ""}
                      onValueChange={(val) =>
                        updateFeature(
                          feature.id,
                          "characteristicType",
                          val || null
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t`Type`} />
                      </SelectTrigger>
                      <SelectContent>
                        {balloonCharacteristicType.map((ct) => (
                          <SelectItem key={ct} value={ct}>
                            {ct}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAnnotation(feature.id);
                      }}
                    >
                      <LuTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </Td>
                </Tr>
              ))}
              {sortedFeatures.length === 0 && (
                <Tr>
                  <Td
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t`No balloons yet. Click "Add Balloon" then drag to highlight a feature on the drawing.`}
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
