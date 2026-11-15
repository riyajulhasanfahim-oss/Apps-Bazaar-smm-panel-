import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, Menu, User, Globe, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getAdminRoleLabel } from '../../lib/permissions';
import { BrandLogo } from '../common/BrandLogo';

interface DashboardHeaderProps {
  onOpenMobileMenu: () => void;
}

function getNotifPillLabel(category: string): string {
  const norm = category.toLowerCase();
  if (norm.startsWith('order')) return 'Order';
  if (norm === 'refund') return 'Refund';
  if (norm.startsWith('payment') || norm === 'wallet') return 'Payment';
  if (norm.startsWith('support')) return 'Support';
  return 'System';
}

export function DashboardHeader({ onOpenMobileMenu }: DashboardHeaderProps) {
  const {
    profile,
    notifications,
    handleNotificationClick,
    markAllNotificationsRead,
    setActiveTab,
    setViewMode,
    userRole,
    staffRole,
    logoutUser,
  } = useApp();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-violet-100/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-violet-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="lg:hidden">
            <BrandLogo showTagline size="sm" onClick={() => setActiveTab('home')} />
          </div>

          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-900">Customer Workspace</span>
            <span aria-hidden="true">·</span>
            <span>{profile?.tierLabel ?? 'Customer Account'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Notification Menu */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-violet-50"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-violet-100 bg-white p-3 shadow-xl shadow-violet-950/10">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-display text-sm font-bold text-slate-900">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-semibold text-violet-700 hover:text-violet-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      You have no notifications yet.
                    </p>
                  ) : (
                    notifications.slice(0, 8).map((item) => {
                      const catLabel = getNotifPillLabel(item.category);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            handleNotificationClick(item).catch(() => undefined);
                          }}
                          className={`w-full rounded-xl p-2.5 text-left transition-colors ${
                            item.read
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-violet-50/80 hover:bg-violet-100/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {!item.read && (
                                <span
                                  className="h-2 w-2 rounded-full bg-violet-600 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 shrink-0">
                                {catLabel}
                              </span>
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {item.title}
                              </p>
                            </div>
                            <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                              {item.timeLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2">
                            {item.message}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-2 border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      setActiveTab('notifications');
                    }}
                    className="w-full rounded-xl bg-violet-50 py-2 text-center text-xs font-bold text-violet-700 hover:bg-violet-100"
                  >
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
              }}
              aria-expanded={profileOpen}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-violet-100 bg-violet-50/60 pl-1.5 pr-2.5 transition-colors hover:bg-violet-100/70"
            >
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-700 to-indigo-600 text-xs font-bold text-white">
                  {profile?.avatarInitials ?? 'US'}
                </span>
              )}
              <span className="hidden sm:inline text-xs font-semibold text-slate-800 max-w-28 truncate">
                {profile?.fullName ?? 'Account'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-violet-100 bg-white p-2 shadow-xl shadow-violet-950/10">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {profile?.fullName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                </div>
                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('profile');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800"
                  >
                    <User className="h-4 w-4" />
                    Account Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setViewMode('landing');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800"
                  >
                    <Globe className="h-4 w-4" />
                    Public Home Page
                  </button>
                  {(userRole === 'admin' || staffRole !== null) && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setViewMode('admin');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-violet-700 hover:bg-violet-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {staffRole ? `${getAdminRoleLabel(staffRole)} Console` : 'Admin Panel'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileOpen(false);
                      await logoutUser();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
