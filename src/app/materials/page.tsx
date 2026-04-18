import { getMaterials, createMaterial, addBOMItem } from '@/lib/actions/materials'
import { getProducts } from '@/lib/actions/products'
import { BoxIcon, Settings2Icon } from 'lucide-react'

export default async function MaterialsPage() {
  const materials = await getMaterials()
  const products = await getProducts()

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Xomashyolar va Reseptlar</h1>
        <p className="text-gray-500">Ombor zaxiralari va mahsulot tarkibi boshqaruvi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Xomashyo qo'shish */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600">
            <BoxIcon className="w-6 h-6" />
            Yangi Xomashyo
          </h2>
          <form action={createMaterial} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nomi</label>
              <input name="name" required className="mt-1 block w-full rounded-xl border-gray-200 p-3 bg-gray-50 text-black px-4" placeholder="Masalan: Mato, G'isht" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Birlik</label>
                <select name="unit" required className="mt-1 block w-full rounded-xl border-gray-200 p-3 bg-gray-50 text-black px-4">
                  <option value="KG">Kilogram (KG)</option>
                  <option value="METER">Metr (M)</option>
                  <option value="PIECE">Dona (PCS)</option>
                  <option value="LITER">Litr (L)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">O'rtacha Narx</label>
                <input name="price" type="number" step="0.01" required className="mt-1 block w-full rounded-xl border-gray-200 p-3 bg-gray-50 text-black px-4" placeholder="0.00" />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition font-bold mt-4">Xomashyoni saqlash</button>
          </form>

          <div className="mt-8">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Mavjud Xomashyolar</h3>
            <div className="space-y-2">
              {materials.map(m => (
                <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl text-black">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-blue-600 font-bold">{m.quantity} {m.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOM Setup (Resept) */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-orange-600">
            <Settings2Icon className="w-6 h-6" />
            Resept (BOM) Sozlash
          </h2>
          <p className="text-sm text-gray-500 mb-6">Mahsulot tayyorlash uchun qancha xomashyo ketishini belgilang.</p>
          
          <form action={addBOMItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mahsulotni tanlang</label>
              <select name="productId" required className="mt-1 block w-full rounded-xl border-gray-200 p-3 bg-gray-50 text-black px-4">
                <option value="">Tanlang...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Kerakli Xomashyo</label>
              <select name="materialId" required className="mt-1 block w-full rounded-xl border-gray-200 p-3 bg-gray-50 text-black px-4">
                <option value="">Tanlang...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Miqdori (1 mahsulot uchun)</label>
              <input name="quantityNeeded" type="number" step="0.001" required className="mt-1 block w-full rounded-xl border-gray-200 p-3 bg-gray-50 text-black px-4" placeholder="Masalan: 0.5" />
            </div>
            <button type="submit" className="w-full bg-orange-600 text-white py-3 px-4 rounded-xl hover:bg-orange-700 transition font-bold mt-4">Reseptga qo'shish</button>
          </form>
        </section>
      </div>
    </div>
  )
}
