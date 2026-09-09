import React from 'react'
import Auth from './Auth'

export default function Header() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex items-center justify-between p-4">
        <div className="text-lg font-semibold">UniHunt</div>
        <nav>
          <Auth />
        </nav>
      </div>
    </header>
  )
}
