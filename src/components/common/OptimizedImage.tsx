/**
 * OptimizedImage Component
 * 
 * Een component voor het optimaliseren van afbeeldingen met lazy loading en placeholders.
 */
import React, { useState, useEffect, useRef } from 'react';

/**
 * Props voor het OptimizedImage component
 */
interface OptimizedImageProps {
  /** De src URL van de afbeelding */
  src: string;
  /** De alt tekst van de afbeelding */
  alt: string;
  /** De breedte van de afbeelding */
  width?: number | string;
  /** De hoogte van de afbeelding */
  height?: number | string;
  /** De CSS class naam */
  className?: string;
  /** De placeholder URL (getoond tijdens het laden) */
  placeholder?: string;
  /** De blur radius voor de placeholder */
  blurRadius?: number;
  /** Geeft aan of de afbeelding lazy geladen moet worden */
  lazy?: boolean;
  /** De loading strategie (eager, lazy) */
  loading?: 'eager' | 'lazy';
  /** De objectFit stijl */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** Callback die wordt aangeroepen wanneer de afbeelding is geladen */
  onLoad?: () => void;
  /** Callback die wordt aangeroepen wanneer er een fout optreedt bij het laden van de afbeelding */
  onError?: (error: Error) => void;
}

/**
 * OptimizedImage
 * 
 * Een component voor het optimaliseren van afbeeldingen met lazy loading en placeholders.
 * 
 * @example
 * ```tsx
 * <OptimizedImage
 *   src="/images/example.jpg"
 *   alt="Voorbeeld afbeelding"
 *   width={300}
 *   height={200}
 *   lazy
 *   placeholder="/images/placeholder.jpg"
 *   blurRadius={5}
 * />
 * ```
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder,
  blurRadius = 5,
  lazy = true,
  loading = 'lazy',
  objectFit = 'cover',
  onLoad,
  onError,
}: OptimizedImageProps) {
  // State
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Effect voor IntersectionObserver (voor lazy loading)
  useEffect(() => {
    // Als lazy false is, skip de observer
    if (!lazy) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Als het element zichtbaar is, laad de afbeelding
          if (entry.isIntersecting && imgRef.current) {
            // Zet de echte src
            imgRef.current.src = src;
            // Stop met observeren
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '100px', // Laad de afbeelding 100px voordat deze zichtbaar is
        threshold: 0.01, // Trigger wanneer 1% van de afbeelding zichtbaar is
      }
    );
    
    // Start met observeren
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    // Cleanup
    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src, lazy]);
  
  // Event handlers
  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };
  
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const newError = new Error(`Failed to load image: ${src}`);
    setError(newError);
    if (onError) onError(newError);
  };
  
  // Als er een error is, toon een fallback
  if (error) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center text-gray-500 ${className}`}
        style={{ width, height }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />
          <path d="M2 9.5v5a2.5 2.5 0 0 0 2.5 2.5h15a2.5 2.5 0 0 0 2.5-2.5v-5A2.5 2.5 0 0 0 19.5 7h-15A2.5 2.5 0 0 0 2 9.5z" />
          <path d="m14 13-2-2-2 2" />
        </svg>
        <span className="ml-2 text-sm">Afbeelding niet geladen</span>
      </div>
    );
  }
  
  // Bepaal de src op basis van lazy loading
  const imageSrc = lazy ? (placeholder || '') : src;
  
  // Stijlen voor de container en afbeelding
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width,
    height,
    overflow: 'hidden',
  };
  
  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    transition: 'filter 0.3s ease-out',
    filter: isLoaded ? 'none' : `blur(${blurRadius}px)`,
  };
  
  // Component render
  return (
    <div style={containerStyle} className={className}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        style={imageStyle}
        data-src={lazy ? src : undefined}
      />
    </div>
  );
}
