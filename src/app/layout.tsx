import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/auth-provider'

const inter = Inter({ subsets: ['latin'] })

const metadataBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL && /^https?:\/\//.test(process.env.NEXT_PUBLIC_APP_URL)
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'SocialPiloat.Ai - Enterprise AI-Powered Social Media Management',
  description: 'Automate, optimize, and scale your social media presence with AI-powered content creation, scheduling, and analytics.',
  keywords: 'social media management, AI content creation, social media automation, social media analytics',
  authors: [{ name: 'SocialPiloat.Ai Team' }],
  creator: 'SocialPiloat.Ai',
  publisher: 'SocialPiloat.Ai',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(metadataBaseUrl),
  openGraph: {
    title: 'SocialPiloat.Ai - Enterprise AI-Powered Social Media Management',
    description: 'Automate, optimize, and scale your social media presence with AI-powered content creation, scheduling, and analytics.',
    url: 'https://socialpiloat.ai',
    siteName: 'SocialPiloat.Ai',
    images: [
      {
        url: 'https://socialpiloat.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SocialPiloat.Ai Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SocialPiloat.Ai - Enterprise AI-Powered Social Media Management',
    description: 'Automate, optimize, and scale your social media presence with AI-powered content creation, scheduling, and analytics.',
    images: ['https://socialpiloat.ai/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}