import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isFeatureOn } from "@/config/features";

type Campaign = {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string;
  alt_text: string;
  advertiser: string;
  type: string;
};

/**
 * Emplacement publicitaire.
 * N'affiche rien si la régie est éteinte ou si aucune campagne n'est active :
 * jamais de cadre vide dans la page.
 */
export function AdSlot({ placement, className }: { placement: string; className?: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (!isFeatureOn("adNetwork")) return;
    let cancelled = false;

    async function load() {
      const now = new Date().toISOString();
      const { data: slot } = await supabase
        .from("ad_placements")
        .select("id")
        .eq("slug", placement)
        .eq("active", true)
        .maybeSingle();
      if (!slot || cancelled) return;
      const { data: campaigns } = await supabase
        .from("ad_campaigns")
        .select("id, title, image_url, link_url, alt_text, advertiser, type, starts_at, ends_at")
        .eq("placement_id", slot.id)
        .eq("active", true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .limit(20);
      const eligible = (campaigns ?? []).filter(
        (item) => !item.ends_at || new Date(item.ends_at).getTime() >= Date.now(),
      );
      if (cancelled || eligible.length === 0) return;
      const picked = eligible[Math.floor(Math.random() * eligible.length)]!;
      setCampaign(picked);
      void supabase.from("ad_events").insert({
        campaign_id: picked.id,
        event_type: "impression",
        page_path: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 250),
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (!isFeatureOn("adNetwork") || !campaign) return null;

  function trackClick() {
    if (!campaign) return;
    void supabase.from("ad_events").insert({
      campaign_id: campaign.id,
      event_type: "click",
      page_path: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 250),
    });
  }

  const external = /^https?:\/\//i.test(campaign.link_url);

  return (
    <aside className={`rounded-xl border border-border bg-card p-3 ${className ?? ""}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {campaign.type === "cross-promo" ? "À découvrir" : "Publicité"}
      </p>
      <a
        href={campaign.link_url}
        onClick={trackClick}
        title={`Ouvrir : ${campaign.title}`}
        {...(external ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {})}
        className="mt-2 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {campaign.image_url ? (
          <img
            src={campaign.image_url}
            alt={campaign.alt_text || campaign.title}
            loading="lazy"
            className="w-full rounded-lg border border-border"
          />
        ) : null}
        <span className="mt-2 block text-sm font-medium text-primary-text underline-offset-2 hover:underline">
          {campaign.title}
        </span>
      </a>
      <p className="mt-1 text-xs text-muted-foreground">{campaign.advertiser}</p>
    </aside>
  );
}
