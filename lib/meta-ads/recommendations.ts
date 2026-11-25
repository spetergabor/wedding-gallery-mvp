import type { DetectedAnomaly, GeneratedRecommendation, PeriodComparison } from "@/lib/meta-ads/types";

export function generateRecommendations(
  comparison: PeriodComparison,
  anomalies: DetectedAnomaly[],
  targets: { costPerLead?: number | null; costPerBooking?: number | null } = {}
): GeneratedRecommendation[] {
  const { current, changes, reliability } = comparison;
  const recommendations: GeneratedRecommendation[] = [];
  const evidence = { window: comparison.label, current, changes, targetCostPerLead: targets.costPerLead ?? null };
  const has = (type: string) => anomalies.some((anomaly) => anomaly.anomalyType === type);

  if (reliability === "low") {
    recommendations.push({
      type: "INSUFFICIENT_DATA",
      title: "Még ne hozz nagy döntést",
      recommendation: "Tartsd stabilan a kampányt, amíg több kattintás és konverzió gyűlik.",
      rationale: "A jelenlegi minta túl kicsi; kis adaton a demográfiai és placement bontások félrevezetők lehetnek.",
      evidence,
      potentialImpact: "Elkerülhető a túl korai leállítás vagy indokolatlan költségemelés.",
      risk: "low",
      confidence: 0.94,
      reevaluateAfterHours: 24
    });
  }

  if (has("TRACKING_OR_LANDING_PAGE_GAP")) {
    recommendations.push({
      type: "TRACKING_FIX",
      title: "Mérés és céloldal ellenőrzése",
      recommendation: "Teszteld a pixel LPV/lead eseményét és a teljes mobil foglalási útvonalat.",
      rationale: "Kattintás van, de a tölcsér következő eseménye nem látszik.",
      evidence,
      potentialImpact: "Megbízhatóbb optimalizálás és a valódi hibák gyors felismerése.",
      risk: "low",
      confidence: 0.92,
      reevaluateAfterHours: 3
    });
  }

  if (has("CREATIVE_FATIGUE") || has("CTR_DECLINE")) {
    recommendations.push({
      type: "CREATIVE_REFRESH",
      title: "Új kreatív a meglévő kontroll mellé",
      recommendation: "Indíts egy világosan eltérő kreatívot azonos ajánlattal és mérd külön.",
      rationale: "A csökkenő CTR és/vagy magas frekvencia kreatívfáradást jelez.",
      evidence,
      potentialImpact: "Magasabb figyelem és olcsóbb minőségi forgalom.",
      risk: "medium",
      confidence: 0.8,
      reevaluateAfterHours: 48
    });
  }

  if ((current.ctr ?? 0) < 0.8 && current.impressions >= 2_000 && !has("CREATIVE_FATIGUE")) {
    recommendations.push({
      type: "CREATIVE_TEST",
      title: "Kreatívteszt indokolt",
      recommendation: "Tesztelj egy új vizuális nyitást és rövidebb, helyspecifikus üzenetet a kontroll mellett.",
      rationale: "A link CTR alacsony megfelelő megjelenésszám mellett.",
      evidence,
      potentialImpact: "Több releváns kattintás változatlan célzás mellett.",
      risk: "medium",
      confidence: 0.74,
      reevaluateAfterHours: 48
    });
  }

  if (current.linkClicks >= 20 && current.landingPageViews / current.linkClicks < 0.5) {
    recommendations.push({
      type: "LANDING_PAGE_REVIEW",
      title: "Céloldali veszteség vizsgálata",
      recommendation: "Ellenőrizd a mobil betöltési sebességet, a cél-URL-t és a foglalóhoz vezető út egyértelműségét.",
      rationale: "A linkkattintások kevesebb mint fele jelenik meg landing page view-ként.",
      evidence,
      potentialImpact: "Több foglalási esély ugyanabból a forgalomból.",
      risk: "low",
      confidence: 0.82,
      reevaluateAfterHours: 24
    });
  }

  if (changes.cpm !== null && changes.cpm >= 35 && (changes.ctr === null || changes.ctr > -10)) {
    recommendations.push({
      type: "AUDIENCE_TEST",
      title: "Közönség- vagy placementteszt mérlegelhető",
      recommendation: "Külön tesztben hasonlítsd össze a jelenlegi broad/Advantage+ beállítást egy üzletileg indokolt alternatívával.",
      rationale: "A CPM jelentősen nőtt, miközben a kreatív figyelemértéke nem romlott hasonló mértékben.",
      evidence,
      potentialImpact: "Olcsóbb releváns elérés a közönség indokolatlan beszűkítése nélkül.",
      risk: "medium",
      confidence: 0.62,
      reevaluateAfterHours: 72
    });
  }

  const targetMet = targets.costPerLead != null && current.costPerLead != null && current.costPerLead <= targets.costPerLead;
  if (targetMet && current.leads >= 3 && !has("CTR_DECLINE")) {
    recommendations.push({
      type: "SCALE",
      title: "Óvatos skálázás megfontolható",
      recommendation: "Legfeljebb 15–20%-kal emeld a napi keretet, majd várj legalább 48 órát az új értékeléssel.",
      rationale: "A CPL eléri az üzleti célértéket és több eredmény támasztja alá.",
      evidence,
      potentialImpact: "Több lead kontrollált hatékonyságromlási kockázattal.",
      risk: "medium",
      confidence: reliability === "high" ? 0.86 : 0.68,
      reevaluateAfterHours: 48
    });
  }

  if (targets.costPerLead != null && current.costPerLead != null && current.costPerLead > targets.costPerLead * 1.5 && current.leads >= 2) {
    recommendations.push({
      type: "REDUCE_BUDGET",
      title: "Keretszint felülvizsgálata",
      recommendation: "Csökkentsd mérsékelten a keretet, amíg a kreatív-, közönség- és céloldali okot tisztázod.",
      rationale: "A CPL legalább 50%-kal a beállított cél fölött van.",
      evidence,
      potentialImpact: "Kevesebb veszteséges költés a tesztek alatt.",
      risk: "medium",
      confidence: 0.78,
      reevaluateAfterHours: 24
    });
  }

  if (current.spend >= 50 && current.leads === 0 && reliability !== "low") {
    recommendations.push({
      type: "PAUSE_CANDIDATE",
      title: "Leállítási jelölt – emberi ellenőrzéssel",
      recommendation: "Ellenőrizd a mérés helyességét és az attribúciós késleltetést; csak ezután mérlegeld a leállítást.",
      rationale: "Érdemi költés történt lead nélkül, de a rendszer nem módosítja automatikusan a kampányt.",
      evidence,
      potentialImpact: "A további eredménytelen költés korlátozása.",
      risk: "high",
      confidence: 0.72,
      reevaluateAfterHours: 12
    });
  }

  if (!recommendations.length && current.spend > 0) {
    recommendations.push({
      type: "KEEP_RUNNING",
      title: "Tartsd stabilan",
      recommendation: "Ne változtass lényegesen; értékeld újra a következő teljes attribúciós ablak után.",
      rationale: "Nincs elég erős, megbízható jel beavatkozáshoz.",
      evidence,
      potentialImpact: "Tisztább tanulási adat és kisebb döntési zaj.",
      risk: "low",
      confidence: 0.75,
      reevaluateAfterHours: 24
    });
  }

  return recommendations;
}
