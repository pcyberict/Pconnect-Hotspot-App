import { useEffect } from "react";
import { api, useQuery } from "@/lib/pconnect-api.ts";

const INSERTED_CODE_ATTR = "data-pconnect-custom-code";

function insertCode(anchor: Comment, code: string) {
  if (!code.trim()) return [];

  const template = document.createElement("template");
  template.innerHTML = code;
  const scripts = Array.from(template.content.querySelectorAll("script"));

  // Scripts added through innerHTML do not execute. Recreate them as real
  // script elements while preserving their attributes and inline contents.
  for (const script of scripts) {
    const replacement = document.createElement("script");
    for (const attribute of Array.from(script.attributes)) {
      replacement.setAttribute(attribute.name, attribute.value);
    }
    replacement.textContent = script.textContent;
    script.replaceWith(replacement);
  }

  const inserted: Node[] = [];
  while (template.content.firstChild) {
    const node = template.content.firstChild;
    inserted.push(node);
    anchor.parentNode?.insertBefore(node, anchor);
  }
  return inserted;
}

export default function CustomCodeInjector() {
  const settings = useQuery<Record<string, string>>(api.siteSettings.getAll, {});

  useEffect(() => {
    if (!settings) return;

    const headerAnchor = document.createComment("Pconnect header custom code");
    const bodyAnchor = document.createComment("Pconnect body custom code");
    const footerAnchor = document.createComment("Pconnect footer custom code");
    headerAnchor.nodeValue = INSERTED_CODE_ATTR;
    bodyAnchor.nodeValue = INSERTED_CODE_ATTR;
    footerAnchor.nodeValue = INSERTED_CODE_ATTR;

    document.head.appendChild(headerAnchor);
    document.body.append(bodyAnchor, footerAnchor);

    const inserted = [
      ...insertCode(headerAnchor, settings.custom_header_code ?? ""),
      ...insertCode(bodyAnchor, settings.custom_body_code ?? ""),
      ...insertCode(footerAnchor, settings.custom_footer_code ?? ""),
    ];
    inserted.forEach((node) => {
      if (node instanceof HTMLElement) node.setAttribute(INSERTED_CODE_ATTR, "");
    });

    return () => {
      inserted.forEach((node) => node.parentNode?.removeChild(node));
      headerAnchor.remove();
      bodyAnchor.remove();
      footerAnchor.remove();
    };
  }, [settings]);

  return null;
}