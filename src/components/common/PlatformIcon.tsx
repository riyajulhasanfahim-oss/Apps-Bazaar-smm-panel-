import React from 'react';
import { Globe } from 'lucide-react';
import type { PlatformId } from '../../types';

interface PlatformIconProps {
  platform: PlatformId | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function PlatformIcon({ platform, size = 'md' }: PlatformIconProps) {
  const boxClass =
    size === 'xs'
      ? 'h-5 w-5 rounded-md'
      : size === 'sm'
        ? 'h-7 w-7 rounded-lg'
        : size === 'lg'
          ? 'h-11 w-11 rounded-2xl'
          : 'h-9 w-9 rounded-xl';

  const iconClass =
    size === 'xs'
      ? 'h-3 w-3'
      : size === 'sm'
        ? 'h-4 w-4'
        : size === 'lg'
          ? 'h-6 w-6'
          : 'h-5 w-5';

  switch (platform) {
    case 'instagram':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className={iconClass}>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
      );
    case 'youtube':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-[#FF0000] text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.2V8.8L15.6 12 10 15.2Z" />
          </svg>
        </span>
      );
    case 'facebook':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-[#1877F2] text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5Z" />
          </svg>
        </span>
      );
    case 'tiktok':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-slate-950 text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .6.04.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66 6.34 6.34 0 0 0 15.68 16v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4c-.29-.03-.58-.18-.86-.43Z" />
          </svg>
        </span>
      );
    case 'telegram':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-[#229ED9] text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M20.665 3.717 2.935 10.554c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434Z" />
          </svg>
        </span>
      );
    case 'x':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-slate-900 text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
          </svg>
        </span>
      );
    case 'more':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-violet-100 text-violet-700`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <circle cx="6" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        </span>
      );
    default:
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xs`}
          aria-hidden="true"
        >
          <Globe className={iconClass} />
        </span>
      );
  }
}
