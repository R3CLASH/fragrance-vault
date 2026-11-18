'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Shown instead of a blank page if something breaks while a page renders. Your bag is kept.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="page"><div className="wrap empty" style={{ minHeight: '60vh', justifyContent: 'center' }}>
      <span className="eyebrow">Something went wrong</span>
      <h1 style={{ fontSize: 'clamp(34px,5vw,60px)' }}>The vault door stuck</h1>
      <p className="lead">This page could not open just now. Your bag is safe. Please try again in a moment.</p>
      <div className="row">
        <button type="button" className="btn btn-gold" onClick={() => reset()}>Try again</button>
        <Link className="btn" href="/shop">Open the collection</Link>
      </div>
    </div></div>
  );
}
