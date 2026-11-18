'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'fv-privacy-ok';

/**
 * A short, honest privacy notice. The site sets no cookies and runs no tracking or ads:
 * it only keeps your bag (and, if you ask, your checkout details) in this browser.
 * Because nothing optional is collected there is nothing to opt in to, so this informs rather than asks.
 * If analytics or ad pixels are ever added, they must only load after an explicit "Accept".
 */
export default function PrivacyNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true); } catch { /* storage blocked: stay quiet */ }
  }, []);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="privacy-note" role="region" aria-label="Privacy notice">
      <p>
        No cookies, no tracking. We only keep your bag in this browser so it is still here when you come back.{' '}
        <Link href="/privacy-policy">Privacy policy</Link>
      </p>
      <button type="button" className="btn btn-gold" onClick={close}>Got it</button>
    </div>
  );
}
