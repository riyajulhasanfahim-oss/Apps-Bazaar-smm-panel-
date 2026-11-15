import React from 'react';
import { Wallet, ShoppingCart, Check, Clock, ArrowRight } from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { StatCard } from '../common/StatCard';

export function StatsGrid() {
  const { wallet, orderStats, setActiveTab, isLoading, systemSettings } = useApp();
  const currencySymbol = systemSettings?.currencySymbol?.trim() || APP_CONFIG.currencySymbol;

  if (isLoading) {
    return (
      <section aria-label="Loading statistics" className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-5 h-24 rounded-2xl bg-violet-200/50 animate-pulse" />
        <div className="lg:col-span-7 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="h-24 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Account statistics" className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* Wallet Balance Card */}
      <div className="lg:col-span-5 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#4F46E5] p-4 sm:p-5 text-white shadow-md shadow-violet-700/20">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xs">
            <Wallet className="h-6 w-6 text-amber-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-violet-100">Your Balance</p>
            <p className="mt-0.5 font-display text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums truncate">
              {currencySymbol} {wallet.balance.toLocaleString()}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('funds')}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-violet-900 shadow-xs transition-transform duration-150 hover:bg-violet-50 active:scale-[0.98] whitespace-nowrap"
        >
          <span>Add Funds</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Order Statistics Cards */}
      <div className="lg:col-span-7 grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatCard
          label="Total Orders"
          value={orderStats.totalOrders}
          tone="indigo"
          icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setActiveTab('order')}
        />
        <StatCard
          label="Completed"
          value={orderStats.completedOrders}
          tone="emerald"
          icon={<Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />}
          onClick={() => setActiveTab('order')}
        />
        <StatCard
          label="Pending"
          value={orderStats.pendingOrders}
          tone="amber"
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setActiveTab('order')}
        />
      </div>
    </section>
  );
}
