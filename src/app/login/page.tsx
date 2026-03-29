'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSession } from '@/components/AppSessionProvider';

export default function LoginEntryPage() {
  const router = useRouter();
  const { authSession, booting } = useAppSession();

  useEffect(() => {
    if (booting) {
      return;
    }

    router.replace(authSession.authenticated ? '/dashboard' : '/auth/login');
  }, [authSession.authenticated, booting, router]);

  return null;
}
