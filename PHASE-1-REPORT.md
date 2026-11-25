# SPETER & IRISMOMENT Meta Ads Intelligence Platform

## Phase 1 – átadási jelentés

Készült: 2026. november 25.

## 1. Kiindulási projektállapot

A munkakönyvtárban nem volt alkalmazáskód. A felhasználó tartós Spetly projektjeként a GitHubhoz és Vercelhez kapcsolt `spetly-app` repó került azonosításra és továbbfejlesztésre.

Technológiai alap:

- Next.js 15 / React 19 / TypeScript.
- Prisma 6 és PostgreSQL.
- Trigger.dev 4 az állandó háttérfeladatokhoz.
- Vercel alkalmazás-futtatás.
- Meglévő adminhitelesítés, CRM, mini-session/foglalási modulok, galériák és számlázási funkciók.

Kiinduláskor nem volt Meta Graph API-integráció, Meta-adatmodell, történeti Meta-adattár, Meta-szinkron, anomália- vagy ajánlási motor és Meta-dashboard API. A forrásban Meta-token vagy hirdetési fiókazonosító nem volt tárolva.

## 2. Meglévő, megőrzött funkciók

A jelenlegi CRM-, foglalási-, galéria-, e-mail-, számlázási és Trigger.dev-funkciókat nem építettem át. Az új rendszer izolált `lib/meta-ads` domainként és külön `/api/meta-ads` route-okként illeszkedik hozzájuk. A meglévő PostgreSQL-t és Trigger.dev-infrastruktúrát használja, ezért nem került be új adatbázis, queue vagy külső szolgáltatás.

## 3. Implementált új funkciók

- Kizárólag olvasási Meta Graph API-kliens.
- Account, campaign, ad set, ad és creative metaadatok lapozott beolvasása.
- Napi account/campaign/ad set/ad insight-gyűjtés.
- Spend, reach, impressions, frequency, CPM, link/outbound click, CTR, CPC, LPV, lead, purchase, cost per result és videómetrikák kezelése.
- Explicit SPETER/IRISMOMENT account mapping.
- 90 napos automatikus első backfill és hét napos gördülő újraolvasás.
- Idempotens napi upsert és változásalapú entity snapshot.
- 1/3/7/14/30/90 napos, előző azonos időszakos és lifetime elemzés.
- Deduplikált anomáliák és visszakövethető, magyarázható ajánlások.
- Márkánkénti üzleti konfiguráció ismeretlen értékek kitalálása nélkül.
- Trigger.dev manuális, háromórás, napi, heti és havi feladatok.
- Adatbázis-lock, retry, timeout, rate-limit és token-expiration kezelés.
- Védett, dashboardra kész API-k.
- Üzemeltetési health/last sync/next execution adatok.

## 4. Architektúra

Adatfolyam:

1. A Trigger.dev vagy egy super-admin manuális kérés elindítja a pipeline-t.
2. A GET-only Graph kliens beolvassa a leképezett accountokat és azok objektumait.
3. A Prisma repository idempotensen frissíti az aktuális objektumokat, napi insightokat és változási snapshotokat.
4. Az analitikai motor az összesített alapadatokból újraszámolja az arányokat.
5. Az anomáliamotor deduplikált riasztásokat ír.
6. Az ajánlási motor ember által értékelhető, végrehajtást nem végző javaslatokat ír.
7. A védett API-k kiszolgálják a következő fázis dashboardját.

## 5. Új és módosított fájlok

Főbb új területek:

- `lib/meta-ads/`: kliens, collector, normalizálás, repository, sync, analytics, anomáliák, ajánlások, pipeline, dashboard és biztonsági segédek.
- `lib/meta-ads/__tests__/`: célzott regressziós tesztek.
- `app/api/meta-ads/`: overview, brand, campaign, creative, trend, alert, recommendation, report, monitoring, config és manuális sync route-ok.
- `trigger/meta-ads-intelligence.ts`: öt Trigger.dev task.
- `prisma/migrations/20261125090000_add_meta_ads_intelligence/`: adatbázis-migráció.
- `docs/meta-ads-intelligence.md`: élesítési és üzemeltetési útmutató.

Módosult a Prisma séma, `.env.example`, `package.json` és `AGENTS.md`.

## 6. Adatbázis-struktúra

Új táblák:

- `MetaAdAccount`, `MetaCampaign`, `MetaAdSet`, `MetaAd`, `MetaCreative`.
- `MetaDailyInsight`: napi, attribúciós beállítással kulcsolt teljesítményadatok és metrika-státuszok.
- `MetaEntitySnapshot`: állapot-, budget- és creative-változások története.
- `MetaSyncRun`, `MetaJobLock`: futási napló, retry és párhuzamos futás elleni védelem.
- `MetaAlert`, `MetaRecommendation`: deduplikált döntési objektumok.
- `MetaBusinessConfig`: külön SPETER és IRISMOMENT üzleti célértékek.

A napi insight egyedi kulcsa megakadályozza a duplikációt. Az utolsó hét nap újraolvasása utólag beérkező konverziókat frissít, nem duplikál.

## 7. Valódi adatokkal végzett tesztek

Ebben a fejlesztői környezetben a `META_ADS_ACCESS_TOKEN`, `META_AD_ACCOUNT_MAPPINGS_JSON`, `DATABASE_URL` és `TRIGGER_SECRET_KEY` nem volt konfigurálva. Ezért valódi Meta Graph API-adatot nem importáltam, és nem állítom, hogy a háttérmonitorozás már él.

Az Ads Managerhez korábban rendelkezésre álló böngészős hozzáférést csak emberi, olvasási kontextusként kezeltük; nem helyettesíti a reprodukálható API-validációt. Éles validációhoz a production változók, migráció és Trigger-deploy szükséges.

## 8. Jelenlegi kampányok első elemzése

A rendelkezésre álló emberi megfigyelések szerint:

- Kremsben a helyek nagy része elfogyott, és az Instagram placement teljesített jobban.
- Liezenben a kampány gyengébben indult, de érkezett valós foglalás; a régi forgalmi kampány leállt, és új 4:5 kreatív került a konverziós kampány mellé, 9:16 videóval.
- Riednél a korábban előkészített konverziós kampány aktív, és a régi forgalmi kampány leváltása volt a stratégia.

Ezek nem API-ból ellenőrzött Phase 1 eredmények. Pontos Krems–Liezen–Ried összehasonlítást csak az első 90 napos sync után szabad készíteni, különösen placement, outbound CTR, LPV, hiteles foglalás és attribúciós késleltetés szerint.

## 9. Észlelt problémák

- Nincs production Meta-token/account mapping a jelenlegi fejlesztői környezetben.
- A Meta-jogosultságokat valódi tokennel még validálni kell.
- A Trigger.dev production taskok nincsenek ebből a környezetből élesítve és visszaellenőrizve.
- A Meta által jelentett lead/purchase jelenleg nem kapcsolódik automatikusan Spetly CRM-foglaláshoz vagy IRISMOMENT időponthoz.
- A napi Meta-adatokból az „utolsó 24 óra” csak napi felbontású közelítés; valódi órás elemzéshez később órás insight-szint kell.
- A teljes alkalmazás buildje helyettesítő, nem elérhető PostgreSQL URL-lel két meglévő `admin.count()` hibát naplóz statikus generáláskor, bár a build sikeresen befejeződik. Ez nem az új Meta-modulból ered.

## 10. Optimalizálási javaslatok

1. Először az éles, read-only adatkapcsolatot és 90 napos backfillt kell aktiválni.
2. Be kell állítani a valódi SPETER CPL/CAC és IRISMOMENT cost-per-booking/capacity célokat.
3. A kampányokat Meta lead helyett hiteles Spetly CRM lead/foglalás és mini-session booking alapján kell majd értékelni.
4. A Krems-placement tanulságot tesztként, nem automatikus általános szabályként kell alkalmazni Riedre és Liezenre; kis mintán a bontás félrevezető lehet.
5. Következő körben kreatív- és placement-dashboard, valamint alert-acknowledgement workflow javasolt.

## 11. Teszteredmények

- Prisma schema validation: sikeres.
- Prisma client generation: sikeres.
- TypeScript `tsc --noEmit`: sikeres.
- Meta Ads regressziós tesztek: 15/15 sikeres.
- Next.js optimalizált production build: sikeres.

A tesztek lefedik a GET-only biztonságot, token URL-ből eltávolítását, paginationt, retryt, lejárt tokent, hiányzó és nulla metrikát, attribúciós provisional státuszt, arányszámítást, időszak-összehasonlítást, anomáliát, ajánlást, account mappinget, snapshot-deduplikációt és a 90 napos első szinkront.

## 12. Fennmaradó technikai akadályok

- Production környezeti változók és Meta read permissions.
- Production adatbázis-migráció.
- Trigger.dev deploy és schedule-verifikáció.
- Első manuális vagy automatikus 90 napos import és health check.
- Üzleti célértékek emberi konfigurációja.
- Hiteles booking/revenue összekötés a CRM- és mini-session-adatokkal.

## 13. Következő fejlesztési fázis

Javasolt Phase 2:

- Teljes super-admin frontend dashboard.
- CRM lead/consultation/booking és IRISMOMENT appointment egyeztetés.
- Hiteles CPA, booking conversion és ROAS.
- Kreatív- és placement-összehasonlító nézet.
- Alert acknowledgement, owner és jegyzetek.
- Ajánlások eredményének visszamérése.
- Szükség esetén órás insight a rövid eseménykampányokhoz.

Az élesítés feltételeit a `docs/meta-ads-intelligence.md` tartalmazza. A rendszer addig helyesen „nincs konfigurálva” állapotot jelez, és nem állítja magáról, hogy folyamatos monitoringot végez.
