import { getProducts } from '@/lib/actions/products'
import { produceProduct, getProductionLogs } from '@/lib/actions/production'
import { HammerIcon, HistoryIcon } from 'lucide-react'

export default async function ProductionPage() {
  const products = await getProducts()
  const logs = await getProductionLogs()

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ishlab Chiqarish</h1>
          <p className="text-gray-500">Tayyor mahsulot yaratish va xomashyo sarfi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Ishlab chiqarish formasi */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-600">
            <HammerIcon className="w-6 h-6" />
            Yangi Ishlab chiqarish
          </h2>
          <form action={produceProduct} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Qaysi mahsulot tayyorlandi?</label>
              <select 
                name="productId" 
                required 
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 p-4 bg-gray-50 text-black"
              >
                <option value="">Mahsulotni tanlang...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-400 font-medium">* Eslatma: Mahsulot resepti (BOM) oldindan sozlangan bo'lishi kerak.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tayyorlangan miqdor (dona)</label>
              <input 
                name="quantityProduced" 
                type="number" 
                step="1" 
                required 
                className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 p-4 bg-gray-50 text-black"
                placeholder="10"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-purple-600 text-white py-4 px-6 rounded-2xl hover:bg-purple-700 transition font-bold text-lg shadow-lg shadow-purple-200"
            >
              Tayyorlashni tasdiqlash
            </button>
          </form>
        </section>

        {/* Tarix */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
              <HistoryIcon className="w-6 h-6 text-gray-400" />
              Oxirgi jarayonlar
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-black">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Sana</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Mahsulot</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Miqdor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{log.product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-bold">+{log.quantityProduced} dona</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">Hali ishlab chiqarish amalga oshirilmagan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
