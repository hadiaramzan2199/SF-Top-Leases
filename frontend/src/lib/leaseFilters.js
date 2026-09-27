export const DEFAULT_LEASE_FILTERS = {
  query: '',
  dealType: 'all',
  leaseType: 'all',
  minSf: 'all',
  sort: 'newest',
};

export function filterLeases(leases = [], filters = DEFAULT_LEASE_FILTERS) {
  const query = String(filters.query || '').trim().toLowerCase();
  const dealType = filters.dealType || 'all';
  const leaseType = filters.leaseType || 'all';
  const minSf = filters.minSf || 'all';

  return leases.filter((lease) => {
    if (dealType !== 'all' && lease.deal_type !== dealType) return false;
    if (leaseType !== 'all' && lease.lease_type !== leaseType) return false;
    if (minSf === '50k' && !(Number(lease.sf) >= 50000)) return false;
    if (minSf === '100k' && !(Number(lease.sf) >= 100000)) return false;
    if (minSf === '200k' && !(Number(lease.sf) >= 200000)) return false;
    if (!query) return true;
    const haystack = `${lease.tenant} ${lease.properties?.display_name} ${lease.properties?.address} ${lease.deal_type} ${lease.lease_type}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function sortLeases(leases = [], sort = 'newest') {
  return [...leases].sort((a, b) => {
    if (sort === 'largest') return (Number(b.sf) || 0) - (Number(a.sf) || 0);
    if (sort === 'rent') return (Number(b.yr1_rent_psf) || 0) - (Number(a.yr1_rent_psf) || 0);
    if (sort === 'lowest-rent') return (Number(a.yr1_rent_psf) || 0) - (Number(b.yr1_rent_psf) || 0);
    return String(b.signed_date || '').localeCompare(String(a.signed_date || ''));
  });
}

export function activeFilterCount(filters = DEFAULT_LEASE_FILTERS) {
  return [
    filters.dealType !== 'all',
    filters.leaseType !== 'all',
    filters.minSf !== 'all',
    String(filters.query || '').trim(),
  ].filter(Boolean).length;
}
