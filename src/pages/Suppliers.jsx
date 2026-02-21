import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, isManager } from '../context/AppContext'
import { suppliers as suppliersApi } from '../services/api'
import { loadFilters, saveFilters } from '../services/filterStore'
import { Building2, Plus, ChevronRight, Filter } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function Suppliers() {
  const user = useUser()
  const canCreate = isManager(user?.role)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => loadFilters('suppliers', {
    search: '',
    active: '1',
    page: 1,
  }))

  useEffect(() => {
    saveFilters('suppliers', { search: filters.search, active: filters.active })
  }, [filters.search, filters.active])

  useEffect(() => {
    loadSuppliers()
  }, [filters])

  async function loadSuppliers() {
    setLoading(true)
    setError('')
    try {
      const result = await suppliersApi.list({
        page: filters.page,
        per_page: 25,
        search: filters.search,
        active: filters.active,
      })
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(value) {
    setFilters(prev => ({ ...prev, search: value, page: 1 }))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} suppliers
          </p>
        </div>
        {canCreate && (
          <Link
            to="/app/suppliers/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Supplier</span>
          </Link>
        )}
      </div>

      {/* Search + Status Filter */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <SearchInput
            value={filters.search}
            onChange={handleSearch}
            placeholder="Search by name, code, or contact..."
          />
        </div>
        <select
          value={filters.active}
          onChange={e => setFilters(prev => ({ ...prev, active: e.target.value, page: 1 }))}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          <option value="1">Active</option>
          <option value="0">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadSuppliers} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading suppliers..." />}

      {/* Suppliers List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.suppliers.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No suppliers found"
              message={filters.search ? `No suppliers matching "${filters.search}"` : 'No suppliers yet'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Code</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Supplier Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contact</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Email</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Payment Terms</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Items</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suppliers.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-900">{s.supplier_code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/suppliers/${s.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{s.contact || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{s.email || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-600">{s.payment_terms}d</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-600">{s.item_count}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={s.is_active ? 'ok' : 'out'}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/suppliers/${s.id}`}>
                            <ChevronRight size={16} className="text-gray-400" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-100">
                {data.suppliers.map(s => (
                  <Link
                    key={s.id}
                    to={`/app/suppliers/${s.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{s.supplier_code}</span>
                        <Badge variant={s.is_active ? 'ok' : 'out'}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{s.contact || 'No contact'}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{s.payment_terms}d terms</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{s.item_count} items</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-4 pb-4">
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.total_pages}
                  total={data.pagination.total}
                  perPage={data.pagination.per_page}
                  onChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
