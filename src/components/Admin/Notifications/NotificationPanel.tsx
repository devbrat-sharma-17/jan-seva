// ============================================================
// Admin notifications
// ============================================================
// Alerts are derived from the records and fingerprinted by what they are
// about, so the same condition is always the same alert. Marking one read
// sticks, and a condition that clears stops being reported instead of
// piling up as another unread item.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAdminNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  subscribeToNotificationReadState,
} from '../../../services/notificationService';
import { subscribeToComplaints } from '../../../services/complaintService';
import { AdminIcon } from '../AdminIcon';
import type { AdminNotification } from '../../../types/admin';
import './NotificationPanel.css';

function drillDownPath(n: AdminNotification): string {
  if (n.departmentId) return `/admin/departments/${n.departmentId}`;
  if (n.type === 'feedback') return '/admin/feedback';
  return '/admin/complaints';
}

export function NotificationPanel() {
  const [items, setItems] = useState<AdminNotification[]>([]);

  const refresh = useCallback(() => setItems(getAdminNotifications()), []);

  useEffect(() => {
    refresh();
    // Two sources of change: the records the alerts are derived from,
    // and the read markers themselves (which another tab may set).
    const unsubRecords = subscribeToComplaints(refresh);
    const unsubRead = subscribeToNotificationReadState(refresh);
    return () => {
      unsubRecords();
      unsubRead();
    };
  }, [refresh]);

  const unread = items.filter((n) => !n.read).length;

  if (items.length === 0) {
    return (
      <section className="admin-notifs">
        <div className="admin-notifs__head">
          <h2 className="admin-notifs__title">
            <AdminIcon name="bell" size={16} />
            Alerts
          </h2>
        </div>
        <p className="admin-notifs__empty">
          Nothing to flag. No SLA breaches, unassigned critical reports or reinspection requests.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-notifs">
      <div className="admin-notifs__head">
        <h2 className="admin-notifs__title">
          <AdminIcon name="bell" size={16} />
          Alerts
          {unread > 0 && <span className="admin-notifs__badge">{unread} unread</span>}
        </h2>

        {unread > 0 && (
          <button
            type="button"
            className="admin-notifs__mark-all"
            onClick={() => {
              markAllNotificationsRead();
              refresh();
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      <ul className="admin-notifs__list">
        {items.map((n) => (
          <li
            key={n.id}
            className={`admin-notif admin-notif--${n.severity}${n.read ? ' is-read' : ''}`}
          >
            <span className="admin-notif__dot" aria-hidden="true" />

            <Link to={drillDownPath(n)} className="admin-notif__body">
              <span className="admin-notif__title">{n.title}</span>
              <span className="admin-notif__message">{n.message}</span>
            </Link>

            <button
              type="button"
              className="admin-notif__toggle"
              onClick={() => {
                if (n.read) markNotificationUnread(n.id);
                else markNotificationRead(n.id);
                refresh();
              }}
            >
              {n.read ? 'Mark unread' : 'Mark read'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
