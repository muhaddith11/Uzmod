import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-100 px-8 py-4 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600">Sex SaaS</Link>
        <div className="flex gap-6 text-sm font-medium text-gray-600">
          <Link href="/inventory" className="hover:text-blue-600">Ombor (Mahsulotlar)</Link>
          <Link href="/materials" className="hover:text-blue-600">Xomashyolar</Link>
          <Link href="/stock-in" className="hover:text-blue-600 font-bold text-green-600">Kirim</Link>
          <Link href="/production" className="hover:text-blue-600 font-bold text-purple-600">Ishlab chiqarish</Link>
        </div>
      </div>
    </nav>
  )
}
