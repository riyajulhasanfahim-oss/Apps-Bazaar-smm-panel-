import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';

interface PromoSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  gradient: string;
}

export function BannerSlider() {
  const { systemSettings } = useApp();
  const brandName = systemSettings?.websiteName?.trim() || APP_CONFIG.brandName;

  const adminImages = useMemo(() => {
    const raw = (systemSettings?.defaultSettings as { bannerImages?: unknown } | undefined)
      ?.bannerImages;
    if (!Array.isArray(raw)) return [] as string[];
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((url) => url.trim())
      .filter((url) => /^https?:\/\//i.test(url));
  }, [systemSettings?.defaultSettings]);

  const fallbackSlides: PromoSlide[] = useMemo(
    () => [
      {
        id: 'promo-1',
        badge: 'Instant Delivery',
        title: `${brandName} Growth Panel`,
        subtitle: 'High-retention social services with automated processing',
        gradient: 'from-[#5B21B6] via-[#7C3AED] to-[#4F46E5]',
      },
      {
        id: 'promo-2',
        badge: '24/7 Active',
        title: 'Fast Checkout & Live Tracking',
        subtitle: 'Select a category below and launch your campaign in seconds',
        gradient: 'from-[#4338CA] via-[#6D28D9] to-[#7E22CE]',
      },
    ],
    [brandName]
  );

  const hasCustomImages = adminImages.length > 0;
  const totalSlides = hasCustomImages ? adminImages.length : fallbackSlides.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setActiveIndex(0);
    setBrokenUrls({});
  }, [adminImages.length, adminImages.join('|')]);

  useEffect(() => {
    if (totalSlides <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [totalSlides, paused]);

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % totalSlides);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || totalSlides <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 36) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  return (
    <section
      aria-label="Promotional banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="group relative overflow-hidden rounded-2xl border border-violet-100/90 bg-white shadow-sm shadow-violet-950/5"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {hasCustomImages
          ? adminImages.map((url, idx) => {
              const isBroken = Boolean(brokenUrls[url]);
              return (
                <div
                  key={`${url}-${idx}`}
                  className="relative h-28 sm:h-36 md:h-40 w-full shrink-0 overflow-hidden bg-slate-100"
                >
                  {isBroken ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#4F46E5] px-4 text-center text-white">
                      <span className="font-display text-sm sm:text-base font-bold">
                        {brandName}
                      </span>
                      <span className="mt-0.5 text-[11px] text-violet-100">
                        Banner image #{idx + 1} unavailable
                      </span>
                    </div>
                  ) : (
                    <img
                      src={url}
                      alt={`${brandName} banner ${idx + 1}`}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      onError={() =>
                        setBrokenUrls((prev) => ({ ...prev, [url]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/35 to-transparent" />
                </div>
              );
            })
          : fallbackSlides.map((slide) => (
              <div
                key={slide.id}
                className={`relative flex h-28 sm:h-36 md:h-40 w-full shrink-0 items-center justify-between overflow-hidden bg-gradient-to-r ${slide.gradient} px-5 sm:px-7 text-white`}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-14 -bottom-12 h-32 w-32 rounded-full bg-amber-300/15 blur-xl"
                />
                <div className="relative z-10 max-w-xl min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 backdrop-blur-xs">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {slide.badge}
                  </span>
                  <h2 className="mt-1.5 truncate font-display text-base sm:text-xl font-extrabold tracking-tight">
                    {slide.title}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] sm:text-xs text-violet-100">
                    {slide.subtitle}
                  </p>
                </div>
              </div>
            ))}
      </div>

      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous banner"
            className="hidden sm:inline-flex absolute left-2.5 top-1/2 -translate-y-1/2 h-7 w-7 items-center justify-center rounded-full bg-slate-950/40 text-white opacity-0 backdrop-blur-xs transition-all duration-200 hover:bg-slate-950/65 group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next banner"
            className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 items-center justify-center rounded-full bg-slate-950/40 text-white opacity-0 backdrop-blur-xs transition-all duration-200 hover:bg-slate-950/65 group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5"
            role="tablist"
            aria-label="Banner slides"
          >
            {Array.from({ length: totalSlides }).map((_, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Go to banner ${idx + 1}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'w-5 bg-white shadow-xs'
                      : 'w-1.5 bg-white/55 hover:bg-white/85'
                  }`}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
