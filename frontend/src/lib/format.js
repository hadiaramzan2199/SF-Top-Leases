export const sf = (n) => (n == null || n === '' ? '—' : `${Math.round(Number(n)).toLocaleString()} SF`);
export const sfCompact = (n) => {
  if (n == null || n === '') return '—';
  const value = Number(n);
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M SF`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k SF`;
  return `${Math.round(value).toLocaleString()} SF`;
};
export const psf = (n) => (n == null || n === '' ? '—' : `$${Number(n).toFixed(2)}/SF/Yr`);
export const psfCompact = (n) => (n == null || n === '' ? '—' : `$${Math.round(Number(n))}`);
export const pct = (n) => (n == null || n === '' ? '—' : `${Number(n).toLocaleString()}%`);
export const months = (n) => (n == null || n === '' ? '—' : `${Math.round(Number(n)).toLocaleString()} mo`);
export const money = (n) => {
  if (n == null || n === '') return '—';
  const value = Number(n);
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}k`;
  return `$${value.toLocaleString()}`;
};
export const date = (d) => d
  ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';
