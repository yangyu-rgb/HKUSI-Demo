import { useEffect, useMemo, useRef, useState } from "react";
import { BorderCommuteScene } from "./BorderCommuteScene/BorderCommuteScene";
import { CONGESTION_CONFIG } from "./BorderCommuteScene/congestionConfig";
import { loadGeographyAsset } from "./BorderCommuteScene/geographyAsset";
import { normalizeRouteStatuses } from "./BorderCommuteScene/routeDataAdapter";
import type { QualityLevel } from "./BorderCommuteScene/types";
import type { PortStatus } from "./types";
import styles from "./PortFlowScene.module.css";

function detectInitialQuality(): QualityLevel {
  if (typeof window === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || memory <= 4) return "low";
  if (cores >= 10 && memory >= 8) return "high";
  return "medium";
}

export function PortFlowScene({ ports }: { ports: PortStatus[] }) {
  const host = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const scene = useRef<BorderCommuteScene | null>(null);
  const statuses = useMemo(() => normalizeRouteStatuses(ports), [ports]);
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
  const [available, setAvailable] = useState(true);
  const [ready, setReady] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
  const [autoTourEnabled, setAutoTourEnabled] = useState(true);
  const [autoTourPaused, setAutoTourPaused] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>(detectInitialQuality);
  const [performanceSummary, setPerformanceSummary] = useState("");
  const [geographyMode, setGeographyMode] = useState<"loading" | "osm" | "fallback">("loading");
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const abortController = new AbortController();
    let runtime: BorderCommuteScene | null = null;
    let cancelled = false;
    setReady(false);
    setAvailable(true);
    setGeographyMode("loading");
    setAutoTourPaused(false);

    void (async () => {
      let geographyAsset = null;
      try {
        geographyAsset = await loadGeographyAsset(abortController.signal);
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.warn("Unable to load offline geography; using simplified fallback", error);
      }
      if (cancelled) return;

      try {
        runtime = new BorderCommuteScene(container, statusesRef.current, quality, reducedMotion, geographyAsset, {
          onHover: setHoveredPortId,
          onSelectionChange: ({ routeId }) => setSelectedPortId(routeId),
          onAutoTourChange: setAutoTourEnabled,
          onAutoTourPauseChange: setAutoTourPaused,
          onTooltipPosition: (x, y) => {
            visual.current?.style.setProperty("--tooltip-x", `${x}px`);
            visual.current?.style.setProperty("--tooltip-y", `${y}px`);
          },
          onAvailabilityChange: setAvailable,
          onPerformanceUpdate: setPerformanceSummary,
        });
        scene.current = runtime;
        setGeographyMode(geographyAsset ? "osm" : "fallback");
        setReady(true);
      } catch (error) {
        console.error("Unable to initialize border commute WebGL scene", error);
        setAvailable(false);
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      runtime?.dispose();
      if (scene.current === runtime) scene.current = null;
    };
  }, [quality, reducedMotion]);

  useEffect(() => {
    scene.current?.updateStatuses(statuses);
  }, [statuses]);

  const detailsId = hoveredPortId ?? selectedPortId;
  const detail = statuses.find((status) => status.id === detailsId);

  function focus(portId: string | null) {
    scene.current?.focus(portId);
  }

  return (
    <section className={styles.panel} aria-labelledby="flow-title">
      <header className={styles.heading}>
        <div>
          <span className="sectionKicker">Live border digital twin</span>
          <h2 id="flow-title">Hong Kong–Shenzhen live four-port flow</h2>
          <p>A city-scale traffic model based on offline geography and road data. Color shows pressure, particle density shows flow, and speed shows throughput.</p>
        </div>
        <div className={styles.legend} aria-label="Four-level congestion legend">
          {(Object.entries(CONGESTION_CONFIG) as Array<[keyof typeof CONGESTION_CONFIG, (typeof CONGESTION_CONFIG)[keyof typeof CONGESTION_CONFIG]]>).map(([level, config]) => (
            <span key={level}><i style={{ background: config.color, color: config.color }} />{config.label}</span>
          ))}
        </div>
      </header>

      <div className={styles.visual} ref={visual}>
        <div className={styles.mapMeta} aria-hidden="true">
          <span><i />LIVE SCENE</span>
          <b>22.45°N · 114.06°E</b>
        </div>
        <div
          className={styles.scene}
          ref={host}
          role="region"
          tabIndex={0}
          aria-describedby="flow-interaction-hint"
          aria-label={`Hong Kong and Shenzhen four-port geographic flow. ${statuses.map((status) => `${status.nameEn} Port is ${CONGESTION_CONFIG[status.congestionLevel].label}, with an estimated ${status.waitingTime}-minute wait`).join("; ")}`}
        >
          {!ready && available && (
            <div className={styles.loading} role="status">
              <span />
              <strong>Building the Hong Kong–Shenzhen city model</strong>
              <small>Loading terrain, ports, and live routes…</small>
            </div>
          )}
          {!available && (
            <div className={styles.fallback} role="status">
              <strong>This browser cannot run the 3D scene</strong>
              <p>Live port status remains available through the route controls and port cards below.</p>
            </div>
          )}
        </div>

        <div className={styles.sceneControls} aria-label="3D scene controls">
          <button type="button" onClick={() => focus(null)} disabled={!selectedPortId}>Overview</button>
          <button
            type="button"
            aria-pressed={autoTourEnabled}
            disabled={reducedMotion}
            title={reducedMotion ? "Reduced motion is enabled, so auto tour remains off" : undefined}
            onClick={() => scene.current?.setAutoTour(!autoTourEnabled)}
          >
            Auto tour {autoTourEnabled ? (autoTourPaused ? "Paused" : "On") : "Off"}
          </button>
          <label>
            <span>Quality</span>
            <select value={quality} onChange={(event) => setQuality(event.target.value as QualityLevel)}>
              <option value="low">Performance</option>
              <option value="medium">Balanced</option>
              <option value="high">Detailed</option>
            </select>
          </label>
        </div>

        {detail && (
          <aside className={styles.tooltip} aria-live="polite" aria-atomic="true">
            <span style={{ color: CONGESTION_CONFIG[detail.congestionLevel].color }}>{CONGESTION_CONFIG[detail.congestionLevel].label}</span>
            <strong>{detail.nameEn} Port</strong>
            <p>Estimated wait: <b>about {detail.waitingTime} minutes</b></p>
          </aside>
        )}

        {import.meta.env.DEV && performanceSummary && <output className={styles.performance}>{quality} · {performanceSummary}</output>}
        <span className={styles.interactionHint} id="flow-interaction-hint">Drag to rotate · Scroll to zoom · Arrow keys to pan · Hover to inspect · Click to focus</span>
      </div>

      <div className={styles.routes} aria-label="Four-port route focus controls">
        {statuses.map((status, index) => {
          const config = CONGESTION_CONFIG[status.congestionLevel];
          const selected = selectedPortId === status.id;
          return (
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`${status.nameEn} Port, ${config.label}, estimated wait ${status.waitingTime} minutes`}
              className={`${styles.routeButton} ${selected ? styles.selected : ""}`}
              onClick={() => focus(selected ? null : status.id)}
              key={status.id}
            >
              <span className={styles.routeIndex}>{String(index + 1).padStart(2, "0")}</span>
              <i style={{ background: config.color, color: config.color }} />
              <span><b>{status.nameEn} Port</b></span>
              <em>{config.label}</em>
            </button>
          );
        })}
      </div>
      <small className={styles.notice}>
        {geographyMode === "fallback" ? "Offline geography failed to load; using simplified outlines. " : "Geography and road base map: "}
        {geographyMode !== "fallback" && (
          <><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>. </>
        )}
        For situation demonstration only; not surveying, passenger tracking, or navigation. Live wait data continues to use the existing Demo API.
      </small>
    </section>
  );
}
