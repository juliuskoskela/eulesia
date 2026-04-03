import DOMPurify from "dompurify";

const ALLOWED_IFRAME_HOSTS = ["www.youtube-nocookie.com", "www.youtube.com"];

// Hook: only allow YouTube iframes, remove all others
DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "iframe") {
    const el = node as Element;
    const src = el.getAttribute("src") || "";
    try {
      const url = new URL(src);
      if (!ALLOWED_IFRAME_HOSTS.includes(url.hostname)) {
        el.remove();
      }
    } catch {
      el.remove();
    }
  }
});

export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "loading",
      "referrerpolicy",
      "data-url",
    ],
  });
}
