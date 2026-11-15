import React from 'react';
import { ArrowRight, Flame } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformIcon } from '../common/PlatformIcon';

function isLinkedInCategory(id: string, name: string): boolean {
  const normId = id.toLowerCase();
  const normName = name.toLowerCase();
  return normId === 'linkedin' || normId.includes('linkedin') || normName.includes('linkedin');
}

function isWebTrafficCategory(id: string, name: string): boolean {
  const normId = id.toLowerCase();
  const normName = name.toLowerCase();
  return (
    normId === 'webtraffic' ||
    normId === 'web-traffic' ||
    normId === 'web_traffic' ||
    normId.includes('traffic') ||
    normName.includes('web traffic') ||
    normName.includes('website traffic') ||
    normName.includes('traffic')
  );
}

export function PopularServices() {
  const { platforms, selectedPlatform, selectPlatformForOrder, setActiveTab, isLoading } = useApp();

  const corePlatforms = platforms
    .filter((platform) => !isLinkedInCategory(platform.id, platform.name) && !isWebTrafficCategory(platform.id, platform.name))
    .slice(0, 6);

  const linkedinCategory = platforms.find((platform) => isLinkedInCategory(platform.id, platform.name));
  const webTrafficCategory = platforms.find((platform) => isWebTrafficCategory(platform.id, platform.name));

  const linkedinId = linkedinCategory?.id ?? 'linkedin';
  const webTrafficId = webTrafficCategory?.id ?? 'webtraffic';

  return (
    <section aria-labelledby="popular-services-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
          <h2 id="popular-services-heading" className="font-display text-base sm:text-lg font-bold text-slate-900">
            Popular Services
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-slate-700 border border-slate-200 transition-colors hover:border-violet-200 hover:text-violet-700 whitespace-nowrap"
        >
          <span>View All</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {isLoading && platforms.length === 0 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
      ) : platforms.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center text-xs text-slate-500">
          No service categories are active yet.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
          {corePlatforms.map((platform) => {
            const isSelected = selectedPlatform === platform.id;
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => selectPlatformForOrder(platform.id)}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 sm:p-3 transition-all duration-150 ${
                  isSelected
                    ? 'border-violet-400 bg-violet-50/70 shadow-sm shadow-violet-500/10'
                    : 'border-slate-200/80 bg-white hover:border-violet-200 hover:-translate-y-0.5'
                }`}
              >
                <PlatformIcon platform={platform.id} size="md" />
                <span className="mt-2 w-full truncate text-center text-[11px] font-semibold text-slate-800">
                  {platform.shortName}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => selectPlatformForOrder(linkedinId)}
            className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 sm:p-3 transition-all duration-150 ${
              selectedPlatform === linkedinId
                ? 'border-violet-400 bg-violet-50/70 shadow-sm shadow-violet-500/10'
                : 'border-slate-200/80 bg-white hover:border-violet-200 hover:-translate-y-0.5'
            }`}
          >
            <PlatformIcon platform={linkedinId} size="md" />
            <span className="mt-2 w-full truncate text-center text-[11px] font-semibold text-slate-800">
              LinkedIn
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectPlatformForOrder(webTrafficId)}
            className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 sm:p-3 transition-all duration-150 ${
              selectedPlatform === webTrafficId
                ? 'border-violet-400 bg-violet-50/70 shadow-sm shadow-violet-500/10'
                : 'border-slate-200/80 bg-white hover:border-violet-200 hover:-translate-y-0.5'
            }`}
          >
            <PlatformIcon platform={webTrafficId} size="md" />
            <span className="mt-2 w-full truncate text-center text-[11px] font-semibold text-slate-800">
              Web Traffic
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
