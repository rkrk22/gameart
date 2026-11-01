import { useEffect, useMemo, useState } from "react";
import { BringToFront, Download, Loader2, Pause, Play, SendToBack, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import {
  AiPromoSlidePayload,
  PromoBoardItem,
  PromoSlide,
  buildAiPromoSlides,
  downloadPromoSlideSvg,
} from "@/lib/promoTeaser";

interface PromoTeaserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: PromoSlide[];
  title: string;
  description: string;
  loading?: boolean;
  baseFilename: string;
  aiSourceType?: "page" | "chapter";
  aiSourceContent?: string;
  aiSourceTitle?: string;
}

type ResizeMode = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type SelectedBoardTarget = {
  slideId: string;
  itemId: string;
} | null;

type EditingTextTarget = {
  slideId: string;
  itemId: string;
} | null;

type ActiveTransform =
  | {
      kind: "drag";
      slideId: string;
      itemId: string;
      startX: number;
      startY: number;
      origin: PromoBoardItem;
      boardRect: DOMRect;
    }
  | {
      kind: "resize";
      slideId: string;
      itemId: string;
      mode: ResizeMode;
      startX: number;
      startY: number;
      origin: PromoBoardItem;
      boardRect: DOMRect;
    }
  | null;

const BOARD_LIMITS = {
  minX: 2,
  minY: 2,
  maxX: 98,
  maxY: 92,
};

const getMinItemWidth = (item: PromoBoardItem, textLength: number) => {
  if (item.kind === "image") return 12;
  if (item.kind === "title") {
    return Math.min(72, Math.max(30, 24 + Math.ceil(textLength / 22) * 4.8));
  }
  return Math.min(44, Math.max(18, 14 + Math.ceil(textLength / 26) * 2.8));
};

const getMinItemHeight = (item: PromoBoardItem, lines: number) => {
  if (item.kind === "image") return 12;
  if (item.kind === "title") {
    return Math.max(24, Math.min(58, 12 + lines * 5.4));
  }
  return Math.max(15, Math.min(42, 8 + lines * 4.1));
};

const estimateTextMetrics = (item: PromoBoardItem) => {
  const textLength = item.text?.trim().length ?? 0;
  const charsPerLine =
    item.kind === "title"
      ? Math.max(10, Math.floor(item.w * 1.45))
      : Math.max(12, Math.floor(item.w * 1.85));
  const lines = Math.max(1, Math.ceil(textLength / charsPerLine));
  return { textLength, lines };
};

const normalizeBoardItem = (item: PromoBoardItem): PromoBoardItem => {
  if (item.kind === "image") {
    return {
      ...item,
      x: Math.max(BOARD_LIMITS.minX, Math.min(BOARD_LIMITS.maxX - item.w, item.x)),
      y: Math.max(BOARD_LIMITS.minY, Math.min(BOARD_LIMITS.maxY - item.h, item.y)),
    };
  }

  const { textLength, lines } = estimateTextMetrics(item);
  const minWidth = getMinItemWidth(item, textLength);
  const minHeight = getMinItemHeight(item, lines);
  const width = Math.max(item.w, minWidth);
  const height = Math.max(item.h, minHeight);
  const x = Math.max(BOARD_LIMITS.minX, Math.min(BOARD_LIMITS.maxX - width, item.x));
  const y = Math.max(BOARD_LIMITS.minY, Math.min(BOARD_LIMITS.maxY - height, item.y));

  return {
    ...item,
    x,
    y,
    w: width,
    h: height,
  };
};

const normalizeBoardItems = (items: PromoBoardItem[]) => items.map(normalizeBoardItem);

const applyTransformToItem = (active: Exclude<ActiveTransform, null>, clientX: number, clientY: number) => {
  const deltaX = ((clientX - active.startX) / active.boardRect.width) * 100;
  const deltaY = ((clientY - active.startY) / active.boardRect.height) * 100;
  const item = active.origin;

  if (active.kind === "drag") {
    const nextItem = {
      ...item,
      x: Math.max(BOARD_LIMITS.minX, Math.min(BOARD_LIMITS.maxX - item.w, item.x + deltaX)),
      y: Math.max(BOARD_LIMITS.minY, Math.min(BOARD_LIMITS.maxY - item.h, item.y + deltaY)),
    };
    return normalizeBoardItem(nextItem);
  }

  let nextX = item.x;
  let nextY = item.y;
  let nextW = item.w;
  let nextH = item.h;

  if (active.mode.includes("e")) {
    nextW = item.w + deltaX;
  }
  if (active.mode.includes("s")) {
    nextH = item.h + deltaY;
  }
  if (active.mode.includes("w")) {
    nextX = item.x + deltaX;
    nextW = item.w - deltaX;
  }
  if (active.mode.includes("n")) {
    nextY = item.y + deltaY;
    nextH = item.h - deltaY;
  }

  const { textLength, lines } = estimateTextMetrics({
    ...item,
    w: nextW,
    h: nextH,
  });
  const minWidth = getMinItemWidth(item, textLength);
  const minHeight = getMinItemHeight(item, lines);

  nextW = Math.max(minWidth, nextW);
  nextH = Math.max(minHeight, nextH);
  nextX = Math.max(BOARD_LIMITS.minX, Math.min(BOARD_LIMITS.maxX - nextW, nextX));
  nextY = Math.max(BOARD_LIMITS.minY, Math.min(BOARD_LIMITS.maxY - nextH, nextY));
  nextW = Math.min(BOARD_LIMITS.maxX - nextX, nextW);
  nextH = Math.min(BOARD_LIMITS.maxY - nextY, nextH);

  return normalizeBoardItem({
    ...item,
    x: nextX,
    y: nextY,
    w: nextW,
    h: nextH,
  });
};

const getBoardTextStyle = (item: PromoBoardItem) => {
  const { textLength, lines } = estimateTextMetrics(item);
  const area = item.w * item.h;

  if (item.kind === "title") {
    if (lines > 7 || area < 360) return { fontSize: "0.82rem", lineHeight: "1.08" };
    if (lines > 5 || textLength > 130) return { fontSize: "1rem", lineHeight: "1.08" };
    if (textLength > 84 || area < 520) return { fontSize: "1.16rem", lineHeight: "1.06" };
    return { fontSize: "1.46rem", lineHeight: "1.02" };
  }

  if (lines > 8 || area < 190) return { fontSize: "0.56rem", lineHeight: "1.16" };
  if (lines > 6 || textLength > 110) return { fontSize: "0.64rem", lineHeight: "1.18" };
  if (textLength > 78 || area < 250) return { fontSize: "0.72rem", lineHeight: "1.2" };
  return { fontSize: "0.8rem", lineHeight: "1.22" };
};

export const PromoTeaserDialog = ({
  open,
  onOpenChange,
  slides,
  title,
  description,
  loading = false,
  baseFilename,
  aiSourceType,
  aiSourceContent,
  aiSourceTitle,
}: PromoTeaserDialogProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [workingSlides, setWorkingSlides] = useState<PromoSlide[]>(slides);
  const [selectedBoardTarget, setSelectedBoardTarget] = useState<SelectedBoardTarget>(null);
  const [editingTextTarget, setEditingTextTarget] = useState<EditingTextTarget>(null);
  const [activeTransform, setActiveTransform] = useState<ActiveTransform>(null);
  const [prompt, setPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!api) return;

    const syncSelected = () => {
      setSelectedIndex(api.selectedScrollSnap());
    };

    syncSelected();
    api.on("select", syncSelected);
    api.on("reInit", syncSelected);

    return () => {
      api.off("select", syncSelected);
    };
  }, [api]);

  useEffect(() => {
    if (!open || !api || !autoplay || workingSlides.length <= 1) return;

    const timer = window.setInterval(() => {
      const nextIndex = api.selectedScrollSnap() + 1;
      api.scrollTo(nextIndex >= workingSlides.length ? 0 : nextIndex);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [api, autoplay, open, workingSlides.length]);

  useEffect(() => {
    setWorkingSlides(slides);
  }, [slides]);

  useEffect(() => {
    if (open) return;
    setSelectedIndex(0);
    setAutoplay(true);
    setWorkingSlides(slides);
    setSelectedBoardTarget(null);
    setEditingTextTarget(null);
    setActiveTransform(null);
  }, [open, slides]);

  useEffect(() => {
    if (!activeTransform) return;

    const handlePointerMove = (event: PointerEvent) => {
      setWorkingSlides((current) =>
        current.map((slide) => {
          if (slide.id !== activeTransform.slideId || slide.layout !== "board" || !slide.boardItems) {
            return slide;
          }

          return {
            ...slide,
            boardItems: slide.boardItems.map((item) =>
              item.id === activeTransform.itemId
                ? applyTransformToItem(activeTransform, event.clientX, event.clientY)
                : item,
            ),
          };
        }),
      );
    };

    const handlePointerUp = () => {
      setActiveTransform(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeTransform]);

  const currentSlide = workingSlides[selectedIndex] ?? null;

  const slideCountLabel = useMemo(() => {
    if (workingSlides.length === 0) return "0 slides";
    if (workingSlides.length === 1) return "1 slide";
    return `${workingSlides.length} slides`;
  }, [workingSlides.length]);

  const currentBoardItems = useMemo(() => {
    if (!currentSlide || currentSlide.layout !== "board" || !currentSlide.boardItems) return [];
    return normalizeBoardItems(currentSlide.boardItems);
  }, [currentSlide]);

  const selectedBoardItem = useMemo(() => {
    if (!currentSlide || currentSlide.layout !== "board") return null;
    if (!selectedBoardTarget || selectedBoardTarget.slideId !== currentSlide.id) return null;
    return currentBoardItems.find((item) => item.id === selectedBoardTarget.itemId) ?? null;
  }, [currentBoardItems, currentSlide, selectedBoardTarget]);

  const getBoardItems = (slide: PromoSlide) => normalizeBoardItems(slide.boardItems ?? []);

  const updateSlideBoardItems = (slideId: string, updater: (items: PromoBoardItem[]) => PromoBoardItem[]) => {
    setWorkingSlides((current) =>
      current.map((slide) => {
        if (slide.id !== slideId || slide.layout !== "board" || !slide.boardItems) return slide;
        return {
          ...slide,
          boardItems: normalizeBoardItems(updater(slide.boardItems)),
        };
      }),
    );
  };

  const updateBoardItemText = (slideId: string, itemId: string, text: string) => {
    updateSlideBoardItems(slideId, (items) =>
      items.map((item) => (item.id === itemId ? { ...item, text } : item)),
    );
  };

  const beginDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    slideId: string,
    item: PromoBoardItem,
  ) => {
    if (event.button !== 0) return;
    const boardElement = event.currentTarget.closest("[data-board-surface='true']");
    if (!(boardElement instanceof HTMLElement)) return;

    event.preventDefault();
    event.stopPropagation();
    if (editingTextTarget?.slideId === slideId && editingTextTarget.itemId === item.id) {
      return;
    }
    setAutoplay(false);
    setSelectedBoardTarget({ slideId, itemId: item.id });
    setActiveTransform({
      kind: "drag",
      slideId,
      itemId: item.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: item,
      boardRect: boardElement.getBoundingClientRect(),
    });
  };

  const beginResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    slideId: string,
    item: PromoBoardItem,
    mode: ResizeMode,
  ) => {
    if (event.button !== 0) return;
    const boardElement = event.currentTarget.closest("[data-board-surface='true']");
    if (!(boardElement instanceof HTMLElement)) return;

    event.preventDefault();
    event.stopPropagation();
    setAutoplay(false);
    setSelectedBoardTarget({ slideId, itemId: item.id });
    setActiveTransform({
      kind: "resize",
      slideId,
      itemId: item.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: item,
      boardRect: boardElement.getBoundingClientRect(),
    });
  };

  const reorderSelectedItem = (direction: "front" | "back") => {
    if (!currentSlide || currentSlide.layout !== "board" || !selectedBoardItem) return;

    updateSlideBoardItems(currentSlide.id, (items) => {
      const nextItems = [...items];
      const index = nextItems.findIndex((item) => item.id === selectedBoardItem.id);
      if (index === -1) return items;
      const [target] = nextItems.splice(index, 1);
      if (direction === "front") {
        nextItems.push(target);
      } else {
        nextItems.unshift(target);
      }
      return nextItems;
    });
  };

  const applyAiPayloadToSlide = (
    slide: PromoSlide,
    aiSlide: Record<string, unknown>,
  ): PromoSlide => {
    const nextSlide: PromoSlide = { ...slide };
    if (typeof aiSlide.title === "string" && aiSlide.title.trim()) {
      nextSlide.title = aiSlide.title.trim();
    }
    if (typeof aiSlide.subtitle === "string") {
      nextSlide.subtitle = aiSlide.subtitle.trim();
    }
    if (typeof aiSlide.footer === "string" && aiSlide.footer.trim()) {
      nextSlide.footer = aiSlide.footer.trim();
    }
    if (Array.isArray(aiSlide.bullets)) {
      nextSlide.bullets = aiSlide.bullets.filter((item): item is string => typeof item === "string").slice(0, 5);
    }

    if (nextSlide.layout === "board" && nextSlide.boardItems) {
      const boardTitle = typeof aiSlide.boardTitle === "string" ? aiSlide.boardTitle.trim() : "";
      const boardNotes = Array.isArray(aiSlide.boardNotes)
        ? aiSlide.boardNotes.filter((item): item is string => typeof item === "string").slice(0, 3)
        : [];

      nextSlide.boardItems = normalizeBoardItems(
        nextSlide.boardItems.map((item) => {
          if (item.id === "title" && boardTitle) {
            return { ...item, text: boardTitle };
          }
          if (item.id === "note-1" && boardNotes[0]) {
            return { ...item, text: boardNotes[0] };
          }
          if (item.id === "note-2" && boardNotes[1]) {
            return { ...item, text: boardNotes[1] };
          }
          if (item.id === "note-3" && boardNotes[2]) {
            return { ...item, text: boardNotes[2] };
          }
          return item;
        }),
      );
    }

    return nextSlide;
  };

  const handleAiRefine = async () => {
    if (!aiSourceType || !aiSourceContent.trim() || !aiSourceTitle) return;

    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/lesson-teaser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          sourceType: aiSourceType,
          sourceContent: aiSourceContent,
          prompt,
          slides: workingSlides.map((slide) => ({
            id: slide.id,
            title: slide.title,
            subtitle: slide.subtitle,
            footer: slide.footer,
            bullets: slide.bullets,
            layout: slide.layout,
            boardItems: slide.boardItems?.map((item) => ({
              id: item.id,
              kind: item.kind,
              text: item.text,
            })),
          })),
        }),
      });

      const responseText = await response.text();
      let payload: { error?: string; slides?: Array<Record<string, unknown>>; raw?: string } = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(responseText || "AI generation failed");
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.raw || "AI generation failed");
      }

      const mappedSlides = new Map(
        (payload.slides ?? []).map((item) => [typeof item.id === "string" ? item.id : "", item]),
      );

      if (workingSlides.length === 0) {
        const aiSlides: AiPromoSlidePayload[] = (payload.slides ?? []).map((item, index) => ({
          id: typeof item.id === "string" && item.id ? item.id : `ai-${index + 1}`,
          title: typeof item.title === "string" ? item.title : aiSourceTitle,
          subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
          footer: typeof item.footer === "string" ? item.footer : "",
          bullets: Array.isArray(item.bullets)
            ? item.bullets.filter((bullet): bullet is string => typeof bullet === "string")
            : [],
          boardTitle: typeof item.boardTitle === "string" ? item.boardTitle : "",
          boardNotes: Array.isArray(item.boardNotes)
            ? item.boardNotes.filter((note): note is string => typeof note === "string")
            : [],
        }));

        setWorkingSlides(
          buildAiPromoSlides({
            sourceType: aiSourceType,
            sourceTitle: aiSourceTitle,
            sourceContent: aiSourceContent,
            aiSlides,
          }).map((slide) =>
            slide.layout === "board" && slide.boardItems
              ? { ...slide, boardItems: normalizeBoardItems(slide.boardItems) }
              : slide,
          ),
        );
        setSelectedBoardTarget(null);
      } else {
        setWorkingSlides((current) =>
          current.map((slide) => {
            const aiSlide = mappedSlides.get(slide.id);
            const nextSlide = aiSlide ? applyAiPayloadToSlide(slide, aiSlide) : slide;
            return nextSlide.layout === "board" && nextSlide.boardItems
              ? { ...nextSlide, boardItems: normalizeBoardItems(nextSlide.boardItems) }
              : nextSlide;
          }),
        );
      }
    } catch (error: unknown) {
      window.alert(error instanceof Error ? error.message : "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const resizeHandles: Array<{ key: ResizeMode; className: string }> = [
    { key: "n", className: "absolute left-3 right-3 top-0 h-3 -translate-y-1/2 cursor-ns-resize" },
    { key: "s", className: "absolute bottom-0 left-3 right-3 h-3 translate-y-1/2 cursor-ns-resize" },
    { key: "e", className: "absolute bottom-3 right-0 top-3 w-3 translate-x-1/2 cursor-ew-resize" },
    { key: "w", className: "absolute bottom-3 left-0 top-3 w-3 -translate-x-1/2 cursor-ew-resize" },
    { key: "ne", className: "absolute right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
    { key: "nw", className: "absolute left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
    { key: "se", className: "absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
    { key: "sw", className: "absolute bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
  ];

  const renderBoardSlide = (slide: PromoSlide) => {
    const items = getBoardItems(slide);
    const selectedItemId = selectedBoardTarget?.slideId === slide.id ? selectedBoardTarget.itemId : null;

    return (
      <article
        className="relative aspect-[9/16] overflow-hidden rounded-[36px] border border-border p-4 shadow-xl"
        style={{ backgroundColor: slide.theme.background }}
      >
        <div
          className="absolute right-[-2rem] top-[-2rem] h-44 w-44 rounded-full"
          style={{ backgroundColor: slide.theme.accentSoft, opacity: 0.7 }}
        />
        <div
          className="absolute bottom-[-3rem] left-[-2rem] h-52 w-52 rounded-full"
          style={{ backgroundColor: slide.theme.accentSoft, opacity: 0.56 }}
        />

        <div
          data-board-surface="true"
          className="relative h-full w-full"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedBoardTarget(null);
            }
          }}
        >
          {items.map((item) => {
            const isSelected = selectedItemId === item.id;
            const isEditingText =
              editingTextTarget?.slideId === slide.id && editingTextTarget.itemId === item.id;
            const isDragging =
              activeTransform?.slideId === slide.id &&
              activeTransform.itemId === item.id &&
              activeTransform.kind === "drag";
            const isTitle = item.kind === "title";

            return (
              <div
                key={item.id}
                className={cn(
                  "absolute touch-none select-none overflow-hidden rounded-[0.35rem] shadow-[0_18px_40px_rgba(0,0,0,0.16)]",
                  isDragging ? "cursor-grabbing" : "cursor-grab",
                  isSelected && "ring-2 ring-primary ring-offset-2",
                )}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.w}%`,
                  height: `${item.h}%`,
                  backgroundColor: item.kind === "image" ? "#ffffff" : isTitle ? slide.theme.panel : "#fff3a6",
                  padding: item.kind === "image" ? "0.45rem" : isTitle ? "0.95rem" : "0.85rem",
                }}
                onPointerDown={(event) => beginDrag(event, slide.id, item)}
                onDoubleClick={(event) => {
                  if (item.kind === "image") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedBoardTarget({ slideId: slide.id, itemId: item.id });
                  setEditingTextTarget({ slideId: slide.id, itemId: item.id });
                }}
              >
                {item.kind === "image" && item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-full w-full rounded-[0.2rem] object-cover"
                    draggable={false}
                  />
                ) : (
                  <>
                    <div className={cn("flex h-full w-full items-start overflow-hidden", isEditingText && "opacity-0")}>
                      <p
                        className={cn(
                          "w-full overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                          isTitle ? "font-black" : "font-semibold",
                        )}
                        style={{
                          color: slide.theme.text,
                          hyphens: "auto",
                          ...getBoardTextStyle(item),
                        }}
                      >
                        {item.text}
                      </p>
                    </div>

                    {isEditingText ? (
                      <textarea
                        autoFocus
                        value={item.text ?? ""}
                        onChange={(event) => updateBoardItemText(slide.id, item.id, event.target.value)}
                        onBlur={() => setEditingTextTarget(null)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setEditingTextTarget(null);
                          }
                          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            event.preventDefault();
                            setEditingTextTarget(null);
                          }
                        }}
                        className={cn(
                          "absolute inset-0 h-full w-full resize-none border-0 bg-transparent outline-none",
                          isTitle ? "font-black" : "font-semibold",
                        )}
                        style={{
                          color: slide.theme.text,
                          padding: isTitle ? "0.95rem" : "0.85rem",
                          ...getBoardTextStyle(item),
                        }}
                      />
                    ) : null}
                  </>
                )}

                {isSelected && !isEditingText ? (
                  <div className="pointer-events-none absolute inset-0">
                    {resizeHandles.map((handle) => (
                      <button
                        key={handle.key}
                        type="button"
                        className={cn(handle.className, "pointer-events-auto border-0 bg-transparent p-0")}
                        onPointerDown={(event) => beginResize(event, slide.id, item, handle.key)}
                        aria-label={`Resize block ${handle.key}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div
            className="absolute bottom-[4%] left-[6%] right-[6%] rounded-[0.9rem] px-4 py-3 text-[0.76rem] font-semibold shadow-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.88)", color: slide.theme.muted }}
          >
            {slide.badge} • {slide.footer}
          </div>
        </div>
      </article>
    );
  };

  const renderStackSlide = (slide: PromoSlide) => (
    <article
      className="relative aspect-[9/16] overflow-hidden rounded-[36px] border border-border p-6 shadow-xl"
      style={{ backgroundColor: slide.theme.background }}
    >
      {slide.imageUrl ? (
        <>
          <img
            src={slide.imageUrl}
            alt={slide.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.42) 26%, rgba(255,255,255,0.88) 58%, rgba(255,255,255,0.96) 100%)",
            }}
          />
        </>
      ) : null}
      <div
        className="absolute right-[-2rem] top-[-3rem] h-44 w-44 rounded-full blur-0"
        style={{ backgroundColor: slide.theme.accentSoft }}
      />
      <div
        className="absolute bottom-[-4rem] left-[-2rem] h-52 w-52 rounded-full"
        style={{ backgroundColor: slide.theme.accentSoft, opacity: 0.7 }}
      />

      <div className="relative flex h-full flex-col">
        <div
          className="inline-flex w-fit items-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{
            backgroundColor: slide.imageUrl ? "rgba(255,255,255,0.88)" : slide.theme.panel,
            color: slide.theme.accent,
          }}
        >
          {slide.badge}
        </div>

        <h3
          className="mt-6 text-3xl font-black leading-[0.95] sm:text-[2.5rem]"
          style={{ color: slide.theme.text }}
        >
          {slide.title}
        </h3>
        {slide.subtitle ? (
          <p
            className="mt-4 text-base leading-6"
            style={{ color: slide.theme.muted }}
          >
            {slide.subtitle}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          {slide.bullets.map((bullet) => (
            <div
              key={bullet}
              className="rounded-[24px] border px-4 py-3"
              style={{
                backgroundColor: slide.imageUrl ? "rgba(255,255,255,0.9)" : slide.theme.panel,
                borderColor: `${slide.theme.accentSoft}`,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slide.theme.accent }}
                />
                <p
                  className="text-sm font-medium leading-5"
                  style={{ color: slide.theme.text }}
                >
                  {bullet}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-auto rounded-[24px] px-4 py-3 text-sm font-semibold"
          style={{
            backgroundColor: slide.imageUrl ? "rgba(255,255,255,0.92)" : slide.theme.panel,
            color: slide.theme.muted,
          }}
        >
          {slide.footer}
        </div>
      </div>
    </article>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr),320px]">
          <div className="border-b border-border bg-muted/20 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>{title}</span>
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            {loading ? (
              <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-dashed border-border bg-background/80">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Collecting content and building promo slides…</span>
                </div>
              </div>
            ) : workingSlides.length === 0 ? (
              <div className="mx-auto flex min-h-[60vh] w-full max-w-[420px] flex-col items-center justify-center rounded-[36px] border border-dashed border-border bg-background/80 p-6 text-center">
                <div className="flex min-h-[66vh] w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-muted/20 p-8">
                  <Sparkles className="h-8 w-8 text-primary" />
                  <p className="mt-4 text-base font-semibold text-foreground">Empty canvas</p>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                    Nothing is generated on open. Set the prompt and click `Improve with OpenAI`.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Carousel
                  setApi={setApi}
                  opts={{ loop: true, align: "start" }}
                  className="mx-auto w-full max-w-[420px]"
                >
                  <CarouselContent className="-ml-0">
                    {workingSlides.map((slide) => (
                      <CarouselItem key={slide.id} className="pl-0">
                        {slide.layout === "board" ? renderBoardSlide(slide) : renderStackSlide(slide)}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {workingSlides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => api?.scrollTo(index)}
                      className={cn(
                        "h-2.5 rounded-full transition-all",
                        selectedIndex === index ? "w-8 bg-primary" : "w-2.5 bg-border",
                      )}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4 p-4 sm:p-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Preview mode</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag blocks directly on the board. Hover block edges to resize. Double-click text blocks to edit them.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">AI prompt</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Works only on local `http://localhost:8080` when `OPENAI_API_KEY` is set.
              </p>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-3 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Напиши, каким должен быть тон и структура тизера"
              />
              <Button
                className="mt-3 w-full"
                onClick={() => void handleAiRefine()}
                disabled={aiLoading || loading || !aiSourceType || !aiSourceContent || !aiSourceTitle}
              >
                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Improve with OpenAI
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Layer order</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a board block first, then move it above or below other blocks.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => reorderSelectedItem("front")}
                  disabled={!selectedBoardItem}
                >
                  <BringToFront className="mr-2 h-4 w-4" />
                  Bring front
                </Button>
                <Button
                  variant="outline"
                  onClick={() => reorderSelectedItem("back")}
                  disabled={!selectedBoardItem}
                >
                  <SendToBack className="mr-2 h-4 w-4" />
                  Send back
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Detected assets</p>
              <p className="mt-1 text-sm text-muted-foreground">{slideCountLabel}</p>
              <p className="text-sm text-muted-foreground">
                Current: {workingSlides.length > 0 ? selectedIndex + 1 : 0}
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setAutoplay((value) => !value)}
                disabled={loading || workingSlides.length <= 1}
              >
                {autoplay ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {autoplay ? "Pause autoplay" : "Resume autoplay"}
              </Button>

              <Button
                className="w-full"
                onClick={() => {
                  if (!currentSlide) return;
                  downloadPromoSlideSvg(currentSlide, `${baseFilename}-${selectedIndex + 1}.svg`);
                }}
                disabled={loading || !currentSlide}
              >
                <Download className="mr-2 h-4 w-4" />
                Download current SVG
              </Button>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  workingSlides.forEach((slide, index) => {
                    downloadPromoSlideSvg(slide, `${baseFilename}-${index + 1}.svg`);
                  });
                }}
                disabled={loading || workingSlides.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Download all SVGs
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              GIF/video later:
              This prototype already structures the chapter into story-sized cards. Next step is server-side render to MP4/GIF or client-side canvas export.
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
};
