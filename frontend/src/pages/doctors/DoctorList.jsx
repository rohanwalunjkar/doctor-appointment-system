import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doctorsAPI } from '../../services/api';
import Loading from '../../components/common/Loading';
import { FiSearch, FiMapPin, FiStar, FiBriefcase, FiDollarSign, FiFilter } from 'react-icons/fi';

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    specialization_id: searchParams.get('specialization_id') || '',
    min_rating: '',
    max_fee: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    doctorsAPI.getSpecializations().then((res) => setSpecializations(res.data));
    fetchDoctors();
  }, []);

  const fetchDoctors = async (params = {}) => {
    setLoading(true);
    try {
      const queryParams = { ...filters, ...params };
      Object.keys(queryParams).forEach((k) => !queryParams[k] && delete queryParams[k]);
      const res = await doctorsAPI.list(queryParams);
      setDoctors(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDoctors();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Find a Doctor</h1>
        <p className="text-gray-500 mt-1">Search from our network of trusted medical professionals</p>
      </div>

      {/* Search & Filters */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field pl-10"
              placeholder="Search doctors by name..."
            />
          </div>
          <select
            value={filters.specialization_id}
            onChange={(e) => setFilters({ ...filters, specialization_id: e.target.value })}
            className="input-field w-auto min-w-[200px]"
          >
            <option value="">All Specializations</option>
            {specializations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">Search</button>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-1">
            <FiFilter /> Filters
          </button>
        </form>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Rating</label>
              <select value={filters.min_rating} onChange={(e) => setFilters({ ...filters, min_rating: e.target.value })} className="input-field text-sm">
                <option value="">Any</option>
                <option value="3">3+ Stars</option>
                <option value="4">4+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Fee</label>
              <select value={filters.max_fee} onChange={(e) => setFilters({ ...filters, max_fee: e.target.value })} className="input-field text-sm">
                <option value="">Any</option>
                <option value="300">Under $300</option>
                <option value="500">Under $500</option>
                <option value="800">Under $800</option>
                <option value="1000">Under $1000</option>
              </select>
            </div>
            <div className="col-span-2 flex items-end">
              <button onClick={() => { setFilters({ search: '', specialization_id: '', min_rating: '', max_fee: '' }); fetchDoctors({ search: '', specialization_id: '', min_rating: '', max_fee: '' }); }} className="text-sm text-gray-500 hover:text-gray-700">
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <Loading />
      ) : doctors.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-lg">No doctors found matching your criteria</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map((doc) => (
            <Link key={doc.id} to={`/doctors/${doc.id}`} className="card group hover:border-primary-200">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-bold text-lg">
                    {doc.user.first_name[0]}{doc.user.last_name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    Dr. {doc.user.first_name} {doc.user.last_name}
                  </h3>
                  <p className="text-sm text-primary-600 font-medium">{doc.specialization.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.qualification}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center text-gray-500">
                  <FiStar className="w-4 h-4 text-amber-500 mr-1" />
                  <span className="font-medium text-gray-700">{doc.average_rating.toFixed(1)}</span>
                  <span className="ml-1">({doc.total_reviews})</span>
                </div>
                <div className="flex items-center text-gray-500">
                  <FiBriefcase className="w-4 h-4 mr-1" />
                  {doc.experience_years} yrs
                </div>
                <div className="flex items-center text-gray-500">
                  <FiDollarSign className="w-4 h-4 mr-1" />
                  ${doc.consultation_fee}
                </div>
                {doc.hospital_name && (
                  <div className="flex items-center text-gray-500 truncate">
                    <FiMapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">{doc.hospital_name}</span>
                  </div>
                )}
              </div>

              <button className="btn-primary w-full mt-4 text-sm">
                Book Appointment
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorList;
