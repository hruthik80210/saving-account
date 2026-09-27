import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2, UserRound, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

export const CustomerManagementPage = ({ currentUser }) => {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    try { setCustomers(await api.getCustomers()); } catch (error) { addToast('error', 'Customers unavailable', error.message); }
  };

  useEffect(() => { loadCustomers(); }, []);

  const createCustomer = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.createCustomer(form);
      setForm({ full_name: '', email: '', password: '' });
      addToast('success', 'Customer created', 'The customer can now sign in and use their empty savings account.');
      await loadCustomers();
    } catch (error) { addToast('error', 'Customer creation failed', error.message); }
    finally { setLoading(false); }
  };

  const createAccount = async (customer) => {
    try { await api.createCustomerAccount(customer.id); addToast('success', 'Account opened', `A new empty savings account was opened for ${customer.full_name}.`); }
    catch (error) { addToast('error', 'Account creation failed', error.message); }
  };

  const removeCustomer = async (customer) => {
    if (customer.id === currentUser.id || !window.confirm(`Delete ${customer.full_name} and all linked banking data?`)) return;
    try { await api.deleteCustomer(customer.id); addToast('success', 'Customer deleted', 'The customer, accounts, and transactions were removed.'); await loadCustomers(); }
    catch (error) { addToast('error', 'Deletion failed', error.message); }
  };

  const editCustomer = async (customer) => {
    const fullName = window.prompt('Customer full name', customer.full_name);
    if (!fullName || fullName.trim() === customer.full_name) return;
    try { await api.updateCustomer(customer.id, { full_name: fullName.trim() }); addToast('success', 'Customer updated', 'Customer details were saved.'); await loadCustomers(); }
    catch (error) { addToast('error', 'Update failed', error.message); }
  };

  return <div className="space-y-8">
    <div><h1 className="text-2xl font-bold text-white">Customer Administration</h1><p className="text-sm text-slate-400 mt-1">Create customers, open ledgers, and manage customer access.</p></div>
    <form onSubmit={createCustomer} className="glass-panel rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
      <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" />
      <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
      <input required minLength={8} type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" />
      <button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"><Plus className="w-4 h-4" />Create customer</button>
    </form>
    <div className="space-y-3">{customers.map((customer) => <div key={customer.id} className="glass-panel rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-sky-500/10 text-sky-400"><UserRound className="w-5 h-5" /></div><div><p className="font-semibold text-white">{customer.full_name}</p><p className="text-xs text-slate-400">{customer.email} · {customer.role}</p></div></div>
      <div className="flex gap-2"><button onClick={() => editCustomer(customer)} className="p-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800" title="Edit customer"><Edit2 className="w-4 h-4" /></button><button onClick={() => createAccount(customer)} className="flex items-center gap-2 rounded-xl border border-sky-500/30 px-3 py-2 text-xs text-sky-300 hover:bg-sky-500/10"><Wallet className="w-4 h-4" />Open empty account</button><button onClick={() => removeCustomer(customer)} className="p-2 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10" title="Delete customer"><Trash2 className="w-4 h-4" /></button></div>
    </div>)}</div>
  </div>;
};