import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { items as itemsApi } from '../services/api'
import { loadFilters, saveFilters } from '../services/filterStore'
import { useUser, isManager } from '../context/AppContext'
import { Package, Filter, ChevronRight, Plus } from 'lucide-react'
import SearchInput from '../components/ui/SearchInput'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function Items() {
  const user = useUser()
  const canCreate = isManager(user?.role) || ['stores_manager', 'admin', 'director', 'procurement_officer'].includes(user?.role)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(() => loadFilters('items', {
    search: '',
    group: '',
    abc_class: '',
    storage_type: '',
    page: 1,
  }))
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    saveFilters('items', { search: filters.search, group: filters.group, abc_class: filters.abc_class, storage_type: filters.storage_type })
  }, [filters.search, filters.group, filters.abc_class, filters.storage_type])

  useEffect(() => {
    loadItems()
  }, [filters])

  async function loadItems() {
    setLoading(true)
    setError('')
    try {
      const result = await itemsApi.list({
        page: filters.page,
        per_page: 25,
        search: filters.search,
        group: filters.group,
        abc_class: filters.abc_class,
        storage_type: filters.storage_type,
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

  function handleFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const activeFilterCount = [filters.group, filters.abc_class, filters.storage_type].filter(Boolean).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Items Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total?.toLocaleString() || '—'} items
          </p>
        </div>
        {canCreate && (
          <Link
            to="/app/items/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Item</span>
          </Link>
        )}
      </div>

      {/* Search + Filter Toggle */}
      <div data-guide="items-search" className="flex gap-2 mb-4">
        <div className="flex-1">
          <SearchInput
            value={filters.search}
            onChange={handleSearch}
            placeholder="Search items by name or code..."
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          data-guide="items-filter-btn"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
            activeFilterCount > 0
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Item Group</label>
              <select
                value={filters.group}
                onChange={(e) => handleFilter('group', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">All Groups</option>
                {data?.groups?.map(g => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ABC Class</label>
              <select
                value={filters.abc_class}
                onChange={(e) => handleFilter('abc_class', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">All Classes</option>
                <option value="A">A — High Value</option>
                <option value="B">B — Medium Value</option>
                <option value="C">C — Low Value</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Storage Type</label>
              <select
                value={filters.storage_type}
                onChange={(e) => handleFilter('storage_type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">All Types</option>
                <option value="ambient">Ambient</option>
                <option value="chilled">Chilled</option>
                <option value="frozen">Frozen</option>
                <option value="hazardous">Hazardous</option>
              </select>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, group: '', abc_class: '', storage_type: '', page: 1 }))}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={loadItems} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && <LoadingSpinner message="Loading items..." />}

      {/* Items List */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          {data.items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No items found"
              message={filters.search ? `No items matching "${filters.search}"` : 'No items in catalog'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Code</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Item Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Group</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">UOM</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">ABC</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Storage</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Price (TZS)</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map(item => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-900">{item.item_code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/items/${item.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                            {item.name}
                          </Link>
                          {item.is_critical && <span className="ml-1 text-red-500 text-xs" title="Critical item">●</span>}
                          {item.is_perishable && <span className="ml-1 text-amber-500 text-xs" title="Perishable">◆</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{item.group_code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">{item.stock_uom}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={item.abc_class}>{item.abc_class}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={item.storage_type}>{item.storage_type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-900">
                            {item.last_purchase_price
                              ? Math.round(item.last_purchase_price).toLocaleString()
                              : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/app/items/${item.id}`}>
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
                {data.items.map(item => (
                  <Link
                    key={item.id}
                    to={`/app/items/${item.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{item.item_code}</span>
                        <Badge variant={item.abc_class}>{item.abc_class}</Badge>
                        {item.is_critical && <span className="text-red-500 text-xs">●</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{item.group_name}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{item.stock_uom}</span>
                        {item.last_purchase_price && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-500">
                              TZS {Math.round(item.last_purchase_price).toLocaleString()}
                            </span>
                          </>
                        )}
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
