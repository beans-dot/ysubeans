'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessPath, homePathForRole } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

export function AuthGuard({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      // Hard navigate so middleware/session cookie state is respected immediately
      window.location.replace('/login');
      return;
    }
    if (adminOnly && user.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    if (pathname && !canAccessPath(user.role, pathname)) {
      router.replace(homePathForRole(user.role));
    }
  }, [hydrated, user, adminOnly, pathname, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        인증 확인 중…
      </div>
    );
  }

  // Not authenticated — redirect to /login is in flight
  if (!user) {
    return null;
  }

  if (adminOnly && user.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
