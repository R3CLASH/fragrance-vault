'use client';

// Last-resort screen if the whole layout fails (it has to bring its own <html> and styles).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505', color: '#efe6cf', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <p style={{ letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 12, color: '#d4af37' }}>Fragrance Vault</p>
          <h1 style={{ fontWeight: 400 }}>We will be right back</h1>
          <p style={{ color: '#a99f88' }}>The site hit a problem. Please try again in a moment.</p>
          <button type="button" onClick={() => reset()} style={{ marginTop: 16, padding: '12px 22px', border: '1px solid #d4af37', background: 'transparent', color: '#d4af37', cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
