import type { Metadata, Viewport } from 'next';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import 'lenis/dist/lenis.css';
import './globals.css';
import { CartProvider } from '@/components/cart';
import SmoothScroll from '@/components/SmoothScroll';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import PrivacyNotice from '@/components/PrivacyNotice';
import { getGlobal, getPages, getCategories } from '@/lib/strapi';
import { SITE_URL } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const g = await getGlobal();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${g.siteName} | Authentic perfumes in Sri Lanka`, template: `%s | ${g.siteName}` },
    description: g.footerText,
    openGraph: { siteName: g.siteName, type: 'website', locale: 'en_LK' },
  };
}

export const viewport: Viewport = { themeColor: '#050505', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [g, pages, cats] = await Promise.all([getGlobal(), getPages(), getCategories()]);
  const logo = g.logo?.url || '/logo.png';
  return (
    <html lang="en">
      <body>
        <SmoothScroll />
        <CartProvider>
          {g.announcement ? <div className="announce">{g.announcement}</div> : null}
          <Nav logo={logo} siteName={g.siteName} categories={cats} />
          <main id="main">{children}</main>
          <Footer logo={logo} global={g} pages={pages} categories={cats} />
          <CartDrawer />
          <PrivacyNotice />
        </CartProvider>
      </body>
    </html>
  );
}
