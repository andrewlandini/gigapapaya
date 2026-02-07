import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Sidebar } from '@/components/sidebar';
import { UserMenu } from '@/components/user-menu';
import { Providers } from '@/components/providers';
import { DebugDrawer } from '@/components/debug-drawer';
import { getSession } from '@/lib/auth/session';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'gigapapaya — AI Video Generation',
    template: '%s — gigapapaya',
  },
  description: 'Generate videos with AI agents. Describe an idea, craft scenes, produce video variations with Google Veo 3.1. Share to the community or keep them private.',
  keywords: ['AI video generation', 'Veo 3.1', 'multi-agent', 'video creator', 'AI video', 'gigapapaya'],
  authors: [{ name: 'gigapapaya' }],
  creator: 'gigapapaya',
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || 'https://gigapapaya.vercel.app'),
  openGraph: {
    type: 'website',
    siteName: 'gigapapaya',
    title: 'gigapapaya — AI Video Generation',
    description: 'Generate videos with AI agents. Describe an idea, craft scenes, produce video variations with Google Veo 3.1.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'gigapapaya — AI Video Generation',
    description: 'Generate videos with AI agents. Describe an idea, craft scenes, produce video variations with Google Veo 3.1.',
  },
  icons: {
    icon: '/icon.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <Providers initialAvatarUrl={user?.avatarUrl}>
          <Sidebar user={user} />
          <UserMenu user={user} />
          <DebugDrawer />
          <div className="ml-[60px] min-h-screen overflow-x-hidden">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
