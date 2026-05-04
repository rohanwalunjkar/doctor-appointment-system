const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">D</span>
              </div>
              <span className="text-lg font-bold">Doc<span className="text-primary-600">Book</span></span>
            </div>
            <p className="text-sm text-gray-500">
              Your trusted platform for booking doctor appointments with ease and convenience.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="/doctors" className="hover:text-primary-600">Find Doctors</a></li>
              <li><a href="/specializations" className="hover:text-primary-600">Specializations</a></li>
              <li><a href="/about" className="hover:text-primary-600">About Us</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">For Doctors</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="/register" className="hover:text-primary-600">Join as Doctor</a></li>
              <li><a href="/dashboard" className="hover:text-primary-600">Doctor Dashboard</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>support@docbook.com</li>
              <li>+1 (555) 123-4567</li>
              <li>123 Medical Ave, Health City</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 mt-8 pt-6 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} DocBook. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
