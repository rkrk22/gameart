const SVG_WIDTH = 1080;
const SVG_HEIGHT = 1920;
const SVG_PADDING_X = 96;
const SVG_TITLE_LINE_HEIGHT = 86;
const SVG_BODY_LINE_HEIGHT = 48;
const SVG_FOOTER_LINE_HEIGHT = 40;

type PromoTheme = {
  name: string;
  background: string;
  panel: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
};

export type PromoSlide = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  footer: string;
  theme: PromoTheme;
  imageUrl?: string;
  layout?: "stack" | "board";
  boardItems?: PromoBoardItem[];
  arrows?: PromoArrow[];
};

export type PromoBoardItem = {
  id: string;
  kind: "image" | "note" | "title";
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  text?: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
};

export type PromoArrow = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  bend?: number;
};

export type PromoPageSource = {
  title: string;
  slug: string;
  markdown: string;
};

export type AiPromoSlidePayload = {
  id: string;
  title: string;
  subtitle: string;
  footer: string;
  bullets: string[];
  boardTitle: string;
  boardNotes: string[];
};

const themes: PromoTheme[] = [
  {
    name: "sunset",
    background: "#fff4de",
    panel: "#fffaf1",
    accent: "#ef6c33",
    accentSoft: "#ffd2b8",
    text: "#2f241f",
    muted: "#7a6253",
  },
  {
    name: "sage",
    background: "#edf4e8",
    panel: "#f9fff6",
    accent: "#3d7a57",
    accentSoft: "#c8e3d1",
    text: "#203128",
    muted: "#586d61",
  },
  {
    name: "sky",
    background: "#edf6ff",
    panel: "#f8fbff",
    accent: "#2f6bb3",
    accentSoft: "#c9def8",
    text: "#1d2f45",
    muted: "#5e7490",
  },
];

type ExtractedIdeas = {
  intro: string[];
  headings: string[];
  bullets: string[];
  sentences: string[];
  images: string[];
};

const sanitizeMarkdown = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "");

const cleanLine = (line: string) =>
  line
    .replace(/^#+\s*/, "")
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\*/g, "")
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSentence = (value: string) => {
  const cleaned = cleanLine(value);
  if (!cleaned) return "";
  if (cleaned.length < 24) return "";
  return cleaned.length > 140 ? `${cleaned.slice(0, 137).trimEnd()}…` : cleaned;
};

const imageUrlPattern =
  /https?:\/\/[^\s)"']+\.(?:png|jpe?g|webp|gif|svg)(?:\?[^\s)"']*)?/gi;

const unique = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const extractIdeasFromMarkdown = (markdown: string): ExtractedIdeas => {
  const sanitized = sanitizeMarkdown(markdown);
  const lines = sanitized.split("\n").map((line) => line.trim());
  const images = unique((markdown.match(imageUrlPattern) ?? []).map((value) => value.trim()));

  const headings = unique(
    lines
      .filter((line) => /^##?\s+/.test(line))
      .map(cleanLine)
      .filter((line) => line.length > 3),
  );

  const bullets = unique(
    lines
      .filter((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line))
      .map(normalizeSentence)
      .filter(Boolean),
  );

  const paragraphs = sanitized
    .split(/\n\s*\n/g)
    .map((block) => cleanLine(block.replace(/\n/g, " ")))
    .filter((block) => block.length > 40);

  const intro = unique(paragraphs.slice(0, 2).map(normalizeSentence).filter(Boolean));

  const sentences = unique(
    paragraphs
      .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
      .map(normalizeSentence)
      .filter(Boolean),
  );

  return { intro, headings, bullets, sentences, images };
};

const pickTheme = (index: number) => themes[index % themes.length];

const pickHighlights = (ideas: ExtractedIdeas, limit: number) => {
  const merged = unique([
    ...ideas.bullets,
    ...ideas.headings,
    ...ideas.sentences,
  ]);
  return merged.slice(0, limit);
};

const buildBoardItems = ({
  title,
  subtitle,
  images,
  points,
}: {
  title: string;
  subtitle: string;
  images: string[];
  points: string[];
}): { boardItems: PromoBoardItem[]; arrows: PromoArrow[] } => {
  const notePoints = points.slice(0, 4);
  const imagePoints = images.slice(0, 4);

  const boardItems: PromoBoardItem[] = [
    {
      id: "title",
      kind: "title",
      x: 6,
      y: 7,
      w: 56,
      h: 18,
      rotate: -2,
      text: `${title}\n${subtitle}`,
      size: "lg",
    },
    {
      id: "note-1",
      kind: "note",
      x: 66,
      y: 10,
      w: 24,
      h: 16,
      rotate: 4,
      text: notePoints[0],
      size: "sm",
    },
    {
      id: "note-2",
      kind: "note",
      x: 9,
      y: 74,
      w: 25,
      h: 15,
      rotate: -5,
      text: notePoints[1],
      size: "sm",
    },
    {
      id: "note-3",
      kind: "note",
      x: 66,
      y: 72,
      w: 24,
      h: 16,
      rotate: 3,
      text: notePoints[2] ?? notePoints[0],
      size: "sm",
    },
  ];

  if (imagePoints[0]) {
    boardItems.push({
      id: "image-1",
      kind: "image",
      x: 9,
      y: 28,
      w: 37,
      h: 24,
      rotate: -4,
      imageUrl: imagePoints[0],
    });
  }

  if (imagePoints[1]) {
    boardItems.push({
      id: "image-2",
      kind: "image",
      x: 48,
      y: 33,
      w: 34,
      h: 20,
      rotate: 3,
      imageUrl: imagePoints[1],
    });
  }

  if (imagePoints[2]) {
    boardItems.push({
      id: "image-3",
      kind: "image",
      x: 30,
      y: 56,
      w: 31,
      h: 18,
      rotate: -2,
      imageUrl: imagePoints[2],
    });
  }

  if (imagePoints[3]) {
    boardItems.push({
      id: "image-4",
      kind: "image",
      x: 62,
      y: 52,
      w: 23,
      h: 14,
      rotate: 5,
      imageUrl: imagePoints[3],
    });
  }

  const arrows: PromoArrow[] = [
    { id: "arrow-1", fromX: 56, fromY: 21, toX: 71, toY: 18, bend: -8 },
    { id: "arrow-2", fromX: 34, fromY: 23, toX: 27, toY: 39, bend: 6 },
    { id: "arrow-3", fromX: 53, fromY: 50, toX: 43, toY: 64, bend: -10 },
    { id: "arrow-4", fromX: 74, fromY: 68, toX: 77, toY: 80, bend: 6 },
  ];

  return { boardItems, arrows };
};

export const buildAiPromoSlides = ({
  sourceType,
  sourceTitle,
  sourceContent,
  aiSlides,
}: {
  sourceType: "page" | "chapter";
  sourceTitle: string;
  sourceContent: string;
  aiSlides: AiPromoSlidePayload[];
}): PromoSlide[] => {
  const ideas = extractIdeasFromMarkdown(sourceContent);
  const fallbackHighlights = pickHighlights(ideas, 8);
  const images = ideas.images;

  return aiSlides.slice(0, 5).map((slide, index) => {
    const noteTexts = slide.boardNotes.filter(Boolean);
    const pointTexts = slide.bullets.filter(Boolean);
    const boardTitle =
      slide.boardTitle.trim() ||
      [slide.title.trim(), slide.subtitle.trim()].filter(Boolean).join("\n") ||
      sourceTitle;
    const rotatedImages = images.length > 0
      ? [...images.slice(index), ...images.slice(0, index)]
      : [];

    const board = buildBoardItems({
      title: boardTitle,
      subtitle: "",
      images: rotatedImages,
      points: [...noteTexts, ...pointTexts, ...fallbackHighlights].filter(Boolean),
    });

    return {
      id: slide.id || `${sourceType}-ai-${index + 1}`,
      badge:
        index === 0
          ? sourceType === "chapter"
            ? "Chapter teaser"
            : "Page teaser"
          : `Slide ${index + 1}`,
      title: slide.title.trim() || sourceTitle,
      subtitle: slide.subtitle.trim(),
      footer: slide.footer.trim() || "AI-generated promo board",
      bullets: pointTexts.slice(0, 5),
      theme: pickTheme(index),
      imageUrl: rotatedImages[0],
      layout: "board",
      boardItems: board.boardItems.map((item) => {
        if (item.id === "title") {
          return { ...item, text: boardTitle };
        }
        if (item.id === "note-1" && noteTexts[0]) {
          return { ...item, text: noteTexts[0] };
        }
        if (item.id === "note-2" && noteTexts[1]) {
          return { ...item, text: noteTexts[1] };
        }
        if (item.id === "note-3" && noteTexts[2]) {
          return { ...item, text: noteTexts[2] };
        }
        return item;
      }),
      arrows: board.arrows,
    };
  });
};

export const buildPagePromoSlides = ({
  pageTitle,
  markdown,
  chapterTitle,
}: {
  pageTitle: string;
  markdown: string;
  chapterTitle?: string;
}): PromoSlide[] => {
  const ideas = extractIdeasFromMarkdown(markdown);
  const highlights = pickHighlights(ideas, 6);
  const intro = ideas.intro[0] ?? highlights[0] ?? "Short, visual lesson with actionable takeaways.";

  return [
    {
      id: "page-cover",
      badge: chapterTitle ? `Page teaser • ${chapterTitle}` : "Page teaser",
      title: pageTitle,
      subtitle: intro,
      bullets: highlights.slice(0, 3),
      footer: "Vertical promo draft for mobile story / reel cover",
      theme: pickTheme(0),
      imageUrl: ideas.images[0],
      layout: "board",
      ...buildBoardItems({
        title: pageTitle,
        subtitle: intro,
        images: ideas.images,
        points: highlights,
      }),
    },
    {
      id: "page-ideas",
      badge: "Key ideas",
      title: "What this lesson gives the reader",
      subtitle: "",
      bullets: highlights.slice(0, 5),
      footer: `${highlights.length} ideas detected`,
      theme: pickTheme(1),
      imageUrl: ideas.images[1] ?? ideas.images[0],
      layout: "stack",
    },
  ].filter((slide) => slide.bullets.length > 0 || slide.id === "page-cover");
};

export const buildChapterPromoSlides = ({
  chapterTitle,
  pages,
}: {
  chapterTitle: string;
  pages: PromoPageSource[];
}): PromoSlide[] => {
  const nonEmptyPages = pages.filter((page) => page.markdown.trim().length > 0);
  const pageIdeas = nonEmptyPages.map((page) => ({
    page,
    ideas: extractIdeasFromMarkdown(page.markdown),
  }));

  const chapterHighlights = unique(
    pageIdeas.flatMap(({ ideas }) => pickHighlights(ideas, 2)),
  ).slice(0, 6);

  const pageTitles = nonEmptyPages.map((page) => page.title).slice(0, 5);
  const intro =
    pageIdeas.flatMap(({ ideas }) => ideas.intro)[0] ??
    chapterHighlights[0] ??
    "A structured lesson sequence distilled into a mobile promo format.";
  const chapterImages = unique(pageIdeas.flatMap(({ ideas }) => ideas.images));

  const result: PromoSlide[] = [
    {
      id: "chapter-cover",
      badge: "Chapter teaser",
      title: chapterTitle,
      subtitle: intro,
      bullets: pageTitles.slice(0, 3),
      footer: `${nonEmptyPages.length} pages turned into promo slides`,
      theme: pickTheme(0),
      imageUrl: chapterImages[0],
      layout: "board",
      ...buildBoardItems({
        title: chapterTitle,
        subtitle: intro,
        images: chapterImages,
        points: chapterHighlights.length > 0 ? chapterHighlights : pageTitles,
      }),
    },
    {
      id: "chapter-ideas",
      badge: "Core takeaways",
      title: "What this chapter teaches",
      subtitle: "",
      bullets: chapterHighlights.slice(0, 5),
      footer: `${chapterHighlights.length} reusable promo hooks`,
      theme: pickTheme(1),
      imageUrl: chapterImages[1] ?? chapterImages[0],
      layout: "stack",
    },
  ];

  const featuredPages = pageIdeas
    .map(({ page, ideas }) => ({
      page,
      points: pickHighlights(ideas, 2),
    }))
    .filter(({ points }) => points.length > 0)
    .slice(0, 3);

  featuredPages.forEach(({ page, points }, index) => {
    result.push({
      id: `chapter-page-${page.slug}`,
      badge: `Lesson ${index + 1}`,
      title: page.title,
      subtitle: points[0] ?? "Focused lesson point",
      bullets: points.slice(0, 3),
      footer: "Use as a carousel card or story continuation",
      theme: pickTheme(index + 2),
      imageUrl: ideas.images[0] ?? chapterImages[index],
      layout: "board",
      ...buildBoardItems({
        title: page.title,
        subtitle: points[0] ?? "Focused lesson point",
        images: ideas.images,
        points,
      }),
    });
  });

  return result;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const wrapText = (text: string, maxChars: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
};

const estimateBoardTextMetrics = (item: PromoBoardItem) => {
  const textLength = item.text?.trim().length ?? 0;
  const charsPerLine =
    item.kind === "title"
      ? Math.max(10, Math.floor(item.w * 1.45))
      : Math.max(12, Math.floor(item.w * 1.85));
  const lines = Math.max(1, Math.ceil(textLength / charsPerLine));
  return { textLength, lines };
};

const getBoardSvgTextStyle = (item: PromoBoardItem) => {
  const { textLength, lines } = estimateBoardTextMetrics(item);
  const area = item.w * item.h;

  if (item.kind === "title") {
    if (lines > 7 || area < 360) return { fontSize: 34, lineHeight: 1.08 };
    if (lines > 5 || textLength > 130) return { fontSize: 42, lineHeight: 1.08 };
    if (textLength > 84 || area < 520) return { fontSize: 50, lineHeight: 1.06 };
    return { fontSize: 62, lineHeight: 1.02 };
  }

  if (lines > 8 || area < 190) return { fontSize: 20, lineHeight: 1.16 };
  if (lines > 6 || textLength > 110) return { fontSize: 24, lineHeight: 1.18 };
  if (textLength > 78 || area < 250) return { fontSize: 28, lineHeight: 1.2 };
  return { fontSize: 32, lineHeight: 1.22 };
};

const buildTextBlock = ({
  lines,
  x,
  y,
  fontSize,
  lineHeight,
  fill,
  fontWeight = 500,
}: {
  lines: string[];
  x: number;
  y: number;
  fontSize: number;
  lineHeight: number;
  fill: string;
  fontWeight?: number;
}) => {
  if (lines.length === 0) return "";
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="${fontWeight}">${tspans}</text>`;
};

const buildWrappedTextBlock = ({
  text,
  x,
  y,
  width,
  height,
  fontSize,
  lineHeight,
  color,
  fontWeight,
  paddingX,
  paddingY,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  color: string;
  fontWeight: number;
  paddingX: number;
  paddingY: number;
}) => {
  const innerWidth = Math.max(1, width - paddingX * 2);
  const innerHeight = Math.max(1, height - paddingY * 2);
  const approxCharsPerLine = Math.max(6, Math.floor(innerWidth / (fontSize * 0.58)));
  const maxLines = Math.max(1, Math.floor(innerHeight / (fontSize * lineHeight)));
  const rawLines = text.split("\n").flatMap((line) => wrapText(line, approxCharsPerLine));
  const lines = rawLines.slice(0, maxLines);

  if (rawLines.length > maxLines && lines.length > 0) {
    const lastLine = lines[lines.length - 1] ?? "";
    lines[lines.length - 1] =
      lastLine.length > 1 ? `${lastLine.slice(0, Math.max(1, lastLine.length - 1)).trimEnd()}…` : "…";
  }

  if (lines.length === 0) return "";

  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : fontSize * lineHeight;
      return `<tspan x="${x + paddingX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x + paddingX}" y="${y + paddingY + fontSize}" fill="${color}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="${fontWeight}" xml:space="preserve">${tspans}</text>`;
};

const resolveImageSource = (imageUrl: string | undefined, embeddedImages?: Record<string, string>) => {
  if (!imageUrl) return "";
  return embeddedImages?.[imageUrl] ?? imageUrl;
};

const buildBoardSvg = (slide: PromoSlide, embeddedImages?: Record<string, string>) => {
  const items = slide.boardItems ?? [];
  const arrows = slide.arrows ?? [];

  const arrowsSvg = arrows
    .map((arrow) => {
      const startX = (arrow.fromX / 100) * SVG_WIDTH;
      const startY = (arrow.fromY / 100) * SVG_HEIGHT;
      const endX = (arrow.toX / 100) * SVG_WIDTH;
      const endY = (arrow.toY / 100) * SVG_HEIGHT;
      const controlX = (startX + endX) / 2 + (arrow.bend ?? 0) * 10;
      const controlY = (startY + endY) / 2 - (arrow.bend ?? 0) * 6;

      return `
        <path d="M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}" stroke="${slide.theme.accent}" stroke-width="8" fill="none" stroke-linecap="round" />
        <circle cx="${endX}" cy="${endY}" r="10" fill="${slide.theme.accent}" />
      `;
    })
    .join("");

  const itemsSvg = items
    .map((item) => {
      const x = (item.x / 100) * SVG_WIDTH;
      const y = (item.y / 100) * SVG_HEIGHT;
      const w = (item.w / 100) * SVG_WIDTH;
      const h = (item.h / 100) * SVG_HEIGHT;
      const rotate = item.rotate ?? 0;

      if (item.kind === "image" && item.imageUrl) {
        const imageSource = resolveImageSource(item.imageUrl, embeddedImages);
        return `
          <g transform="translate(${x + w / 2} ${y + h / 2}) rotate(${rotate}) translate(${-w / 2} ${-h / 2})">
            <rect x="0" y="0" width="${w}" height="${h}" rx="28" fill="#ffffff" />
            <image href="${escapeXml(imageSource)}" x="18" y="18" width="${w - 36}" height="${h - 36}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 18px)" />
            <rect x="0" y="0" width="${w}" height="${h}" rx="28" fill="none" stroke="rgba(47,36,31,0.12)" stroke-width="3" />
          </g>
        `;
      }

      const isTitle = item.kind === "title";
      const { fontSize, lineHeight } = getBoardSvgTextStyle(item);
      const paddingX = 28;
      const paddingY = isTitle ? 26 : 22;

      return `
        <g transform="translate(${x + w / 2} ${y + h / 2}) rotate(${rotate}) translate(${-w / 2} ${-h / 2})">
          <rect x="0" y="0" width="${w}" height="${h}" rx="${isTitle ? 42 : 30}" fill="${isTitle ? slide.theme.panel : "#fff6b8"}" />
          <rect x="0" y="0" width="${w}" height="${h}" rx="${isTitle ? 42 : 30}" fill="none" stroke="rgba(47,36,31,0.12)" stroke-width="3" />
          ${buildWrappedTextBlock({
            text: item.text ?? "",
            x: 0,
            y: 0,
            width: w,
            height: h,
            fontSize,
            lineHeight,
            color: slide.theme.text,
            fontWeight: isTitle ? 800 : 600,
            paddingX,
            paddingY,
          })}
        </g>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
      <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${slide.theme.background}" />
      <circle cx="920" cy="180" r="240" fill="${slide.theme.accentSoft}" opacity="0.65" />
      <circle cx="140" cy="1710" r="200" fill="${slide.theme.accentSoft}" opacity="0.55" />
      ${arrowsSvg}
      ${itemsSvg}
      <rect x="${SVG_PADDING_X}" y="1772" width="${SVG_WIDTH - SVG_PADDING_X * 2}" height="88" rx="32" fill="${slide.theme.panel}" opacity="0.94" />
      ${buildTextBlock({
        lines: wrapText(`${slide.badge} • ${slide.footer}`, 46).slice(0, 2),
        x: SVG_PADDING_X + 30,
        y: 1828,
        fontSize: 28,
        lineHeight: 34,
        fill: slide.theme.muted,
        fontWeight: 700,
      })}
    </svg>
  `.trim();
};

export const promoSlideToSvg = (slide: PromoSlide, embeddedImages?: Record<string, string>) => {
  if (slide.layout === "board") {
    return buildBoardSvg(slide, embeddedImages);
  }

  const titleLines = wrapText(slide.title, 18).slice(0, 4);
  const subtitleLines = wrapText(slide.subtitle, 34).slice(0, 4);
  const bulletLines = slide.bullets.slice(0, 5);
  const footerLines = wrapText(slide.footer, 38).slice(0, 2);

  const bulletSvg = bulletLines
    .map((bullet, index) => {
      const top = 760 + index * 170;
      const lines = wrapText(bullet, 28).slice(0, 3);
      return `
        <rect x="${SVG_PADDING_X}" y="${top}" width="${SVG_WIDTH - SVG_PADDING_X * 2}" height="132" rx="38" fill="${slide.theme.panel}" opacity="0.96" />
        <circle cx="${SVG_PADDING_X + 44}" cy="${top + 48}" r="12" fill="${slide.theme.accent}" />
        ${buildTextBlock({
          lines,
          x: SVG_PADDING_X + 80,
          y: top + 58,
          fontSize: 36,
          lineHeight: 42,
          fill: slide.theme.text,
          fontWeight: 600,
        })}
      `;
    })
    .join("");

  const coverImageSource = resolveImageSource(slide.imageUrl, embeddedImages);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
      <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${slide.theme.background}" />
      ${coverImageSource ? `<image href="${escapeXml(coverImageSource)}" x="0" y="0" width="${SVG_WIDTH}" height="820" preserveAspectRatio="xMidYMid slice" opacity="0.34" />` : ""}
      ${slide.imageUrl ? `<rect x="0" y="0" width="${SVG_WIDTH}" height="820" fill="${slide.theme.background}" opacity="0.38" />` : ""}
      <circle cx="940" cy="180" r="220" fill="${slide.theme.accentSoft}" opacity="0.75" />
      <circle cx="160" cy="1660" r="240" fill="${slide.theme.accentSoft}" opacity="0.55" />
      <rect x="${SVG_PADDING_X}" y="96" width="${SVG_WIDTH - SVG_PADDING_X * 2}" height="120" rx="60" fill="${slide.theme.panel}" opacity="0.98" />
      ${buildTextBlock({
        lines: wrapText(slide.badge.toUpperCase(), 28).slice(0, 2),
        x: SVG_PADDING_X + 38,
        y: 172,
        fontSize: 34,
        lineHeight: 36,
        fill: slide.theme.accent,
        fontWeight: 700,
      })}
      ${buildTextBlock({
        lines: titleLines,
        x: SVG_PADDING_X,
        y: 360,
        fontSize: 76,
        lineHeight: SVG_TITLE_LINE_HEIGHT,
        fill: slide.theme.text,
        fontWeight: 800,
      })}
      ${buildTextBlock({
        lines: subtitleLines,
        x: SVG_PADDING_X,
        y: 640,
        fontSize: 42,
        lineHeight: SVG_BODY_LINE_HEIGHT,
        fill: slide.theme.muted,
        fontWeight: 500,
      })}
      ${bulletSvg}
      <rect x="${SVG_PADDING_X}" y="1730" width="${SVG_WIDTH - SVG_PADDING_X * 2}" height="116" rx="42" fill="${slide.theme.panel}" opacity="0.92" />
      ${buildTextBlock({
        lines: footerLines,
        x: SVG_PADDING_X + 36,
        y: 1802,
        fontSize: 32,
        lineHeight: SVG_FOOTER_LINE_HEIGHT,
        fill: slide.theme.muted,
        fontWeight: 600,
      })}
    </svg>
  `.trim();
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image blob"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });

const collectSlideImageUrls = (slide: PromoSlide) => {
  const urls = new Set<string>();
  if (slide.imageUrl) {
    urls.add(slide.imageUrl);
  }
  slide.boardItems?.forEach((item) => {
    if (item.kind === "image" && item.imageUrl) {
      urls.add(item.imageUrl);
    }
  });
  return [...urls];
};

const embedSlideImages = async (slide: PromoSlide) => {
  const imageUrls = collectSlideImageUrls(slide);
  const entries = await Promise.all(
    imageUrls.map(async (imageUrl) => {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          return [imageUrl, imageUrl] as const;
        }
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        return [imageUrl, dataUrl] as const;
      } catch {
        return [imageUrl, imageUrl] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
};

export const downloadPromoSlideSvg = async (slide: PromoSlide, filename: string) => {
  const embeddedImages = await embedSlideImages(slide);
  const svg = promoSlideToSvg(slide, embeddedImages);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
