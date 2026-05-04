import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorsAPI, appointmentsAPI, reviewsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { format, addDays, parseISO } from 'date-fns';
import { FiStar, FiBriefcase, FiDollarSign, FiMapPin, FiCalendar, FiClock, FiUser, FiAward } from 'react-icons/fi';

const DoctorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isPatient } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('slots');

  useEffect(() => {
    fetchDoctor();
    fetchReviews();
  }, [id]);

  useEffect(() => {
    if (doctor) fetchSlots();
  }, [selectedDate, doctor]);

  const fetchDoctor = async () => {
    try {
      const res = await doctorsAPI.getById(id);
      setDoctor(res.data);
    } catch {
      navigate('/doctors');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await reviewsAPI.getByDoctor(id);
      setReviews(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSlots = async () => {
    try {
      const res = await appointmentsAPI.getSlots(id, selectedDate, selectedDate);
      setSlots(res.data);
      setSelectedSlot(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBooking = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to book an appointment');
      navigate('/login');
      return;
    }
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }
    setBooking(true);
    try {
      await appointmentsAPI.create({
        doctor_id: parseInt(id),
        time_slot_id: selectedSlot.id,
        reason,
      });
      toast.success('Appointment booked successfully!');
      navigate('/appointments');
    } catch {
      // handled by interceptor
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <Loading />;
  if (!doctor) return null;

  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i);
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE, MMM d') };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Doctor Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <div className="text-center mb-4">
              <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-primary-700 font-bold text-3xl">
                  {doctor.user.first_name[0]}{doctor.user.last_name[0]}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Dr. {doctor.user.first_name} {doctor.user.last_name}
              </h1>
              <p className="text-primary-600 font-medium">{doctor.specialization.name}</p>
              <p className="text-sm text-gray-500">{doctor.qualification}</p>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-500"><FiStar className="w-4 h-4 mr-2 text-amber-500" /> Rating</span>
                <span className="font-semibold">{doctor.average_rating.toFixed(1)} ({doctor.total_reviews} reviews)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-500"><FiBriefcase className="w-4 h-4 mr-2" /> Experience</span>
                <span className="font-semibold">{doctor.experience_years} years</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-500"><FiDollarSign className="w-4 h-4 mr-2" /> Fee</span>
                <span className="font-semibold text-primary-600">${doctor.consultation_fee}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-gray-500"><FiUser className="w-4 h-4 mr-2" /> Patients</span>
                <span className="font-semibold">{doctor.total_patients}+</span>
              </div>
              {doctor.hospital_name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center text-gray-500"><FiMapPin className="w-4 h-4 mr-2" /> Hospital</span>
                  <span className="font-semibold text-right">{doctor.hospital_name}</span>
                </div>
              )}
            </div>

            {doctor.bio && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                <p className="text-sm text-gray-500">{doctor.bio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Booking Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {['slots', 'reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium capitalize transition-colors ${
                  activeTab === tab ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'slots' ? '📅 Book Appointment' : `⭐ Reviews (${reviews.length})`}
              </button>
            ))}
          </div>

          {activeTab === 'slots' ? (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Date & Time</h2>

              {/* Date selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiCalendar className="inline w-4 h-4 mr-1" /> Select Date
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {dateOptions.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDate(d.value)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedDate === d.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiClock className="inline w-4 h-4 mr-1" /> Available Slots
                </label>
                {slots.length === 0 ? (
                  <p className="text-gray-400 text-sm py-4 text-center">No available slots for this date</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedSlot?.id === slot.id
                            ? 'bg-primary-600 text-white shadow-md'
                            : 'bg-gray-50 text-gray-700 hover:bg-primary-50 hover:text-primary-700'
                        }`}
                      >
                        {slot.start_time.slice(0, 5)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for visit (optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field"
                  rows={3}
                  placeholder="Describe your symptoms or reason for the appointment..."
                />
              </div>

              {/* Summary & Book */}
              {selectedSlot && (
                <div className="bg-primary-50 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-primary-800 mb-2">Booking Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p className="text-primary-600">Doctor:</p>
                    <p className="font-medium">Dr. {doctor.user.first_name} {doctor.user.last_name}</p>
                    <p className="text-primary-600">Date:</p>
                    <p className="font-medium">{selectedDate}</p>
                    <p className="text-primary-600">Time:</p>
                    <p className="font-medium">{selectedSlot.start_time.slice(0, 5)} - {selectedSlot.end_time.slice(0, 5)}</p>
                    <p className="text-primary-600">Fee:</p>
                    <p className="font-medium">${doctor.consultation_fee}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleBooking}
                disabled={!selectedSlot || booking}
                className="btn-primary w-full text-center"
              >
                {booking ? 'Booking...' : isPatient ? 'Confirm Booking' : 'Login to Book'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="card text-center py-12">
                  <p className="text-gray-400">No reviews yet</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="card">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-600">
                          {review.patient.first_name[0]}{review.patient.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">
                            {review.patient.first_name} {review.patient.last_name}
                          </h4>
                          <span className="text-xs text-gray-400">{review.created_at?.slice(0, 10)}</span>
                        </div>
                        <div className="flex items-center mt-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <FiStar
                              key={i}
                              className={`w-4 h-4 ${i < review.rating ? 'text-amber-400 fill-current' : 'text-gray-200'}`}
                            />
                          ))}
                        </div>
                        {review.comment && <p className="text-sm text-gray-600 mt-2">{review.comment}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDetail;
