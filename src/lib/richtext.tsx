import { Fragment, useRef, type ReactNode } from "react";

/**
 * Texte enrichi CDS.
 *
 * Le contenu est stocké dans une syntaxe simple (proche du Markdown) et rendu
 * en éléments React : aucun HTML brut n'est jamais injecté, donc aucune
 * injection de code n'est possible.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function safeHref(url: string) {
  const clean = url.trim();
  return /^(https?:\/\/|\/|mailto:)/i.test(clean) ? clean : null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((chunk, index) => {
      const key = `${keyPrefix}-${index}`;
      if (chunk.startsWith("**") && chunk.endsWith("**")) {
        return <strong key={key}>{chunk.slice(2, -2)}</strong>;
      }
      if (chunk.startsWith("*") && chunk.endsWith("*")) {
        return <em key={key}>{chunk.slice(1, -1)}</em>;
      }
      if (chunk.startsWith("`") && chunk.endsWith("`")) {
        return (
          <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-foreground">
            {chunk.slice(1, -1)}
          </code>
        );
      }
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(chunk);
      if (link) {
        const href = safeHref(link[2] ?? "");
        if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
        const external = href.startsWith("http");
        return (
          <a
            key={key}
            href={href}
            title={`Ouvrir : ${link[1]}`}
            {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
            className="text-primary-text underline underline-offset-2"
          >
            {link[1]}
          </a>
        );
      }
      return <Fragment key={key}>{chunk}</Fragment>;
    });
}

/** Affiche un contenu enrichi en toute sécurité. */
export function RichText({ value, className }: { value: string; className?: string }) {
  const lines = (value ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    blocks.push(
      <p key={`p-${blocks.length}`} className="mt-3 first:mt-0">
        {renderInline(text, `p${blocks.length}`)}
      </p>,
    );
    paragraph = [];
  }
  function flushList() {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="mt-3 list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item, `li${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  }
  function flushQuote() {
    if (quote.length === 0) return;
    const text = quote.join(" ");
    blocks.push(
      <blockquote
        key={`q-${blocks.length}`}
        className="mt-3 border-l-4 border-border pl-4 italic text-muted-foreground"
      >
        {renderInline(text, `q${blocks.length}`)}
      </blockquote>,
    );
    quote = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code === null) {
        flushParagraph();
        flushList();
        flushQuote();
        code = [];
      } else {
        blocks.push(
          <pre
            key={`code-${blocks.length}`}
            className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs text-foreground"
          >
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
      }
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      flushQuote();
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^\s*>\s?/, ""));
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  if (code !== null && code.length > 0) {
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs text-foreground"
      >
        <code>{code.join("\n")}</code>
      </pre>,
    );
  }
  flushParagraph();
  flushList();
  flushQuote();

  return <div className={className}>{blocks}</div>;
}

/** Version texte brut, utile pour les résumés et les métadonnées. */
export function richTextToPlain(value: string) {
  return (value ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[*`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TOOLS = [
  {
    label: "Gras",
    title: "Mettre le texte sélectionné en gras",
    wrap: ["**", "**"],
    sample: "texte",
  },
  {
    label: "Italique",
    title: "Mettre le texte sélectionné en italique",
    wrap: ["*", "*"],
    sample: "texte",
  },
  { label: "Lien", title: "Insérer un lien", wrap: ["[", "](https://)"], sample: "libellé" },
  { label: "Liste", title: "Insérer une liste à puces", wrap: ["\n- ", ""], sample: "élément" },
  { label: "Citation", title: "Insérer une citation", wrap: ["\n> ", ""], sample: "citation" },
  { label: "Code", title: "Insérer un bloc de code", wrap: ["\n```\n", "\n```\n"], sample: "code" },
] as const;

/** Zone de saisie avec barre d'outils de mise en forme. */
export function RichTextEditor({
  id,
  name,
  rows = 6,
  required,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(before: string, after: string, sample: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end) || sample;
    const next = `${el.value.slice(0, start)}${before}${selected}${after}${el.value.slice(end)}`;
    el.value = next;
    el.focus();
    const caret = start + before.length + selected.length;
    el.setSelectionRange(caret, caret);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div
        className="flex flex-wrap gap-1 border-b border-border p-1.5"
        role="group"
        aria-label="Mise en forme"
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.title}
            onClick={() => apply(tool.wrap[0], tool.wrap[1], tool.sample)}
            className="min-h-11 rounded px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:min-h-0"
          >
            {tool.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full resize-y rounded-b-lg bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
