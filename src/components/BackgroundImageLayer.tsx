import React from 'react'

export default function BackgroundImageLayer({ imageUrl }: { imageUrl?: string }) {
  if (!imageUrl) return null
  return (
    <div className="absolute inset-0 -z-0" aria-hidden>
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'right center'
        }}
      />
    </div>
  )
}