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
};

function buildStepPath(points: PlotNode[]) {
  let path = `M ${CHART_LEFT} ${CHART_BOTTOM}`;
  for (const point of points) path += ` H ${point.x.toFixed(1)} V ${point.y.toFixed(1)}`;
  return `${path} H ${CHART_RIGHT}`;
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

    return {
      player,
      color: COLORS[index],
      points,
      linePath: buildStepPath(points),
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
            return {
              userId: item.player.userId,
              name: item.player.name,
              color: item.color,
              score: scoreAtTime,
              y: y(scoreAtTime),
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
                <circle cx={CHART_RIGHT} cy={y(item.player.score)} r="4.5" className="score-endpoint-dot" />
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
          <li key={item.player.userId}>
            <button
              type="button"
              aria-pressed={!item.hidden}
              className={item.hidden ? 'is-muted' : hoveredUserId === item.player.userId ? 'is-active' : ''}
              onPointerEnter={() => setHoveredUserId(item.player.userId)}
              onPointerLeave={() => setHoveredUserId(null)}
              onFocus={() => setHoveredUserId(item.player.userId)}
              onBlur={() => setHoveredUserId(null)}
              onClick={() => toggleUser(item.player.userId)}
            >
              <i style={{ backgroundColor: item.color }} />
              <span>{item.player.name}</span>
              <strong>{pointFormatter.format(item.player.score)} PTS</strong>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
