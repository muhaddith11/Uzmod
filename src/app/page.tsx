import Link from 'next/link'
import { PackageIcon, BoxIcon, HammerIcon, ArrowDownLeftIcon } from 'lucide-react'

export default function Home() {
  const cards = [
    { name: 'Mahsulotlar', desc: 'Tayyor tovarlar ombori', href: '/inventory', icon: PackageIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Xomashyolar', desc: 'Resurslar va reseptlar', href: '/materials', icon: BoxIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
    { name: 'Kirim qilish', desc: 'Yangi mahsulotlarni qabul qilish', href: '/stock-in', icon: ArrowDownLeftIcon, color: 'text-green-600', bg: 'bg-green-50' },
    { name: 'Ishlab chiqarish', desc: 'Xomashyodan mahsulot yaratish', href: '/production', icon: HammerIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="p-12 max-w-6xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">Kichik Sex Boshqaruvi</h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">Sizning biznesingiz uchun aqlli ombor va ishlab chiqarish tizimi.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link key={card.name} href={card.href} className="group p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300">
            <div className={`${card.bg} ${card.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6`}>
              <card.icon className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{card.name}</h2>
            <p className="text-gray-500 leading-relaxed">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
