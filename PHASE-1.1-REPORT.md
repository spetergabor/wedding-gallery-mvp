# SPETLY Meta Ads Intelligence – Phase 1.1 jelentés

Készült: 2026. november 25.

Jelölések: **IMPLEMENTÁLT** = helyben elkészült; **TESZTELT** = automatizált/lokális ellenőrzés sikeres; **PRODUCTION ELLENŐRZÖTT** = éles környezetben igazolt; **BLOCKED** = külső hozzáférés, adat vagy jóváhagyás hiányzik.

## 1. Production readiness

| Terület | Állapot | Eredmény |
|---|---|---|
| GitHub `main` | PRODUCTION ELLENŐRZÖTT | Auditkor a helyi és az origin HEAD megegyezett; a Phase 1.1 változások jelenleg csak helyiek, jóváhagyásra várnak. |
| Vercel | PRODUCTION ELLENŐRZÖTT | Az aktuális Phase 1 deployment `READY`. |
| `DATABASE_URL` | PRODUCTION ELLENŐRZÖTT | A változó létezik; értéke nem került kiolvasásra vagy riportálásra. |
| `TRIGGER_SECRET_KEY` | PRODUCTION ELLENŐRZÖTT | A változó létezik; értéke nem került kiolvasásra vagy riportálásra. |
| `META_ADS_ACCESS_TOKEN` | BLOCKED | Vercelben és Trigger.dev production környezetben nincs konfigurálva. |
| `META_AD_ACCOUNT_MAPPINGS_JSON` | BLOCKED | Vercelben és Trigger.dev production környezetben nincs konfigurálva. |
| Super-admin API-védelem | IMPLEMENTÁLT / TESZTELT | Minden Meta route approved, nem team-member `super_admin` sessiont követel. |
| Read-only védelem | IMPLEMENTÁLT / TESZTELT | A kliens csak GET-et tesz elérhetővé; élő Meta-módosítás nincs. |

## 2. Meta API connection status

- **IMPLEMENTÁLT:** a runtime alapértelmezett Graph API-verziója `v27.0`; a korábbi `v24.0` már nem használható production alapként.
- **IMPLEMENTÁLT:** biztonságos, adatbázisba nem író smoke-test endpoint account-, campaign-, ad set-, ad-, creative- és insight-próbákkal.
- **IMPLEMENTÁLT:** válasz-telemetria az API-hívásszámhoz és a Meta rate-limit headerekhez, tokennaplózás nélkül.
- **PRODUCTION ELLENŐRZÖTT:** a Business Settings felületen két külön portfolio és két külön hirdetési fiók azonosítható. Az IRISMOMENT portfolióban vannak korábbi rendszerfelhasználók, de az `irisfotografie` hirdetési fiókhoz jelenleg csak személyek vannak rendelve; a portfolióhoz nincs alkalmazás rendelve. A SPETER portfolióban nincs rendszerfelhasználó; vannak meglévő alkalmazások, de a megvizsgált `hochzeitsfotografen` apphoz nincs üzleti objektum kapcsolva.
- **BLOCKED:** nincs érvényes system-user token, ezért valódi API-hívás és tokenlejárat-ellenőrzés nem történt.

Ajánlott hozzáférés: Meta Business Portfolio alatti system user, kizárólag a szükséges advertising accountokkal és minimálisan `ads_read` jogosultsággal. A tokent kizárólag Vercel és Trigger.dev secretként szabad rögzíteni.

## 3. Ellenőrzött jogosultságok

- **DOKUMENTÁCIÓVAL ELLENŐRZÖTT:** `ads_read` szükséges az Ads Insights olvasásához.
- **IMPLEMENTÁLT:** az alkalmazás nem tartalmaz write/mutation műveletet.
- **PRODUCTION ELLENŐRZÖTT:** a két Business Portfolio és account tulajdonjoga látható, de egyikben sincs kész, mindkét accountra olvasási joggal rendelkező rendszerfelhasználó.
- **BLOCKED:** az app jogosultsága, a system-user–app–account hozzárendelés és a generált token `ads_read` scope-ja még nincs kész.

## 4. Account mapping

- **IMPLEMENTÁLT / TESZTELT:** explicit `SPETER` vagy `IRISMOMENT` mapping; duplikált account ID elutasítva.
- **PRODUCTION ELLENŐRZÖTT a Business UI-ban:** `IRISMOMENT → act_1664159937695658` (`irisfotografie`) és `SPETER → act_509645602062811` (`Hochzeits`).
- **BLOCKED:** a mapping még nincs production secretként beállítva és Graph API-val visszaellenőrizve. Kampánynévből márka nem kerül kikövetkeztetésre.

## 5. Production migráció eredménye

- **PRODUCTION ELLENŐRZÖTT:** a Phase 1 `20261125090000_add_meta_ads_intelligence` migráció élesben alkalmazva van.
- **IMPLEMENTÁLT / TESZTELT:** a Phase 1.1 placement migráció csak az új `MetaPlacementInsight` táblát, indexeket és foreign keyt adja hozzá; meglévő CRM-, galéria-, számlázási vagy foglalási táblát nem módosít.
- **BLOCKED:** a Phase 1.1 migráció még nincs élesítve. Éles futtatás előtt mentés/PITR és visszaállítási eljárás ellenőrzése, majd felhasználói jóváhagyás szükséges.
- Visszaállítás: az új tábla eldobása csak külön jóváhagyással és csak akkor, ha az abban lévő importált breakdown-adatok elvesztése elfogadható. Automatikus destruktív rollback nincs.
- Várható mennyiség: hozzávetőleg `napok × aktív hirdetések × tényleges placement/device kombinációk`; valós fiókadat nélkül pontos sor- és tárhelybecslés nem adható.

## 6. Importált történeti adatok

- **IMPLEMENTÁLT / TESZTELT:** 3/7/30/90 napos, újrafuttatható, egyedi kulcsos upsert; hét napos gördülő frissítés konfigurálható.
- **IMPLEMENTÁLT:** futási metaadatban request count, rate-limit header és placement részállapot.
- **BLOCKED:** valódi 3, 7, 30 és 90 napos import nem indítható token és mapping nélkül. Importált production sorok száma: 0.

Kötelező éles sorrend: smoke test → 3 nap → egyeztetés → 7 nap → egyeztetés → 30 nap → egyeztetés → 90 nap → végső egyeztetés.

## 7. Adatpontossági ellenőrzés

- **IMPLEMENTÁLT / TESZTELT:** additív metrikák toleranciaalapú egyeztetése; reach/frequency külön, nem összegezhető értékként kezelve.
- **IMPLEMENTÁLT:** placement API nem összegezi a reach és frequency mezőket.
- **IMPLEMENTÁLT:** a legutóbbi 72 óra provisional, az attribúciós késés miatt; a gördülő újraolvasás napjai konfigurálhatók.
- **BLOCKED:** három reprezentatív kampány Ads Manager–adatbázis egyeztetése csak az import után végezhető el. Azonos dátum, időzóna, pénznem, attribúciós ablak és result type szükséges.

## 8. Trigger.dev futási eredmények

- **PRODUCTION ELLENŐRZÖTT:** a Trigger projekt elérhető, de a production deployment régebbi a Phase 1 Meta taskoknál.
- **BLOCKED:** az öt task még nincs productionben telepítve; egyikhez sincs production run vagy schedule-bizonyíték.
- **IMPLEMENTÁLT / TESZTELT:** retry, timeout, idempotency key, adatbázis-lock, stale-lock lejárat és sikertelen sync alert.
- **BLOCKED:** első production futás és naplóellenőrzés csak Meta secretek, migráció és deploy után lehetséges.

## 9. Kampányok tényleges elemzése

**BLOCKED:** valós API-adat és hiteles booking-egyeztetés nélkül nincs production kampányelemzés. A Meta lead/purchase mezők nem számítanak automatikusan valódi foglalásnak vagy bevételnek.

## 10. IRISMOMENT eseménykampányok összehasonlítása

Krems–MARIANDL, Liezen–ELI és Ried–Weberzeile összehasonlítása **BLOCKED**. A korábbi megfigyelések – például Kremsben az Instagram erősebbnek tűnt – hipotézisek. Bizonyításhoz kell:

- azonos esemény előtti napok szerinti idősáv;
- placement/device bontás;
- kreatív és formátum ellenőrzött metaadata;
- forgalmi és konverziós kampány külön kezelése;
- hiteles Spetly/mini-session foglalásszám.

## 11. Optimalizálási javaslatok

1. Először a read-only Meta-kapcsolatot és az account mappinget kell hitelesíteni.
2. Kis mintán nem szabad Instagram-only következtetést vagy automatikus placement-szűkítést alkalmazni.
3. Leállított kampányok már nem generálnak élő analitikai riasztást; korábbi ajánlásaik superseded állapotba kerülnek.
4. A riasztási küszöbök márkánként és Meta campaign objective szerint külön konfigurálhatók; SPETER nem örökli automatikusan az IRISMOMENT rövid eseménylogikáját.
5. Kapacitás- és költésjavaslat csak hiteles foglalási adatokból készüljön, végrehajtás nélkül.

## 12. Észlelt hibák és javításuk

- Elavult API-alapverzió → `v27.0` alapértelmezés.
- Nem volt placement breakdown → külön placement collector, tábla és API.
- Globális, fix riasztási küszöbök → márka- és kampánytípus-specifikus konfiguráció.
- Leállított kampányok történeti adatai riaszthattak → csak aktív kampányok értékelése.
- Kumulatív request count több accountnál → accountonkénti telemetria.
- Egyszerű health jelző → explicit hétállapotú state machine.
- Budget pacing valós validációja **BLOCKED**, amíg a Meta budget mezők pénzegysége és a valós költés az adott accountban nincs egyeztetve.

## 13. Üzemeltetési költségek

Új szerver vagy queue nem szükséges. Az öt taskból a háromórás sync körülbelül napi 8 futás, a riportokkal együtt hozzávetőleg 243–275 run/hó. Trigger.dev jelenlegi small-1x listaára mellett:

- 30 másodperces átlagos futással körülbelül **0,25 USD/hó**;
- 60 másodperces átlagos futással körülbelül **0,50 USD/hó**;
- ehhez egyszeri backfill-futások és a meglévő Vercel/PostgreSQL csomag esetleges többlete társulhat.

Ez becslés, nem számla; a tényleges futásidő és az aktuális csomag határozza meg a költséget. Trigger production aktiválás előtt jóváhagyás szükséges.

## 14. Fennmaradó akadályok

1. Egy dedikált Meta Developer App és system user létrehozása vagy egy meglévő app tudatos kiválasztása; mindkét Business Portfolio accountjának biztonságos partner-/objektum-hozzárendelése ugyanahhoz a read-only system userhez.
2. `META_ADS_ACCESS_TOKEN` és ellenőrzött `META_AD_ACCOUNT_MAPPINGS_JSON` biztonságos beállítása Vercelben és Trigger.devben.
3. Production backup/PITR ellenőrzése és Phase 1.1 migráció/deploy jóváhagyása.
4. Valós smoke test és lépcsőzetes történeti import.
5. Három kampány manuális reconciliationje.
6. Trigger production deploy és első sikeres futás.
7. Valódi adaton alert false-positive, attribúciós késés és budget pacing validáció.
8. IRISMOMENT kapacitás, foglalásszám és napi booking rate feltöltése.

A Phase 1.1 acceptance criteria ezért jelenleg: **BLOCKED / NEM TELJES**.

## 15. Phase 2 frontend dashboard technikai terve

1. Health fejléc állapotgéppel, utolsó sikeres/hibás futással és következő schedule-lel.
2. Márkaválasztó: SPETER és IRISMOMENT teljesen elkülönített célértékekkel.
3. Időablak-kártyák: 1/3/7/14/30/90 nap, előző azonos időszak, lifetime.
4. Kampány/ad set/ad drill-down, attribution és reliability jelöléssel.
5. Placement és creative összehasonlítás; nem additív metrikák figyelmeztetésével.
6. Alert/recommendation inbox acknowledgement, owner és jegyzet funkcióval.
7. IRISMOMENT event-capacity panel konzervatív/alap/optimista forgatókönyvvel.
8. Későbbi hiteles CRM/mini-session booking reconciliation a valódi CPA és ROAS számára.

## Helyi ellenőrzési eredmény

- Prisma format/validate/generate: sikeres.
- Meta Ads regressziós tesztek: sikeres.
- TypeScript ellenőrzés: sikeres a végső átadás előtt újrafuttatva.
- Production build: sikeres a végső átadás előtt újrafuttatva.
- Production adat-, Meta- és Trigger-validáció: **BLOCKED**, a fenti okokból.

## Hivatalos ellenőrzési források

- Meta Graph API verziók: https://developers.facebook.com/docs/graph-api/changelog/versions/
- Meta Marketing API Insights: https://developers.facebook.com/docs/marketing-api/insights/
- Meta system user tokenek: https://developers.facebook.com/docs/marketing-api/system-users/
- Trigger.dev pricing: https://trigger.dev/pricing
