# SPETLY Meta Ads Intelligence – Phase 1.2 élesítési jelentés

Készült: 2026. november 25.

Jelölések: **ÉLESEN ELLENŐRZÖTT** = production környezetben igazolt; **TESZTELT** = automatizált ellenőrzés sikeres; **FENNMARADÓ** = további üzleti adat vagy megfigyelési idő kell.

## 1. Éles infrastruktúra

| Terület | Állapot | Eredmény |
|---|---|---|
| GitHub `main` | ÉLESEN ELLENŐRZÖTT | Phase 1.2 kód és Meta v27 kompatibilitási javítás pusholva. |
| Vercel production | ÉLESEN ELLENŐRZÖTT | `ee62155` deployment `Ready` (1m 19s); `spetly.app` alias aktív. |
| Trigger.dev production | ÉLESEN ELLENŐRZÖTT | `20261125.2`, 9 felismert task, ebből 5 Meta Ads task. |
| Neon backup | ÉLESEN ELLENŐRZÖTT | `pre-phase-1-2-2026-11-25` permanens gyermekág létrehozva a production ágról. |
| Placement migráció | ÉLESEN ELLENŐRZÖTT | `20261125130000_add_meta_placement_insights` alkalmazva; második migrációs ellenőrzésnél nem maradt függő migráció. |

## 2. Meta-hozzáférés

- Dedikált app: `SPETLY Marketing Intelligence`, app ID `1528495835769535`.
- Dedikált rendszerfelhasználó: `Spetly`, ID `61597070184899`.
- SPETER: `act_509645602062811` (`Hochzeits`), kizárólag teljesítmény megtekintése.
- IRISMOMENT: `act_1664159937695658` (`irisfotografie`), partnermegosztással, kizárólag teljesítmény megtekintése.
- A rendszerfelhasználói token lejárata: nincs; scope: kizárólag `ads_read`.
- A token kizárólag Vercel és Trigger.dev secretként van tárolva; értéke nincs forráskódban, gitben vagy ebben a riportban.
- Mindkét account Graph API `v27.0` GET-próbája HTTP 200 választ adott, az accountnév, pénznem és státusz helyes.
- A kód csak olvasási célú Graph API GET-hívást tesz elérhetővé. Kampányt, budgetet, célzást vagy kreatívot nem módosít.

## 3. Éles importok

| Ablak | SPETER | IRISMOMENT | Placement | Eredmény |
|---|---:|---:|---:|---|
| 3 nap | 88/88 | 347/347 | 0 / 154 | sikeres |
| 7 nap | 88/88 | 613/613 | 0 / 386 | sikeres |
| 30 nap | 88/88 | 1303/1303 | 0 / 990 | sikeres |
| 90 nap | 88/88 | 1303/1303 | 0 / 990 | sikeres |

A számpár formátuma: `recordsRead/recordsWritten`. Az upsert egyedi kulcsos és újrafuttatható; a rövidebb ablakok ismételt betöltése nem hozott létre duplikált kampány-entitásokat.

Az első production próbafutás egy Meta v27 mezőhibát talált: `video_3_sec_watched_actions`. A lekérdezés a támogatott `video_play_actions` mezőre lett átállítva, regressziós teszt készült, majd a javított `20261125.2` Trigger verzió minden további importot sikeresen futtatott. A végső 90 napos futás azonosítója `run_06h14etm5fbmpjf25t5incbqa2`; 5 perc 31 másodperc alatt, retry és rate-limit hiba nélkül zárult.

## 4. Adatpontosság és korlátok

- A Meta által jelentett `lead` nem tekinthető automatikusan valódi foglalásnak vagy bevételnek.
- Reach és frequency placement sorokon nem összegezhető; az API ezeket szándékosan `null` értékkel adja vissza a placement összesítésben.
- A legutóbbi 72 óra provisional az attribúciós késés miatt; a rendszer 7 napos gördülő újraolvasással frissíti.
- A 3/7/30/90 napos futásoknál mindkét account `recordsRead === recordsWritten`, retry nélkül, Meta rate-limit terhelés nélkül futott.
- A tényleges booking, CPA és ROAS csak a Spetly foglalási adataival való későbbi egyeztetés után hiteles.

## 5. Valós kampánymegfigyelések

### IRISMOMENT – 30 napos import alapján

- Krems régi forgalmi kampány: 48 956 HUF költés, 48 688 megjelenés, 4,47% link CTR, 22,50 HUF CPC, 1 774 landing page view. Meta lead nincs, ezért a kampány valós sikerét kizárólag a tényleges foglalások igazolják.
- Liezen régi forgalmi kampány: 44 390 HUF költés, 2,67% link CTR, 47,58 HUF CPC, 727 landing page view. A Kremshez képest drágább és gyengébb forgalmat hozott.
- Ried régi forgalmi kampány: 6 824 HUF költés, 5,56% link CTR, 20,43 HUF CPC, 267 landing page view. A felső tölcsér jó, de Meta lead nincs.
- Ried Website Lead: 13 850 HUF költés, 49 landing page view, 10 Meta lead, Meta CPL 1 385 HUF. A leadek többsége Facebook feedből érkezett; két lead Instagram Reels Androidból. Kis minta, ezért Instagram-only vagy Facebook-only szűkítés nem indokolt.
- Liezen Website Lead: 8 115 HUF költés, 18 landing page view, 2 Meta lead, Meta CPL 4 057,50 HUF. A két Meta lead Facebook feed iPhone elhelyezésből jött. A tényleges foglalásszám külön ellenőrzendő.
- Mindkét aktív Website Lead kampánynál a kattintás → landing page view arány 50% alatt van (Ried 49/136, Liezen 18/68). Az automatikus elemző ezért alacsony kockázatú céloldal-vizsgálatot javasol: mobil betöltés, cél-URL és a foglalóhoz vezető út ellenőrzése.

Következtetés: a konverziós kampányok lead jelet adnak, de a Meta lead és a booking nem azonos. Advantage+ elhelyezésből csak a bizonyítottan pazarló placementek kizárása indokolt elegendő mintán; a jelenlegi kis minta alapján nincs automatikus célzási vagy placement-módosítás.

### SPETER

Két aktívként jelölt traffic kampány található, de a betöltött időszakban nincs mérhető insight-költés. Ez lehet ad set/ad szintű leállítás vagy tényleges kézbesítés hiánya; automatikus módosítás nem történt.

## 6. Automatizálás

- `meta-ads-three-hourly-sync`: háromóránként, `Europe/Vienna`.
- `meta-ads-daily-report`: naponta 08:00.
- `meta-ads-weekly-report`: hétfőn 08:00.
- `meta-ads-monthly-report`: hónap első napján 08:00.
- `meta-ads-manual-sync`: kézi, lépcsőzetes import és hibaelhárítás.
- Minden schedule Trigger.devben production verzióhoz van rendelve. A sikeres 90 napos visszatöltés után a Vercel production környezetben a `META_ADS_SCHEDULES_ACTIVE=true` kapcsoló beállításra került; az éles deployment- és állapotellenőrzés a záró aktiválás része.

## 7. Biztonság és rollback

- Meta-hozzáférés: minimális `ads_read`; a hirdetési accountokhoz nincs kezelési jogosultság.
- Adatbázis-visszaállítás: Neon backup ág `pre-phase-1-2-2026-11-25`.
- Kód-visszaállítás: Git commit előtti production verzió `8cab4ee`; a v27 javítás commitja `ee62155`.
- Trigger visszaállítás: korábbi `20261125.1` deployment megmaradt.
- Destruktív automatikus rollback nincs.

## 8. Tesztek

- Meta Ads tesztek: 22/22 sikeres.
- TypeScript: sikeres.
- Git diff whitespace ellenőrzés: sikeres.
- Production migráció: sikeres.
- Production Graph API account smoke: 2/2 sikeres.
- Production import: 3/7/30/90 nap sikeres.

## 9. Fennmaradó üzleti konfiguráció

Az elemzőmotor működik, de a következő üzleti adatok nélkül nem adható hiteles CPA/ROAS vagy kapacitásjavaslat:

- SPETER: qualified lead, consultation és booking definíció; cél CAC; szerződésérték.
- IRISMOMENT: eseményhelyszín és -dátum; elérhető és foglalt időpontok; cél cost per booking; átlagos ügyfélérték.
- Valódi Spetly booking-egyeztetés a Meta lead eseményekhez.

