'use client';

import { useState, useEffect } from 'react';
import { getActiveAnnouncements } from '@/lib/api/content';
import type { Announcement } from '@/lib/types';
import AnnouncementBar from './AnnouncementBar';
import AnnouncementFloat from './AnnouncementFloat';

/**
 * Renders:
 * - AnnouncementBar (top) for urgent + maintenance announcements
 * - AnnouncementFloat (bottom-right) for categorized article lists
 */
export default function AnnouncementSystem() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    getActiveAnnouncements()
      .then(setAnnouncements)
      .catch(() => {});
  }, []);

  return (
    <>
      {announcements.length > 0 && (
        <AnnouncementBar announcements={announcements} />
      )}
      <AnnouncementFloat />
    </>
  );
}
