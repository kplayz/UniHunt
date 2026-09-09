import './globals.css'
import React from 'react'
import ToastContainer from '../components/ToastContainer'

export const metadata = {
  title: 'UniHunt',
  description: 'University course shortlisting assistant'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          {children}
        </div>
        <ToastContainer />
      </body>
    </html>
  )
}
