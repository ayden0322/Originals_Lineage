'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SiteManagePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/module/site-manage/settings');
  }, [router]);

  return null;
}
