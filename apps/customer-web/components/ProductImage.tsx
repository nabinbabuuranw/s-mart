'use client';
import { useState } from 'react';

/** Product photo that falls back to a quiet tile if the file cannot load (never a broken-image icon). */
export function ProductImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={`flex h-full w-full items-center justify-center bg-soft text-sm text-muted ${className}`}>
        <span aria-hidden="true" className="font-display text-2xl text-line">S</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`h-full w-full object-cover ${className}`} />;
}
