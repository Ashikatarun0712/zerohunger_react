import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';

export default function Login() {
  const { updateApp } = useAppContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin');
  const [error, setError] = useState('');
  
  // Admin Popup State
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminErr, setAdminErr] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const un = e.target.username.value.trim().toLowerCase();
    const pw = e.target.password.value.trim();
    
    if (un === 'admin' && pw === 'assara') {
      updateApp({ user: 'admin', role: 'admin', name: 'System Administrator', prevPage: 'admin', emoji: '⚙️' });
      navigate('/admin');
      return;
    }

    try {
      const { data, error: dbError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('username', un)
        .eq('password', pw)
        .single();
        
      if (dbError || !data) {
        setError('Invalid credentials');
      } else {
        updateApp({ user: data.username, role: data.role, name: data.name, prevPage: 'profile', emoji: data.emoji || '👤' });
        navigate('/profile');
      }
    } catch {
      setError('Connection error');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const un = e.target.username.value.trim().toLowerCase();
    const pw = e.target.password.value;
    const name = e.target.name.value.trim();
    const email = e.target.email.value.trim();
    const role = e.target.role.value;
    const emoji = role === 'admin' ? '⚙️' : '👤';

    try {
      // Check if exists
      const { data: existing } = await supabaseClient.from('users').select('id').eq('username', un).single();
      if (existing) {
        setError('Username already taken');
        return;
      }

      // Insert
      const { data: _data, error: insertError } = await supabaseClient
        .from('users')
        .insert([{ username: un, password: pw, name, email, role, emoji }])
        .select()
        .single();

      if (insertError) {
        setError('Error creating account: ' + insertError.message);
      } else {
        updateApp({ user: un, role: role, name: name, prevPage: 'profile', emoji });
        navigate('/profile');
      }
    } catch (err) {
      setError('Exception: ' + err.message);
    }
  };

  return (
    <div className="page active" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {showAdminPopup && (
        <div className="modal-bg" style={{ zIndex: 9999, backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-box" style={{ maxWidth: '350px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <div className="modal-head" style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <div className="modal-title" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>⚙️</span> Admin Access
              </div>
              <button className="x-btn" onClick={() => setShowAdminPopup(false)}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ color: 'var(--txt1)', fontSize: '0.85rem', marginBottom: '16px', marginTop: '0' }}>Enter master password to access system controls.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (adminPwd === 'assara' || adminPwd === 'admin123') {
                  updateApp({ user: 'admin_sys', role: 'admin', name: 'System Admin', emoji: '⚙️', prevPage: 'admin' });
                  navigate('/admin');
                } else {
                  setAdminErr('Incorrect password');
                }
              }}>
                <input 
                  type="password" 
                  autoFocus
                  placeholder="Master password..." 
                  value={adminPwd}
                  onChange={e => { setAdminPwd(e.target.value); setAdminErr(''); }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid var(--border)', fontSize: '1rem', marginBottom: '10px', background: 'rgba(255,255,255,0.9)' }}
                />
                {adminErr && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '10px', fontWeight: 'bold' }}>{adminErr}</div>}
                <button type="submit" className="btn btn-primary btn-full" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: 'none', color: 'white', padding: '10px' }}>Authenticate</button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="login-card" style={{ maxWidth: '460px', width: '100%' }}>
        <div className="login-logo" style={{ position: 'relative' }}>
          <div className="licon">🌱</div>
          <div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.4rem', color: 'var(--g1)' }}>Zero Hunger P2P</h1>
            <span style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>AI-Enhanced Community Food Network</span>
          </div>
          <button 
            title="Admin Login"
            style={{ 
              position: 'absolute', right: 0, top: 0, 
              background: 'transparent', border: 'none', 
              fontSize: '1.2rem', cursor: 'pointer', opacity: 0.6,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
            onClick={() => setShowAdminPopup(true)}
          >
            ⚙️
          </button>
        </div>
        
        <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px', marginBottom: '22px' }}>
          <button 
            onClick={() => setTab('signin')} 
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s', ...(tab === 'signin' ? { background: 'linear-gradient(135deg,var(--g2),var(--t1))', color: '#fff' } : { background: 'transparent', color: 'var(--txt2)' }) }}>
            🔐 Sign In
          </button>
          <button 
            onClick={() => setTab('signup')} 
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s', ...(tab === 'signup' ? { background: 'linear-gradient(135deg,var(--g2),var(--t1))', color: '#fff' } : { background: 'transparent', color: 'var(--txt2)' }) }}>
            ✏️ Sign Up
          </button>
        </div>
        
        {tab === 'signin' ? (
          <div>
            <form onSubmit={handleLogin}>
              <div className="fg"><label>Email / Username</label><input name="username" type="text" placeholder="Enter email or username" /></div>
              <div className="fg"><label>Password</label><input name="password" type="password" placeholder="Enter password" /></div>
              <div style={{ color: 'var(--r1)', fontSize: '.8rem', marginBottom: '12px', minHeight: '18px' }}>{error}</div>
              <button type="submit" className="btn btn-primary btn-full">🔐 Sign In</button>
            </form>
          </div>
        ) : (
          <div>
            <form onSubmit={handleSignup}>
              <div className="fg"><label>Full Name / Trust Name *</label><input name="name" type="text" placeholder="Your full name or Trust name" required /></div>
              <div className="fg"><label>Email *</label><input name="email" type="email" placeholder="your@email.com" required /></div>
              <div className="fg"><label>Username *</label><input name="username" type="text" placeholder="Choose a username" required /></div>
              <div className="fg"><label>Password *</label><input name="password" type="password" placeholder="Min. 6 characters" required minLength="6" /></div>
              <div className="fg"><label>Role *</label>
                <select name="role">
                  <option value="user">👤 Community Member</option>
                  <option value="trust">🏛️ Trust / NGO</option>
                </select>
              </div>
              <div style={{ color: 'var(--r1)', fontSize: '.8rem', marginBottom: '12px', minHeight: '18px' }}>{error}</div>
              <button type="submit" className="btn btn-primary btn-full">🚀 Create Account</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
