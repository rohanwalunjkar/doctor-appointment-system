import { useState, useEffect } from 'react';
import { doctorsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiClock, FiCalendar } from 'react-icons/fi';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const Schedule = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    day_of_week: 'monday',
    start_time: '09:00',
    end_time: '13:00',
    slot_duration_minutes: 30,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      // First try to find doctor profile
      const res = await doctorsAPI.list({ search: user.first_name });
      const myProfile = res.data.find((d) => d.user.id === user.id);
      if (myProfile) {
        setDoctorProfile(myProfile);
        fetchSchedules(myProfile.id);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const fetchSchedules = async (doctorId) => {
    try {
      const res = await doctorsAPI.getSchedules(doctorId);
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addSchedule = async (e) => {
    e.preventDefault();
    try {
      await doctorsAPI.createSchedule({
        ...form,
        start_time: form.start_time + ':00',
        end_time: form.end_time + ':00',
      });
      toast.success('Schedule added & time slots generated!');
      setShowAdd(false);
      fetchSchedules(doctorProfile.id);
    } catch {
      // handled
    }
  };

  const deleteSchedule = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await doctorsAPI.deleteSchedule(id);
      toast.success('Schedule deleted');
      fetchSchedules(doctorProfile.id);
    } catch {
      // handled
    }
  };

  const generateSlots = async () => {
    try {
      const res = await doctorsAPI.generateSlots(doctorProfile.id, 14);
      toast.success(res.data.message);
    } catch {
      // handled
    }
  };

  if (loading) return <Loading />;

  if (!doctorProfile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Doctor Profile Required</h2>
        <p className="text-gray-500">Please create your doctor profile first to manage schedules.</p>
      </div>
    );
  }

  const groupedSchedules = DAYS.reduce((acc, day) => {
    acc[day] = schedules.filter((s) => s.day_of_week === day);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-500 mt-1">Manage your weekly availability and time slots</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateSlots} className="btn-secondary text-sm">
            <FiCalendar className="inline w-4 h-4 mr-1" /> Regenerate Slots
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            <FiPlus className="inline w-4 h-4 mr-1" /> Add Schedule
          </button>
        </div>
      </div>

      {/* Weekly View */}
      <div className="space-y-3">
        {DAYS.map((day) => (
          <div key={day} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 capitalize w-28">{day}</h3>
              <div className="flex-1 flex flex-wrap gap-2">
                {groupedSchedules[day].length === 0 ? (
                  <span className="text-sm text-gray-400">No schedule – Day off</span>
                ) : (
                  groupedSchedules[day].map((s) => (
                    <div key={s.id} className="flex items-center bg-primary-50 rounded-lg px-3 py-1.5 text-sm group">
                      <FiClock className="w-3.5 h-3.5 text-primary-500 mr-1.5" />
                      <span className="text-primary-700 font-medium">
                        {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                      </span>
                      <span className="text-primary-400 ml-2 text-xs">({s.slot_duration_minutes}min slots)</span>
                      <button
                        onClick={() => deleteSchedule(s.id)}
                        className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Schedule Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Schedule Slot</h2>
            <form onSubmit={addSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} className="input-field capitalize">
                  {DAYS.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slot Duration (minutes)</label>
                <select value={form.slot_duration_minutes} onChange={(e) => setForm({ ...form, slot_duration_minutes: parseInt(e.target.value) })} className="input-field">
                  {[15, 20, 30, 45, 60].map((d) => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
