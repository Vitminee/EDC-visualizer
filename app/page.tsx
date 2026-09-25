"use client";

import Image from "next/image";
import { ChangeEvent, useCallback, useMemo, useRef, useState } from "react";
import { Background, BaseEdge, EdgeLabelRenderer, Handle, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type Period = "day" | "week" | "month" | "quarter" | "year" | "custom" | "all";
type Role = "in" | "out";

type Reading = {
  date: Date;
  values: number[];
};

type Connection = {
  id: string;
  source: string;
  target: string;
  values: number[];
};

type Building = {
  id: string;
  name: string;
  role: Role;
  eans: string[];
};

function flowPosition(index: number, count: number) {
  if (count === 3) return [{ x: 400, y: 20 }, { x: 80, y: 390 }, { x: 720, y: 390 }][index];
  if (count === 4) return [{ x: 80, y: 50 }, { x: 720, y: 50 }, { x: 720, y: 360 }, { x: 80, y: 360 }][index];
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return { x: 400 + Math.cos(angle) * 320, y: 220 + Math.sin(angle) * 180 };
}

type FlowNodeData = {
  building: Building;
  total: { incoming: number; outgoing: number };
  self: number;
  onRename: (id: string, name: string) => void;
  layoutIndex: number;
  layoutCount: number;
};

function BuildingFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  return <div className="flow-building-node"><Handle type="target" id="target-top-left" className="corner top-left" position={Position.Top} /><Handle type="source" id="source-top-left" className="corner top-left" position={Position.Top} /><Handle type="target" id="target-top-right" className="corner top-right" position={Position.Top} /><Handle type="source" id="source-top-right" className="corner top-right" position={Position.Top} /><Handle type="target" id="target-bottom-left" className="corner bottom-left" position={Position.Bottom} /><Handle type="source" id="source-bottom-left" className="corner bottom-left" position={Position.Bottom} /><Handle type="target" id="target-bottom-right" className="corner bottom-right" position={Position.Bottom} /><Handle type="source" id="source-bottom-right" className="corner bottom-right" position={Position.Bottom} /><Handle type="target" id="target-left-top" className="corner left-top" position={Position.Left} /><Handle type="source" id="source-left-top" className="corner left-top" position={Position.Left} /><Handle type="target" id="target-left-bottom" className="corner left-bottom" position={Position.Left} /><Handle type="source" id="source-left-bottom" className="corner left-bottom" position={Position.Left} /><Handle type="target" id="target-right-top" className="corner right-top" position={Position.Right} /><Handle type="source" id="source-right-top" className="corner right-top" position={Position.Right} /><Handle type="target" id="target-right-bottom" className="corner right-bottom" position={Position.Right} /><Handle type="source" id="source-right-bottom" className="corner right-bottom" position={Position.Right} /><input aria-label={`Name for ${data.building.id}`} value={data.building.name} onChange={(event) => data.onRename(data.building.id, event.target.value)} /><div className="node-metric"><span>Self</span><strong>{formatKwh(data.self)}</strong></div><div className="node-stats"><span>in {formatKwh(data.total.incoming)}</span><span>out {formatKwh(data.total.outgoing)}</span></div></div>;
}

const flowNodeTypes = { building: BuildingFlowNode };

function BuildingFlowEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<Edge<{ amount: string; lane: number; labelT: number; labelVertical: number; color: string; markerId: string }>>) {
  const lane = data?.lane || 0;
  const offsetPoint = (x: number, y: number, position: Position) => position === Position.Top || position === Position.Bottom ? { x: x + lane, y } : { x, y: y + lane };
  const source = offsetPoint(sourceX, sourceY, sourcePosition);
  const target = offsetPoint(targetX, targetY, targetPosition);
  const path = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  const labelT = data?.labelT ?? 0.5;
  const labelBaseX = source.x + (target.x - source.x) * labelT;
  const labelBaseY = source.y + (target.y - source.y) * labelT;
  const length = Math.max(Math.hypot(target.x - source.x, target.y - source.y), 1);
  const normalX = -(target.y - source.y) / length;
  const normalY = (target.x - source.x) / length;
  const sideOffset = lane === 0 ? 12 : Math.sign(lane) * 12;
  const labelX = labelBaseX + normalX * sideOffset + (data?.color === "#168578" ? -24 : 0);
  const labelY = labelBaseY + normalY * sideOffset + (data?.labelVertical || 0);
  return <><BaseEdge path={path} markerEnd={`url(#${data?.markerId || "flow-arrow-orange"})`} style={{ stroke: data?.color || "#f2a65a", strokeWidth: 3 }} /><EdgeLabelRenderer><div className="flow-edge-label" style={{ color: data?.color, background: data?.color === "#168578" ? "#d9f0ea" : "#f8dfc4", transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}>{data?.amount}</div></EdgeLabelRenderer></>;
}

const flowEdgeTypes = { connection: BuildingFlowEdge };

function edgeHandles(source: { x: number; y: number }, target: { x: number; y: number }) {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return { source: `${deltaX >= 0 ? "right" : "left"}-${deltaY >= 0 ? "bottom" : "top"}`, target: `${deltaX >= 0 ? "left" : "right"}-${deltaY >= 0 ? "top" : "bottom"}` };
  return { source: `${deltaY >= 0 ? "bottom" : "top"}-${deltaX >= 0 ? "right" : "left"}`, target: `${deltaY >= 0 ? "top" : "bottom"}-${deltaX >= 0 ? "left" : "right"}` };
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatKwh(value: number) {
  return `${numberFormat.format(value)} kWh`;
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += character;
  }
  cells.push(cell.trim());
  return cells.map((value) => value.replace(/^"|"$/g, ""));
}

function parseDate(value: string) {
  const [day, month, year] = value.split(/[./-]/).map(Number);
  return new Date(year, month - 1, day);
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = splitCsvLine(lines[0], delimiter);
  const columns = header.slice(3).filter(Boolean);
  const readings = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return {
      date: parseDate(cells[0]),
      values: columns.map((_, index) => Number((cells[index + 3] || "0").replace(",", ".")) || 0),
    };
  });
  return { columns, readings };
}

function uniqueIds(columns: string[]) {
  return Array.from(new Set(columns.flatMap((column) => column.split("-"))));
}

function buildBuildings(ids: string[], names: Record<string, string>) {
  const groups = new Map<string, Building>();
  ids.forEach((id, index) => {
    const name = names[id] || `Building ${index + 1}`;
    const key = name.trim().toLocaleLowerCase();
    const existing = groups.get(key);
    if (existing) existing.eans.push(id);
    else groups.set(key, { id: `building-${id}`, name, role: index === 0 ? "out" : "in", eans: [id] });
  });
  return Array.from(groups.values());
}

function periodStart(date: Date, period: Period) {
  const start = new Date(date);
  if (period === "day") start.setHours(0, 0, 0, 0);
  if (period === "week") {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  }
  if (period === "month") start.setDate(1);
  if (period === "quarter") start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  if (period === "year") start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function periodEnd(date: Date, period: Period) {
  const end = periodStart(date, period);
  if (period === "day") end.setDate(end.getDate() + 1);
  if (period === "week") end.setDate(end.getDate() + 7);
  if (period === "month") end.setMonth(end.getMonth() + 1);
  if (period === "quarter") end.setMonth(end.getMonth() + 3);
  if (period === "year") end.setFullYear(end.getFullYear() + 1);
  return end;
}

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodLabel(date: Date, period: Period) {
  if (period === "day") return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (period === "week") return `Week of ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  if (period === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  if (period === "custom") return "Custom range";
  if (period === "year") return String(date.getFullYear());
  if (period === "all") return "All time";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function exactDate(date: Date | null) {
  return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

function readEanNames() {
  const value = document.cookie.split("; ").find((item) => item.startsWith("gridline_ean_names="))?.split("=")[1];
  if (!value) return {} as Record<string, string>;
  try { return JSON.parse(decodeURIComponent(value)) as Record<string, string>; } catch { return {}; }
}

function writeEanNames(names: Record<string, string>) {
  document.cookie = `gridline_ean_names=${encodeURIComponent(JSON.stringify(names))}; max-age=31536000; path=/; samesite=lax`;
}

export default function Home() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [eanNames, setEanNames] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("No CSV loaded");

  const dataBounds = useMemo(() => {
    if (!readings.length) return { start: null, end: null };
    const timestamps = readings.map((reading) => reading.date.getTime());
    return { start: new Date(Math.min(...timestamps)), end: new Date(Math.max(...timestamps)) };
  }, [readings]);

  const range = useMemo(() => {
    if (period === "all") return { start: dataBounds.start || new Date(0), end: dataBounds.end || new Date(0) };
    if (period === "custom") return { start: new Date(`${customStart}T00:00:00`), end: new Date(`${customEnd}T23:59:59`) };
    return { start: periodStart(selectedDate, period), end: new Date(periodEnd(selectedDate, period).getTime() - 1) };
  }, [customEnd, customStart, dataBounds, period, selectedDate]);

  const eanToBuilding = useMemo(() => {
    const result = new Map<string, Building>();
    buildings.forEach((building) => building.eans.forEach((ean) => result.set(ean, building)));
    return result;
  }, [buildings]);

  const connections = useMemo<Connection[]>(() => headers.map((header, index) => {
    const [source, target] = header.split("-");
    const values = readings.filter((reading) => reading.date >= range.start && reading.date <= range.end).map((reading) => reading.values[index] || 0);
    return { id: `${header}-${index}`, source, target, values };
  }), [headers, range, readings]);

  const flows = useMemo(() => connections.map((connection) => ({
    ...connection,
    source: eanToBuilding.get(connection.source)?.id || connection.source,
    target: eanToBuilding.get(connection.target)?.id || connection.target,
    total: connection.values.reduce((sum, value) => sum + value, 0),
  })).filter((connection) => connection.total > 0 && connection.source !== connection.target), [connections, eanToBuilding]);
  const allFlows = useMemo(() => connections.map((connection) => ({
    ...connection,
    source: eanToBuilding.get(connection.source)?.id || connection.source,
    target: eanToBuilding.get(connection.target)?.id || connection.target,
    total: connection.values.reduce((sum, value) => sum + value, 0),
  })).filter((connection) => connection.total > 0), [connections, eanToBuilding]);
  const selfTotals = useMemo(() => {
    const result = new Map<string, number>();
    allFlows.filter((flow) => flow.source === flow.target).forEach((flow) => result.set(flow.source, (result.get(flow.source) || 0) + flow.total));
    return result;
  }, [allFlows]);
  const tableFlows = allFlows;
  const tableTotal = tableFlows.reduce((sum, flow) => sum + flow.total, 0);
  const totals = useMemo(() => {
    const result = new Map<string, { incoming: number; outgoing: number }>();
    buildings.forEach((building) => result.set(building.id, { incoming: 0, outgoing: 0 }));
    allFlows.forEach(({ source, target, total }) => {
      result.get(source)!.outgoing += total;
      result.get(target)!.incoming += total;
    });
    return result;
  }, [allFlows, buildings]);
  const totalEnergy = flows.reduce((sum, flow) => sum + flow.total, 0);
  const activeBuildings = buildings.filter((building) => {
    const total = totals.get(building.id);
    return total && (total.incoming + total.outgoing > 0 || (selfTotals.get(building.id) || 0) > 0);
  });
  const renameBuilding = useCallback((id: string, name: string) => {
    setBuildings((current) => current.map((building) => building.id === id ? { ...building, name } : building));
    setEanNames((current) => {
      const building = buildings.find((item) => item.id === id);
      const next = { ...current };
      building?.eans.forEach((ean) => { next[ean] = name; });
      writeEanNames(next);
      return next;
    });
  }, [buildings]);
  const flowNodes = useMemo<Node<FlowNodeData>[]>(() => activeBuildings.map((building, index) => ({
    id: building.id,
    type: "building",
    position: flowPosition(index, activeBuildings.length),
    data: { building, total: totals.get(building.id) || { incoming: 0, outgoing: 0 }, self: selfTotals.get(building.id) || 0, onRename: renameBuilding, layoutIndex: index, layoutCount: activeBuildings.length },
  })), [activeBuildings, renameBuilding, selfTotals, totals]);
  const flowEdges = useMemo<Edge[]>(() => {
    const pairCounts = new Map<string, number>();
    const pairTotals = new Map<string, number>();
    flows.forEach((flow) => {
      const pairKey = [flow.source, flow.target].sort().join("-");
      pairTotals.set(pairKey, (pairTotals.get(pairKey) || 0) + 1);
    });
    return flows.map((flow) => {
      const pairKey = [flow.source, flow.target].sort().join("-");
      const pairIndex = pairCounts.get(pairKey) || 0;
      pairCounts.set(pairKey, pairIndex + 1);
      const pairTotal = pairTotals.get(pairKey) || 1;
      const lane = (pairIndex - (pairTotal - 1) / 2) * 72;
      const labelT = pairTotal === 1 ? 0.5 : 0.5 + (pairIndex - (pairTotal - 1) / 2) * 0.1;
      const labelVertical = pairTotal === 1 ? 0 : (pairIndex - (pairTotal - 1) / 2) * 44;
      const sourceIndex = activeBuildings.findIndex((building) => building.id === flow.source);
      const targetIndex = activeBuildings.findIndex((building) => building.id === flow.target);
      const handles = edgeHandles(flowPosition(sourceIndex, activeBuildings.length), flowPosition(targetIndex, activeBuildings.length));
      const canonicalSource = [flow.source, flow.target].sort()[0];
      const color = flow.source === canonicalSource ? "#168578" : "#f2a65a";
      return { id: flow.id, source: flow.source, target: flow.target, sourceHandle: `source-${handles.source}`, targetHandle: `target-${handles.target}`, type: "connection", data: { amount: formatKwh(flow.total), lane, labelT, labelVertical, color, markerId: color === "#168578" ? "flow-arrow-teal" : "flow-arrow-orange" } };
    });
  }, [activeBuildings, flows]);

  function updateEanBuildingName(ean: string, name: string) {
    const nextName = name.trim() || "Building 1";
    const groupKey = nextName.toLocaleLowerCase();
    setEanNames((current) => {
      const next = { ...current, [ean]: nextName };
      writeEanNames(next);
      return next;
    });
    setBuildings((current) => {
      const source = current.find((building) => building.eans.includes(ean));
      if (!source) return current;
      const target = current.find((building) => building.id !== source.id && building.name.trim().toLocaleLowerCase() === groupKey);
      if (target) {
        return current.map((building) => building.id === target.id
          ? { ...building, eans: Array.from(new Set([...building.eans, ean])) }
          : { ...building, eans: building.eans.filter((item) => item !== ean) }).filter((building) => building.eans.length > 0);
      }
      return [...current.map((building) => building.id === source.id ? { ...building, eans: building.eans.filter((item) => item !== ean) } : building).filter((building) => building.eans.length > 0), { id: `building-${ean}`, name: nextName, role: source.role, eans: [ean] }];
    });
  }

  function shiftPeriod(direction: number) {
    if (period === "custom" || period === "all") return;
    const next = new Date(selectedDate);
    if (period === "day") next.setDate(next.getDate() + direction);
    if (period === "week") next.setDate(next.getDate() + direction * 7);
    if (period === "month") next.setMonth(next.getMonth() + direction);
    if (period === "quarter") next.setMonth(next.getMonth() + direction * 3);
    if (period === "year") next.setFullYear(next.getFullYear() + direction);
    setSelectedDate(next);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseCsv(await file.text());
    const ids = uniqueIds(parsed.columns);
    const savedNames = readEanNames();
    const nextNames = Object.fromEntries(ids.map((id, index) => [id, savedNames[id] || `Building ${index + 1}`]));
    setHeaders(parsed.columns);
    setReadings(parsed.readings);
    setEanNames(nextNames);
    writeEanNames({ ...savedNames, ...nextNames });
    setBuildings(buildBuildings(ids, nextNames));
    setFileName(file.name);
    if (parsed.readings[0]) {
      setSelectedDate(parsed.readings[0].date);
      setCustomStart(inputDate(parsed.readings[0].date));
      setCustomEnd(inputDate(parsed.readings[parsed.readings.length - 1]?.date || parsed.readings[0].date));
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span>EDC sharing visualizer</span></div>
        <div className="file-status"><span className="status-dot" /> {fileName} <span className="file-size">· {readings.length.toLocaleString()} intervals</span></div>
        <button className="upload-button" onClick={() => fileInput.current?.click()}><span>↑</span> Upload CSV</button>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={handleUpload} />
      </header>

      <section className="toolbar">
        <div className="period-tabs">{(["day", "week", "month", "quarter", "year", "all"] as Period[]).map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item === "all" ? "All time" : item}</button>)}<button className={period === "custom" ? "active" : ""} onClick={() => setPeriod("custom")}>Custom range</button></div>
        {period === "custom" ? <div className="custom-dates"><label>From <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><span>to</span><label>To <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div> : <div className="date-nav"><button aria-label="Previous period" disabled={period === "all"} onClick={() => shiftPeriod(-1)}>←</button><strong>{periodLabel(selectedDate, period)}</strong><button aria-label="Next period" disabled={period === "all"} onClick={() => shiftPeriod(1)}>→</button><button className="today-button" onClick={() => setSelectedDate(new Date())}>Today</button></div>}
        <div className="range-readout"><span>From <strong>{exactDate(range.start)}</strong></span><span>To <strong>{exactDate(range.end)}</strong></span></div>
      </section>

      <section className="summary-row">
        <div className="summary-card accent"><span>Total transferred</span><strong>{formatKwh(totalEnergy)}</strong><small>Across {flows.length} active connections</small></div>
        <div className="summary-card"><span>Buildings</span><strong>{activeBuildings.length}<em> / {buildings.length}</em></strong><small>Active this period</small></div>
      </section>

      <section className="map-section">
        <div className="section-heading"><div><p className="eyebrow">Live flow map</p><h2>Building connections</h2></div></div>
        <div className="flow-map">
          <svg className="flow-marker-defs" aria-hidden="true"><defs><marker id="flow-arrow-orange" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#f2a65a" /></marker><marker id="flow-arrow-teal" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#168578" /></marker></defs></svg>
          {activeBuildings.length > 0 ? <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={flowNodeTypes} edgeTypes={flowEdgeTypes} fitView fitViewOptions={{ padding: 0.2 }} nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} panOnDrag={false}><Background color="#ffffff" gap={54} size={1} /></ReactFlow> : <div className="empty-map">No energy flows in this period. Move to another period or upload a different CSV.</div>}
        </div>
      </section>

      <section className="ean-section"><div className="section-heading"><div><p className="eyebrow">EAN setup</p><h2>Group meters into buildings</h2></div></div><p className="section-note">Name two EANs the same way to group them into one building automatically. Names are saved in this browser.</p><div className="ean-table"><div className="ean-row ean-head"><span>EAN</span><span>Building name</span></div>{uniqueIds(headers).map((ean) => <div className="ean-row" key={ean}><span className="ean-id">{ean}</span><input className="building-name-input" aria-label={`Building name for ${ean}`} value={eanNames[ean] || eanToBuilding.get(ean)?.name || "Building 1"} onChange={(event) => updateEanBuildingName(ean, event.target.value)} /></div>)}</div></section>

      <section className="table-section"><div className="section-heading"><div><p className="eyebrow">Connection detail</p><h2>Who gives to whom</h2></div><span className="connection-count">{tableFlows.length} connections</span></div><div className="connection-table"><div className="table-row table-head"><span>From</span><span>To</span><span>Energy transferred</span><span>Share of total</span></div>{tableFlows.map((flow) => <div className="table-row" key={flow.id}><span className="building-cell"><i className={`table-dot ${flow.source === flow.target ? "self" : "out"}`} />{buildings.find((building) => building.id === flow.source)?.name || flow.source}</span><span className="building-cell"><i className={`table-dot ${flow.source === flow.target ? "self" : "in"}`} />{buildings.find((building) => building.id === flow.target)?.name || flow.target}{flow.source === flow.target ? " (self)" : ""}</span><strong>{formatKwh(flow.total)}</strong><span className="share"><b style={{ width: `${Math.min((flow.total / tableTotal) * 100, 100)}%` }} />{tableTotal ? `${Math.round((flow.total / tableTotal) * 100)}%` : "0%"}</span></div>)}</div></section>
    </main>
  );
}

export function LegacyHome() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert h-5 w-[100px]"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the{" "}
            <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
              page.tsx
            </code>{" "}
            file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert h-[14px] w-4"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={14}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
