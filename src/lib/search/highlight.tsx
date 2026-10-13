import React from "react";
import type { FuseResultMatch, RangeTuple } from "fuse.js";

/**
 * Render text with Fuse match indices wrapped in <mark>.
 */
export function renderHighlighted(
  text: string,
  indices?: readonly RangeTuple[],
): React.ReactNode {
  if (!text) return null;
  if (!indices || indices.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={i}
        style={{
          backgroundColor: "var(--colorPaletteYellowBackground2, #fff4ce)",
          color: "inherit",
          padding: 0,
          borderRadius: 2,
        }}
      >
        {text.slice(start, end + 1)}
      </mark>,
    );
    cursor = end + 1;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function findMatch(
  matches: readonly FuseResultMatch[] | undefined,
  key: string,
  valueIndex?: number,
): FuseResultMatch | undefined {
  return matches?.find(
    (m) => m.key === key && (valueIndex === undefined || m.refIndex === valueIndex),
  );
}
