import React, { useState } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Command,
  PanelLeft,
  ChevronDown,
} from '../system/icons';
import { cn } from '../system/cn';
import { Select } from '../system/primitives/Select';
import { Button, IconButton } from '../system';

export interface WorkspaceOption {
  id: string;
  name: string;
}

export interface UserSummary {
  initials: string;
  name: string;
  email: string;
}

export interface TopBarProps {
  /** Optional breadcrumb / page label */
  pageTitle?: string;

  /** Workspace switcher */
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string;
  onWorkspaceChange: (id: string) => void;

  /** Theme */
  theme: 'light' | 'dark';
  onThemeToggle: () => void;

  /** Notifications */
  notificationCount?: number;
  onNotificationsClick?: () => void;

  /** Command palette trigger */
  onSearchClick?: () => void;

  /** User */
  user?: UserSummary;
  onUserMenuClick?: () => void;

  /** Mobile menu trigger (consumed by AppShell) */
  onMobileMenuClick?: () => void;
}

/**
 * Global TopBar — single source of truth for app-level chrome.
 *
 * Houses:
 *   - Workspace switcher (replaces the duplicate selector that lived
 *     in every page toolbar)
 *   - Global search (Cmd+K)
 *   - Theme toggle
 *   - Notifications
 *   - User menu
 *
 * Page-level filters (date range, status, etc.) belong in the page,
 * not here.
 */
export function TopBar({
  pageTitle,
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
  theme,
  onThemeToggle,
  notificationCount = 0,
  onNotificationsClick,
  onSearchClick,
  user,
  onUserMenuClick,
  onMobileMenuClick,
}: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-sticky shrink-0',
        'flex items-center gap-3 px-4 lg:px-6',
        'border-b border-[color:var(--dusk-border-default)]',
        'bg-surface-1 backdrop-blur-xl',
      )}
      style={{ height: 'var(--dusk-topbar-height)' }}
    >
      {/* Mobile menu */}
      <IconButton
        onClick={onMobileMenuClick}
        aria-label="Open navigation"
        icon={<PanelLeft className="h-4 w-4" />}
        size="sm"
        variant="ghost"
        className="lg:hidden -ml-1"
      />

      {/* Workspace + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <Select
          selectSize="sm"
          value={activeWorkspaceId}
          onChange={(e) => onWorkspaceChange(e.target.value)}
          options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
          fullWidth={false}
          className="min-w-[180px]"
          aria-label="Active workspace"
        />
        {pageTitle && (
          <>
            <span aria-hidden className="text-[color:var(--dusk-text-soft)]">/</span>
            <h1 className="text-sm font-semibold text-[color:var(--dusk-text-primary)] truncate">
              {pageTitle}
            </h1>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search trigger — opens command palette */}
      <Button
        onClick={onSearchClick}
        variant="secondary"
        size="sm"
        className={cn(
          'hidden md:inline-flex',
          'text-xs text-[color:var(--dusk-text-soft)]',
          'hover:text-[color:var(--dusk-text-muted)]',
        )}
        aria-label="Open command palette (Cmd+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="dusk-mono ml-3 inline-flex items-center gap-0.5 text-[10px] text-[color:var(--dusk-text-soft)]">
          <Command className="h-3 w-3" />K
        </kbd>
      </Button>

      {/* Theme toggle */}
      <IconButton
        icon={theme === 'dark' ? <Sun /> : <Moon />}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={onThemeToggle}
        size="sm"
        variant="ghost"
      />

      {/* Notifications */}
      <Button
        onClick={onNotificationsClick}
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
        className="relative !px-0 !gap-0 w-8"
      >
        <Bell className="h-4 w-4" />
        {notificationCount > 0 && (
          <span
            aria-hidden
            className="absolute top-1 right-1 inline-flex h-3.5 min-w-[14px] px-1 items-center justify-center rounded-full bg-brand-500 text-[9px] font-semibold text-white"
          >
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </Button>

      {/* User menu */}
      {user && (
        <Button
          onClick={onUserMenuClick}
          variant="ghost"
          size="sm"
          className="inline-flex items-center gap-2 pl-1 pr-2"
          aria-label="User menu"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-gradient text-[11px] font-bold text-white"
          >
            {user.initials}
          </span>
          <span className="hidden lg:inline-flex text-xs font-medium text-[color:var(--dusk-text-primary)] truncate max-w-[120px]">
            {user.name}
          </span>
          <ChevronDown className="hidden lg:inline-flex h-3 w-3 text-[color:var(--dusk-text-soft)]" />
        </Button>
      )}
    </header>
  );
}
