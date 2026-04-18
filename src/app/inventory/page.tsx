import { getProducts, createProduct, deleteProduct } from '@/lib/actions/products'
import { PlusIcon, TrashIcon } from 'lucide-react'

export default async function InventoryPage() {
  const products = await getProducts()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mahsulotlar Ombori</h1>
          <p className="text-gray-500">Tayyor mahsulotlar ro'yxati va boshqaruvi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Yangi mahsulot qo'shish formasi */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <PlusIcon className="w-5 h-5 text-blue-600" />
            Yangi Mahsulot
          </h2>
          <form action={createProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nomi</label>
              <input 
                name="name" 
                required 
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-gray-50 text-black"
                placeholder="Masalan: Mahsulot A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Artikul (SKU)</label>
              <input 
                name="sku" 
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-gray-50 text-black"
                placeholder="SKU-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Narxi (so'm)</label>
              <input 
                name="price" 
                type="number" 
                step="0.01" 
                required 
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-gray-50 text-black"
                placeholder="0.00"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Qo'shish
            </button>
          </form>
        </div>

        {/* Mahsulotlar jadvali */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-black">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nomi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mavjud</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Narxi</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amallar</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.quantity > 10 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {product.quantity} dona
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.price.toString()} so'm</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <form action={async () => { 'use server'; await deleteProduct(product.id) }}>
                      <button className="text-red-600 hover:text-red-900">
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    Hozircha mahsulotlar yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
