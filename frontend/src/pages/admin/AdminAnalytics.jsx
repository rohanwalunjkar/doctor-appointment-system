import { useState, useEffect } from 'react';
import { dashboardAPI, usersAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import { FiUsers, FiCalendar, FiDollarSign, FiTrendingUp, FiStar } from 'react-icons/fi';

const AdminAnalytics = () => {
  const [stats, setStats] = useState(null);
  const [topDoctors, setTopDoctors] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, doctorsRes, trendsRes] = await Promise.all([
        dashboardAPI.getAdminStats(),
        dashboardAPI.getTopDoctors(5),
        dashboardAPI.getAppointmentTrends(30),
      ]);
      setStats(statsRes.data);
      setTopDoctors(doctorsRes.data);
      setTrends(trendsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Analytics</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Appointments', value: stats?.total_appointments, icon: <FiCalendar />, color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Doctors', value: stats?.total_doctors, icon: <FiUsers />, color: 'bg-purple-50 text-purple-600' },
          { label: 'Total Patients', value: stats?.total_patients, icon: <FiUsers />, color: 'bg-green-50 text-green-600' },
          { label: 'Total Revenue', value: `$${(stats?.total_revenue || 0).toLocaleString()}`, icon: <FiDollarSign />, color: 'bg-amber-50 text-amber-600' },
        ].map((card, i) => (
          <div key={i} className="card">
            <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center mb-3`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Doctors */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Rated Doctors</h2>
          <div className="space-y-3">
            {topDoctors.map((doc, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-xs font-bold text-primary-700">
                    #{i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.total_patients} patients</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <FiStar className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-sm">{doc.rating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Appointment Trends */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Appointment Trends (30 days)</h2>
          {trends.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data available</p>
          ) : (
            <div className="space-y-2">
              {trends.slice(-10).map((t, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500 w-20">{t.date.slice(5)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min((t.count / Math.max(...trends.map(x => x.count))) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-8 text-right">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
