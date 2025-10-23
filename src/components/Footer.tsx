export default function Footer() {
  return (
    <footer className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            © 2024 Haigoo Remote Assistant. All rights reserved.
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-sm text-gray-500 hover:text-blue-500">
              About Us
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-blue-500">
              Contact
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-blue-500">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}