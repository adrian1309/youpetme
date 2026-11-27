import { PawPrint } from 'lucide-react';
import { useState } from 'react';

interface AnimalPhotoProps {
  src: string | undefined;
  alt: string;
  /** Shown in the fallback, so a missing photo still says whose it is. */
  name: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Animal photo (Design System — AnimalPhoto). When there is no URL or it fails to load, a warm
 * fallback with a paw and the animal's name replaces the broken-image icon.
 */
export function AnimalPhoto({ src, alt, name, className = '', loading }: AnimalPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    // An empty alt marks a decorative copy (e.g. a thumbnail inside a named button).
    const a11y = alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true };
    return (
      <div
        {...a11y}
        className={`flex flex-col items-center justify-center gap-2 bg-accent-soft text-on-accent-soft ${className}`}
      >
        <PawPrint aria-hidden="true" className="size-12" />
        <span aria-hidden="true" className="px-2 text-center text-lg font-semibold">
          {name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailedSrc(src)}
      className={`bg-accent-soft object-cover ${className}`}
    />
  );
}
