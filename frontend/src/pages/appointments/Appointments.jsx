import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { FiCalendar, FiClock, FiUser, FiFileText, FiX, FiCheck, FiEye } from 'react-icons/fi';

const Appointments = () => {
  const { isDoctor } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status_filter = statusFilter;
      const res = await appointmentsAPI.getMy(params);
      setAppointments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await appointmentsAPI.update(id, { status });
      toast.success(`Appointment ${status}`);
      fetchAppointments();
      setShowModal(false);
    } catch {
      // handled by interceptor
    }
  };

  const saveNotes = async () => {
    try {
      const data = {};
      if (notes) data.notes = notes;
      if (prescription) data.prescription = prescription;
      await appointmentsAPI.update(selectedAppointment.id, data);
      toast.success('Notes saved');
      fetchAppointments();
      setShowModal(false);
    } catch {
      // handled
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled',
      no_show: 'bg-gray-100 text-gray-800',
    };
    return <span className={`badge ${styles[status] || 'bg-gray-100'}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-500 mt-1">{isDoctor ? 'Manage your patient appointments' : 'View and manage your bookings'}</p>
        </div>
        {!isDoctor && (
          <Link to="/doctors" className="btn-primary text-sm">Book New Appointment</Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6 overflow-x-auto">
        {[
          { value: '', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.value ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : appointments.length === 0 ? (
        <div className="card text-center py-16">
          <FiCalendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No appointments found</p>
          <p className="text-gray-400 text-sm mt-1">
            {statusFilter ? 'Try a different filter' : 'Book your first appointment'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div key={appt.id} className="card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    {isDoctor ? (
                      <span className="text-primary-700 font-semibold text-sm">
                        {appt.patient.first_name[0]}{appt.patient.last_name[0]}
                      </span>
                    ) : (
                      <span className="text-primary-700 font-semibold text-sm">
                        {appt.doctor.user.first_name[0]}{appt.doctor.user.last_name[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {isDoctor
                        ? `${appt.patient.first_name} ${appt.patient.last_name}`
                        : `Dr. ${appt.doctor.user.first_name} ${appt.doctor.user.last_name}`
                      }
                    </h3>
                    {!isDoctor && (
                      <p className="text-sm text-primary-600">{appt.doctor.specialization.name}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center"><FiCalendar className="w-3.5 h-3.5 mr-1" />{appt.appointment_date}</span>
                      <span className="flex items-center"><FiClock className="w-3.5 h-3.5 mr-1" />{appt.start_time.slice(0, 5)} - {appt.end_time.slice(0, 5)}</span>
                    </div>
                    {appt.reason && (
                      <p className="text-sm text-gray-400 mt-1">Reason: {appt.reason}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusBadge(appt.status)}

                  {/* Doctor actions */}
                  {isDoctor && appt.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(appt.id, 'confirmed')} className="btn-success text-xs px-3 py-1.5">
                        <FiCheck className="inline w-3.5 h-3.5 mr-1" /> Confirm
                      </button>
                      <button onClick={() => updateStatus(appt.id, 'cancelled')} className="btn-danger text-xs px-3 py-1.5">
                        <FiX className="inline w-3.5 h-3.5 mr-1" /> Reject
                      </button>
                    </>
                  )}
                  {isDoctor && appt.status === 'confirmed' && (
                    <button onClick={() => updateStatus(appt.id, 'completed')} className="btn-success text-xs px-3 py-1.5">
                      Complete
                    </button>
                  )}

                  {/* Patient cancel */}
                  {!isDoctor && (appt.status === 'pending' || appt.status === 'confirmed') && (
                    <button onClick={() => updateStatus(appt.id, 'cancelled')} className="btn-danger text-xs px-3 py-1.5">
                      Cancel
                    </button>
                  )}

                  {/* View details */}
                  <button
                    onClick={() => { setSelectedAppointment(appt); setNotes(appt.notes || ''); setPrescription(appt.prescription || ''); setShowModal(true); }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <FiEye className="inline w-3.5 h-3.5 mr-1" /> Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Appointment Details</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Status</span>{getStatusBadge(selectedAppointment.status)}</div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{selectedAppointment.appointment_date}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{selectedAppointment.start_time.slice(0, 5)} - {selectedAppointment.end_time.slice(0, 5)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Patient</span><span className="font-medium">{selectedAppointment.patient.first_name} {selectedAppointment.patient.last_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Doctor</span><span className="font-medium">Dr. {selectedAppointment.doctor.user.first_name} {selectedAppointment.doctor.user.last_name}</span></div>
                {selectedAppointment.reason && (
                  <div><span className="text-gray-500">Reason:</span><p className="mt-1 text-gray-700">{selectedAppointment.reason}</p></div>
                )}
              </div>

              {/* Doctor can add notes */}
              {isDoctor && (
                <div className="mt-6 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Doctor's Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field text-sm" rows={3} placeholder="Add notes..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prescription</label>
                    <textarea value={prescription} onChange={(e) => setPrescription(e.target.value)} className="input-field text-sm" rows={3} placeholder="Add prescription..." />
                  </div>
                  <button onClick={saveNotes} className="btn-primary w-full text-sm">Save Notes</button>
                </div>
              )}

              {/* Patient sees notes/prescription */}
              {!isDoctor && (
                <div className="mt-6 space-y-3">
                  {selectedAppointment.notes && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-blue-800 mb-1">Doctor's Notes</h4>
                      <p className="text-sm text-blue-700">{selectedAppointment.notes}</p>
                    </div>
                  )}
                  {selectedAppointment.prescription && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-green-800 mb-1">Prescription</h4>
                      <p className="text-sm text-green-700">{selectedAppointment.prescription}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
