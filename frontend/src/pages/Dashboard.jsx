import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI, appointmentsAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiUsers, FiDollarSign, FiStar, FiArrowRight } from 'react-icons/fi';
import Loading from '../../components/common/Loading';

const Dashboard = () => {
  const { user, isDoctor, isAdmin, isPatient } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      let statsRes;
      if (isAdmin) statsRes = await dashboardAPI.getAdminStats();
      else if (isDoctor) statsRes = await dashboardAPI.getDoctorStats();
      else statsRes = await dashboardAPI.getPatientStats();
      setStats(statsRes.data);

      if (!isAdmin) {
        const apptRes = await appointmentsAPI.getMy({ per_page: 5 });
        setRecentAppointments(apptRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  const statCards = [
    { label: 'Total Appointments', value: stats?.total_appointments || 0, icon: <FiCalendar />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending', value: stats?.pending_appointments || 0, icon: <FiClock />, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Completed', value: stats?.completed_appointments || 0, icon: <FiCheckCircle />, color: 'bg-green-50 text-green-600' },
    { label: 'Cancelled', value: stats?.cancelled_appointments || 0, icon: <FiXCircle />, color: 'bg-red-50 text-red-600' },
    ...(isDoctor || isAdmin ? [
      { label: isAdmin ? 'Total Doctors' : 'Total Patients', value: isAdmin ? stats?.total_doctors : stats?.total_patients || 0, icon: <FiUsers />, color: 'bg-purple-50 text-purple-600' },
    ] : []),
    ...(isDoctor || isAdmin ? [
      { label: 'Revenue', value: `$${(stats?.total_revenue || 0).toLocaleString()}`, icon: <FiDollarSign />, color: 'bg-emerald-50 text-emerald-600' },
    ] : []),
    ...(isDoctor ? [
      { label: 'Rating', value: stats?.average_rating?.toFixed(1) || '0.0', icon: <FiStar />, color: 'bg-amber-50 text-amber-600' },
    ] : []),
  ];

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled',
      no_show: 'bg-gray-100 text-gray-800',
    };
    return <span className={`badge ${styles[status] || ''}`}>{status}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.first_name}! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          {isDoctor ? "Here's your practice overview" : isAdmin ? "System overview dashboard" : "Here's your health overview"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {isPatient && (
          <Link to="/doctors" className="card flex items-center justify-between group">
            <div>
              <h3 className="font-semibold text-gray-900">Find a Doctor</h3>
              <p className="text-sm text-gray-500">Browse specialists nearby</p>
            </div>
            <FiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
          </Link>
        )}
        <Link to="/appointments" className="card flex items-center justify-between group">
          <div>
            <h3 className="font-semibold text-gray-900">View Appointments</h3>
            <p className="text-sm text-gray-500">Manage your bookings</p>
          </div>
          <FiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
        </Link>
        {isDoctor && (
          <Link to="/schedule" className="card flex items-center justify-between group">
            <div>
              <h3 className="font-semibold text-gray-900">Manage Schedule</h3>
              <p className="text-sm text-gray-500">Set your availability</p>
            </div>
            <FiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
          </Link>
        )}
        <Link to="/profile" className="card flex items-center justify-between group">
          <div>
            <h3 className="font-semibold text-gray-900">Update Profile</h3>
            <p className="text-sm text-gray-500">Edit your information</p>
          </div>
          <FiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
        </Link>
      </div>

      {/* Recent Appointments */}
      {!isAdmin && recentAppointments.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Appointments</h2>
            <Link to="/appointments" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">{isDoctor ? 'Patient' : 'Doctor'}</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAppointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3">{appt.appointment_date}</td>
                    <td className="py-3">
                      {isDoctor
                        ? `${appt.patient.first_name} ${appt.patient.last_name}`
                        : `Dr. ${appt.doctor.user.first_name} ${appt.doctor.user.last_name}`
                      }
                    </td>
                    <td className="py-3">{appt.start_time}</td>
                    <td className="py-3">{getStatusBadge(appt.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
