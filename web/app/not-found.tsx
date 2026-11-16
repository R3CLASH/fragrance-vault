import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page"><div className="wrap empty" style={{ minHeight: '60vh', justifyContent: 'center' }}>
      <span className="eyebrow">Error 404</span>
      <h1 style={{ fontSize: 'clamp(34px,5vw,60px)' }}>This box is empty</h1>
      <p className="lead">The page you are looking for is not in the vault.</p>
      <Link className="btn btn-gold" href="/shop">Open the collection</Link>
    </div></div>
  );
}
