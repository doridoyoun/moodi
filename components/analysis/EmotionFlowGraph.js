import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { notebook } from '../../constants/theme';
import { paletteFor } from '../../utils/timelineEntryFormat';

const PAD = { left: 8, right: 8, top: 12, bottom: 12 };
const LABEL_H = 18;

/**
 * Build a smooth-ish path through points (cubic Bézier with control points at 1/3 segments).
 * @param {{ x: number, y: number }[]} pts
 */
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const pPrev = i > 0 ? pts[i - 1] : p0;
    const pNext = i + 2 < pts.length ? pts[i + 2] : p1;
    const c1x = p0.x + (p1.x - pPrev.x) * 0.2;
    const c1y = p0.y + (p1.y - pPrev.y) * 0.2;
    const c2x = p1.x - (pNext.x - p0.x) * 0.2;
    const c2y = p1.y - (pNext.y - p0.y) * 0.2;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p1.x} ${p1.y}`;
  }
  return d;
}

/**
 * @param {{ kind: 'single' | 'two' | 'multi', points: { emotionId: string, yValue: number, xRatio: number }[] }} flowGraph
 */
export default function EmotionFlowGraph({ flowGraph }) {
  const [w, setW] = useState(0);
  const h = 168 + LABEL_H;

  const onLayout = (e) => {
    setW(e.nativeEvent.layout.width);
  };

  const { linePath, circles, labels } = useMemo(() => {
    const innerW = Math.max(0, w - PAD.left - PAD.right);
    const innerH = h - PAD.top - PAD.bottom - LABEL_H;
    const points = flowGraph?.points ?? [];
    if (points.length === 0 || innerW <= 0) {
      return { linePath: '', circles: [], labels: [] };
    }

    const yToPx = (yVal) => PAD.top + ((5 - yVal) / 4) * innerH;

    const pxPts = points.map((p) => ({
      x: PAD.left + p.xRatio * innerW,
      y: yToPx(p.yValue),
      emotionId: p.emotionId,
      hourLabel: p.hourLabel,
    }));

    if (points.length === 1) {
      const cx = PAD.left + innerW * 0.5;
      const cy = yToPx(points[0].yValue);
      return {
        linePath: '',
        circles: [{ cx, cy, emotionId: points[0].emotionId, r: 4 }],
        labels: [{ x: cx, label: points[0].hourLabel }],
      };
    }

    return {
      linePath: smoothPath(pxPts.map((p) => ({ x: p.x, y: p.y }))),
      circles: pxPts.map((p) => ({
        cx: p.x,
        cy: p.y,
        emotionId: p.emotionId,
        r: 4,
      })),
      labels: pxPts.map((p) => ({ x: p.x, label: p.hourLabel })),
    };
  }, [flowGraph, w, h]);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {linePath ? (
            <Path
              d={linePath}
              stroke={notebook.inkMuted}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.5}
            />
          ) : null}
          {circles.map((c, i) => {
            const pal = paletteFor(c.emotionId);
            return (
              <Circle
                key={`pt-${i}`}
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill={pal.bg}
                stroke={pal.border}
                strokeWidth={1.5}
              />
            );
          })}
          {labels.map((l, i) => (
            <SvgText
              key={`xl-${i}`}
              x={l.x}
              y={h - 6}
              fontSize={11}
              fontWeight="600"
              fill={notebook.inkLight}
              textAnchor="middle"
            >
              {l.label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: 168,
  },
});
