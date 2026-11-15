import React, { useMemo, useState } from 'react';
import { Search, ArrowRight, ShieldCheck } from 'lucide-react';
import { APP_CONFIG } from '../config/app.config';
import { useApp } from '../context/AppContext';
import type { PlatformId } from '../types';
import { PlatformIcon } from '../components/common/PlatformIcon';

export function ServicesPage() {
  const { platforms, services, selectPlatformForOrder, isLoading, systemSettings } = useApp();
  const currencySymbol = systemSettings?.currencySymbol?.trim() || APP_CONFIG.currencySymbol;
  const [filterPlatform, setFilterPlatform] = useState<'all' | PlatformId>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((srv) => {
      const matchPlat = filterPlatform === 'all' || srv.categoryId === filterPlatform;
      const matchSearch =
        !q || srv.name.toLowerCase().includes(q) || srv.description.toLowerCase().includes(q);
      return matchPlat && matchSearch;
    });
  }, [services, filterPlatform, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">Service Catalog</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
          Browse verified social growth rates per 1,000 units and jump straight to ordering.
        </p>
      </div>

      {/* Platform Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterPlatform('all')}
            className={`h-9 rounded-xl px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              filterPlatform === 'all'
                ? 'bg-violet-700 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-violet-200'
            }`}
          >
            All Platforms
          </button>
          {platforms.map((plat) => {
            const active = filterPlatform === plat.id;
            return (
              <button
                key={plat.id}
                type="button"
                onClick={() => setFilterPlatform(plat.id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-violet-700 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-violet-200'
                }`}
              >
                <PlatformIcon platform={plat.id} size="xs" />
                <span>{plat.shortName}</span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter services..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
      </div>

      {/* Services Cards */}
      {isLoading && services.length === 0 ? (
        <div className="grid gap-3.5 md:grid-cols-2">
          <div className="h-36 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="h-36 rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">No services found</p>
          <p className="mt-1 text-xs text-slate-500">
            Try choosing a different category or clearing your search query.
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {filtered.map((srv) => (
          <div
            key={srv.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlatformIcon platform={srv.categoryId} size="sm" />
                  <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {srv.name}
                  </h2>
                </div>
                <span className="font-mono text-sm font-extrabold text-violet-800 whitespace-nowrap tabular-nums shrink-0">
                  {currencySymbol}
                  {srv.ratePerThousand.toFixed(2)} / 1K
                </span>
              </div>

              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">{srv.description}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium text-slate-500 tabular-nums">
                {srv.serviceType && (
                  <>
                    <span className="rounded-md bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                      {srv.serviceType}
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>Min {srv.minQuantity.toLocaleString()}</span>
                <span aria-hidden="true">·</span>
                <span>Avg {srv.averageTime}</span>
                {srv.refillGuaranteed && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      30d Refill
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => selectPlatformForOrder(srv.categoryId)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-50 px-3.5 text-xs font-bold text-violet-800 transition-colors hover:bg-violet-700 hover:text-white whitespace-nowrap"
              >
                <span>Order</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}
