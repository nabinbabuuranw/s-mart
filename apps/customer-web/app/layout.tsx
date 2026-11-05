import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { ToastProvider } from '@/components/Toast';
import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: { default: 'S Mart', template: '%s · S Mart' },
  icons: { icon: [{ url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/brand/apple-touch-icon.png' },
  description: 'S Mart: everyday stationery, kitchen and home goods. Cash on delivery.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F6F7F4' }, { media: '(prefers-color-scheme: dark)', color: '#0F1411' }] };

const themeScript = `(function(){try{var t=localStorage.getItem('smart-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NP" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <a href="#main" className="skip-link">Skip to content</a>
              <SiteChrome>{children}</SiteChrome>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
