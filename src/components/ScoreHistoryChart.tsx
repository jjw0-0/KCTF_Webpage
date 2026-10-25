'use client';

import { useMemo, useState } from 'react';
import type { LeaderboardEntry, ScoreHistoryEvent } from '@/lib/challenges';

const COLORS = [
  '#4de0a7',
  '#58c4f6',
  '#f5c451',
  '#c084fc',
  '#fb7185',
  '#a3e635',
  '#38bdf8',
  '#fb923c',
  '#e879f9',
  '#94a3b8',
];

const CHART_LEFT = 62;
const CHART_RIGHT = 964;
const CHART_TOP = 34;
const CHART_BOTTOM = 296;
const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;

type PlotNode = {
  x: number;
  y: number;
  time: number;
  total: number;
};

type HermiteSegment = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  m0: number;
  m1: number;
};

/**
 * Fritsch–Carlson monotone cubic Hermite spline.
 * Guarantees smooth C1 curves through cumulative score points with zero overshoot.
 */
function buildMonotoneSpline(rawNodes: PlotNode[]): {
  linePath: string;
  areaPath: string;
  segments: HermiteSegment[];
} {
  // Merge nodes with identical X coordinates (keep the latest cumulative point at that X)
  const nodes: PlotNode[] = [];
  for (const node of rawNodes) {
    const prev = nodes.at(-1);
    if (prev && Math.abs(node.x - prev.x) < 0.5) {
      nodes[nodes.length - 1] = node;
    } else {
      nodes.push(node);
    }
  }

  const n = nodes.length;
  if (n === 0) return { linePath: '', areaPath: '', segments: [] };
  if (n === 1) {
    const p = nodes[0];
    const linePath = `M ${CHART_LEFT} ${p.y.toFixed(1)} L ${CHART_RIGHT} ${p.y.toFixed(1)}`;
    const areaPath = `${linePath} V ${CHART_BOTTOM} H ${CHART_LEFT} Z`;
    return { linePath, areaPath, segments: [] };
  }

  const dx: number[] = [];
  const dy: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const deltaX = Math.max(1e-3, nodes[i + 1].x - nodes[i].x);
    const deltaY = nodes[i + 1].y - nodes[i].y;
    dx.push(deltaX);
    dy.push(deltaY);
    slopes.push(deltaY / deltaX);
  }

  const tangents = new Array<number>(n).fill(0);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const s0 = slopes[i - 1];
    const s1 = slopes[i];
    if (s0 * s1 <= 0) {
      tangents[i] = 0;
    } else {
      const w0 = 2 * dx[i] + dx[i - 1];
      const w1 = dx[i] + 2 * dx[i - 1];
      tangents[i] = (w0 + w1) / (w0 / s0 + w1 / s1);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i];
    if (Math.abs(s) < 1e-6) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / s;
      const b = tangents[i + 1] / s;
      const hypot = Math.hypot(a, b);
      if (hypot > 3) {
        const scale = 3 / hypot;
        tangents[i] = scale * a * s;
        tangents[i + 1] = scale * b * s;
      }
    }
  }

  let linePath = `M ${nodes[0].x.toFixed(1)} ${nodes[0].y.toFixed(1)}`;
  const segments: HermiteSegment[] = [];

  for (let i = 0; i < n - 1; i++) {
    const p0 = nodes[i];
    const p1 = nodes[i + 1];
    const h = dx[i];
    const m0 = tangents[i];
    const m1 = tangents[i + 1];
    const cp1x = p0.x + h / 3;
    const cp1y = p0.y + (m0 * h) / 3;
    const cp2x = p1.x - h / 3;
    const cp2y = p1.y - (m1 * h) / 3;
    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    segments.push({ x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, m0, m1 });
  }

  const areaPath = `${linePath} V ${CHART_BOTTOM} H ${nodes[0].x.toFixed(1)} Z`;
  return { linePath, areaPath, segments };
}

function evaluateHermiteY(segments: HermiteSegment[], targetX: number, fallbackY: number): number {
  if (!segments.length) return fallbackY;
  if (targetX <= segments[0].x0) return segments[0].y0;
  const last = segments[segments.length - 1];
  if (targetX >= last.x1) return last.y1;

  for (const seg of segments) {
    if (targetX >= seg.x0 && targetX <= seg.x1) {
      const h = Math.max(1e-3, seg.x1 - seg.x0);
      const t = (targetX - seg.x0) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      return h00 * seg.y0 + h10 * h * seg.m0 + h01 * seg.y1 + h11 * h * seg.m1;
    }
  }
  return fallbackY;
}

export default function ScoreHistoryChart({
  leaderboard,
  history,
}: {
  leaderboard: LeaderboardEntry[];
  history: ScoreHistoryEvent[];
}) {
  const players = useMemo(() => leaderboard.slice(0, COLORS.length), [leaderboard]);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(() => new Set());
  const [cursorRatio, setCursorRatio] = useState<number | null>(null);

  const normalizedHistory = useMemo(
    () =>
      history
        .map((event) => ({
          ...event,
          solvedAt: event.solvedAt instanceof Date ? event.solvedAt : new Date(event.solvedAt),
        }))
        .sort((a, b) => a.solvedAt.getTime() - b.solvedAt.getTime()),
    [history],
  );

  if (!normalizedHistory.length || !players.length) {
    return (
      <section className="score-history" aria-label="점수 변화">
        <div className="score-history-empty">기록 대기 중</div>
      </section>
    );
  }

  const rawFirst = normalizedHistory[0].solvedAt.getTime();
  const rawLast = normalizedHistory.at(-1)?.solvedAt.getTime() ?? rawFirst;
  const rawSpan = Math.max(60 * 60_000, rawLast - rawFirst);
  const startTime = rawFirst - Math.max(20 * 60_000, rawSpan * 0.16);
  const endTime = rawLast + Math.max(15 * 60_000, rawSpan * 0.12);
  const duration = Math.max(1, endTime - startTime);

  const maxScore = Math.max(100, ...players.map((player) => player.score));
  const x = (time: number) => CHART_LEFT + Math.min(1, Math.max(0, (time - startTime) / duration)) * CHART_WIDTH;
  const y = (score: number) => CHART_BOTTOM - (score / maxScore) * CHART_HEIGHT;

  const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const pointFormatter = new Intl.NumberFormat('ko-KR');

  const series = players.map((player, index) => {
    const events = normalizedHistory.filter((event) => event.userId === player.userId);
    const rawSum = events.reduce((acc, event) => acc + event.points, 0);
    const scale = rawSum > 0 ? player.score / rawSum : 1;
    let running = 0;
    const points = events.map((event, eventIdx) => {
      running += event.points;
      const total = eventIdx === events.length - 1 ? player.score : Math.round(running * scale);
      const t = event.solvedAt.getTime();
      return {
        ...event,
        time: t,
        total,
        x: x(t),
        y: y(total),
      };
    });

    const firstSolveTime = points[0]?.time ?? startTime;
    const preSolveLeadTime = Math.max(startTime, firstSolveTime - Math.max(8 * 60_000, duration * 0.12));

    const splineNodes: PlotNode[] = [
      { x: CHART_LEFT, y: y(0), time: startTime, total: 0 },
    ];
    if (preSolveLeadTime > startTime + 60_000) {
      splineNodes.push({ x: x(preSolveLeadTime), y: y(0), time: preSolveLeadTime, total: 0 });
    }
    for (const pt of points) {
      splineNodes.push({ x: pt.x, y: pt.y, time: pt.time, total: pt.total });
    }
    const finalScore = points.at(-1)?.total ?? 0;
    splineNodes.push({ x: CHART_RIGHT, y: y(finalScore), time: endTime, total: finalScore });

    const { linePath, areaPath, segments } = buildMonotoneSpline(splineNodes);

    return {
      player,
      color: COLORS[index],
      index,
      points,
      linePath,
      areaPath,
      segments,
      hidden: hiddenUserIds.has(player.userId),
    };
  });

  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    x: CHART_LEFT + ratio * CHART_WIDTH,
    label: dateFormatter.format(new Date(startTime + ratio * duration)),
  }));

  const cursorTime = cursorRatio !== null ? startTime + cursorRatio * duration : null;
  const cursorX = cursorRatio !== null ? CHART_LEFT + cursorRatio * CHART_WIDTH : null;

  const tooltipSnapshot =
    cursorTime !== null && cursorX !== null
      ? series
          .filter((item) => !item.hidden)
          .map((item) => {
            let scoreAtTime = 0;
            for (const pt of item.points) {
              if (pt.time <= cursorTime) scoreAtTime = pt.total;
              else break;
            }
            const curveY = evaluateHermiteY(item.segments, cursorX, y(scoreAtTime));
            return {
              userId: item.player.userId,
              name: item.player.name,
              color: item.color,
              score: scoreAtTime,
              y: curveY,
            };
          })
          .sort((a, b) => b.score - a.score)
      : [];

  const toggleUser = (userId: string) => {
    setHiddenUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <section className="score-history" aria-label="점수 변화">
      <div className="score-chart-wrap">
        <svg
          className="score-chart"
          viewBox="0 0 1000 345"
          role="img"
          aria-labelledby="score-chart-title score-chart-description"
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const svgX = ((event.clientX - rect.left) / rect.width) * 1000;
            if (svgX < CHART_LEFT || svgX > CHART_RIGHT) {
              setCursorRatio(null);
              return;
            }
            setCursorRatio((svgX - CHART_LEFT) / CHART_WIDTH);
          }}
          onPointerLeave={() => setCursorRatio(null)}
        >
          <title id="score-chart-title">상위 참가자 누적 점수 변화</title>
          <desc id="score-chart-description">{players.map((player) => `${player.name} ${player.score}점`).join(', ')}</desc>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.player.userId} id={`score-grad-${item.index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={item.index < 3 ? '0.18' : '0.08'} />
                <stop offset="75%" stopColor={item.color} stopOpacity={item.index < 3 ? '0.04' : '0.015'} />
                <stop offset="100%" stopColor={item.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line
                x1={CHART_LEFT}
                x2={CHART_RIGHT}
                y1={y(maxScore * ratio)}
                y2={y(maxScore * ratio)}
                className="score-grid-line"
              />
              <text x={CHART_LEFT - 12} y={y(maxScore * ratio) + 4} textAnchor="end">
                {pointFormatter.format(Math.round(maxScore * ratio))}
              </text>
            </g>
          ))}

          {timeTicks.map((tick) => (
            <g key={tick.ratio}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={CHART_TOP}
                y2={CHART_BOTTOM}
                className="score-grid-line is-vertical"
              />
              <text
                x={tick.x}
                y={328}
                textAnchor={tick.ratio === 0 ? 'start' : tick.ratio === 1 ? 'end' : 'middle'}
              >
                {tick.label}
              </text>
            </g>
          ))}

          {series.map((item) => {
            if (item.hidden) return null;
            const isDimmed = hoveredUserId !== null && hoveredUserId !== item.player.userId;
            const isHighlighted = hoveredUserId === item.player.userId;
            return (
              <g
                key={item.player.userId}
                style={{ '--chart-color': item.color } as React.CSSProperties}
                className={isDimmed ? 'score-series is-dimmed' : isHighlighted ? 'score-series is-highlighted' : 'score-series'}
              >
                <path d={item.areaPath} fill={`url(#score-grad-${item.index})`} className="score-player-area" />
                <path d={item.linePath} className="score-player-line" />
                {item.points.map((point) => (
                  <circle
                    key={`${point.userId}-${point.solvedAt.toISOString()}`}
                    cx={point.x}
                    cy={point.y}
                    r={isHighlighted ? 5.2 : 3.8}
                    className="score-player-point"
                  >
                    <title>{`${point.name} · ${pointFormatter.format(point.total)}점 · ${dateFormatter.format(point.solvedAt)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {cursorX !== null && (
            <g className="score-crosshair" pointerEvents="none">
              <line x1={cursorX} x2={cursorX} y1={CHART_TOP} y2={CHART_BOTTOM} className="score-crosshair-line" />
              {tooltipSnapshot.map((entry) => (
                <circle
                  key={entry.userId}
                  cx={cursorX}
                  cy={entry.y}
                  r="4.5"
                  fill="#030806"
                  stroke={entry.color}
                  strokeWidth="2.2"
                />
              ))}
            </g>
          )}
        </svg>

        {cursorRatio !== null && cursorTime !== null && tooltipSnapshot.length > 0 && (
          <div
            className="score-chart-tooltip"
            style={{
              left: `${Math.min(78, Math.max(8, cursorRatio * 100))}%`,
            }}
          >
            <time>{dateFormatter.format(new Date(cursorTime))}</time>
            <ul>
              {tooltipSnapshot.map((entry) => (
                <li key={entry.userId}>
                  <i style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}</span>
                  <strong>{pointFormatter.format(entry.score)} PTS</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ul className="score-legend" aria-label="그래프 참가자">
        {series.map((item) => (
          <li
            key={item.player.userId}
            className={item.hidden ? 'is-muted' : hoveredUserId === item.player.userId ? 'is-active' : ''}
            onPointerEnter={() => setHoveredUserId(item.player.userId)}
            onPointerLeave={() => setHoveredUserId(null)}
            onClick={() => toggleUser(item.player.userId)}
          >
            <i style={{ backgroundColor: item.color }} />
            <span>{item.player.name}</span>
            <strong>{pointFormatter.format(item.player.score)} PTS</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
