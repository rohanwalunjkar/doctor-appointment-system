import { useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';
import { FiBell, FiCheck, FiCheckCircle } from 'react-icons/fi';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsAPI.getAll();
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(notifications.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* handled */ }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch { /* handled */ }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {notifications.some((n) => !n.is_read) && (
          <button onClick={markAllRead} className="btn-secondary text-sm">
            <FiCheckCircle className="inline w-4 h-4 mr-1" /> Mark All Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-16">
          <FiBell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`card flex items-start space-x-3 cursor-pointer ${!notif.is_read ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : ''}`}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
            >
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!notif.is_read ? 'bg-primary-500' : 'bg-transparent'}`} />
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${!notif.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{notif.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-1">{notif.created_at?.slice(0, 16).replace('T', ' ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
