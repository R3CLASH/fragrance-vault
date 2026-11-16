'use client';

export type QuoteLine = { id: string; name: string; slug: string; variant: string | null; unitPrice: number; regularPrice: number; onSale: boolean; quantity: number; lineTotal: number; image: string | null };
export type Quote = {
  lines: QuoteLine[]; problems: { id: string; variant?: string | null; message: string; available?: number }[];
  coupon: { code: string; valid: boolean; message: string } | null;
  subtotal: number; discount: number; shipping: number; fee: number; total: number;
  shippingMethodId: string | null; paymentMethodId: string | null;
  shippingMethods: { id: string; name: string; description: string | null; estimatedDays: string | null; cost: number }[];
  paymentMethods: { id: string; name: string; type: string; description: string | null; fee: number; total: number }[];
};

export async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T | null; error: string | null; details?: any }> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, data: null, error: data?.error?.message || 'Something went wrong. Please try again.', details: data?.error?.details };
    return { ok: true, data, error: null };
  } catch {
    return { ok: false, data: null, error: 'You seem to be offline. Please check your connection.' };
  }
}

/** Mediaurls from Strapi (/uploads/...) are served through this site at /media/... */
export const media = (u: string | null) => (u && u.startsWith('/uploads/') ? `/media/${u.slice(9)}` : u);
