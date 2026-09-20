import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowUpRight, Clock, RefreshCcw, RotateCcw, Terminal } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { useShelbyHost } from "../../context/ShelbyHostContext";

type Release = {
  id: string;
  status: string;
  stage: string;
  failed_stage?: string;
  error_message?: string;
  exit_code?: number;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  created_at: string;
  commit_sha?: string;
  branch?: string;
  build_command?: string;
  build_output?: string;
  framework?: string;
  package_manager?: string;
  content_hash: string;
  version_url?: string;
  shelby_manifest_url?: string;
  shelby_owner_address?: string;
  shelby_uploaded_at?: string;
  registry_tx_hash?: string;
  storage_backend?: string;
  pipeline_version: number;
};
type Log = { sequence: number; line: string; stream: string; stage: string; created_at: string };
type ResponseData = {
  deployments: Release[];
  activeDeploymentId?: string;
  buildConfig: Record<string, string>;
  logs: Log[];
  cursor: number;
  hasMore: boolean;
};
const stages = [
  "queued",
  "preparing",
  "cloning",
  "installing",
  "building",
  "validating",
  "uploading",
  "publishing",
  "ready",
];
export function DeploymentConsole({ slug }: { slug: string }) {
  const { getAccessToken } = usePrivy(),
    { refreshProjects } = useShelbyHost();
  const [releases, setReleases] = useState<Release[]>([]),
    [active, setActive] = useState<string>(),
    [selected, setSelected] = useState<string>(),
    [logs, setLogs] = useState<Log[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [follow, setFollow] = useState(true),
    [clock, setClock] = useState(Date.now());
  const [config, setConfig] = useState<Record<string, string>>({});
  const configLoaded = useRef(false),
    cursor = useRef(0),
    end = useRef<HTMLDivElement>(null);
  const selectedRelease = releases.find((d) => d.id === selected);
  const terminalKey = releases
    .filter((d) => ["ready", "failed"].includes(d.status))
    .map((d) => d.id)
    .join(",");
  const previousTerminal = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousTerminal.current !== undefined && previousTerminal.current !== terminalKey)
      void refreshProjects();
    previousTerminal.current = terminalKey;
  }, [terminalKey, refreshProjects]);
  const load = useCallback(async () => {
    const result = await apiRequest<ResponseData>(
      `/api/deployments?slug=${encodeURIComponent(slug)}`,
      {},
      getAccessToken,
    );
    setReleases(result.deployments);
    setActive(result.activeDeploymentId);
    setSelected((old) => old || result.deployments[0]?.id);
    if (!configLoaded.current) {
      setConfig(result.buildConfig);
      configLoaded.current = true;
    }
    return result;
  }, [slug, getAccessToken]);
  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        await load();
        if (live) setError("");
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    };
    void poll();
    const timer = setInterval(() => {
      setClock(Date.now());
      void poll();
    }, 2500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    let live = true,
      timer: ReturnType<typeof setTimeout>;
    cursor.current = 0;
    setLogs([]);
    if (!selected) return;
    const poll = async () => {
      try {
        const result = await apiRequest<ResponseData>(
          `/api/deployments?slug=${encodeURIComponent(slug)}&deploymentId=${selected}&after=${cursor.current}`,
          {},
          getAccessToken,
        );
        if (!live) return;
        cursor.current = result.cursor;
        setLogs((old) => [...old, ...result.logs]);
        timer = setTimeout(poll, result.hasMore ? 50 : 2000);
      } catch (e) {
        if (live) {
          setError((e as Error).message);
          timer = setTimeout(poll, 4000);
        }
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [slug, selected, getAccessToken]);
  useEffect(() => {
    if (follow) end.current?.scrollIntoView({ block: "nearest" });
  }, [logs, follow]);
  async function action(rollback?: string) {
    setBusy(true);
    setError("");
    try {
      const clean = Object.fromEntries(Object.entries(config).filter(([, v]) => v.trim()));
      const result = await apiRequest<{ deploymentId?: string }>(
        "/api/deployments",
        {
          method: rollback ? "PATCH" : "POST",
          body: rollback
            ? { projectSlug: slug, deploymentId: rollback }
            : { projectSlug: slug, config: clean },
        },
        getAccessToken,
      );
      if (result.deploymentId) setSelected(result.deploymentId);
      await load();
      await refreshProjects();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const duration =
    selectedRelease?.duration_ms ??
    (selectedRelease?.started_at ? clock - Date.parse(selectedRelease.started_at) : 0);
  return (
    <section className="mt-6 space-y-5" aria-label="Deployment console">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Deployment pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Real build output, polled from the worker. Production changes only after successful
            publication.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => action()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-bold disabled:opacity-50"
        >
          <RefreshCcw size={16} />
          Deploy source
        </button>
      </div>
      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">Build configuration</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["rootDirectory", "Root directory", "."],
            ["buildCommand", "Build command", "Auto-detect"],
            ["outputDirectory", "Output directory", "Auto-detect"],
          ].map(([key, label, placeholder]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                value={config[key] || ""}
                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                placeholder={placeholder}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          These settings apply to the next deployment. Environment variables are configured in
          project settings.
        </p>
      </details>
      {error && (
        <div
          role="alert"
          className="whitespace-pre-wrap rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="max-h-[680px] space-y-2 overflow-auto" aria-label="Deployment history">
          {releases.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={`w-full rounded-lg border p-3 text-left ${selected === d.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-bold ${d.status === "failed" ? "text-destructive" : d.status === "ready" ? "text-success" : ""}`}
                >
                  {d.status === "failed"
                    ? `Failed · ${d.failed_stage || d.stage}`
                    : d.stage || d.status}
                </span>
                {active === d.id && <span className="text-xs text-success">Production</span>}
              </div>
              <p className="mt-2 font-mono text-xs">
                {d.id.slice(0, 8)} · {d.commit_sha?.slice(0, 8) || "Source upload"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(d.created_at).toLocaleString()}
              </p>
            </button>
          ))}
          {!releases.length && (
            <p className="p-4 text-sm text-muted-foreground">
              No deployments yet. Submit source to run your first build.
            </p>
          )}
        </aside>
        {selectedRelease && (
          <div className="min-w-0 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap gap-2" aria-label="Build stages">
                {stages.map((stage, i) => {
                  const current = stages.indexOf(selectedRelease.stage);
                  return (
                    <span
                      key={stage}
                      className={`rounded px-2 py-1 text-xs capitalize ${selectedRelease.failed_stage === stage ? "bg-destructive/10 text-destructive" : i < current || (stage === "ready" && selectedRelease.status === "ready") ? "bg-success/10 text-success" : stage === selectedRelease.stage ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {stage}
                    </span>
                  );
                })}
              </div>
              <p
                className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <Clock size={13} />
                {Math.max(0, Math.round(duration / 1000))} seconds ·{" "}
                {selectedRelease.status === "failed"
                  ? `Failed during ${selectedRelease.failed_stage}`
                  : selectedRelease.stage}
              </p>
            </div>
            {selectedRelease.error_message && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"
              >
                <strong>
                  Failed during {selectedRelease.failed_stage}
                  {selectedRelease.exit_code != null ? ` · exit ${selectedRelease.exit_code}` : ""}
                </strong>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {selectedRelease.error_message}
                </pre>
                <p className="mt-3 text-xs">
                  {active
                    ? "The previously published production version remains active."
                    : "No production version has been published yet."}
                </p>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 text-xs sm:grid-cols-3">
              {[
                ["Branch", selectedRelease.branch],
                ["Commit", selectedRelease.commit_sha],
                ["Framework", selectedRelease.framework],
                ["Package manager", selectedRelease.package_manager],
                ["Build command", selectedRelease.build_command],
                ["Output directory", selectedRelease.build_output],
                ["Version", selectedRelease.id],
                ["Content hash", selectedRelease.content_hash],
                ["Storage", selectedRelease.storage_backend],
                ["Shelby account", selectedRelease.shelby_owner_address],
                ["Stored at", selectedRelease.shelby_uploaded_at],
                ["Registry transaction", selectedRelease.registry_tx_hash],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-all font-mono">{value || "Not available yet"}</dd>
                </div>
              ))}
            </dl>
            {selectedRelease.status === "ready" && (
              <div className="flex flex-wrap gap-3">
                <a
                  href={selectedRelease.version_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
                >
                  Open immutable release
                  <ArrowUpRight size={14} />
                </a>
                {active !== selectedRelease.id && (
                  <button
                    disabled={busy}
                    onClick={() => action(selectedRelease.id)}
                    className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
                  >
                    <RotateCcw size={14} />
                    Roll back to this release
                  </button>
                )}
                <span className="self-center text-xs text-muted-foreground">
                  {active === selectedRelease.id
                    ? "Serving production"
                    : "Ready version; not serving production"}
                </span>
              </div>
            )}
            <div className="overflow-hidden rounded-lg bg-[#18231e] text-[#d1ddce]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs">
                <span className="flex items-center gap-2">
                  <Terminal size={14} />
                  Worker logs · stdout / stderr
                </span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={follow}
                    onChange={(e) => setFollow(e.target.checked)}
                  />
                  Follow
                </label>
              </div>
              <div
                className="max-h-[480px] min-h-52 overflow-auto p-4 font-mono text-xs leading-6"
                aria-label="Build logs"
              >
                {logs.map((line) => (
                  <div
                    key={line.sequence}
                    className={`whitespace-pre-wrap break-words ${line.stream === "stderr" ? "text-red-300" : line.stream === "system" ? "text-emerald-300" : ""}`}
                  >
                    <span className="text-white/40">
                      {new Date(line.created_at).toLocaleTimeString()} [{line.stage}/{line.stream}
                      ]{" "}
                    </span>
                    {line.line}
                  </div>
                ))}
                {!logs.length && (
                  <p className="text-white/50">
                    {selectedRelease.status === "queued"
                      ? "Waiting for an available worker. No build commands have run yet."
                      : "No log output recorded for this deployment."}
                  </p>
                )}
                <div ref={end} />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
