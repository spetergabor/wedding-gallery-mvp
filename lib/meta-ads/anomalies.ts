import type { DetectedAnomaly, PeriodComparison } from "@/lib/meta-ads/types";

function changed(value: number | null, threshold: number) {
  return value !== null && value >= threshold;
}

export function detectAnomalies(comparison: PeriodComparison): DetectedAnomaly[] {
  const { current, previous, changes, reliability } = comparison;
  const anomalies: DetectedAnomaly[] = [];
  const evidence = { window: comparison.label, current, previous, changes, notes: comparison.notes };
  const add = (anomaly: Omit<DetectedAnomaly, "dataReliability" | "evidence">) => {
    anomalies.push({ ...anomaly, evidence, dataReliability: reliability });
  };

  if (current.spend > 0 && current.landingPageViews === 0 && current.linkClicks >= 10) {
    add({
      anomalyType: "TRACKING_OR_LANDING_PAGE_GAP",
      severity: "CRITICAL",
      title: "Kattintások vannak, landing page view nincs",
      possibleCause: "Hibás pixel/esemény, lassú vagy nem betöltődő céloldal, illetve hibás cél-URL lehetséges.",
      recommendedAction: "Ellenőrizd mobilon a céloldalt és az LPV eseményt; a hirdetést ne skálázd a mérés tisztázásáig.",
      confidence: current.linkClicks >= 30 ? 0.92 : 0.76
    });
  }

  if (current.spend >= 25 && current.leads === 0 && reliability !== "low") {
    add({
      anomalyType: "SPEND_WITHOUT_LEADS",
      severity: "WARNING",
      title: "Érdemi költés lead nélkül",
      possibleCause: "Kreatív-, ajánlat-, céloldal- vagy mérési probléma állhat a háttérben.",
      recommendedAction: "Vizsgáld meg a CTR → LPV → lead tölcsért, mielőtt költségvetést emelnél.",
      confidence: 0.78
    });
  }

  if (changed(changes.spend, 50) && !changed(changes.leads, 20)) {
    add({
      anomalyType: "SPEND_SPIKE",
      severity: "WARNING",
      title: "A költés gyorsabban nő, mint az eredmények",
      possibleCause: "Költségemelés, dráguló aukció vagy romló konverziós hatékonyság.",
      recommendedAction: "Tartsd vagy csökkentsd a keretet, és nézd meg a CPM, CTR és CPL változását.",
      confidence: reliability === "high" ? 0.88 : 0.68
    });
  }

  if (changed(changes.costPerLead, 35) && current.leads >= 2) {
    add({
      anomalyType: "CPL_INCREASE",
      severity: "WARNING",
      title: "Jelentősen emelkedett a lead költsége",
      possibleCause: "Kreatívfáradás, rosszabb forgalom, aukciós drágulás vagy céloldali visszaesés.",
      recommendedAction: "Bonts placementre és kreatívra, majd a gyenge elemet frissítsd vagy teszteld.",
      confidence: reliability === "high" ? 0.9 : 0.7
    });
  }

  if (changes.leads !== null && changes.leads <= -50 && previous.leads >= 3) {
    add({
      anomalyType: "CONVERSION_DROP",
      severity: "WARNING",
      title: "Hirtelen visszaesett a konverziók száma",
      possibleCause: "Attribúciós késleltetés, mérési hiba, gyengébb forgalom vagy ajánlati probléma.",
      recommendedAction: "Először ellenőrizd az attribúciós késleltetést és a mérési láncot, majd bontsd kreatívra és placementre.",
      confidence: reliability === "high" ? 0.86 : 0.64
    });
  }

  if (changes.ctr !== null && changes.ctr <= -30 && current.impressions >= 2_000) {
    add({
      anomalyType: "CTR_DECLINE",
      severity: "WARNING",
      title: "Visszaesett a link CTR",
      possibleCause: "Kreatívfáradás, gyenge üzenet vagy kevésbé releváns közönség.",
      recommendedAction: "Indíts új kreatívtesztet, de a működő kontrollt hagyd futni.",
      confidence: reliability === "high" ? 0.86 : 0.66
    });
  }

  if (changed(changes.cpm, 35) && current.impressions >= 2_000) {
    add({
      anomalyType: "CPM_INCREASE",
      severity: "INFO",
      title: "Drágult az elérés",
      possibleCause: "Aukciós verseny, szezonalitás vagy szűk közönség.",
      recommendedAction: "Ellenőrizd a placement és földrajzi bontást; kis mintán ne szűkíts automatikusan.",
      confidence: 0.65
    });
  }

  if ((current.frequency ?? 0) >= 3.5 && changes.ctr !== null && changes.ctr <= -20) {
    add({
      anomalyType: "CREATIVE_FATIGUE",
      severity: "WARNING",
      title: "Kreatívfáradás valószínű",
      possibleCause: "Magas frekvencia mellett csökkenő CTR.",
      recommendedAction: "Adj új kreatívot az ad sethez; ne cseréld le vakon a még konvertáló kontrollt.",
      confidence: 0.82
    });
  }

  if (current.leads >= 3 && changes.costPerLead !== null && changes.costPerLead <= -25) {
    add({
      anomalyType: "EFFICIENCY_IMPROVEMENT",
      severity: "OPPORTUNITY",
      title: "Javult a leadhatékonyság",
      possibleCause: "Erősebb kreatív, jobb közönség-illeszkedés vagy kedvezőbb aukció.",
      recommendedAction: "Ha az üzleti célérték is teljesül, óvatos, lépcsőzetes skálázás mérlegelhető.",
      confidence: reliability === "high" ? 0.88 : 0.68
    });
  }

  if (reliability === "low") {
    add({
      anomalyType: "LOW_DATA_VOLUME",
      severity: "INFO",
      title: "Kevés adat a megbízható döntéshez",
      possibleCause: "Rövid futás, alacsony költés vagy hiányos időszak.",
      recommendedAction: "Gyűjts további adatot, és kerüld a nagy költség- vagy célzásmódosítást.",
      confidence: 0.95
    });
  }

  return anomalies;
}
