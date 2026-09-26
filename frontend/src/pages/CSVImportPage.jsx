import { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

export const CSVImportPage = ({ account, onImportSuccess }) => {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.csv')) {
        addToast('error', 'Invalid file type', 'Please select a valid .csv file.');
        return;
      }
      setSelectedFile(file);
      setValidationResult(null);
    }
  };

  const handleValidate = async () => {
    if (!selectedFile) return;
    try {
      setValidating(true);
      const res = await api.validateCsv(account.id, selectedFile);
      setValidationResult(res);
      if (res.invalid_rows_count > 0) {
        addToast(
          'warning',
          'Validation completed with issues',
          `${res.valid_rows_count} valid rows, ${res.invalid_rows_count} invalid rows.`
        );
      } else {
        addToast('success', 'Validation passed', `All ${res.valid_rows_count} rows are valid and ready to import.`);
      }
    } catch (err) {
      addToast('error', 'Validation Failed', err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.valid_rows_count === 0) return;
    const validRows = validationResult.rows.filter((r) => r.is_valid);
    try {
      setImporting(true);
      const res = await api.confirmCsvImport(account.id, validRows);
      addToast('success', 'Import Successful', res.message);
      setSelectedFile(null);
      setValidationResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImportSuccess();
    } catch (err) {
      addToast('error', 'Import Failed', err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'transaction_date,value_date,type,amount,description,reference\n' +
      '2026-07-01,2026-07-01,OPENING_BALANCE,50000.00,Initial Opening Balance,OPN-01\n' +
      '2026-07-05,2026-07-05,DEPOSIT,10000.00,Cash Deposit Branch,DEP-02\n' +
      '2026-07-12,2026-07-12,WITHDRAWAL,5000.00,ATM Cash Withdrawal,WDL-03\n' +
      '2026-07-20,2026-07-18,DEPOSIT,20000.00,Backdated NEFT Inward,DEP-04\n';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_savings_transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CSV Batch Transaction Import</h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload CSV files containing transaction dates, value dates, types, and amounts with automated simulation
          </p>
        </div>

        <button
          onClick={handleDownloadSampleCsv}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-colors"
        >
          <Download className="w-4 h-4 text-sky-400" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl flex flex-col items-center justify-center text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-file-input"
        />

        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
          <FileSpreadsheet className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold text-white">
          {selectedFile ? selectedFile.name : 'Select or drop your transactions CSV'}
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          Expected headers: <code className="font-mono text-sky-300">transaction_date, value_date, type, amount, description, reference</code>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label
            htmlFor="csv-file-input"
            className="cursor-pointer flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4 text-sky-400" />
            <span>{selectedFile ? 'Change File' : 'Browse CSV File'}</span>
          </label>

          {selectedFile && (
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${validating ? 'animate-spin' : ''}`} />
              <span>{validating ? 'Validating CSV...' : 'Validate CSV'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Validation Results Preview */}
      {validationResult && (
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl overflow-hidden space-y-6 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>CSV Verification Summary</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {validationResult.total_rows} Total Rows
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Preview valid entries and inspect validation errors before final account booking
              </p>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={importing || validationResult.valid_rows_count === 0}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-glow-emerald transition-all active:scale-95 disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>
                {importing
                  ? 'Importing...'
                  : `Confirm & Import ${validationResult.valid_rows_count} Valid Rows`}
              </span>
            </button>
          </div>

          {/* Validation Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-mono">{validationResult.valid_rows_count}</div>
                <div className="text-xs text-emerald-400 font-medium">Valid Rows Ready to Import</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-mono">{validationResult.invalid_rows_count}</div>
                <div className="text-xs text-rose-400 font-medium">Invalid Rows (Will Be Skipped)</div>
              </div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 bg-slate-950 uppercase font-semibold text-slate-400 text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Row</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4">Transaction Date</th>
                  <th className="py-3 px-4">Value Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Errors / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {validationResult.rows.map((row) => (
                  <tr
                    key={row.row_number}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      row.is_valid ? '' : 'bg-rose-950/15'
                    }`}
                  >
                    <td className="py-3 px-3 text-slate-500">{row.row_number}</td>
                    <td className="py-3 px-3">
                      {row.is_valid ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 font-sans">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Valid</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-semibold border border-rose-500/20 font-sans">
                          <XCircle className="w-3 h-3" />
                          <span>Error</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-white font-sans">{row.transaction_date}</td>
                    <td className="py-3 px-4 text-sky-400 font-sans font-semibold">{row.value_date}</td>
                    <td className="py-3 px-4 text-slate-300 font-sans">{row.type}</td>
                    <td className="py-3 px-4 text-right font-bold text-white">{row.amount}</td>
                    <td className="py-3 px-4 text-slate-400 font-sans truncate max-w-xs">{row.description || '-'}</td>
                    <td className="py-3 px-4 text-rose-400 font-sans text-[11px]">
                      {row.errors.length > 0 ? row.errors.join(' • ') : 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
