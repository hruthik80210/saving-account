import { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDate, formatPercent } from '../utils/formatters';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const InterestSlabsPage = () => {
  const { addToast } = useToast();
  const [slabs, setSlabs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState(null);
  const [formData, setFormData] = useState({
    min_balance: '0.00',
    max_balance: '',
    annual_rate: '3.50',
    tier_type: 'TIERED',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    status: 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchSlabs = async () => {
    try {
      setLoading(true);
      const data = await api.getInterestSlabs();
      setSlabs(data);
    } catch (err) {
      addToast('error', 'Failed to load interest slabs', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlabs();
  }, []);

  const handleOpenAdd = () => {
    setEditingSlab(null);
    setFormData({
      min_balance: '0.00',
      max_balance: '',
      annual_rate: '3.50',
      tier_type: 'TIERED',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (slab) => {
    setEditingSlab(slab);
    setFormData({
      min_balance: slab.min_balance.toString(),
      max_balance: slab.max_balance !== null ? slab.max_balance.toString() : '',
      annual_rate: slab.annual_rate.toString(),
      tier_type: slab.tier_type,
      effective_from: slab.effective_from,
      effective_to: slab.effective_to || '',
      status: slab.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const minBal = parseFloat(formData.min_balance);
    const maxBal = formData.max_balance ? parseFloat(formData.max_balance) : null;
    const rate = parseFloat(formData.annual_rate);

    if (isNaN(minBal) || isNaN(rate)) {
      addToast('error', 'Validation Error', 'Minimum balance and annual rate must be valid numbers.');
      return;
    }
    if (maxBal !== null && maxBal <= minBal) {
      addToast('error', 'Validation Error', 'Maximum balance must be greater than minimum balance.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        min_balance: minBal,
        max_balance: maxBal,
        annual_rate: rate,
        tier_type: formData.tier_type,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || null,
        status: formData.status,
      };

      if (editingSlab) {
        await api.updateInterestSlab(editingSlab.id, payload);
        addToast('success', 'Slab updated', 'Interest slab updated successfully.');
      } else {
        await api.createInterestSlab(payload);
        addToast('success', 'Slab created', 'New interest slab added successfully.');
      }

      setIsModalOpen(false);
      fetchSlabs();
    } catch (err) {
      addToast('error', 'Operation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (slab) => {
    if (!window.confirm('Are you sure you want to delete this interest slab?')) return;
    try {
      await api.deleteInterestSlab(slab.id);
      addToast('success', 'Slab deleted', 'Interest slab deleted successfully.');
      fetchSlabs();
    } catch (err) {
      addToast('error', 'Delete Failed', err.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Interest Rate Slabs</h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic tiered rate configuration with historical date effective windows
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Interest Slab</span>
        </button>
      </div>

      {/* Explanatory Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl flex items-start space-x-4">
        <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex-shrink-0">
          <Layers className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 text-xs text-slate-300">
          <h3 className="text-sm font-bold text-white">Tiered (Marginal) vs Flat Slab Mechanics</h3>
          <p className="leading-relaxed text-slate-400">
            <strong>Tiered Bracket:</strong> For a closing balance of ₹2,50,000, the first ₹1,00,000 earns 3.00% and the remaining ₹1,50,000 earns 3.50%.
          </p>
          <p className="leading-relaxed text-slate-400">
            <strong>Date-Effective Rates:</strong> Historical interest calculations reference the slabs that were active on each respective calendar date, guaranteeing that historical calculations remain perfectly reproducible even after new rates are announced.
          </p>
        </div>
      </div>

      {/* Slabs Table */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Configured Interest Slabs</h3>
          <span className="text-xs text-slate-400 font-mono">{slabs.length} Total Slabs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 uppercase font-semibold text-slate-400 text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Balance Range</th>
                <th className="py-3.5 px-4 text-right">Annual Rate %</th>
                <th className="py-3.5 px-4">Tier Type</th>
                <th className="py-3.5 px-4">Effective From</th>
                <th className="py-3.5 px-4">Effective To</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {slabs.map((slab) => (
                <tr key={slab.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white font-sans">
                    {formatCurrency(slab.min_balance, 'INR')} –{' '}
                    {slab.max_balance !== null ? formatCurrency(slab.max_balance, 'INR') : 'Above (No Limit)'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400 text-sm">
                    {formatPercent(slab.annual_rate)}
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold">
                      {slab.tier_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-400">
                    {formatDate(slab.effective_from)}
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-400">
                    {slab.effective_to ? formatDate(slab.effective_to) : 'Present / Indefinite'}
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        slab.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{slab.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleOpenEdit(slab)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                        title="Edit Slab"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(slab)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete Slab"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlab ? 'Edit Interest Slab' : 'Create New Interest Slab'}
        subtitle="Specify balance thresholds, annual interest rate percentage, and effective dates"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Minimum Balance (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.min_balance}
                onChange={(e) => setFormData({ ...formData, min_balance: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Maximum Balance (₹) (Leave blank for Above)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 500000.00"
                value={formData.max_balance}
                onChange={(e) => setFormData({ ...formData, max_balance: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Annual Interest Rate (% p.a.)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="3.50"
                value={formData.annual_rate}
                onChange={(e) => setFormData({ ...formData, annual_rate: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tier Calculation Type
              </label>
              <select
                value={formData.tier_type}
                onChange={(e) => setFormData({ ...formData, tier_type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="TIERED">TIERED (Marginal bracket)</option>
                <option value="FLAT">FLAT (Whole-balance rate)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Effective From Date
              </label>
              <input
                type="date"
                required
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Effective To Date (Optional)
              </label>
              <input
                type="date"
                value={formData.effective_to}
                onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingSlab ? 'Update Slab' : 'Create Slab'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
