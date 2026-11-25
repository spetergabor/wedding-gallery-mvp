import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, BarChart3, Bell, CheckCircle2, ChevronRight, CircleDollarSign,
  Cloud, Columns3, Database, Film, Image, LayoutDashboard, Loader2, LogOut, Megaphone,
  MonitorCog, Moon, MousePointerClick, Play, RefreshCw, Search, Settings, ShieldCheck,
  Sparkles, Sun, TableProperties, TrendingDown, TrendingUp, Wifi, X
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import { apiGet, apiPost, hasSession, login, logout } from "./api";
import { currencyFor, dateTime, money, number, percent, placementLabel, shortDate, statusLabel } from "./format";
import type {
  Account, Ad, AdSet, AlertItem, Brand, BrandAnalytics, Campaign, CreativePerformance, Metrics, Monitoring,
  Placement, Recommendation, ThemeMode, TrendRow, ViewId
} from "./types";

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Áttekintés", icon: LayoutDashboard },
  { id: "campaigns", label: "Kampányok", icon: Megaphone },
  { id: "ads", label: "Hirdetések", icon: TableProperties },
  { id: "creatives", label: "Kreatívok", icon: Image },
  { id: "alerts", label: "Riasztások", icon: Bell },
  { id: "monitoring", label: "Monitorozás", icon: MonitorCog },
  { id: "settings", label: "Beállítások", icon: Settings }
];

const PERIODS = [
  { value: 1, label: "Ma" },
  { value: 2, label: "Tegnap" },
  { value: 3, label: "Utolsó 3 nap" },
  { value: 7, label: "Utolsó 7 nap" },
  { value: 14, label: "Utolsó 14 nap" },
  { value: 30, label: "Utolsó 30 nap" },
  { value: 90, label: "Utolsó 90 nap" }
];

type ApiResponse<T> = { ok: boolean } & T;

function stored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => stored(key, fallback));
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}

function statusClass(status?: string | null) {
  const value = (status || "").toUpperCase();
  if (value === "ACTIVE" || value === "HEALTHY" || value === "SUCCESS") return "success";
  if (value.includes("PAUSED") || value === "WARNING" || value === "SYNCING") return "warning";
  if (value === "FAILED" || value === "CRITICAL" || value === "DEGRADED") return "danger";
  return "info";
}

function changeClass(value: number | null | undefined, lowerIsBetter = false) {
  if (value == null || value === 0) return "";
  const good = lowerIsBetter ? value < 0 : value > 0;
  return good ? "good" : "bad";
}

function Kpi({ label, value, change, lowerIsBetter = false }: { label: string; value: string; change?: number | null; lowerIsBetter?: boolean }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-change ${changeClass(change, lowerIsBetter)}`}>
        {change == null ? "Nincs összehasonlítható adat" : `${change > 0 ? "+" : ""}${number(change, 1)}% az előző időszakhoz`}
      </div>
    </div>
  );
}

function Badge({ value, label }: { value?: string | null; label?: string }) {
  return <span className={`badge ${statusClass(value)}`}><span className="dot" />{label || statusLabel(value)}</span>;
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head"><h2>{title}</h2>{action}</header>
      {children}
    </section>
  );
}

function ErrorBanner({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-banner">
      <span>{error instanceof Error ? error.message : String(error)}</span>
      {retry ? <button className="button" onClick={retry}>Újrapróbálás</button> : null}
    </div>
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await login(email, password, code || undefined);
      if (result.ok) {
        onSuccess();
        return;
      }
      if (result.code === "two_factor_required") setNeedsTwoFactor(true);
      setError(result.message || "A belépés sikertelen.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-brand">
        <div className="login-mark">SP</div>
        <div>
          <h1>A hirdetési adatok, végre egy helyen.</h1>
          <p>Professzionális, read-only Meta Ads áttekintés a SPETER és IRISMOMENT fiókokhoz — valós adatokkal, zaj nélkül.</p>
        </div>
        <small>SPETLY Ads Manager · macOS · v1.0</small>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h2>Biztonságos belépés</h2>
          <p>A meglévő Spetly főadmin-fiókoddal.</p>
          {error ? <div className="login-error">{error}</div> : null}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required disabled={needsTwoFactor} />
          </div>
          <div className="field">
            <label>Jelszó</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={needsTwoFactor} />
          </div>
          {needsTwoFactor ? (
            <div className="field">
              <label>Kétfaktoros kód</label>
              <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required autoFocus />
            </div>
          ) : null}
          <button className="button primary login-submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{pending ? "Belépés…" : "Belépés"}
          </button>
          <div className="login-security"><ShieldCheck />A munkamenet a macOS Keychainben tárolódik. Meta token és adatbázis-hozzáférés nem kerül a gépre.</div>
        </form>
      </section>
    </div>
  );
}

function GlobalFilters({ brand, setBrand, days, setDays, status, setStatus, showStatus = true }: {
  brand: Brand; setBrand: (brand: Brand) => void; days: number; setDays: (days: number) => void; status: string; setStatus: (value: string) => void; showStatus?: boolean;
}) {
  return (
    <div className="toolbar">
      <div className="segmented">
        {(["IRISMOMENT", "SPETER"] as Brand[]).map((item) => <button key={item} className={brand === item ? "active" : ""} onClick={() => setBrand(item)}>{item}</button>)}
      </div>
      <select className="select" value={days} onChange={(event) => setDays(Number(event.target.value))}>
        {PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
      </select>
      {showStatus ? (
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Kampánystátusz szűrése">
          <option value="all">Összes kampány</option><option value="active">Csak aktívak</option><option value="paused">Szüneteltetettek</option><option value="completed">Befejezettek</option>
        </select>
      ) : null}
    </div>
  );
}

function OverviewView({ brand, days, currency, metrics, comparison, trends, campaigns, alerts, recommendations, latestSync }: {
  brand: Brand; days: number; currency: string; metrics: Metrics; comparison?: { changes: Partial<Record<keyof Metrics, number | null>>; notes: string[]; reliability: string };
  trends: TrendRow[]; campaigns: Campaign[]; alerts: AlertItem[]; recommendations: Recommendation[]; latestSync?: string | null;
}) {
  const chartData = useMemo(() => trends.map((row) => ({
    date: shortDate(row.date), spend: row.spend, leads: row.leads,
    ctr: row.impressions ? row.linkClicks / row.impressions * 100 : 0,
    cpc: row.linkClicks ? row.spend / row.linkClicks : 0,
    provisional: row.dataStatus === "provisional"
  })), [trends]);
  const activeCampaigns = campaigns.filter((campaign) => campaign.deliveryStatus === "ACTIVE").length;
  const ranked = [...campaigns].filter((campaign) => campaign.performance.spend > 0).sort((a, b) => (a.performance.costPerLead ?? Number.MAX_VALUE) - (b.performance.costPerLead ?? Number.MAX_VALUE));
  const best = ranked[0];
  const worst = [...ranked].reverse()[0];
  const c = comparison?.changes || {};

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Hirdetési költés" value={money(metrics.spend, currency)} change={c.spend} />
        <Kpi label="Megjelenések" value={number(metrics.impressions)} change={c.impressions} />
        <Kpi label="Elérés" value={number(metrics.reach)} change={c.reach} />
        <Kpi label="Link CTR" value={percent(metrics.ctr)} change={c.ctr} />
        <Kpi label="CPC" value={money(metrics.cpc, currency)} change={c.cpc} lowerIsBetter />
        <Kpi label="Meta lead" value={number(metrics.leads)} change={c.leads} />
        <Kpi label="Landing page view" value={number(metrics.landingPageViews)} change={c.landingPageViews} />
        <Kpi label="CPL" value={money(metrics.costPerLead, currency)} change={c.costPerLead} lowerIsBetter />
        <Kpi label="CPM" value={money(metrics.cpm, currency)} change={c.cpm} lowerIsBetter />
        <Kpi label="Outbound kattintás" value={number(metrics.outboundClicks)} change={c.outboundClicks} />
        <Kpi label="Frequency" value={number(metrics.frequency, 2)} change={c.frequency} />
        <Kpi label="Aktív kampány" value={number(activeCampaigns)} />
      </div>
      <div className="chart-grid">
        <Panel title={`Napi költés · ${days} nap`} action={<span className="badge info">{currency}</span>}>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}>
            <defs><linearGradient id="spend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6f9ee8" stopOpacity={.42}/><stop offset="95%" stopColor="#6f9ee8" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="date" stroke="var(--muted-2)" fontSize={11}/><YAxis stroke="var(--muted-2)" fontSize={11}/><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10 }}/><Area type="monotone" dataKey="spend" name="Költés" stroke="#6f9ee8" fill="url(#spend)" strokeWidth={2}/>
          </AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Meta lead és CPL" action={<span className="badge warning">Az utolsó 72 óra provisional</span>}>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}>
            <CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="date" stroke="var(--muted-2)" fontSize={11}/><YAxis stroke="var(--muted-2)" fontSize={11}/><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10 }}/><Bar dataKey="leads" name="Meta lead" fill="#65d4aa" radius={[5,5,0,0]}/>
          </BarChart></ResponsiveContainer></div>
        </Panel>
      </div>
      <div className="split-grid">
        <Panel title="Kampányteljesítmény">
          <div className="panel-body">
            {best ? <div className="alert-card"><div className="alert-icon" style={{ background: "var(--success-soft)", color: "var(--success)" }}><TrendingUp /></div><div><h3>Legjobb CPL · {best.name}</h3><p>{money(best.performance.costPerLead, currency)} / Meta lead · {number(best.performance.leads)} lead</p></div><Badge value="ACTIVE" label="Legjobb" /></div> : <div className="empty">Nincs elegendő kampányadat.</div>}
            {worst && worst.id !== best?.id ? <div className="alert-card" style={{ marginTop: 10 }}><div className="alert-icon"><TrendingDown /></div><div><h3>Legmagasabb CPL · {worst.name}</h3><p>{money(worst.performance.costPerLead, currency)} / Meta lead · kis mintán óvatosan értelmezendő</p></div><Badge value="WARNING" label="Figyelendő" /></div> : null}
          </div>
        </Panel>
        <Panel title="Aktuális riasztások és javaslatok" action={<span className="badge info">{alerts.length + recommendations.length}</span>}>
          <div className="panel-body alert-list">
            {alerts.slice(0, 2).map((alert) => <div className="alert-card" key={alert.id}><div className="alert-icon"><AlertTriangle /></div><div><h3>{alert.title}</h3><p>{alert.recommendedAction || alert.possibleCause}</p></div><Badge value={alert.severity} /></div>)}
            {recommendations.slice(0, 2).map((item) => <div className="alert-card" key={item.id}><div className="alert-icon" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Sparkles /></div><div><h3>{item.title}</h3><p>{item.recommendation}</p></div><Badge value="INFO" label={item.risk} /></div>)}
            {!alerts.length && !recommendations.length ? <div className="empty">Nincs aktív jelzés.</div> : null}
          </div>
        </Panel>
      </div>
      <p style={{ color: "var(--muted-2)", fontSize: 11, marginTop: 12 }}>Utolsó adatfrissítés: {dateTime(latestSync)} · A Meta lead nem azonos a tényleges foglalással. Megbízhatóság: {comparison?.reliability || "—"}.</p>
    </>
  );
}

type SortKey = "startTime" | "name" | "spend" | "impressions" | "ctr" | "cpc" | "leads" | "cpl";

function CampaignsView({ campaigns, currency, brand, days, onSelect }: { campaigns: Campaign[]; currency: string; brand: Brand; days: number; onSelect: (campaign: Campaign) => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("startTime");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hidden, setHidden] = useStoredState<string[]>("desktop-hidden-columns", []);
  const columns = ["budget", "spend", "impressions", "reach", "frequency", "ctr", "cpc", "cpm", "lpv", "leads", "cpl", "alerts"];
  const rows = useMemo(() => {
    const values = campaigns.filter((campaign) => campaign.name.toLowerCase().includes(query.toLowerCase()));
    const metric = (campaign: Campaign) => {
      if (sort === "startTime") return campaign.startTime ? new Date(campaign.startTime).getTime() : 0;
      if (sort === "name") return campaign.name;
      if (sort === "spend") return campaign.performance.spend;
      if (sort === "impressions") return campaign.performance.impressions;
      if (sort === "ctr") return campaign.performance.ctr ?? -1;
      if (sort === "cpc") return campaign.performance.cpc ?? Number.MAX_VALUE;
      if (sort === "leads") return campaign.performance.leads;
      return campaign.performance.costPerLead ?? Number.MAX_VALUE;
    };
    return values.sort((a, b) => {
      const left = metric(a); const right = metric(b);
      const result = typeof left === "string" ? left.localeCompare(String(right), "hu") : Number(left) - Number(right);
      return direction === "asc" ? result : -result;
    });
  }, [campaigns, query, sort, direction]);
  function sortBy(key: SortKey) { if (sort === key) setDirection(direction === "asc" ? "desc" : "asc"); else { setSort(key); setDirection("desc"); } }
  function toggleColumn(key: string) { setHidden(hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key]); }

  return (
    <Panel title={`${brand} kampányok`} action={<div className="toolbar"><div className="search-wrap"><Search/><input className="input search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kampány keresése"/></div><button className="button icon-button" onClick={() => setColumnsOpen(!columnsOpen)} title="Oszlopok"><Columns3/></button></div>}>
      {columnsOpen ? <div className="panel-body" style={{ paddingBottom: 8 }}><div className="toolbar">{columns.map((key) => <label className="badge" key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={() => toggleColumn(key)}/>{key.toUpperCase()}</label>)}</div></div> : null}
      <div className="table-scroll"><table><thead><tr>
        <th className="sortable" onClick={() => sortBy("name")}>Kampány</th><th>Státusz</th><th>Cél</th>
        {!hidden.includes("budget") && <th>Budget</th>}{!hidden.includes("spend") && <th className="sortable" onClick={() => sortBy("spend")}>Spend</th>}
        {!hidden.includes("impressions") && <th className="sortable" onClick={() => sortBy("impressions")}>Impressions</th>}{!hidden.includes("reach") && <th>Reach</th>}
        {!hidden.includes("frequency") && <th>Frequency</th>}{!hidden.includes("ctr") && <th className="sortable" onClick={() => sortBy("ctr")}>Link CTR</th>}
        {!hidden.includes("cpc") && <th className="sortable" onClick={() => sortBy("cpc")}>CPC</th>}{!hidden.includes("cpm") && <th>CPM</th>}
        {!hidden.includes("lpv") && <th>LPV</th>}{!hidden.includes("leads") && <th className="sortable" onClick={() => sortBy("leads")}>Meta lead</th>}
        {!hidden.includes("cpl") && <th className="sortable" onClick={() => sortBy("cpl")}>CPL</th>}{!hidden.includes("alerts") && <th>Riasztás</th>}<th></th>
      </tr></thead><tbody>
        {rows.map((campaign) => <tr className="clickable" key={campaign.id} onClick={() => onSelect(campaign)}>
          <td><div className="cell-title">{campaign.name}</div><div className="cell-sub">Indulás: {dateTime(campaign.startTime)} · {campaign.externalId}</div></td><td><Badge value={campaign.deliveryStatus}/></td><td>{campaign.objective?.replaceAll("_", " ") || "—"}</td>
          {!hidden.includes("budget") && <td>{campaign.dailyBudget ? `${money(Number(campaign.dailyBudget), currency)} / nap` : campaign.lifetimeBudget ? money(Number(campaign.lifetimeBudget), currency) : "—"}</td>}
          {!hidden.includes("spend") && <td>{money(campaign.performance.spend, currency)}</td>}{!hidden.includes("impressions") && <td>{number(campaign.performance.impressions)}</td>}
          {!hidden.includes("reach") && <td>{number(campaign.performance.reach)}</td>}{!hidden.includes("frequency") && <td>{number(campaign.performance.frequency, 2)}</td>}
          {!hidden.includes("ctr") && <td>{percent(campaign.performance.ctr)}</td>}{!hidden.includes("cpc") && <td>{money(campaign.performance.cpc, currency)}</td>}
          {!hidden.includes("cpm") && <td>{money(campaign.performance.cpm, currency)}</td>}{!hidden.includes("lpv") && <td>{number(campaign.performance.landingPageViews)}</td>}
          {!hidden.includes("leads") && <td>{number(campaign.performance.leads)}</td>}{!hidden.includes("cpl") && <td>{money(campaign.performance.costPerLead, currency)}</td>}
          {!hidden.includes("alerts") && <td>{campaign.alertCount ? <span className="badge warning">{campaign.alertCount}</span> : "—"}</td>}<td><ChevronRight size={16}/></td>
        </tr>)}
      </tbody></table>{!rows.length ? <div className="empty">Nincs a szűrésnek megfelelő kampány.</div> : null}</div>
      <div className="panel-body" style={{ paddingTop: 10, color: "var(--muted-2)", fontSize: 11 }}>{days} nap · {rows.length} kampány · {currency}</div>
    </Panel>
  );
}

function AdsView({ ads, currency }: { ads: Ad[]; currency: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const rows = ads.filter((ad) => `${ad.name} ${ad.campaign?.name || ""}`.toLowerCase().includes(query.toLowerCase()));
  const compared = ads.filter((ad) => selected.includes(ad.id));
  return (
    <>
      {compared.length >= 2 ? <Panel title={`${compared.length} hirdetés összehasonlítása`} className="mb-4"><div className="panel-body metric-row">{compared.map((ad) => <div className="metric-mini" key={ad.id}><span>{ad.name}</span><strong>{money(ad.performance.spend, currency)}</strong><div className="cell-sub">CTR {percent(ad.performance.ctr)} · CPL {money(ad.performance.costPerLead, currency)}</div></div>)}</div></Panel> : null}
      <Panel title="Hirdetésszintű teljesítmény" action={<div className="search-wrap"><Search/><input className="input search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hirdetés keresése"/></div>}>
        <div className="table-scroll"><table><thead><tr><th>Összehasonlítás</th><th>Hirdetés</th><th>Kampány / hirdetéssorozat</th><th>Státusz</th><th>Spend</th><th>Impressions</th><th>Frequency</th><th>CTR</th><th>CPC</th><th>Meta lead</th><th>CPL</th><th>Video play actions</th><th>ThruPlay</th></tr></thead><tbody>
          {rows.map((ad) => <tr key={ad.id}><td><input type="checkbox" checked={selected.includes(ad.id)} onChange={() => setSelected(selected.includes(ad.id) ? selected.filter((id) => id !== ad.id) : [...selected, ad.id])}/></td>
            <td><div className="cell-title">{ad.name}</div><div className="cell-sub">{ad.creative?.title || ad.creative?.callToActionType || "Kreatív metaadat nélkül"}</div></td>
            <td><div>{ad.campaign?.name || "—"}</div><div className="cell-sub">{ad.adSet?.name || "—"}</div></td><td><Badge value={ad.deliveryStatus}/></td>
            <td>{money(ad.performance.spend, currency)}</td><td>{number(ad.performance.impressions)}</td><td>{number(ad.performance.frequency, 2)}</td><td>{percent(ad.performance.ctr)}</td><td>{money(ad.performance.cpc, currency)}</td><td>{number(ad.performance.leads)}</td><td>{money(ad.performance.costPerLead, currency)}</td><td>{number(ad.video.videoPlayActions)}</td><td>{number(ad.video.videoThruplays)}</td>
          </tr>)}
        </tbody></table>{!rows.length ? <div className="empty">Nincs hirdetés a kiválasztott időszakban.</div> : null}</div>
      </Panel>
    </>
  );
}

function CreativesView({ items, currency }: { items: CreativePerformance[]; currency: string }) {
  return <div className="creative-grid">{items.map((item, index) => <article className="creative-card" key={item.creative?.id || index}>
    <div className="creative-media">{item.creative?.imageUrl ? <img src={item.creative.imageUrl} alt="" loading="lazy"/> : item.creative?.videoId ? <><Film size={30}/><span>Videókreatív · előnézet nem érhető el</span></> : <><Image size={30}/><span>Nincs hiteles thumbnail</span></>}</div>
    <div className="creative-copy"><h3>{item.creative?.name || item.ads[0]?.name || "Névtelen kreatív"}</h3><p>{item.creative?.body || item.creative?.title || "Nincs elérhető hirdetésszöveg."}</p><div className="cell-sub" style={{ marginTop: 8 }}>{item.ads[0]?.campaignName || "Kampány nélkül"} · {item.creative?.callToActionType || "CTA nélkül"}</div></div>
    <div className="creative-stats"><div className="creative-stat"><span>Spend</span><strong>{money(item.performance.spend, currency)}</strong></div><div className="creative-stat"><span>CTR</span><strong>{percent(item.performance.ctr)}</strong></div><div className="creative-stat"><span>CPL</span><strong>{money(item.performance.costPerLead, currency)}</strong></div><div className="creative-stat"><span>Impressions</span><strong>{number(item.performance.impressions)}</strong></div><div className="creative-stat"><span>Meta lead</span><strong>{number(item.performance.leads)}</strong></div><div className="creative-stat"><span>Video play</span><strong>{number(item.video.videoPlayActions)}</strong></div></div>
  </article>)}</div>;
}

function AlertsView({ alerts, recommendations, brand }: { alerts: AlertItem[]; recommendations: Recommendation[]; brand: Brand }) {
  const [kind, setKind] = useState("all");
  const filteredAlerts = alerts.filter((item) => item.brand === brand && (kind === "all" || item.severity.toLowerCase() === kind));
  const filteredRecommendations = recommendations.filter((item) => item.brand === brand);
  return <div className="split-grid"><Panel title="Aktív riasztások" action={<select className="select" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Minden súlyosság</option><option value="critical">Kritikus</option><option value="warning">Figyelmeztetés</option><option value="opportunity">Lehetőség</option><option value="info">Információ</option></select>}><div className="panel-body alert-list">
    {filteredAlerts.map((item) => <div className="alert-card" key={item.id}><div className="alert-icon"><AlertTriangle/></div><div><h3>{item.title}</h3><p>{item.possibleCause}</p><p><strong>Javaslat:</strong> {item.recommendedAction || "—"}</p><div className="alert-meta">{dateTime(item.detectedAt)} · megbízhatóság: {item.dataReliability} · kampány: {item.entityExternalId || "account"}</div></div><Badge value={item.severity}/></div>)}
    {!filteredAlerts.length ? <div className="empty">Nincs aktív riasztás.</div> : null}
  </div></Panel><Panel title="Optimalizálási javaslatok"><div className="panel-body alert-list">
    {filteredRecommendations.map((item) => <div className="alert-card" key={item.id}><div className="alert-icon" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Sparkles/></div><div><h3>{item.title}</h3><p>{item.recommendation}</p><p>{item.rationale}</p><div className="alert-meta">Kockázat: {item.risk} · frissítve: {dateTime(item.updatedAt)}</div></div><Badge value="INFO" label={item.type}/></div>)}
    {!filteredRecommendations.length ? <div className="empty">Nincs aktív javaslat.</div> : null}
  </div></Panel></div>;
}

function MonitoringView({ monitoring, refreshing, onRefresh, syncing, onSync }: { monitoring: Monitoring; refreshing: boolean; onRefresh: () => void; syncing: boolean; onSync: () => void }) {
  const statusCards = [
    ["Meta API", monitoring.metaConnection.configured, `${monitoring.metaConnection.apiVersion} · ${monitoring.metaConnection.connectedAccounts} account`],
    ["Backend", true, "spetly.app védett API"],
    ["Adatbázis", monitoring.database.connected, monitoring.database.connected ? "PostgreSQL elérhető" : "Nem elérhető"],
    ["Trigger.dev", monitoring.schedule.deployedAndActive, monitoring.schedule.deployedAndActive ? "Ütemezések aktívak" : "Ütemezés inaktív"],
    ["SPETER kapcsolat", monitoring.accountMapping.stored.some((item) => item.brand === "SPETER"), "act_509645602062811"],
    ["IRISMOMENT kapcsolat", monitoring.accountMapping.stored.some((item) => item.brand === "IRISMOMENT"), "act_1664159937695658"]
  ] as const;
  return <>
    <div className="toolbar" style={{ justifyContent: "flex-end", marginBottom: 14 }}><button className="button" onClick={onRefresh} disabled={refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""}/>Felület frissítése</button><button className="button primary" onClick={onSync} disabled={syncing || monitoring.locks.length > 0}>{syncing ? <Loader2 className="animate-spin"/> : <Cloud/>}{syncing ? "Szinkron fut…" : "Meta-szinkron indítása"}</button></div>
    <div className="monitor-grid">{statusCards.map(([title, ok, detail]) => <div className="status-card" key={title}><div className="status-card-head"><h3>{title}</h3><span className={`status-indicator ${ok ? "" : "off"}`}/></div><p>{detail}</p></div>)}</div>
    <div className="split-grid"><Panel title="Szinkronizáció"><div className="panel-body"><div className="setting-row"><div><h3>Utolsó sikeres futás</h3><p>{monitoring.lastSuccessfulSync?.brand || "Mindkét márka"}</p></div><strong>{dateTime(monitoring.lastSuccessfulSync?.completedAt)}</strong></div><div className="setting-row"><div><h3>Utolsó sikertelen futás</h3><p>{monitoring.lastFailedSync?.errorCode || "Nincs új hiba"}</p></div><strong>{dateTime(monitoring.lastFailedSync?.completedAt)}</strong></div><div className="setting-row"><div><h3>Következő automatikus szinkron</h3><p>{monitoring.schedule.timezone}</p></div><strong>{dateTime(monitoring.schedule.next.sync)}</strong></div><div className="setting-row"><div><h3>Importált történeti időszak</h3><p>Legutóbbi adatszinkron: {dateTime(monitoring.dataFreshness.latestSyncedAt)}</p></div><strong>{monitoring.dataFreshness.earliestDataDate ? `${shortDate(monitoring.dataFreshness.earliestDataDate)} – ${shortDate(monitoring.dataFreshness.latestDataDate || "")}` : "—"}</strong></div></div></Panel>
    <Panel title="Legutóbbi futások" action={<span className="badge info">{monitoring.activeAlerts} aktív riasztás</span>}><div className="table-scroll"><table style={{ minWidth: 650 }}><thead><tr><th>Márka</th><th>Mód</th><th>Státusz</th><th>Időpont</th><th>Olvasott / írt</th><th>Retry</th></tr></thead><tbody>{monitoring.runs.slice(0, 8).map((run) => <tr key={run.id}><td>{run.brand || "—"}</td><td>{run.mode}</td><td><Badge value={run.status}/></td><td>{dateTime(run.completedAt || run.startedAt)}</td><td>{run.recordsRead} / {run.recordsWritten}</td><td>{run.retryCount}</td></tr>)}</tbody></table></div></Panel></div>
  </>;
}

function SettingsView({ theme, setTheme, refreshMinutes, setRefreshMinutes, defaultBrand, setDefaultBrand, defaultDays, setDefaultDays, monitoring, onLogout }: {
  theme: ThemeMode; setTheme: (value: ThemeMode) => void; refreshMinutes: number; setRefreshMinutes: (value: number) => void;
  defaultBrand: Brand; setDefaultBrand: (value: Brand) => void; defaultDays: number; setDefaultDays: (value: number) => void; monitoring?: Monitoring; onLogout: () => void;
}) {
  return <div className="settings-grid"><Panel title="Alkalmazás"><div className="panel-body"><div className="setting-row"><div><h3>Megjelenés</h3><p>Dark, light vagy rendszerbeállítás.</p></div><select className="select" value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}><option value="system">Rendszer</option><option value="dark">Sötét</option><option value="light">Világos</option></select></div><div className="setting-row"><div><h3>Automatikus felületfrissítés</h3><p>Csak a backend adatait olvassa újra.</p></div><select className="select" value={refreshMinutes} onChange={(event) => setRefreshMinutes(Number(event.target.value))}><option value={0}>Kikapcsolva</option><option value={5}>5 perc</option><option value={15}>15 perc</option><option value={30}>30 perc</option></select></div><div className="setting-row"><div><h3>Alapértelmezett márka</h3></div><select className="select" value={defaultBrand} onChange={(event) => setDefaultBrand(event.target.value as Brand)}><option>IRISMOMENT</option><option>SPETER</option></select></div><div className="setting-row"><div><h3>Alapértelmezett időszak</h3></div><select className="select" value={defaultDays} onChange={(event) => setDefaultDays(Number(event.target.value))}>{PERIODS.filter((item) => item.value !== 2).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div></Panel>
    <Panel title="Kapcsolat és biztonság"><div className="panel-body"><div className="setting-row"><div><h3>Backend kapcsolat</h3><p>https://spetly.app</p></div><Badge value={monitoring?.healthy ? "HEALTHY" : "DEGRADED"}/></div><div className="setting-row"><div><h3>Hitelesítés</h3><p>Főadmin token a macOS Keychainben.</p></div><ShieldCheck color="var(--success)" size={20}/></div><div className="setting-row"><div><h3>Meta kapcsolat</h3><p>Read-only · a secret kizárólag a szerveren található.</p></div><Badge value={monitoring?.metaConnection.configured ? "ACTIVE" : "FAILED"}/></div><div className="setting-row"><div><h3>Alkalmazásverzió</h3><p>Apple Silicon ARM64</p></div><strong>1.0.0</strong></div><button className="button danger" onClick={onLogout}><LogOut/>Kijelentkezés</button></div></Panel></div>;
}

function CampaignDrawer({ campaign, brand, days, currency, onClose, trends, placements, adSets, ads, recommendations }: {
  campaign: Campaign; brand: Brand; days: number; currency: string; onClose: () => void; trends: TrendRow[]; placements: Placement[]; adSets: AdSet[]; ads: Ad[]; recommendations: Recommendation[];
}) {
  const chart = trends.map((row) => ({ date: shortDate(row.date), spend: row.spend, leads: row.leads }));
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="drawer"><div className="drawer-head"><div><div className="breadcrumbs">{brand} / Kampány / {campaign.externalId}</div><h2>{campaign.name}</h2><div className="toolbar"><Badge value={campaign.deliveryStatus}/><span className="badge info">{days} nap</span><span className="badge">{campaign.objective || "Cél nélkül"}</span></div></div><button className="button icon-button" onClick={onClose}><X/></button></div>
    <div className="metric-row"><div className="metric-mini"><span>Spend</span><strong>{money(campaign.performance.spend, currency)}</strong></div><div className="metric-mini"><span>Meta lead</span><strong>{number(campaign.performance.leads)}</strong></div><div className="metric-mini"><span>CPL</span><strong>{money(campaign.performance.costPerLead, currency)}</strong></div><div className="metric-mini"><span>CTR</span><strong>{percent(campaign.performance.ctr)}</strong></div></div>
    <Panel title="Napi teljesítmény"><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="date" stroke="var(--muted-2)" fontSize={11}/><YAxis stroke="var(--muted-2)" fontSize={11}/><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10 }}/><Legend/><Line type="monotone" dataKey="spend" name="Költés" stroke="#83aef2" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="leads" name="Meta lead" stroke="#65d4aa" strokeWidth={2}/></LineChart></ResponsiveContainer></div></Panel>
    <div style={{ height: 14 }}/><Panel title={`Hirdetéssorozatok (${adSets.length})`}><div className="table-scroll"><table style={{ minWidth: 650 }}><thead><tr><th>Név</th><th>Státusz</th><th>Hirdetések</th><th>Spend</th><th>CTR</th><th>CPL</th></tr></thead><tbody>{adSets.map((item) => <tr key={item.id}><td>{item.name}</td><td><Badge value={item.deliveryStatus}/></td><td>{item._count.ads}</td><td>{money(item.performance.spend, currency)}</td><td>{percent(item.performance.ctr)}</td><td>{money(item.performance.costPerLead, currency)}</td></tr>)}</tbody></table></div></Panel>
    <div style={{ height: 14 }}/><Panel title={`Kapcsolódó hirdetések (${ads.length})`}><div className="panel-body alert-list">{ads.slice(0, 8).map((ad) => <div className="alert-card" key={ad.id}><div className="alert-icon" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Play/></div><div><h3>{ad.name}</h3><p>{ad.adSet?.name} · {money(ad.performance.spend, currency)} · CTR {percent(ad.performance.ctr)}</p></div><Badge value={ad.deliveryStatus}/></div>)}</div></Panel>
    <div style={{ height: 14 }}/><Panel title="Placementek" action={<span className="badge warning">Reach és frequency nem összegezhető</span>}><div className="table-scroll"><table style={{ minWidth: 680 }}><thead><tr><th>Placement</th><th>Eszköz</th><th>Spend</th><th>Impressions</th><th>CTR</th><th>LPV</th><th>Meta lead</th><th>CPL</th></tr></thead><tbody>{placements.map((row, index) => <tr key={`${row.publisherPlatform}-${row.platformPosition}-${row.impressionDevice}-${index}`}><td>{placementLabel(row.publisherPlatform, row.platformPosition)}</td><td>{row.impressionDevice}</td><td>{money(row.spend, currency)}</td><td>{number(row.impressions)}</td><td>{percent(row.linkCtr)}</td><td>{number(row.landingPageViews)}</td><td>{number(row.leads)}</td><td>{money(row.costPerLead, currency)}</td></tr>)}</tbody></table></div></Panel>
    <div style={{ height: 14 }}/><Panel title="Automatikus javaslatok"><div className="panel-body alert-list">{recommendations.filter((item) => !item.entityExternalId || item.entityExternalId === campaign.externalId).map((item) => <div className="alert-card" key={item.id}><div className="alert-icon"><Sparkles/></div><div><h3>{item.title}</h3><p>{item.recommendation}</p></div><Badge value="INFO" label={item.risk}/></div>)}{!recommendations.length ? <div className="empty">Nincs kapcsolódó javaslat.</div> : null}</div></Panel>
  </aside></div>;
}

export default function App() {
  const queryClient = useQueryClient();
  const [sessionState, setSessionState] = useState<"loading" | "signed_out" | "signed_in">("loading");
  const [view, setView] = useStoredState<ViewId>("desktop-view", "overview");
  const [defaultBrand, setDefaultBrand] = useStoredState<Brand>("desktop-default-brand", "IRISMOMENT");
  const [defaultDays, setDefaultDays] = useStoredState<number>("desktop-default-days", 30);
  const [brand, setBrand] = useStoredState<Brand>("desktop-brand", defaultBrand);
  const [days, setDays] = useStoredState<number>("desktop-days", defaultDays);
  const [campaignStatus, setCampaignStatus] = useStoredState("desktop-status", "all");
  const [theme, setTheme] = useStoredState<ThemeMode>("desktop-theme", "system");
  const [refreshMinutes, setRefreshMinutes] = useStoredState<number>("desktop-refresh", 15);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  useEffect(() => { hasSession().then((value) => setSessionState(value ? "signed_in" : "signed_out")).catch(() => setSessionState("signed_out")); }, []);
  useEffect(() => {
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [theme]);
  useEffect(() => {
    if (!refreshMinutes || sessionState !== "signed_in") return;
    const timer = window.setInterval(() => queryClient.invalidateQueries(), refreshMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [refreshMinutes, queryClient, sessionState]);

  const enabled = sessionState === "signed_in";
  const brandsQ = useQuery({ queryKey: ["brands"], queryFn: () => apiGet<ApiResponse<{ brands: BrandAnalytics[] }>>("/api/meta-ads/brands"), enabled });
  const overviewQ = useQuery({
    queryKey: ["overview"],
    queryFn: () => apiGet<ApiResponse<{ overview: { accounts: Array<{ account: Account }> } }>>("/api/meta-ads/overview"),
    enabled
  });
  const campaignsQ = useQuery({ queryKey: ["campaigns", brand, days], queryFn: () => apiGet<ApiResponse<{ campaigns: Campaign[] }>>(`/api/meta-ads/campaigns?brand=${brand}&days=${days}`), enabled });
  const trendsQ = useQuery({ queryKey: ["trends", brand, days], queryFn: () => apiGet<ApiResponse<{ trends: TrendRow[] }>>(`/api/meta-ads/trends?brand=${brand}&entityLevel=account&days=${days}`), enabled });
  const alertsQ = useQuery({ queryKey: ["alerts"], queryFn: () => apiGet<ApiResponse<{ alerts: AlertItem[] }>>("/api/meta-ads/alerts?status=active"), enabled });
  const recommendationsQ = useQuery({ queryKey: ["recommendations"], queryFn: () => apiGet<ApiResponse<{ recommendations: Recommendation[] }>>("/api/meta-ads/recommendations?status=active"), enabled });
  const adsQ = useQuery({ queryKey: ["ads", brand, days], queryFn: () => apiGet<ApiResponse<{ ads: Ad[] }>>(`/api/meta-ads/ads?brand=${brand}&days=${days}`), enabled: enabled && (view === "ads" || Boolean(selectedCampaign)) });
  const creativesQ = useQuery({ queryKey: ["creatives", brand, days], queryFn: () => apiGet<ApiResponse<{ creatives: CreativePerformance[] }>>(`/api/meta-ads/creatives?brand=${brand}&days=${days}`), enabled: enabled && view === "creatives" });
  const monitoringQ = useQuery({ queryKey: ["monitoring"], queryFn: () => apiGet<ApiResponse<{ monitoring: Monitoring }>>("/api/meta-ads/monitoring"), enabled, refetchInterval: view === "monitoring" ? 30_000 : false });
  const selectedId = selectedCampaign?.externalId;
  const campaignTrendsQ = useQuery({ queryKey: ["campaign-trends", selectedId, days], queryFn: () => apiGet<ApiResponse<{ trends: TrendRow[] }>>(`/api/meta-ads/trends?brand=${brand}&entityLevel=campaign&entityExternalId=${selectedId}&days=${days}`), enabled: enabled && Boolean(selectedId) });
  const placementsQ = useQuery({ queryKey: ["placements", selectedId, days], queryFn: () => apiGet<ApiResponse<{ placements: Placement[] }>>(`/api/meta-ads/placements?brand=${brand}&campaign=${selectedId}&days=${days}`), enabled: enabled && Boolean(selectedId) });
  const adSetsQ = useQuery({ queryKey: ["adsets", selectedId, days], queryFn: () => apiGet<ApiResponse<{ adSets: AdSet[] }>>(`/api/meta-ads/adsets?brand=${brand}&campaign=${selectedId}&days=${days}`), enabled: enabled && Boolean(selectedId) });
  const syncMutation = useMutation({ mutationFn: () => apiPost("/api/meta-ads/sync", { backfill: false, lookbackDays: 7 }), onSuccess: () => queryClient.invalidateQueries() });

  if (sessionState === "loading") return <div className="loading-screen"><div className="spinner"/></div>;
  if (sessionState === "signed_out") return <LoginScreen onSuccess={() => { setSessionState("signed_in"); queryClient.invalidateQueries(); }}/>

  const account = overviewQ.data?.overview.accounts.find((item) => item.account.brand === brand)?.account;
  const currency = currencyFor(brand, account?.currency);
  const brandData = brandsQ.data?.brands.find((item) => item.brand === brand);
  const comparison = brandData?.analytics.comparisons.find((item) => item.days === (days === 2 ? 1 : days)) || brandData?.analytics.comparisons.find((item) => item.days === 30);
  const metrics = comparison?.current || brandData?.analytics.lifetime || ({ spend: 0, impressions: 0, reach: 0, linkClicks: 0, outboundClicks: 0, landingPageViews: 0, leads: 0, purchases: 0, frequency: null, cpm: null, ctr: null, outboundCtr: null, cpc: null, costPerLandingPageView: null, costPerLead: null, costPerPurchase: null, landingPageConversionRate: null } satisfies Metrics);
  let campaigns = campaignsQ.data?.campaigns || [];
  if (campaignStatus !== "all") campaigns = campaigns.filter((campaign) => campaignStatus === "active" ? campaign.deliveryStatus === "ACTIVE" : campaignStatus === "paused" ? campaign.deliveryStatus.includes("PAUSED") : ["ARCHIVED", "DELETED", "COMPLETED"].includes(campaign.deliveryStatus));
  const alerts = alertsQ.data?.alerts.filter((item) => item.brand === brand) || [];
  const recommendations = recommendationsQ.data?.recommendations.filter((item) => item.brand === brand) || [];
  const monitoring = monitoringQ.data?.monitoring;
  const anyError = brandsQ.error || campaignsQ.error || trendsQ.error || monitoringQ.error;
  const pageTitle = NAV_ITEMS.find((item) => item.id === view)?.label || "Áttekintés";

  async function signOut() {
    await logout();
    queryClient.clear();
    setSessionState("signed_out");
  }

  return <div className="app-shell">
    <header className="titlebar"><span className="titlebar-title">SPETLY Ads Manager</span><span className="titlebar-status">{monitoring?.healthy ? <><CheckCircle2 size={14}/>Healthy</> : <><AlertTriangle size={14}/>Ellenőrzés</>}</span></header>
    <aside className="sidebar"><div className="brand-lockup"><strong>SPETLY</strong><span>Ads Manager</span></div><nav className="nav-list">{NAV_ITEMS.map((item) => <button key={item.id} className={`nav-button ${view === item.id ? "active" : ""}`} onClick={() => { setView(item.id); setSelectedCampaign(null); }}><item.icon/>{item.label}</button>)}</nav><div className="sidebar-footer">macOS · v1.0 · read-only</div></aside>
    <main className="content"><div className="page"><div className="page-head"><div><h1>{pageTitle}</h1><p>{view === "overview" ? "A legfontosabb Meta Ads üzleti adatok egy helyen." : view === "monitoring" ? "Felhőalapú adatgyűjtés és rendszerállapot." : "Valós, read-only production adatok."}</p></div>{!["monitoring", "settings"].includes(view) ? <GlobalFilters brand={brand} setBrand={setBrand} days={days} setDays={setDays} status={campaignStatus} setStatus={setCampaignStatus} showStatus={view === "campaigns"}/> : null}</div>
      <ErrorBanner error={anyError} retry={() => queryClient.invalidateQueries()}/>
      {view === "overview" && <OverviewView brand={brand} days={days} currency={currency} metrics={metrics} comparison={comparison} trends={trendsQ.data?.trends || []} campaigns={campaigns} alerts={alerts} recommendations={recommendations} latestSync={account?.lastSyncedAt}/>}
      {view === "campaigns" && <CampaignsView campaigns={campaigns} currency={currency} brand={brand} days={days} onSelect={setSelectedCampaign}/>}
      {view === "ads" && <AdsView ads={adsQ.data?.ads || []} currency={currency}/>}
      {view === "creatives" && <CreativesView items={creativesQ.data?.creatives || []} currency={currency}/>}
      {view === "alerts" && <AlertsView alerts={alertsQ.data?.alerts || []} recommendations={recommendationsQ.data?.recommendations || []} brand={brand}/>}
      {view === "monitoring" && monitoring ? <MonitoringView monitoring={monitoring} refreshing={monitoringQ.isFetching} onRefresh={() => queryClient.invalidateQueries()} syncing={syncMutation.isPending} onSync={() => syncMutation.mutate()}/> : null}
      {view === "settings" && <SettingsView theme={theme} setTheme={setTheme} refreshMinutes={refreshMinutes} setRefreshMinutes={setRefreshMinutes} defaultBrand={defaultBrand} setDefaultBrand={setDefaultBrand} defaultDays={defaultDays} setDefaultDays={setDefaultDays} monitoring={monitoring} onLogout={signOut}/>}
    </div></main>
    {selectedCampaign ? <CampaignDrawer campaign={selectedCampaign} brand={brand} days={days} currency={currency} onClose={() => setSelectedCampaign(null)} trends={campaignTrendsQ.data?.trends || []} placements={placementsQ.data?.placements || []} adSets={adSetsQ.data?.adSets || []} ads={(adsQ.data?.ads || []).filter((ad) => ad.campaignExternalId === selectedCampaign.externalId)} recommendations={recommendations}/> : null}
  </div>;
}
