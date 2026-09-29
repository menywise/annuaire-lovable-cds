import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RichText } from "@/lib/richtext";
import {
  isSectionType,
  items,
  safeHref,
  safeImage,
  str,
  type PageData,
  type SectionType,
} from "@/lib/pages";

/**
 * CDS — Rendu public des pages libres. Une section inconnue ou mal remplie est ignorée :
 * jamais de page blanche. Aucun HTML brut n'est injecté (texte enrichi rendu en React).
 */

type P = Record<string, unknown>;

function Cta({
  label,
  href,
  variant = "default",
}: {
  label: string;
  href: string;
  variant?: "default" | "outline";
}) {
  const safe = safeHref(href);
  if (!label.trim() || !safe) return null;
  const external = /^https:\/\//i.test(safe);
  return (
    <Button asChild variant={variant} className="min-h-11">
      <a href={safe} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
        {label}
      </a>
    </Button>
  );
}

function Img({ src, alt, className }: { src: string; alt: string; className: string }) {
  const safe = safeImage(src);
  if (!safe) return null;
  return <img src={safe} alt={alt} loading="lazy" className={className} />;
}

function Hero({ p, first }: { p: P; first: boolean }) {
  const Title = first ? "h1" : "h2";
  const image = safeImage(str(p, "image"));
  return (
    <section className={`grid items-center gap-8 ${image ? "md:grid-cols-2" : ""}`}>
      <div>
        {str(p, "eyebrow") ? (
          <p className="text-xs font-medium uppercase tracking-wide text-primary-text">
            {str(p, "eyebrow")}
          </p>
        ) : null}
        <Title className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          {str(p, "title")}
        </Title>
        {str(p, "subtitle") ? (
          <p className="mt-4 max-w-[640px] text-base text-muted-foreground">{str(p, "subtitle")}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Cta label={str(p, "ctaLabel")} href={str(p, "ctaHref")} />
          <Cta label={str(p, "secondaryLabel")} href={str(p, "secondaryHref")} variant="outline" />
        </div>
      </div>
      {image ? (
        <Img
          src={image}
          alt={str(p, "imageAlt")}
          className="aspect-[4/3] w-full rounded-xl border border-border bg-muted object-cover"
        />
      ) : null}
    </section>
  );
}

function SectionTitle({ text, first }: { text: string; first: boolean }) {
  if (!text) return null;
  const Title = first ? "h1" : "h2";
  return <Title className="text-2xl font-semibold text-foreground">{text}</Title>;
}

function Text({ p, first }: { p: P; first: boolean }) {
  return (
    <section className="max-w-[760px]">
      <SectionTitle text={str(p, "title")} first={first} />
      {str(p, "body") ? <RichText value={str(p, "body")} className="mt-3" /> : null}
    </section>
  );
}

function ImageText({ p, first }: { p: P; first: boolean }) {
  const right = str(p, "imageSide") === "right";
  const image = safeImage(str(p, "image"));
  return (
    <section className={`grid items-center gap-8 ${image ? "md:grid-cols-2" : ""}`}>
      {image ? (
        <Img
          src={image}
          alt={str(p, "imageAlt")}
          className={`aspect-[4/3] w-full rounded-xl border border-border bg-muted object-cover ${right ? "md:order-2" : ""}`}
        />
      ) : null}
      <div>
        <SectionTitle text={str(p, "title")} first={first} />
        {str(p, "body") ? <RichText value={str(p, "body")} className="mt-3" /> : null}
        <div className="mt-5">
          <Cta label={str(p, "ctaLabel")} href={str(p, "ctaHref")} />
        </div>
      </div>
    </section>
  );
}

function Features({ p, first }: { p: P; first: boolean }) {
  const list = items(p, "items").filter((item) => str(item, "title") || str(item, "text"));
  return (
    <section>
      <SectionTitle text={str(p, "title")} first={first} />
      {str(p, "intro") ? (
        <p className="mt-2 max-w-[680px] text-sm text-muted-foreground">{str(p, "intro")}</p>
      ) : null}
      {list.length ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item, index) => (
            <li
              key={index}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card-tactile)]"
            >
              <h3 className="text-base font-semibold text-foreground">{str(item, "title")}</h3>
              {str(item, "text") ? (
                <p className="mt-2 text-sm text-muted-foreground">{str(item, "text")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ImageOnly({ p }: { p: P }) {
  const image = safeImage(str(p, "image"));
  if (!image) return null;
  return (
    <figure>
      <Img
        src={image}
        alt={str(p, "imageAlt")}
        className="w-full rounded-xl border border-border bg-muted object-cover"
      />
      {str(p, "caption") ? (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {str(p, "caption")}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Faq({ p, first }: { p: P; first: boolean }) {
  const list = items(p, "items").filter((item) => str(item, "question") && str(item, "answer"));
  if (!list.length) return null;
  return (
    <section className="max-w-[760px]">
      <SectionTitle text={str(p, "title")} first={first} />
      <Accordion type="multiple" className="mt-4 rounded-xl border border-border bg-card px-5">
        {list.map((item, index) => (
          <AccordionItem key={index} value={`q-${index}`}>
            <AccordionTrigger className="min-h-11 text-left">
              {str(item, "question")}
            </AccordionTrigger>
            <AccordionContent>
              <RichText value={str(item, "answer")} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function CallToAction({ p, first }: { p: P; first: boolean }) {
  return (
    <section className="rounded-xl border border-primary/30 bg-accent p-8 text-center">
      <SectionTitle text={str(p, "title")} first={first} />
      {str(p, "text") ? (
        <p className="mx-auto mt-3 max-w-[600px] text-sm text-muted-foreground">{str(p, "text")}</p>
      ) : null}
      <div className="mt-5 flex justify-center">
        <Cta label={str(p, "ctaLabel")} href={str(p, "ctaHref")} />
      </div>
    </section>
  );
}

const RENDERERS: Record<SectionType, (args: { p: P; first: boolean }) => React.ReactNode> = {
  Hero,
  Text,
  ImageText,
  Features,
  Image: ImageOnly,
  Faq,
  CallToAction,
};

/** Rend les sections d'une page. `titleFallback` : titre principal si aucune section n'en porte. */
export function PageRender({ data, titleFallback }: { data: PageData; titleFallback?: string }) {
  const sections = data.content.filter((s) => isSectionType(s.type));
  const firstHasTitle =
    !!sections[0] && (sections[0].type === "Hero" || !!str(sections[0].props, "title"));
  return (
    <div className="space-y-14">
      {titleFallback && !firstHasTitle ? (
        <h1 className="text-3xl font-bold text-foreground">{titleFallback}</h1>
      ) : null}
      {sections.map((section, index) => {
        const Render = RENDERERS[section.type as SectionType];
        return (
          <div key={section.props.id}>
            <Render p={section.props} first={index === 0 && firstHasTitle} />
          </div>
        );
      })}
    </div>
  );
}
