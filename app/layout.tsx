import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '한일 교류회 (日韓交流会)',
  description: '한국인과 일본인의 언어 교환 및 친목 도모를 위한 공식 교류회 플랫폼',
  icons: {
    icon: '/icon',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="antialiased bg-slate-100 text-slate-800">
        {children}
      </body>
    </html>
  )
}