import { Children, isValidElement, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { VideoEmbed } from "./VideoEmbed";
import { XpStar } from "./XpStar";

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (href?: string, event?: React.MouseEvent<HTMLAnchorElement>) => boolean | void;
  pageSlug?: string;
}

export const MarkdownRenderer = ({ content, onLinkClick, pageSlug }: MarkdownRendererProps) => {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);

  const handleMarkdownImageClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const image = target?.closest("img[data-markdown-img]") as HTMLImageElement | null;
    if (!image) return;

    event.preventDefault();
    event.stopPropagation();
    setLightboxImage({ src: image.currentSrc || image.src, alt: image.alt });
  };

  const handleCloseLightbox = () => setLightboxImage(null);

  const shouldRenderParagraph = (children: ReactNode) =>
    !Children.toArray(children).some((child) => {
      if (!isValidElement(child) || typeof child.type !== "string") {
        return false;
      }

      return ["div", "video", "iframe", "img", "button"].includes(child.type);
    });

  return (
    <>
      <div onClickCapture={handleMarkdownImageClickCapture}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-3xl font-bold mb-4 text-foreground">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-2xl font-semibold mb-3 mt-6 text-foreground">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-xl font-semibold mb-2 mt-4 text-foreground">{children}</h3>
            ),
            p: ({ children }) =>
              shouldRenderParagraph(children) ? (
                <p className="mb-4 text-foreground leading-relaxed">{children}</p>
              ) : (
                <>{children}</>
              ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside mb-4 space-y-2 text-foreground">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside mb-4 space-y-2 text-foreground">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-foreground">{children}</li>
            ),
            code: ({
              inline,
              children,
              ...props
            }: {
              inline?: boolean;
              children?: ReactNode;
            } & ComponentPropsWithoutRef<"code">) =>
              inline ? (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
                  {children}
                </code>
              ) : (
                <code className="block bg-muted p-4 rounded-xl text-sm font-mono overflow-x-auto mb-4 text-foreground" {...props}>
                  {children}
                </code>
              ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
                {children}
              </blockquote>
            ),
            img: ({ src, alt, title, ...rest }) => {
              if (!src) return null;

              const widthMatch = typeof title === "string" ? title.match(/w=(\d+)/) : null;
              const alignMatch = typeof title === "string" ? title.match(/align=(\w+)/i) : null;

              const width = widthMatch ? `${widthMatch[1]}px` : "100%";
              const align = alignMatch ? alignMatch[1].toLowerCase() : undefined;

              const alignmentStyles =
                align === "center"
                  ? { display: "block", marginLeft: "auto", marginRight: "auto" }
                  : align === "left"
                  ? { display: "block", marginRight: "auto" }
                  : align === "right"
                  ? { display: "block", marginLeft: "auto" }
                  : undefined;

              const wrapperStyle = {
                width,
                ...alignmentStyles,
              };

              const handleImageClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                setLightboxImage({ src, alt });
              };

              return (
                <button
                  type="button"
                  onClick={handleImageClick}
                  style={wrapperStyle}
                  className="group relative block cursor-zoom-in overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <img
                    src={src}
                    alt={alt}
                    data-markdown-img
                    className="w-full rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                    style={{ height: "auto" }}
                    {...rest}
                  />
                  <span className="pointer-events-none absolute inset-0 rounded-xl border border-border/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </button>
              );
            },
            iframe: ({ className, height, width, ...props }) => {
              const computedHeight =
                typeof height === "number" ? height : height ? Number(height) || height : 600;

              return (
                <div className="my-6 overflow-hidden rounded-xl">
                  <iframe
                    {...props}
                    width="100%"
                    height={computedHeight}
                    className={`w-full ${className ?? ""}`}
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              );
            },
            ["xp-star"]: (props) => <XpStar {...props} pageSlug={pageSlug} />,
            a: (props) => <VideoEmbed onLinkClick={onLinkClick} {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {lightboxImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={handleCloseLightbox}
          role="presentation"
        >
          <img
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl cursor-zoom-out"
            onClick={(event) => {
              event.stopPropagation();
              handleCloseLightbox();
            }}
          />
        </div>
      ) : null}
    </>
  );
};
