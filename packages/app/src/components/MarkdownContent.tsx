import type { ComponentProps, MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePlatform } from "../platform/PlatformContext";

function isLocalFileHref(href: string) {
  const value = href.trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  if (value.startsWith("mailto:") || value.startsWith("tel:")) return false;
  if (value.startsWith("#")) return false;

  return true;
}

function decodeFileHref(href: string) {
  if (!href.startsWith("file://")) return href;
  return decodeURIComponent(href.slice("file://".length));
}

function resolveLocalFileHref(href: string, basePath?: string) {
  if (href.startsWith("file://")) return decodeFileHref(href);
  if (!basePath) return href;
  return decodeURIComponent(new URL(href, `file://${basePath.replace(/\/?$/, "/")}`).pathname);
}

function MarkdownLink({
  children,
  href,
  onClick,
  basePath,
  ...props
}: ComponentProps<"a"> & { href?: string; basePath?: string }) {
  const platform = usePlatform();
  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !href || !isLocalFileHref(href)) return;
    event.preventDefault();
    const filePath = resolveLocalFileHref(href, basePath);
    await platform.openPath(filePath);
  };

  return (
    <a {...props} href={href} target="_blank" rel="noreferrer" onClick={handleClick}>
      {children}
    </a>
  );
}

export function MarkdownContent({ children, basePath }: { children: string; basePath?: string }) {
  const components = {
    a: (props: ComponentProps<"a"> & { href?: string }) => (
      <MarkdownLink {...props} basePath={basePath} />
    ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
