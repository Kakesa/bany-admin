import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { adminLogin } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { token, setToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@banytalks.com');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await adminLogin(email, password);
      setToken(res.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <section className="bg-stone-950 min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/15 flex items-center justify-center">
            <Shield className="w-6 h-6 text-rose-500" />
          </div>
          <p className="section-label">Back-office</p>
          <h1 className="font-display text-3xl text-stone-100">Bany Admin</h1>
          <p className="text-sm text-stone-500 font-body">
            Connexion réservée aux administrateurs autorisés.
          </p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email admin"
            className="w-full bg-transparent border-b border-white/10 py-3 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50"
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full bg-transparent border-b border-white/10 py-3 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50"
            required
            autoComplete="current-password"
          />
          {loginError && <p className="text-xs text-red-400">{loginError}</p>}
          <button type="submit" disabled={loggingIn} className="btn-primary text-xs w-full justify-center">
            {loggingIn ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </section>
  );
}
