export const BULK_SCHEMAS = {
  properties: {
    label: 'Properties',
    filename: 'properties-template.csv',
    columns: [
      { key: 'address', required: true, type: 'string', sample: '300 Howard St, San Francisco, CA' },
      { key: 'display_name', required: false, type: 'string', sample: '300 Howard' },
      { key: 'latitude', required: false, type: 'number', sample: '37.7892' },
      { key: 'longitude', required: false, type: 'number', sample: '-122.396' },
      { key: 'image_url', required: false, type: 'string', sample: '' },
    ],
  },
  leases: {
    label: 'Leases',
    filename: 'leases-template.csv',
    columns: [
      { key: 'property_address', required: true, type: 'string', sample: '300 Howard St, San Francisco, CA' },
      { key: 'tenant', required: true, type: 'string', sample: 'Acme Corp' },
      { key: 'signed_date', required: false, type: 'date', sample: '2026-03-15' },
      { key: 'sf', required: false, type: 'integer', sample: '45000' },
      { key: 'floors', required: false, type: 'string', sample: '12-14' },
      { key: 'term_months', required: false, type: 'integer', sample: '120' },
      { key: 'lease_type', required: false, type: 'enum', options: ['Direct', 'Sublease', 'Undisclosed'], sample: 'Direct' },
      { key: 'yr1_rent_psf', required: false, type: 'number', sample: '78.50' },
      { key: 'escalation_pct', required: false, type: 'number', sample: '3' },
      { key: 'free_rent_months', required: false, type: 'integer', sample: '6' },
      { key: 'ti_psf', required: false, type: 'number', sample: '85' },
      { key: 'deal_type', required: false, type: 'enum', options: ['New Lease', 'Renewal', 'Relocation', 'Expansion', 'Extension', 'New to Market'], sample: 'New Lease' },
      { key: 'rank_ytd', required: false, type: 'integer', sample: '1' },
      { key: 'name', required: false, type: 'string', sample: '' },
      { key: 'notes', required: false, type: 'string', sample: '' },
    ],
  },
  transactions: {
    label: 'Sales',
    filename: 'transactions-template.csv',
    columns: [
      { key: 'property_address', required: true, type: 'string', sample: '300 Howard St, San Francisco, CA' },
      { key: 'name', required: false, type: 'string', sample: '300 Howard sale' },
      { key: 'status', required: true, type: 'enum', options: ['on_market', 'closed'], sample: 'on_market' },
      { key: 'sub_status', required: false, type: 'string', sample: 'Marketing' },
      { key: 'as_of_date', required: false, type: 'date', sample: '2026-04-01' },
      { key: 'sf', required: false, type: 'integer', sample: '250000' },
      { key: 'pct_leased', required: false, type: 'number', sample: '82.5' },
      { key: 'cap_low', required: false, type: 'number', sample: '5.2' },
      { key: 'cap_high', required: false, type: 'number', sample: '5.8' },
      { key: 'psf_low', required: false, type: 'integer', sample: '650' },
      { key: 'psf_high', required: false, type: 'integer', sample: '720' },
      { key: 'price_low', required: false, type: 'integer', sample: '150000000' },
      { key: 'price_high', required: false, type: 'integer', sample: '175000000' },
      { key: 'buyer', required: false, type: 'string', sample: '' },
      { key: 'seller', required: false, type: 'string', sample: '' },
      { key: 'notes', required: false, type: 'string', sample: '' },
    ],
  },
};

export function escapeCsvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildTemplateCsv(type) {
  const schema = BULK_SCHEMAS[type];
  if (!schema) throw new Error(`Unknown bulk type: ${type}`);
  const header = schema.columns.map((col) => col.key).join(',');
  const sample = schema.columns.map((col) => escapeCsvCell(col.sample ?? '')).join(',');
  return `${header}\n${sample}\n`;
}

export function downloadTemplateCsv(type) {
  const schema = BULK_SCHEMAS[type];
  const csv = buildTemplateCsv(type);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = schema.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => String(value || '').trim() !== ''));
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function parseValue(raw, column) {
  const value = String(raw ?? '').trim();
  if (value === '') return { value: null, error: column.required ? `${column.key} is required` : null };

  if (column.type === 'integer') {
    const number = Number(value);
    if (!Number.isInteger(number)) return { value: null, error: `${column.key} must be an integer` };
    return { value: number, error: null };
  }

  if (column.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) return { value: null, error: `${column.key} must be a number` };
    return { value: number, error: null };
  }

  if (column.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { value: null, error: `${column.key} must be YYYY-MM-DD` };
    }
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return { value: null, error: `${column.key} is not a valid date` };
    return { value, error: null };
  }

  if (column.type === 'enum') {
    const match = column.options.find((option) => option.toLowerCase() === value.toLowerCase());
    if (!match) return { value: null, error: `${column.key} must be one of: ${column.options.join(', ')}` };
    return { value: match, error: null };
  }

  return { value, error: null };
}

function findPropertyId(properties, address) {
  const needle = String(address || '').trim().toLowerCase();
  if (!needle) return null;
  const match = properties.find((property) => {
    const candidates = [property.address, property.display_name]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    return candidates.includes(needle);
  });
  return match?.id ?? null;
}

export function validateBulkCsv(type, csvText, { properties = [] } = {}) {
  const schema = BULK_SCHEMAS[type];
  if (!schema) {
    return { ok: false, headerError: `Unknown import type: ${type}`, rows: [] };
  }

  const matrix = parseCsv(csvText);
  if (!matrix.length) {
    return { ok: false, headerError: 'CSV is empty', rows: [] };
  }

  const headers = matrix[0].map(normalizeHeader);
  const expected = schema.columns.map((col) => col.key);
  const missing = expected.filter((key) => !headers.includes(key));
  const unexpected = headers.filter((key) => key && !expected.includes(key));

  if (missing.length || unexpected.length) {
    const parts = [];
    if (missing.length) parts.push(`Missing columns: ${missing.join(', ')}`);
    if (unexpected.length) parts.push(`Unknown columns: ${unexpected.join(', ')}`);
    return {
      ok: false,
      headerError: `${parts.join('. ')}. Download the template and use exact column names.`,
      rows: [],
    };
  }

  const indexByKey = Object.fromEntries(expected.map((key) => [key, headers.indexOf(key)]));
  const rows = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i];
    const record = { __row: i + 1, __errors: [], __values: {} };

    for (const column of schema.columns) {
      const cell = raw[indexByKey[column.key]] ?? '';
      const parsed = parseValue(cell, column);
      record.__values[column.key] = parsed.value;
      if (parsed.error) record.__errors.push(parsed.error);
    }

    if (type === 'leases' || type === 'transactions') {
      const propertyAddress = record.__values.property_address;
      const propertyId = findPropertyId(properties, propertyAddress);
      if (!propertyId) {
        record.__errors.push(`No property matches address "${propertyAddress || ''}"`);
      } else {
        record.__values.property_id = propertyId;
      }
    }

    if (type === 'properties') {
      // Photos are optional for bulk import.
      record.__values.image_url = record.__values.image_url || '';
    }

    rows.push(record);
  }

  const ok = rows.length > 0 && rows.every((row) => row.__errors.length === 0);
  return { ok, headerError: '', rows };
}

export function rowsToPayload(type, rows) {
  return rows.map((row) => {
    const values = { ...row.__values };
    if (type === 'leases' || type === 'transactions') {
      delete values.property_address;
    }
    if (type === 'properties' && !values.image_url) {
      values.image_url = null;
    }
    return values;
  });
}
