import { getProducts } from '@/lib/actions/products'
import { stockIn } from '@/lib/actions/stock'
import { ArrowDownLeftIcon } from 'lucide-react'

export default async function StockInPage() {
  const products = await getProducts()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Omborga Kirim</h1>
        <p className="text-gray-500">Tayyor mahsulotlarni omborga qabul qilish</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <form action={stockIn} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mahsulotni tanlang</label>
            <select 
              name="productId" 
              required 
              className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 bg-gray-50 text-black"
            >
              <option value="">Tanlang...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Hozirgi: {p.quantity})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Miqdori (dona)</label>
            <input 
              name="quantity" 
              type="number" 
              step="1" 
              required 
              className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 bg-gray-50 text-black"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Izoh (ixtiyoriy)</label>
            <textarea 
              name="note" 
              className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 bg-gray-50 text-black"
              placeholder="Masalan: Yangi partiya keldi"
              rows={3}
            />
          </div>

          <button 
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 transition font-semibold text-lg"
          >
            <ArrowDownLeftIcon className="w-6 h-6" />
            Kirimni tasdiqlash
          </button>
        </form>
      </div>
    </div>
  )
}
