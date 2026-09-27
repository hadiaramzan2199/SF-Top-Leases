import { useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import {
  BULK_SCHEMAS,
  downloadTemplateCsv,
  rowsToPayload,
  validateBulkCsv,
} from '../lib/csvBulk.js';

export default function BulkCsvImport({
  type,
  properties = [],
  onClose,
  onImported,
}) {
  const fileRef = useRef(null);
  const schema = BULK_SCHEMAS[type];
  const [headerError, setHeaderError] = useState('');
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [uploadingRow, setUploadingRow] = useState(null);
  const [importError, setImportError] = useState('');
  const [fileName, setFileName] = useState('');

  const previewColumns = useMemo(() => {
    const cols = schema.columns.map((col) => col.key);
    if (type === 'properties') return [...cols.filter((key) => key !== 'image_url'), 'photo'];
    return cols;
  }, [schema, type]);

  const errorCount = rows.reduce((sum, row) => sum + row.__errors.length, 0);
  const canImport = rows.length > 0 && !headerError && errorCount === 0 && !importing;

  function resetFileInput() {
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');
    setHeaderError('');
    setFileName(file.name);

    try {
      const text = await file.text();
      const result = validateBulkCsv(type, text, { properties });
      setHeaderError(result.headerError || '');
      setRows(result.rows || []);
    } catch (error) {
      setHeaderError(error.message || 'Could not read CSV');
      setRows([]);
    } finally {
      resetFileInput();
    }
  }

  async function uploadRowPhoto(rowIndex, file) {
    if (!file) return;
    setUploadingRow(rowIndex);
    setImportError('');
    try {
      const uploaded = await api.uploadPropertyImage(file, `bulk-${rowIndex + 1}`);
      setRows((current) => current.map((row, index) => (
        index === rowIndex
          ? {
            ...row,
            __values: { ...row.__values, image_url: uploaded.image_url },
          }
          : row
      )));
    } catch (error) {
      setImportError(error.message || 'Photo upload failed');
    } finally {
      setUploadingRow(null);
    }
  }

  async function confirmImport() {
    if (!canImport) return;
    setImporting(true);
    setImportError('');
    try {
      const payload = rowsToPayload(type, rows);
      if (type === 'properties') await api.bulkCreateProperties(payload);
      if (type === 'leases') await api.bulkCreateLeases(payload);
      if (type === 'transactions') await api.bulkCreateTransactions(payload);
      await onImported?.();
      onClose?.();
    } catch (error) {
      setImportError(error.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function cellDisplay(row, key, rowIndex) {
    if (key === 'photo') {
      const imageUrl = row.__values.image_url;
      return (
        <div className="bulk-photo-cell">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt="" />
              <span>Ready</span>
            </>
          ) : (
            <label className="bulk-photo-upload">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploadingRow === rowIndex}
                onChange={(event) => uploadRowPhoto(rowIndex, event.target.files?.[0])}
              />
              <span>{uploadingRow === rowIndex ? 'Uploading…' : 'Add photo'}</span>
            </label>
          )}
        </div>
      );
    }

    const value = row.__values[key];
    return value == null || value === '' ? '—' : String(value);
  }

  return (
    <div className="bulk-import">
      <div className="bulk-import-toolbar">
        <div>
          <strong>Bulk upload {schema.label.toLowerCase()}</strong>
          <p>Download the template, fill exact column names, then preview before importing.</p>
        </div>
        <div className="bulk-import-actions">
          <button type="button" className="btn secondary" onClick={() => downloadTemplateCsv(type)}>
            Download template CSV
          </button>
          <label className="btn">
            Choose CSV
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} hidden />
          </label>
        </div>
      </div>

      {fileName && <div className="bulk-file-name">Selected: {fileName}</div>}
      {headerError && <div className="inline-error">{headerError}</div>}
      {importError && <div className="inline-error">{importError}</div>}

      {!headerError && rows.length > 0 && (
        <>
          <div className={`bulk-status ${errorCount ? 'has-errors' : 'is-ready'}`}>
            {errorCount
              ? `${errorCount} validation error${errorCount === 1 ? '' : 's'} across ${rows.length} row${rows.length === 1 ? '' : 's'}. Fix the CSV and re-upload.`
              : `${rows.length} row${rows.length === 1 ? '' : 's'} ready to import.${type === 'properties' ? ' Photos are optional — add them per row below if needed.' : ''}`}
          </div>

          <div className="bulk-table-shell">
            <table className="bulk-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  {previewColumns.map((key) => <th key={key}>{key}</th>)}
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={row.__row} className={row.__errors.length ? 'is-invalid' : ''}>
                    <td>{row.__row}</td>
                    {previewColumns.map((key) => (
                      <td key={key}>{cellDisplay(row, key, rowIndex)}</td>
                    ))}
                    <td className="bulk-error-cell">
                      {row.__errors.length ? row.__errors.join(' · ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn" onClick={confirmImport} disabled={!canImport}>
          {importing ? 'Importing…' : `Import ${rows.length || ''} ${schema.label.toLowerCase()}`.trim()}
        </button>
      </div>
    </div>
  );
}
