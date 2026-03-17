import type { Metadata } from 'next';
import '@fontsource-variable/figtree';
import '@fontsource-variable/bricolage-grotesque';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vizo Group | Fashion AI Studio',
  description: 'AI-powered fashion photography platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 font-sans text-stone-950 antialiased">
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
        {children}
      </body>
    </html>
  );
}
