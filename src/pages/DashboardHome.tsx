import React from 'react';
import { HeroBanner } from '../components/dashboard/HeroBanner';
import { StatsGrid } from '../components/dashboard/StatsGrid';
import { NewOrderCard } from '../components/dashboard/NewOrderCard';
import { PopularServices } from '../components/dashboard/PopularServices';
import { RecentOrdersCard } from '../components/dashboard/RecentOrdersCard';
import { SupportBanner } from '../components/dashboard/SupportBanner';

export function DashboardHome() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner />
      <StatsGrid />
      <NewOrderCard />
      <PopularServices />
      <RecentOrdersCard />
      <SupportBanner />
    </div>
  );
}
