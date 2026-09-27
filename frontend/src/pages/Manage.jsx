import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineBuildingOffice2,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlinePhoto,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import BulkCsvImport from '../components/BulkCsvImport.jsx';
import SalesInsights from '../components/SalesInsights.jsx';
import { date, money, psf, sf } from '../lib/format.js';
import LeaseForm from './forms/LeaseForm.jsx';
import PropertyForm from './forms/PropertyForm.jsx';
import TransactionForm from './forms/TransactionForm.jsx';

const TABS = [
  { key: 'properties', label: 'Properties', icon: HiOutlineBuildingOffice2 },
  { key: 'leases', label: 'Leases', icon: HiOutlineClipboardDocumentList },
  { key: 'transactions', label: 'Sales', icon: HiOutlineChartBar },
];

const DEFAULT_FILTERS = {
  query: '',
  mapped: 'all',
  photo: 'all',
  dealType: 'all',
  leaseType: 'all',
  status: 'all',
  sort: 'newest',
};

function uniqueOptions(rows, getter) {
  return [...new Set(rows.map(getter).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function propertyTitle(property = {}) {
  return property.display_name || property.address?.split(',')[0] || 'Unnamed property';
}

export default function Manage() {
  const [tab, setTab] = useState('properties');
  const [properties, setProperties] = useState([]);
  const [leases, setLeases] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [modal, setModal] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const photoInputRef = useRef(null);
  const [photoTargetId, setPhotoTargetId] = useState(null);

  async function refresh() {
    const [propertyRows, leaseRows, transactionRows] = await Promise.all([
      api.listProperties(),
      api.listLeases(),
      api.listTransactions(),
    ]);
    setProperties(propertyRows);
    setLeases(leaseRows);
    setTransactions(transactionRows);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const dealTypes = useMemo(() => uniqueOptions(leases, (row) => row.deal_type), [leases]);
  const leaseTypes = useMemo(() => uniqueOptions(leases, (row) => row.lease_type), [leases]);

  const stats = useMemo(() => {
    const mapped = properties.filter((p) => p.latitude != null && p.longitude != null).length;
    const withPhoto = properties.filter((p) => p.image_url).length;
    const closed = transactions.filter((t) => t.status === 'closed').length;
    return {
      properties: properties.length,
      mapped,
      withPhoto,
      leases: leases.length,
      transactions: transactions.length,
      closed,
    };
  }, [properties, leases, transactions]);

  const visibleProperties = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    let rows = properties.filter((property) => {
      if (q && !`${property.display_name} ${property.address}`.toLowerCase().includes(q)) return false;
      if (filters.mapped === 'mapped' && (property.latitude == null || property.longitude == null)) return false;
      if (filters.mapped === 'unmapped' && property.latitude != null && property.longitude != null) return false;
      if (filters.photo === 'has' && !property.image_url) return false;
      if (filters.photo === 'missing' && property.image_url) return false;
      return true;
    });

    rows = [...rows];
    if (filters.sort === 'name') {
      rows.sort((a, b) => propertyTitle(a).localeCompare(propertyTitle(b)));
    } else if (filters.sort === 'missing-photo') {
      rows.sort((a, b) => Number(Boolean(a.image_url)) - Number(Boolean(b.image_url)));
    } else {
      rows.sort((a, b) => Number(b.id) - Number(a.id));
    }
    return rows;
  }, [properties, filters]);

  const visibleLeases = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    let rows = leases.filter((lease) => {
      if (q && !`${lease.tenant} ${lease.properties?.display_name} ${lease.properties?.address} ${lease.deal_type}`.toLowerCase().includes(q)) return false;
      if (filters.dealType !== 'all' && lease.deal_type !== filters.dealType) return false;
      if (filters.leaseType !== 'all' && lease.lease_type !== filters.leaseType) return false;
      return true;
    });

    rows = [...rows];
    if (filters.sort === 'rent') rows.sort((a, b) => Number(b.yr1_rent_psf || 0) - Number(a.yr1_rent_psf || 0));
    else if (filters.sort === 'size') rows.sort((a, b) => Number(b.sf || 0) - Number(a.sf || 0));
    else if (filters.sort === 'tenant') rows.sort((a, b) => String(a.tenant || '').localeCompare(String(b.tenant || '')));
    else rows.sort((a, b) => String(b.signed_date || '').localeCompare(String(a.signed_date || '')));
    return rows;
  }, [leases, filters]);

  const visibleTransactions = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    let rows = transactions.filter((tx) => {
      if (q && !`${tx.name} ${tx.properties?.display_name} ${tx.properties?.address} ${tx.buyer} ${tx.seller} ${tx.sub_status}`.toLowerCase().includes(q)) return false;
      if (filters.status !== 'all' && tx.status !== filters.status) return false;
      return true;
    });

    rows = [...rows];
    if (filters.sort === 'price') rows.sort((a, b) => Number(b.price_high || b.price_low || 0) - Number(a.price_high || a.price_low || 0));
    else if (filters.sort === 'name') {
      rows.sort((a, b) => String(a.properties?.display_name || a.name || '').localeCompare(String(b.properties?.display_name || b.name || '')));
    } else {
      rows.sort((a, b) => String(b.as_of_date || '').localeCompare(String(a.as_of_date || '')));
    }
    return rows;
  }, [transactions, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.query.trim()) count += 1;
    if (tab === 'properties' && filters.mapped !== 'all') count += 1;
    if (tab === 'properties' && filters.photo !== 'all') count += 1;
    if (tab === 'leases' && filters.dealType !== 'all') count += 1;
    if (tab === 'leases' && filters.leaseType !== 'all') count += 1;
    if (tab === 'transactions' && filters.status !== 'all') count += 1;
    if (filters.sort !== 'newest') count += 1;
    return count;
  }, [filters, tab]);

  const visibleCount = tab === 'properties'
    ? visibleProperties.length
    : tab === 'leases'
      ? visibleLeases.length
      : visibleTransactions.length;

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_FILTERS });
  }

  function switchTab(next) {
    setTab(next);
    setFilters((current) => ({ ...DEFAULT_FILTERS, query: current.query }));
    setBulkOpen(false);
  }

  async function saveProperty(form) {
    modal?.initial ? await api.updateProperty(modal.initial.id, form) : await api.createProperty(form);
    setModal(null);
    await refresh();
  }
  async function saveLease(form) {
    modal?.initial ? await api.updateLease(modal.initial.id, form) : await api.createLease(form);
    setModal(null);
    await refresh();
  }
  async function saveTransaction(form) {
    modal?.initial ? await api.updateTransaction(modal.initial.id, form) : await api.createTransaction(form);
    setModal(null);
    await refresh();
  }

  async function remove(type, id) {
    const message = type === 'property'
      ? 'Delete this property? Linked leases and sales will also be deleted.'
      : `Delete this ${type}?`;
    if (!confirm(message)) return;
    setBusyId(`${type}-${id}`);
    try {
      if (type === 'property') await api.deleteProperty(id);
      if (type === 'lease') await api.deleteLease(id);
      if (type === 'transaction') await api.deleteTransaction(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    const typeByTab = { leases: 'lease', properties: 'property', transactions: 'transaction' };
    setModal({ type: typeByTab[tab] });
  }

  function requestPhoto(propertyId) {
    setPhotoTargetId(propertyId);
    photoInputRef.current?.click();
  }

  async function handleQuickPhoto(event) {
    const file = event.target.files?.[0];
    const propertyId = photoTargetId;
    event.target.value = '';
    if (!file || propertyId == null) return;

    setBusyId(`photo-${propertyId}`);
    setError('');
    try {
      const uploaded = await api.uploadPropertyImage(file, propertyId);
      const property = properties.find((row) => row.id === propertyId);
      if (!property) throw new Error('Property not found');
      await api.updateProperty(propertyId, {
        address: property.address,
        display_name: property.display_name,
        latitude: property.latitude,
        longitude: property.longitude,
        image_url: uploaded.image_url,
      });
      await refresh();
    } catch (err) {
      setError(err.message || 'Photo upload failed');
    } finally {
      setBusyId(null);
      setPhotoTargetId(null);
    }
  }

  const addLabel = tab === 'transactions' ? 'sale' : tab === 'properties' ? 'property' : 'lease';

  return (
    <div className="manage-page pm">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={handleQuickPhoto}
      />

      <div className="pm-shell">
        <header className="pm-hero">
          <div>
            <span className="eyebrow">Property Manager</span>
            <h1>Portfolio operations</h1>
            <p>Search, filter, edit, upload media, and bulk-import comps without leaving this workspace.</p>
          </div>
          <div className="pm-hero-actions">
            <button type="button" className="btn secondary" onClick={() => refresh().catch((err) => setError(err.message))}>
              <HiOutlineArrowPath /> Refresh
            </button>
            <button type="button" className="btn secondary" onClick={() => setBulkOpen(true)}>
              <HiOutlineClipboardDocumentList /> Bulk CSV
            </button>
            <button type="button" className="btn primary-large" onClick={openCreate}>
              <HiOutlinePlus /> Add {addLabel}
            </button>
          </div>
        </header>

        <section className="pm-stats" aria-label="Portfolio summary">
          <article><span>Properties</span><strong>{stats.properties}</strong><em>{stats.mapped} mapped · {stats.withPhoto} photos</em></article>
          <article><span>Leases</span><strong>{stats.leases}</strong><em>Market comps</em></article>
          <article><span>Sales</span><strong>{stats.transactions}</strong><em>{stats.closed} closed</em></article>
          <article><span>Needs attention</span><strong>{Math.max(stats.properties - stats.withPhoto, 0)}</strong><em>Missing photos</em></article>
        </section>

        <section className="pm-panel">
          <div className="pm-tabs" role="tablist" aria-label="Manage datasets">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? 'active' : ''}
                onClick={() => switchTab(key)}
              >
                <Icon />
                <span>{label}</span>
                <em>{key === 'properties' ? stats.properties : key === 'leases' ? stats.leases : stats.transactions}</em>
              </button>
            ))}
          </div>

          <div className="pm-controls">
            <label className="pm-search">
              <HiOutlineMagnifyingGlass />
              <input
                value={filters.query}
                onChange={(event) => setFilter('query', event.target.value)}
                placeholder={
                  tab === 'properties'
                    ? 'Search buildings or addresses…'
                    : tab === 'leases'
                      ? 'Search tenants, buildings, deal types…'
                      : 'Search sales, buyers, sellers…'
                }
              />
              {filters.query && (
                <button type="button" className="pm-icon-clear" onClick={() => setFilter('query', '')} aria-label="Clear search">
                  <HiOutlineXMark />
                </button>
              )}
            </label>

            <button
              type="button"
              className={`btn secondary pm-filter-toggle ${filtersOpen ? 'active' : ''}`}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <HiOutlineFunnel /> Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
            </button>
          </div>

          {filtersOpen && (
            <div className="pm-filters">
              {tab === 'properties' && (
                <>
                  <label>
                    <span>Map status</span>
                    <select value={filters.mapped} onChange={(event) => setFilter('mapped', event.target.value)}>
                      <option value="all">All</option>
                      <option value="mapped">Mapped</option>
                      <option value="unmapped">Not mapped</option>
                    </select>
                  </label>
                  <label>
                    <span>Photo</span>
                    <select value={filters.photo} onChange={(event) => setFilter('photo', event.target.value)}>
                      <option value="all">All</option>
                      <option value="has">Has photo</option>
                      <option value="missing">Missing photo</option>
                    </select>
                  </label>
                  <label>
                    <span>Sort</span>
                    <select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}>
                      <option value="newest">Newest</option>
                      <option value="name">Name A–Z</option>
                      <option value="missing-photo">Missing photo first</option>
                    </select>
                  </label>
                </>
              )}

              {tab === 'leases' && (
                <>
                  <label>
                    <span>Deal type</span>
                    <select value={filters.dealType} onChange={(event) => setFilter('dealType', event.target.value)}>
                      <option value="all">All deals</option>
                      {dealTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Lease type</span>
                    <select value={filters.leaseType} onChange={(event) => setFilter('leaseType', event.target.value)}>
                      <option value="all">All leases</option>
                      {leaseTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Sort</span>
                    <select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}>
                      <option value="newest">Newest signed</option>
                      <option value="rent">Highest rent</option>
                      <option value="size">Largest area</option>
                      <option value="tenant">Tenant A–Z</option>
                    </select>
                  </label>
                </>
              )}

              {tab === 'transactions' && (
                <>
                  <label>
                    <span>Status</span>
                    <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                      <option value="all">All statuses</option>
                      <option value="on_market">On market</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label>
                    <span>Sort</span>
                    <select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}>
                      <option value="newest">Newest as-of</option>
                      <option value="price">Highest price</option>
                      <option value="name">Name A–Z</option>
                    </select>
                  </label>
                </>
              )}

              <button type="button" className="pm-clear-filters" onClick={clearFilters} disabled={!activeFilterCount}>
                Clear filters
              </button>
            </div>
          )}

          <div className="pm-results-meta">
            <strong>{visibleCount}</strong>
            <span>
              {tab === 'properties' ? 'properties' : tab === 'leases' ? 'leases' : 'sales'} shown
              {activeFilterCount ? ' · filtered' : ''}
            </span>
          </div>

          {error && <div className="inline-error">{error}</div>}

          {loading ? (
            <div className="page-state"><span className="spinner" />Loading portfolio data…</div>
          ) : (
            <>
              {tab === 'properties' && (
                visibleProperties.length === 0 ? (
                  <div className="pm-empty">
                    <HiOutlineBuildingOffice2 />
                    <strong>No properties match</strong>
                    <p>Adjust filters or add a building to get started.</p>
                    <button type="button" className="btn" onClick={openCreate}><HiOutlinePlus /> Add property</button>
                  </div>
                ) : (
                  <div className="pm-property-grid">
                    {visibleProperties.map((property) => {
                      const mapped = property.latitude != null && property.longitude != null;
                      const photoBusy = busyId === `photo-${property.id}`;
                      const deleteBusy = busyId === `property-${property.id}`;
                      return (
                        <article key={property.id} className="pm-property-card">
                          <div className={`pm-property-media ${property.image_url ? '' : 'is-empty'}`}>
                            {property.image_url ? (
                              <img src={property.image_url} alt="" />
                            ) : (
                              <div className="pm-property-media-empty">
                                <HiOutlinePhoto />
                                <span>No photo yet</span>
                              </div>
                            )}
                            <button
                              type="button"
                              className="pm-media-btn"
                              onClick={() => requestPhoto(property.id)}
                              disabled={photoBusy}
                            >
                              <HiOutlinePhoto /> {photoBusy ? 'Uploading…' : property.image_url ? 'Replace photo' : 'Upload photo'}
                            </button>
                          </div>
                          <div className="pm-property-body">
                            <div className="pm-property-top">
                              <div>
                                <h3>{propertyTitle(property)}</h3>
                                <p>{property.address || '—'}</p>
                              </div>
                              <span className={`pm-pill ${mapped ? 'good' : 'warn'}`}>
                                <HiOutlineMapPin /> {mapped ? 'Mapped' : 'Needs map'}
                              </span>
                            </div>
                            <div className="pm-property-actions">
                              <button type="button" className="btn secondary" onClick={() => setModal({ type: 'property', initial: property })}>
                                <HiOutlinePencilSquare /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn secondary danger"
                                onClick={() => remove('property', property.id)}
                                disabled={deleteBusy}
                              >
                                <HiOutlineTrash /> {deleteBusy ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )
              )}

              {tab === 'leases' && (
                visibleLeases.length === 0 ? (
                  <div className="pm-empty">
                    <HiOutlineClipboardDocumentList />
                    <strong>No leases match</strong>
                    <p>Try clearing filters or add a lease comp.</p>
                  </div>
                ) : (
                  <div className="pm-table-shell">
                    <table className="pm-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Building</th>
                          <th>Area</th>
                          <th>Rent</th>
                          <th>Executed</th>
                          <th>Deal</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLeases.map((lease) => (
                          <tr key={lease.id}>
                            <td>
                              <strong>{lease.tenant || '—'}</strong>
                              {lease.lease_type && <small>{lease.lease_type}</small>}
                            </td>
                            <td>{lease.properties?.display_name || lease.properties?.address || '—'}</td>
                            <td>{sf(lease.sf)}</td>
                            <td>{psf(lease.yr1_rent_psf)}</td>
                            <td>{date(lease.signed_date)}</td>
                            <td><span className="pm-chip">{lease.deal_type || '—'}</span></td>
                            <td className="pm-row-actions">
                              <button type="button" onClick={() => setModal({ type: 'lease', initial: lease })}><HiOutlinePencilSquare /> Edit</button>
                              <button type="button" className="danger" onClick={() => remove('lease', lease.id)}><HiOutlineTrash /> Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {tab === 'transactions' && (
                <>
                  {!loading && <SalesInsights transactions={transactions} />}
                  {visibleTransactions.length === 0 ? (
                  <div className="pm-empty">
                    <HiOutlineChartBar />
                    <strong>No sales match</strong>
                    <p>Try clearing filters or add a sale transaction.</p>
                  </div>
                ) : (
                  <div className="pm-table-shell">
                    <table className="pm-table">
                      <thead>
                        <tr>
                          <th>Property</th>
                          <th>Status</th>
                          <th>Size</th>
                          <th>Price</th>
                          <th>Buyer</th>
                          <th>As of</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>
                              <strong>{tx.properties?.display_name || tx.properties?.address || tx.name || '—'}</strong>
                              {tx.name && <small>{tx.name}</small>}
                            </td>
                            <td>
                              <span className={`pm-chip ${tx.status === 'closed' ? 'closed' : 'open'}`}>
                                {tx.status === 'closed' ? 'Closed' : 'On market'}
                                {tx.sub_status ? ` · ${tx.sub_status}` : ''}
                              </span>
                            </td>
                            <td>{sf(tx.sf)}</td>
                            <td>{tx.price_low != null || tx.price_high != null ? `${money(tx.price_low)} – ${money(tx.price_high)}` : '—'}</td>
                            <td>{tx.buyer || '—'}</td>
                            <td>{date(tx.as_of_date)}</td>
                            <td className="pm-row-actions">
                              <button type="button" onClick={() => setModal({ type: 'transaction', initial: tx })}><HiOutlinePencilSquare /> Edit</button>
                              <button type="button" className="danger" onClick={() => remove('transaction', tx.id)}><HiOutlineTrash /> Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {modal?.type === 'property' && (
        <Modal wide title={modal.initial ? 'Edit property' : 'Add property'} onClose={() => setModal(null)}>
          <PropertyForm initial={modal.initial} onSubmit={saveProperty} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'lease' && (
        <Modal title={modal.initial ? 'Edit lease' : 'Add lease'} onClose={() => setModal(null)}>
          {properties.length
            ? <LeaseForm initial={modal.initial} properties={properties} onSubmit={saveLease} onCancel={() => setModal(null)} />
            : <p className="muted-cell">Add a property first.</p>}
        </Modal>
      )}
      {modal?.type === 'transaction' && (
        <Modal title={modal.initial ? 'Edit sale transaction' : 'Add sale transaction'} onClose={() => setModal(null)}>
          {properties.length
            ? <TransactionForm initial={modal.initial} properties={properties} onSubmit={saveTransaction} onCancel={() => setModal(null)} />
            : <p className="muted-cell">Add a property first.</p>}
        </Modal>
      )}

      {bulkOpen && (
        <Modal
          wide
          title={`Bulk CSV · ${tab === 'transactions' ? 'Sales' : tab[0].toUpperCase() + tab.slice(1)}`}
          onClose={() => setBulkOpen(false)}
        >
          <BulkCsvImport
            type={tab}
            properties={properties}
            onClose={() => setBulkOpen(false)}
            onImported={refresh}
          />
        </Modal>
      )}
    </div>
  );
}
