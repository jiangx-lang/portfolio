/** Client-safe downsample (no fs). */
export function downsampleSeries<T>(series: T[], maxPoints = 1800): T[] {
  if (!Array.isArray(series) || series.length <= maxPoints) return series;
  const step = Math.ceil(series.length / maxPoints);
  const out: T[] = [];
  for (let i = 0; i < series.length; i += step) out.push(series[i]);
  const last = series[series.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
