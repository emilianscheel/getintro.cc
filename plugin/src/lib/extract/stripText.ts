const SCRIPT_STYLE_REGEX = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
const TAG_REGEX = /<[^>]+>/g;
const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">"
};

export const stripHtmlToText = (html: string): string => {
  const withoutScripts = html.replace(SCRIPT_STYLE_REGEX, " ");
  const withoutTags = withoutScripts.replace(TAG_REGEX, " ");

  const decoded = Object.entries(ENTITY_MAP).reduce(
    (acc, [entity, replacement]) => acc.split(entity).join(replacement),
    withoutTags
  );

  return decoded.replace(/\s+/g, " ").trim();
};
