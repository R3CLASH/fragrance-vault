export function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0.001;
  return 'Rs. ' + rounded.toLocaleString('en-LK', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const GENDERS: Record<string, string> = { 'for-him': 'For Him', 'for-her': 'For Her', unisex: 'Unisex' };
