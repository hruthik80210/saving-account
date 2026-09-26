import { useState } from 'react';
import { Calculator, LogIn, UserPlus } from 'lucide-react';
import { api } from '../services/api';

export const AuthPage = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center"><Calculator className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-bold text-white">AgyBank DCB</h1><p className="text-xs text-slate-400">Daily closing balance banking</p></div>
        </div>
        <div className="flex gap-2 p-1 rounded-xl bg-slate-900 mb-6">
          {['login', 'register'].map((item) => <button key={item} type="button" onClick={() => { setMode(item); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize ${mode === item ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{item}</button>)}
        </div>
        <h2 className="text-2xl font-bold mb-1">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="text-sm text-slate-400 mb-6">{mode === 'login' ? 'Sign in with your email and password.' : 'New accounts are created as customer accounts.'}</p>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full name" className="w-full input-field" />}
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" className="w-full input-field" />
          <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (8+ characters)" className="w-full input-field" />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold">
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}{loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>
      </section>
    </main>
  );
};