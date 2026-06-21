import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: string[];         // array of URLs
  alt: string;
  aspectClass?: string;     // e.g. "aspect-[16/7]"
}

export function ImageCarousel({ images, alt, aspectClass = "aspect-[16/7]" }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const validImages = images.filter((_, i) => !failed[i]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + validImages.length) % validImages.length);
  }, [validImages.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % validImages.length);
  }, [validImages.length]);

  // Touch / swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const delta = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      delta > 0 ? next() : prev();
    }
    setTouchStart(null);
  };

  if (validImages.length === 0) {
    return (
      <div className={`relative rounded-xl overflow-hidden bg-muted mb-6 ${aspectClass} flex items-center justify-center text-muted-foreground`}>
        No Image Available
      </div>
    );
  }

  // Clamp index if images shrank after failures
  const safeIdx = Math.min(current, validImages.length - 1);

  return (
    <div className={`relative rounded-xl overflow-hidden bg-muted mb-6 ${aspectClass} select-none`}>
      {/* Images */}
      {validImages.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`${alt} — photo ${i + 1}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ opacity: i === safeIdx ? 1 : 0, pointerEvents: i === safeIdx ? "auto" : "none" }}
          loading={i === 0 ? "eager" : "lazy"}
          onError={() => setFailed((f) => ({ ...f, [images.indexOf(src)]: true }))}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      ))}

      {/* Prev / Next arrows — only show when >1 image */}
      {validImages.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {validImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to image ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === safeIdx
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          {/* Counter */}
          <div className="absolute top-3 left-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full z-10">
            {safeIdx + 1} / {validImages.length}
          </div>
        </>
      )}
    </div>
  );
}
