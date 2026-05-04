import { Link } from 'react-router-dom';
import { FiSearch, FiCalendar, FiShield, FiStar, FiClock, FiUsers } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    { icon: <FiSearch className="w-6 h-6" />, title: 'Find Doctors', desc: 'Search from hundreds of specialists by location, rating, and specialization.' },
    { icon: <FiCalendar className="w-6 h-6" />, title: 'Easy Booking', desc: 'Book appointments with real-time availability and instant confirmation.' },
    { icon: <FiClock className="w-6 h-6" />, title: 'Time Slot Management', desc: 'Choose from available slots that fit your schedule perfectly.' },
    { icon: <FiShield className="w-6 h-6" />, title: 'Secure Platform', desc: 'Your health data is protected with enterprise-grade security.' },
    { icon: <FiStar className="w-6 h-6" />, title: 'Reviews & Ratings', desc: 'Read patient reviews and pick top-rated doctors with confidence.' },
    { icon: <FiUsers className="w-6 h-6" />, title: 'Doctor Dashboard', desc: 'Doctors manage their schedule, patients, and appointments seamlessly.' },
  ];

  const specializations = [
    { name: 'General Medicine', icon: '🩺', color: 'bg-blue-50 text-blue-600' },
    { name: 'Cardiology', icon: '❤️', color: 'bg-red-50 text-red-600' },
    { name: 'Dermatology', icon: '🧴', color: 'bg-purple-50 text-purple-600' },
    { name: 'Orthopedics', icon: '🦴', color: 'bg-orange-50 text-orange-600' },
    { name: 'Pediatrics', icon: '👶', color: 'bg-pink-50 text-pink-600' },
    { name: 'Neurology', icon: '🧠', color: 'bg-indigo-50 text-indigo-600' },
    { name: 'Ophthalmology', icon: '👁️', color: 'bg-teal-50 text-teal-600' },
    { name: 'Dentistry', icon: '🦷', color: 'bg-cyan-50 text-cyan-600' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Your Health, <br />
              <span className="text-primary-200">Our Priority</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-100 mb-8 max-w-2xl">
              Book appointments with top doctors in just a few clicks. Manage your health journey with our comprehensive appointment system.
            </p>
            <div className="flex flex-wrap gap-4">
              {isAuthenticated ? (
                <Link to="/doctors" className="bg-white text-primary-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-primary-50 transition-all shadow-lg">
                  Find a Doctor
                </Link>
              ) : (
                <>
                  <Link to="/register" className="bg-white text-primary-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-primary-50 transition-all shadow-lg">
                    Get Started Free
                  </Link>
                  <Link to="/login" className="border-2 border-primary-300 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-primary-600 transition-all">
                    Log In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-8 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: '500+', label: 'Doctors' },
            { num: '10K+', label: 'Patients' },
            { num: '50K+', label: 'Appointments' },
            { num: '4.8★', label: 'Avg Rating' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl md:text-3xl font-bold text-primary-600">{s.num}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Specializations */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Browse by Specialization</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Find the right specialist for your health needs</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {specializations.map((spec) => (
              <Link
                key={spec.name}
                to={`/doctors?specialization=${spec.name}`}
                className="card text-center hover:scale-105 transition-transform"
              >
                <div className={`w-14 h-14 ${spec.color} rounded-xl flex items-center justify-center text-2xl mx-auto mb-3`}>
                  {spec.icon}
                </div>
                <h3 className="font-medium text-gray-900 text-sm">{spec.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Why Choose DocBook?</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Everything you need to manage your healthcare appointments</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card text-center group">
                <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-600 text-white">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Book Your First Appointment?</h2>
          <p className="text-primary-100 mb-8 text-lg">Join thousands of patients who trust DocBook for their healthcare needs.</p>
          <Link to="/register" className="bg-white text-primary-700 px-10 py-3.5 rounded-xl font-semibold hover:bg-primary-50 transition-all shadow-lg inline-block">
            Sign Up Now — It's Free
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
