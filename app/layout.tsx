import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Sidebar } from '@/components/sidebar';
import { getSession } from '@/lib/auth/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'gigapapaya',
  description: 'Multi-agent video generation powered by Google Veo 3.1. Idea to scenes to video.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSession();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <Sidebar user={user} />
        <div className="ml-[60px]">
          {children}
        </div>
      </body>
    </html>
  );
}
