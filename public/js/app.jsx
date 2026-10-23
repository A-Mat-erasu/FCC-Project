const { useState, useEffect, useMemo, useCallback } = React;

// API Helper
const API_BASE = '/api';

const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.error || (data.details ? JSON.stringify(data.details) : `Request failed (${res.status})`);
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

// Blood types and organ types
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ORGAN_TYPES = ['HEART', 'LIVER', 'KIDNEY', 'LUNG', 'PANCREAS', 'INTESTINE'];

// Format seconds into readable hh:mm:ss
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return 'Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// -------------------------------------------------------------
// MAIN APP COMPONENT
// -------------------------------------------------------------
function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentTab, setCurrentTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check auth session on load
  useEffect(() => {
    if (user && localStorage.getItem('token')) {
      apiRequest('/auth/me')
        .then((userData) => {
          setUser((prev) => ({ ...prev, ...userData }));
        })
        .catch(() => {
          handleLogout();
        });
    }
  }, []);

  const handleLoginSuccess = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setCurrentTab('home');
    showToast(`Welcome back, ${userData.username}!`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setProfileModalOpen(false);
    setCurrentTab('home');
    showToast('You have been logged out.', 'info');
  };

  if (!user) {
    return (
      <div>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <AuthPage onLoginSuccess={handleLoginSuccess} showToast={showToast} />
      </div>
    );
  }

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Navbar */}
      <Navbar
        user={user}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="container-fluid py-4 px-md-4">
        {currentTab === 'home' && <HomePage user={user} setCurrentTab={setCurrentTab} showToast={showToast} />}
        {currentTab === 'donors' && <DonorsPage user={user} showToast={showToast} />}
        {currentTab === 'recipients' && <RecipientsPage user={user} showToast={showToast} />}
        {currentTab === 'organs' && <OrgansPage user={user} showToast={showToast} />}
        {currentTab === 'waitlist' && <WaitlistPage user={user} showToast={showToast} />}
        {currentTab === 'allocations' && <AllocationsPage user={user} showToast={showToast} />}
      </main>

      {/* Profile Modal */}
      {profileModalOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileModalOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS
// -------------------------------------------------------------
function Toast({ toast, onClose }) {
  if (!toast) return null;
  const bgClass =
    toast.type === 'success' ? 'bg-success text-white' :
    toast.type === 'danger' ? 'bg-danger text-white' :
    toast.type === 'warning' ? 'bg-warning text-dark' : 'bg-primary text-white';

  return (
    <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999 }}>
      <div className={`toast show align-items-center ${bgClass} border-0 shadow-lg`} role="alert">
        <div className="d-flex">
          <div className="toast-body py-2 px-3 fw-medium">
            <i className="bi bi-info-circle me-2"></i>
            {toast.message}
          </div>
          <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={onClose}></button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// NAVBAR COMPONENT
// -------------------------------------------------------------
function Navbar({ user, currentTab, setCurrentTab, onOpenProfile }) {
  const getRoleLabel = (role) => {
    if (role === 'ADMIN') return 'Admin';
    if (role === 'COORDINATOR') return 'Coordinator';
    return 'Doctor (Viewer)';
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark app-navbar py-2 sticky-top">
      <div className="container-fluid px-3 px-md-4">
        {/* Brand */}
        <a className="navbar-brand d-flex align-items-center gap-2 me-4" href="#home" onClick={(e) => { e.preventDefault(); setCurrentTab('home'); }}>
          <span className="d-inline-flex p-1 rounded bg-info bg-opacity-25 text-info">
            <i className="bi bi-heart-pulse-fill fs-5"></i>
          </span>
          <span className="fw-bold tracking-tight">OrganRegistry</span>
        </a>

        {/* Toggler for mobile */}
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent">
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navigation Tabs */}
        <div className="collapse navbar-collapse" id="navbarContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-1">
            <li className="nav-item">
              <a className={`nav-link ${currentTab === 'home' ? 'active' : ''}`} href="#home" onClick={(e) => { e.preventDefault(); setCurrentTab('home'); }}>
                <i className="bi bi-speedometer2 me-1"></i> Dashboard
              </a>
            </li>
            <li className="nav-item">
              <a className={`nav-link ${currentTab === 'donors' ? 'active' : ''}`} href="#donors" onClick={(e) => { e.preventDefault(); setCurrentTab('donors'); }}>
                <i className="bi bi-person-heart me-1"></i> Donors
              </a>
            </li>
            <li className="nav-item">
              <a className={`nav-link ${currentTab === 'recipients' ? 'active' : ''}`} href="#recipients" onClick={(e) => { e.preventDefault(); setCurrentTab('recipients'); }}>
                <i className="bi bi-people me-1"></i> Recipients
              </a>
            </li>
            <li className="nav-item">
              <a className={`nav-link ${currentTab === 'organs' ? 'active' : ''}`} href="#organs" onClick={(e) => { e.preventDefault(); setCurrentTab('organs'); }}>
                <i className="bi bi-box2-heart me-1"></i> Organs
              </a>
            </li>
            <li className="nav-item">
              <a className={`nav-link ${currentTab === 'waitlist' ? 'active' : ''}`} href="#waitlist" onClick={(e) => { e.preventDefault(); setCurrentTab('waitlist'); }}>
                <i className="bi bi-clock-history me-1"></i> Waitlist
              </a>
            </li>
            <li className="nav-item">
              <a className={`nav-link ${currentTab === 'allocations' ? 'active' : ''}`} href="#allocations" onClick={(e) => { e.preventDefault(); setCurrentTab('allocations'); }}>
                <i className="bi bi-check2-circle me-1"></i> Allocation
              </a>
            </li>
          </ul>

          {/* Profile Icon in Top Right */}
          <div className="d-flex align-items-center">
            <button className="profile-btn" onClick={onOpenProfile} title="View Profile">
              <div className="profile-avatar">
                <i className="bi bi-person-fill"></i>
              </div>
              <div className="text-start d-none d-sm-block">
                <div className="small fw-semibold lh-1">{user.username}</div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>{getRoleLabel(user.role)}</div>
              </div>
              <i className="bi bi-chevron-down ms-1" style={{ fontSize: '0.75rem' }}></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

// -------------------------------------------------------------
// PROFILE MODAL (TOP RIGHT CORNER DROPDOWN/MODAL)
// -------------------------------------------------------------
function ProfileModal({ user, onClose, onLogout }) {
  const getRoleBadge = (role) => {
    if (role === 'ADMIN') return <span className="badge bg-danger">ADMIN</span>;
    if (role === 'COORDINATOR') return <span className="badge bg-primary">COORDINATOR</span>;
    return <span className="badge bg-success">VIEWER (DOCTOR)</span>;
  };

  const contactNumber = user.phone || '+91 98765 43210';

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px' }}>
        <div className="modal-content shadow border-0 rounded-3">
          <div className="modal-header py-3 px-4 bg-light">
            <h5 className="modal-title fs-6 fw-bold text-dark d-flex align-items-center gap-2">
              <i className="bi bi-person-circle text-primary"></i> User Profile
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 text-center">
            <div className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary" style={{ width: '64px', height: '64px', fontSize: '2rem' }}>
              <i className="bi bi-person-badge"></i>
            </div>

            <h5 className="fw-bold mb-1">{user.username}</h5>
            <div className="mb-3">{getRoleBadge(user.role)}</div>

            <div className="list-group list-group-flush text-start border rounded-2 mb-4">
              <div className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                <span className="text-muted small"><i className="bi bi-person me-2"></i>Full Name:</span>
                <span className="fw-medium small">{user.username}</span>
              </div>
              <div className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                <span className="text-muted small"><i className="bi bi-shield-lock me-2"></i>Assigned Role:</span>
                <span className="fw-medium small">{user.role}</span>
              </div>
              <div className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                <span className="text-muted small"><i className="bi bi-telephone me-2"></i>Contact Number:</span>
                <span className="fw-medium small text-primary">{contactNumber}</span>
              </div>
              <div className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                <span className="text-muted small"><i className="bi bi-hospital me-2"></i>Access Level:</span>
                <span className="fw-medium small">
                  {user.role === 'ADMIN' ? 'Full System Admin' : user.role === 'COORDINATOR' ? 'Registry Coordinator' : 'Medical Doctor (Read Only)'}
                </span>
              </div>
            </div>

            {/* Red Logout Button */}
            <button
              type="button"
              className="btn btn-danger w-100 py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
              onClick={onLogout}
            >
              <i className="bi bi-box-arrow-right fs-5"></i>
              <span className="fw-semibold">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// AUTHORISATION PAGE (CENTERED TAB / CARD)
// -------------------------------------------------------------
function AuthPage({ onLoginSuccess, showToast }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('COORDINATOR'); // ADMIN, COORDINATOR, VIEWER
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'login') {
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: { username, password }
        });
        onLoginSuccess(res.token, res.user);
      } else {
        // Register
        await apiRequest('/auth/register', {
          method: 'POST',
          body: { username, password, role }
        });
        showToast('Registration successful! Please log in.', 'success');
        setActiveTab('login');
      }
    } catch (err) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (demoRole) => {
    if (demoRole === 'ADMIN') {
      setUsername('admin');
      setPassword('admin123');
      setRole('ADMIN');
    } else if (demoRole === 'COORDINATOR') {
      setUsername('coordinator1');
      setPassword('coord123');
      setRole('COORDINATOR');
    } else {
      setUsername('dr_sharma');
      setPassword('doctor123');
      setRole('VIEWER');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="d-inline-flex p-3 rounded-circle bg-primary bg-opacity-10 text-primary mb-2">
            <i className="bi bi-heart-pulse-fill fs-2"></i>
          </div>
          <h4 className="fw-bold text-dark mb-1">Organ Transplant Registry</h4>
          <p className="text-muted small mb-0">Secure Healthcare Matching & Critical Allocation</p>
        </div>

        {/* Tab Selector */}
        <div className="px-4">
          <div className="d-flex rounded-3 p-1 bg-light border">
            <button
              type="button"
              className={`btn btn-sm w-50 fw-semibold rounded-2 ${activeTab === 'login' ? 'btn-white shadow-sm bg-white text-dark' : 'text-muted'}`}
              onClick={() => { setActiveTab('login'); setError(''); }}
            >
              <i className="bi bi-box-arrow-in-right me-1"></i> Login
            </button>
            <button
              type="button"
              className={`btn btn-sm w-50 fw-semibold rounded-2 ${activeTab === 'register' ? 'btn-white shadow-sm bg-white text-dark' : 'text-muted'}`}
              onClick={() => { setActiveTab('register'); setError(''); }}
            >
              <i className="bi bi-person-plus me-1"></i> Register
            </button>
          </div>
        </div>

        <div className="auth-body">
          {error && (
            <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Login ID / Username */}
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Login ID / Username</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted border-end-0">
                  <i className="bi bi-person"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Enter login ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted border-end-0">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  type="password"
                  className="form-control border-start-0"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Role Selection with Centered Tabs / Pills */}
            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary d-flex justify-content-between">
                <span>User Role</span>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>(Doctor = Viewer)</span>
              </label>
              <div className="d-flex rounded overflow-hidden">
                <div
                  className={`role-pill-btn ${role === 'ADMIN' ? 'active' : ''}`}
                  onClick={() => setRole('ADMIN')}
                >
                  <i className="bi bi-shield-shaded me-1"></i> Admin
                </div>
                <div
                  className={`role-pill-btn ${role === 'COORDINATOR' ? 'active' : ''}`}
                  onClick={() => setRole('COORDINATOR')}
                >
                  <i className="bi bi-person-gear me-1"></i> Coordinator
                </div>
                <div
                  className={`role-pill-btn ${role === 'VIEWER' ? 'active' : ''}`}
                  onClick={() => setRole('VIEWER')}
                >
                  <i className="bi bi-eye me-1"></i> Viewer (Doctor)
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-semibold shadow-sm mb-3"
              disabled={loading}
            >
              {loading ? (
                <span><span className="spinner-border spinner-border-sm me-2"></span>Processing...</span>
              ) : activeTab === 'login' ? (
                <span><i className="bi bi-box-arrow-in-right me-2"></i>Sign In</span>
              ) : (
                <span><i className="bi bi-person-check me-2"></i>Create Account</span>
              )}
            </button>

            {/* Quick Demo Credentials */}
            <div className="pt-2 border-top text-center">
              <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>Quick Fill Test Credentials:</p>
              <div className="d-flex gap-2 justify-content-center">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-2 py-1"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => quickFill('ADMIN')}
                >
                  Admin
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-2 py-1"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => quickFill('COORDINATOR')}
                >
                  Coordinator
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-2 py-1"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => quickFill('VIEWER')}
                >
                  Doctor (Viewer)
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// HOME PAGE / DASHBOARD
// -------------------------------------------------------------
function HomePage({ user, setCurrentTab, showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    apiRequest('/stats')
      .then((data) => setStats(data))
      .catch((err) => showToast(err.message, 'danger'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      {/* Welcome Banner */}
      <div className="custom-card p-4 mb-4 bg-white">
        <div className="row align-items-center">
          <div className="col-md-8">
            <h4 className="fw-bold text-dark mb-1">
              Welcome, {user.username}!
            </h4>
            <p className="text-muted mb-0">
              Role: <span className="fw-semibold text-primary">{user.role}</span> | Critical Organ Allocation & Matching Engine Console.
            </p>
          </div>
          <div className="col-md-4 text-md-end mt-3 mt-md-0">
            <span className="badge bg-success bg-opacity-10 text-success p-2 rounded-pill me-2">
              <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i> System Operational
            </span>
            <span className="badge bg-primary bg-opacity-10 text-primary p-2 rounded-pill">
              <i className="bi bi-cpu-fill me-1"></i> Java Engine Live
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon bg-info bg-opacity-10 text-info">
              <i className="bi bi-box2-heart"></i>
            </div>
            <div>
              <div className="text-muted small fw-medium">Available Organs</div>
              <h3 className="fw-bold mb-0 text-dark">
                {loading ? '...' : (stats?.organs?.AVAILABLE || 0)}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon bg-warning bg-opacity-10 text-warning">
              <i className="bi bi-clock-history"></i>
            </div>
            <div>
              <div className="text-muted small fw-medium">Waiting Recipients</div>
              <h3 className="fw-bold mb-0 text-dark">
                {loading ? '...' : (stats?.requests?.WAITING || 0)}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon bg-success bg-opacity-10 text-success">
              <i className="bi bi-check-circle"></i>
            </div>
            <div>
              <div className="text-muted small fw-medium">Transplanted / Matched</div>
              <h3 className="fw-bold mb-0 text-dark">
                {loading ? '...' : ((stats?.organs?.TRANSPLANTED || 0) + (stats?.requests?.MATCHED || 0))}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon bg-danger bg-opacity-10 text-danger">
              <i className="bi bi-person-heart"></i>
            </div>
            <div>
              <div className="text-muted small fw-medium">Registered Donors</div>
              <h3 className="fw-bold mb-0 text-dark">
                {loading ? '...' : (stats?.donors || 0)}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <h5 className="fw-bold mb-3 text-secondary">Registry Quick Access</h5>
      <div className="row g-3">
        <div className="col-md-4">
          <div className="custom-card p-3 h-100">
            <div className="d-flex align-items-center gap-3 mb-2">
              <div className="p-2 bg-primary bg-opacity-10 text-primary rounded">
                <i className="bi bi-box2-heart fs-4"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-0">Organ Viability & Matching</h6>
                <small className="text-muted">Real-time countdowns & Java Priority ranking</small>
              </div>
            </div>
            <p className="text-muted small">Inspect live organs, remaining ischemia window, and trigger candidate allocations.</p>
            <button className="btn btn-outline-primary btn-sm w-100" onClick={() => setCurrentTab('organs')}>
              View Organs <i className="bi bi-arrow-right ms-1"></i>
            </button>
          </div>
        </div>

        <div className="col-md-4">
          <div className="custom-card p-3 h-100">
            <div className="d-flex align-items-center gap-3 mb-2">
              <div className="p-2 bg-warning bg-opacity-10 text-warning rounded">
                <i className="bi bi-clock-history fs-4"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-0">Waitlist Management</h6>
                <small className="text-muted">Ranked by urgency (1-5) and listing time</small>
              </div>
            </div>
            <p className="text-muted small">View registered patient requests, urgency scoring, and manage waiting status.</p>
            <button className="btn btn-outline-warning btn-sm w-100 text-dark" onClick={() => setCurrentTab('waitlist')}>
              View Waitlist <i className="bi bi-arrow-right ms-1"></i>
            </button>
          </div>
        </div>

        <div className="col-md-4">
          <div className="custom-card p-3 h-100">
            <div className="d-flex align-items-center gap-3 mb-2">
              <div className="p-2 bg-success bg-opacity-10 text-success rounded">
                <i className="bi bi-check2-circle fs-4"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-0">Completed Allocations</h6>
                <small className="text-muted">Track transplants and audit trail</small>
              </div>
            </div>
            <p className="text-muted small">Monitor active assignments, confirm surgical completion, and review logs.</p>
            <button className="btn btn-outline-success btn-sm w-100" onClick={() => setCurrentTab('allocations')}>
              View Allocations <i className="bi bi-arrow-right ms-1"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DONORS PAGE
// -------------------------------------------------------------
function DonorsPage({ user, showToast }) {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bloodFilter, setBloodFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchDonors = () => {
    setLoading(true);
    let url = '/donors?limit=100';
    if (search) url += `&q=${encodeURIComponent(search)}`;
    if (bloodFilter) url += `&bloodType=${encodeURIComponent(bloodFilter)}`;

    apiRequest(url)
      .then((data) => setDonors(data.items || []))
      .catch((err) => showToast(err.message, 'danger'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDonors();
  }, [bloodFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDonors();
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this donor?')) return;
    try {
      await apiRequest(`/donors/${id}`, { method: 'DELETE' });
      showToast('Donor deleted successfully', 'success');
      fetchDonors();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Donor Registry</h4>
          <p className="text-muted small mb-0">Manage registered organ donors, blood types, and legal consents.</p>
        </div>
        {user.role !== 'VIEWER' && (
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg"></i> Register Donor
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="custom-card p-3 mb-3">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          <div className="col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-light text-muted"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control"
                placeholder="Search donor name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-outline-secondary" type="submit">Search</button>
            </div>
          </div>
          <div className="col-md-4">
            <select className="form-select" value={bloodFilter} onChange={(e) => setBloodFilter(e.target.value)}>
              <option value="">All Blood Types</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2 text-md-end">
            <button type="button" className="btn btn-light border w-100" onClick={() => { setSearch(''); setBloodFilter(''); fetchDonors(); }}>
              <i className="bi bi-arrow-clockwise me-1"></i> Reset
            </button>
          </div>
        </form>
      </div>

      {/* Donors Table */}
      <div className="custom-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="py-3 px-3">Donor Name</th>
                <th>Blood Type</th>
                <th>Gender</th>
                <th>Type</th>
                <th>Consent Status</th>
                <th>Contact</th>
                {user.role === 'ADMIN' && <th className="text-end px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span> Loading donors...
                  </td>
                </tr>
              ) : donors.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">No donor records found.</td>
                </tr>
              ) : (
                donors.map((d) => (
                  <tr key={d._id}>
                    <td className="px-3 fw-semibold">{d.firstName} {d.lastName}</td>
                    <td><span className="badge-blood">{d.bloodType}</span></td>
                    <td>{d.gender}</td>
                    <td>
                      <span className={`badge ${d.donorType === 'LIVING' ? 'bg-primary' : 'bg-secondary'}`}>
                        {d.donorType}
                      </span>
                    </td>
                    <td>
                      {d.consentVerified ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                          <i className="bi bi-check-circle-fill me-1"></i> Verified
                        </span>
                      ) : (
                        <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
                          <i className="bi bi-hourglass-split me-1"></i> Pending
                        </span>
                      )}
                    </td>
                    <td className="text-muted small">{d.phone}</td>
                    {user.role === 'ADMIN' && (
                      <td className="text-end px-3">
                        <button className="btn btn-outline-danger btn-sm py-0 px-2" onClick={() => handleDelete(d._id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Donor Modal */}
      {showAddModal && (
        <AddDonorModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchDonors(); showToast('Donor registered!', 'success'); }}
        />
      )}
    </div>
  );
}

function AddDonorModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '1990-01-01',
    gender: 'MALE',
    bloodType: 'O+',
    phone: '9876543210',
    donorType: 'DECEASED',
    consentVerified: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiRequest('/donors', { method: 'POST', body: formData });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title fs-6 fw-bold">Register New Donor</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && <div className="alert alert-danger py-2 px-3 small mb-3">{error}</div>}
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium">First Name</label>
                  <input type="text" className="form-control" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Last Name</label>
                  <input type="text" className="form-control" required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
              </div>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium">Blood Type</label>
                  <select className="form-select" value={formData.bloodType} onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}>
                    {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Gender</label>
                  <select className="form-select" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium">Date of Birth</label>
                  <input type="date" className="form-control" required value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Phone</label>
                  <input type="text" className="form-control" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Donor Type</label>
                  <select className="form-select" value={formData.donorType} onChange={(e) => setFormData({ ...formData, donorType: e.target.value })}>
                    <option value="DECEASED">Deceased</option>
                    <option value="LIVING">Living</option>
                  </select>
                </div>
                <div className="col-6 d-flex align-items-end">
                  <div className="form-check mb-2">
                    <input className="form-check-input" type="checkbox" id="consentCheck" checked={formData.consentVerified} onChange={(e) => setFormData({ ...formData, consentVerified: e.target.checked })} />
                    <label className="form-check-label small" htmlFor="consentCheck">Consent Verified</label>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Register Donor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// RECIPIENTS / PATIENTS PAGE
// -------------------------------------------------------------
function RecipientsPage({ user, showToast }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bloodFilter, setBloodFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPatients = () => {
    setLoading(true);
    let url = '/patients?limit=100';
    if (search) url += `&q=${encodeURIComponent(search)}`;
    if (bloodFilter) url += `&bloodType=${encodeURIComponent(bloodFilter)}`;

    apiRequest(url)
      .then((data) => setPatients(data.items || []))
      .catch((err) => showToast(err.message, 'danger'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatients();
  }, [bloodFilter]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this patient record?')) return;
    try {
      await apiRequest(`/patients/${id}`, { method: 'DELETE' });
      showToast('Patient record deleted', 'success');
      fetchPatients();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Recipients Registry</h4>
          <p className="text-muted small mb-0">Browse patients awaiting organ transplants, hospitals, and clinical status.</p>
        </div>
        {user.role !== 'VIEWER' && (
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg"></i> Register Recipient
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="custom-card p-3 mb-3">
        <form onSubmit={(e) => { e.preventDefault(); fetchPatients(); }} className="row g-2 align-items-center">
          <div className="col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-light text-muted"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control"
                placeholder="Search recipient name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-outline-secondary" type="submit">Search</button>
            </div>
          </div>
          <div className="col-md-4">
            <select className="form-select" value={bloodFilter} onChange={(e) => setBloodFilter(e.target.value)}>
              <option value="">All Blood Types</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2 text-md-end">
            <button type="button" className="btn btn-light border w-100" onClick={() => { setSearch(''); setBloodFilter(''); fetchPatients(); }}>
              <i className="bi bi-arrow-clockwise me-1"></i> Reset
            </button>
          </div>
        </form>
      </div>

      {/* Patients Table */}
      <div className="custom-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="py-3 px-3">Patient Name</th>
                <th>Blood Type</th>
                <th>Medical Condition</th>
                <th>Hospital</th>
                <th>Gender</th>
                <th>Contact Phone</th>
                {user.role === 'ADMIN' && <th className="text-end px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span> Loading recipients...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">No recipient records found.</td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p._id}>
                    <td className="px-3 fw-semibold">{p.firstName} {p.lastName}</td>
                    <td><span className="badge-blood">{p.bloodType}</span></td>
                    <td className="text-secondary">{p.medicalCondition}</td>
                    <td>{p.hospital || '—'}</td>
                    <td>{p.gender}</td>
                    <td className="text-muted small">{p.phone}</td>
                    {user.role === 'ADMIN' && (
                      <td className="text-end px-3">
                        <button className="btn btn-outline-danger btn-sm py-0 px-2" onClick={() => handleDelete(p._id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Recipient Modal */}
      {showAddModal && (
        <AddRecipientModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchPatients(); showToast('Recipient added successfully!', 'success'); }}
        />
      )}
    </div>
  );
}

function AddRecipientModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '1985-05-15',
    gender: 'MALE',
    bloodType: 'A+',
    phone: '9876543210',
    medicalCondition: 'End-stage renal failure',
    hospital: 'City Memorial Hospital'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiRequest('/patients', { method: 'POST', body: formData });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title fs-6 fw-bold">Register New Recipient</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && <div className="alert alert-danger py-2 px-3 small mb-3">{error}</div>}
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium">First Name</label>
                  <input type="text" className="form-control" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Last Name</label>
                  <input type="text" className="form-control" required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
              </div>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium">Blood Type</label>
                  <select className="form-select" value={formData.bloodType} onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}>
                    {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Gender</label>
                  <select className="form-select" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="mb-2">
                <label className="form-label small fw-medium">Medical Condition</label>
                <input type="text" className="form-control" required value={formData.medicalCondition} onChange={(e) => setFormData({ ...formData, medicalCondition: e.target.value })} />
              </div>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium">Hospital</label>
                  <input type="text" className="form-control" value={formData.hospital} onChange={(e) => setFormData({ ...formData, hospital: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Phone</label>
                  <input type="text" className="form-control" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Register Recipient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ORGANS PAGE (LIVE VIABILITY COUNTDOWN & CANDIDATES MATCHING)
// -------------------------------------------------------------
function OrgansPage({ user, showToast }) {
  const [organs, setOrgans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrgan, setSelectedOrgan] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchOrgans = () => {
    apiRequest('/organs')
      .then((data) => setOrgans(data.items || []))
      .catch((err) => showToast(err.message, 'danger'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrgans();
    // Live countdown tick every second
    const interval = setInterval(() => {
      setOrgans((prev) =>
        prev.map((o) => {
          if (o.status === 'AVAILABLE' || o.status === 'ALLOCATED') {
            const sec = Math.max(0, Math.floor((new Date(o.expiresAt) - Date.now()) / 1000));
            return { ...o, secondsRemaining: sec };
          }
          return o;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCandidates = async (organ) => {
    setSelectedOrgan(organ);
    setCandidatesLoading(true);
    setCandidates([]);
    try {
      const data = await apiRequest(`/organs/${organ._id}/candidates`);
      setCandidates(data || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleAllocate = async (organId) => {
    try {
      await apiRequest(`/organs/${organId}/allocate`, { method: 'POST' });
      showToast('Organ allocated successfully to top prioritized candidate!', 'success');
      setSelectedOrgan(null);
      fetchOrgans();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleConfirmTransplant = async (organId) => {
    try {
      await apiRequest(`/organs/${organId}/confirm-transplant`, { method: 'POST' });
      showToast('Transplant procedure confirmed as completed!', 'success');
      fetchOrgans();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Live Organ Registry</h4>
          <p className="text-muted small mb-0">Active donor organs, ischemic viability countdowns, and automated priority matching.</p>
        </div>
        {user.role !== 'VIEWER' && (
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg"></i> Register Organ
          </button>
        )}
      </div>

      {/* Organs Table */}
      <div className="custom-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="py-3 px-3">Organ Type</th>
                <th>Blood Type</th>
                <th>Donor</th>
                <th>Harvest Time</th>
                <th>Viability Window</th>
                <th>Ischemia Time Remaining</th>
                <th>Status</th>
                <th className="text-end px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span> Loading organs...
                  </td>
                </tr>
              ) : organs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">No organs currently registered.</td>
                </tr>
              ) : (
                organs.map((o) => {
                  const sec = o.secondsRemaining ?? 0;
                  const isExp = sec <= 0 || o.status === 'EXPIRED';
                  const badgeClass =
                    isExp ? 'badge-viability-danger' :
                    sec < 3600 * 2 ? 'badge-viability-danger' :
                    sec < 3600 * 6 ? 'badge-viability-warn' : 'badge-viability-ok';

                  return (
                    <tr key={o._id}>
                      <td className="px-3">
                        <span className="fw-bold text-dark d-flex align-items-center gap-2">
                          <i className="bi bi-box2-heart text-danger"></i> {o.organType}
                        </span>
                      </td>
                      <td><span className="badge-blood">{o.bloodType}</span></td>
                      <td className="text-muted small">
                        {o.donor ? `${o.donor.firstName} ${o.donor.lastName}` : 'Anonymous'}
                      </td>
                      <td className="text-muted small">
                        {new Date(o.harvestDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="small">{o.viabilityHours} hrs</td>
                      <td>
                        <span className={`badge py-1 px-2 fw-semibold ${badgeClass}`}>
                          <i className="bi bi-clock me-1"></i> {formatTimeRemaining(sec)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          o.status === 'AVAILABLE' ? 'bg-success' :
                          o.status === 'ALLOCATED' ? 'bg-primary' :
                          o.status === 'TRANSPLANTED' ? 'bg-info text-dark' : 'bg-secondary'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="text-end px-3">
                        <div className="d-flex gap-1 justify-content-end">
                          {o.status === 'AVAILABLE' && !isExp && (
                            <button
                              className="btn btn-outline-primary btn-sm py-1 px-2 d-flex align-items-center gap-1"
                              onClick={() => handleOpenCandidates(o)}
                            >
                              <i className="bi bi-diagram-3"></i> Candidates
                            </button>
                          )}
                          {o.status === 'ALLOCATED' && user.role !== 'VIEWER' && (
                            <button
                              className="btn btn-outline-success btn-sm py-1 px-2 d-flex align-items-center gap-1"
                              onClick={() => handleConfirmTransplant(o._id)}
                            >
                              <i className="bi bi-check2"></i> Confirm Transplant
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Ranking Modal */}
      {selectedOrgan && (
        <CandidatesModal
          organ={selectedOrgan}
          candidates={candidates}
          loading={candidatesLoading}
          user={user}
          onAllocate={() => handleAllocate(selectedOrgan._id)}
          onClose={() => setSelectedOrgan(null)}
        />
      )}

      {/* Add Organ Modal */}
      {showAddModal && (
        <AddOrganModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchOrgans(); showToast('Organ registered and viability clock started!', 'success'); }}
        />
      )}
    </div>
  );
}

function CandidatesModal({ organ, candidates, loading, user, onAllocate, onClose }) {
  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header py-3 px-4 bg-light">
            <div>
              <h5 className="modal-title fs-6 fw-bold mb-0">
                Matching Candidates for {organ.organType} ({organ.bloodType})
              </h5>
              <small className="text-muted">Ranked using Java PriorityQueue (Urgency, Listing Date, Compatibility)</small>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            {loading ? (
              <div className="text-center py-4">
                <span className="spinner-border text-primary me-2"></span>
                <span>Calculating compatibility & ranking in Java engine...</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="alert alert-warning py-3 text-center mb-0">
                <i className="bi bi-info-circle fs-5 d-block mb-1"></i>
                No compatible waitlist candidates found for this organ.
              </div>
            ) : (
              <div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Rank</th>
                        <th>Candidate Name</th>
                        <th>Blood Type</th>
                        <th>Urgency Score</th>
                        <th>Listing Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((c, index) => (
                        <tr key={c.requestId} className={index === 0 ? 'table-success' : ''}>
                          <td>
                            {index === 0 ? (
                              <span className="badge bg-success"><i className="bi bi-trophy-fill me-1"></i> Top Match</span>
                            ) : (
                              <span className="text-muted fw-bold">#{index + 1}</span>
                            )}
                          </td>
                          <td className="fw-semibold">
                            {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : 'Unknown Patient'}
                          </td>
                          <td><span className="badge-blood">{c.patient?.bloodType || '—'}</span></td>
                          <td>
                            <span className={`badge ${c.urgency === 5 ? 'bg-danger' : c.urgency >= 3 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                              Priority {c.urgency} / 5
                            </span>
                          </td>
                          <td className="text-muted small">
                            {c.listingDate ? new Date(c.listingDate).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                              Compatible
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {user.role !== 'VIEWER' && candidates.length > 0 && (
                  <div className="mt-4 p-3 bg-light rounded d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold text-dark">Ready to Allocate?</div>
                      <small className="text-muted">Will allocate to top ranked patient: <strong>{candidates[0]?.patient ? `${candidates[0].patient.firstName} ${candidates[0].patient.lastName}` : ''}</strong></small>
                    </div>
                    <button className="btn btn-primary fw-semibold px-3" onClick={onAllocate}>
                      <i className="bi bi-check2-circle me-1"></i> Allocate Organ
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddOrganModal({ onClose, onSuccess }) {
  const [donors, setDonors] = useState([]);
  const [donorId, setDonorId] = useState('');
  const [organType, setOrganType] = useState('KIDNEY');
  const [viabilityHours, setViabilityHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const defaultViability = { HEART: 4, LUNG: 6, INTESTINE: 8, LIVER: 12, PANCREAS: 12, KIDNEY: 24 };

  useEffect(() => {
    apiRequest('/donors?limit=100')
      .then((data) => {
        const list = (data.items || []).filter((d) => d.consentVerified);
        setDonors(list);
        if (list.length > 0) setDonorId(list[0]._id);
      })
      .catch(() => {});
  }, []);

  const handleOrganChange = (type) => {
    setOrganType(type);
    setViabilityHours(defaultViability[type] || 12);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!donorId) {
      setError('A verified donor is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiRequest('/organs', {
        method: 'POST',
        body: {
          donor: donorId,
          organType,
          harvestDatetime: new Date().toISOString(),
          viabilityHours: Number(viabilityHours)
        }
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title fs-6 fw-bold">Register Harvested Organ</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && <div className="alert alert-danger py-2 px-3 small mb-3">{error}</div>}
              <div className="mb-3">
                <label className="form-label small fw-medium">Select Verified Donor</label>
                {donors.length === 0 ? (
                  <div className="alert alert-warning small py-2">No verified donors available. Please create a donor with verified consent first.</div>
                ) : (
                  <select className="form-select" value={donorId} onChange={(e) => setDonorId(e.target.value)}>
                    {donors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.firstName} {d.lastName} ({d.bloodType})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Organ Type</label>
                  <select className="form-select" value={organType} onChange={(e) => handleOrganChange(e.target.value)}>
                    {ORGAN_TYPES.map((ot) => <option key={ot} value={ot}>{ot}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Viability Window (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-control"
                    value={viabilityHours}
                    onChange={(e) => setViabilityHours(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading || donors.length === 0}>
                {loading ? 'Saving...' : 'Start Clock & Register'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// WAITLIST PAGE (TRANSPLANT REQUESTS)
// -------------------------------------------------------------
function WaitlistPage({ user, showToast }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [organFilter, setOrganFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchRequests = () => {
    setLoading(true);
    let url = '/requests?';
    if (organFilter) url += `organType=${organFilter}&`;
    if (statusFilter) url += `status=${statusFilter}&`;

    apiRequest(url)
      .then((data) => setRequests(data.items || []))
      .catch((err) => showToast(err.message, 'danger'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, [organFilter, statusFilter]);

  const handleCancel = async (id) => {
    if (!confirm('Cancel this transplant request?')) return;
    try {
      await apiRequest(`/requests/${id}/cancel`, { method: 'PATCH' });
      showToast('Transplant request cancelled', 'info');
      fetchRequests();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Transplant Waitlist</h4>
          <p className="text-muted small mb-0">Prioritized registry queue sorted by clinical urgency and listing seniority.</p>
        </div>
        {user.role !== 'VIEWER' && (
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg"></i> Add to Waitlist
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="custom-card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-5">
            <select className="form-select" value={organFilter} onChange={(e) => setOrganFilter(e.target.value)}>
              <option value="">All Organs</option>
              {ORGAN_TYPES.map((ot) => <option key={ot} value={ot}>{ot}</option>)}
            </select>
          </div>
          <div className="col-md-5">
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="WAITING">WAITING</option>
              <option value="MATCHED">MATCHED</option>
              <option value="FULFILLED">FULFILLED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="col-md-2 text-md-end">
            <button className="btn btn-light border w-100" onClick={() => { setOrganFilter(''); setStatusFilter(''); fetchRequests(); }}>
              <i className="bi bi-arrow-clockwise me-1"></i> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="custom-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="py-3 px-3">Patient</th>
                <th>Blood Type</th>
                <th>Required Organ</th>
                <th>Clinical Urgency</th>
                <th>Listing Date</th>
                <th>Status</th>
                {user.role !== 'VIEWER' && <th className="text-end px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span> Loading waitlist...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">No waitlist requests found.</td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r._id}>
                    <td className="px-3 fw-semibold">
                      {r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : 'Unknown'}
                    </td>
                    <td><span className="badge-blood">{r.patient?.bloodType || '—'}</span></td>
                    <td>
                      <span className="fw-medium text-dark"><i className="bi bi-box2-heart me-1 text-danger"></i>{r.organType}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        r.urgency === 5 ? 'bg-danger' :
                        r.urgency === 4 ? 'bg-warning text-dark' :
                        r.urgency === 3 ? 'bg-primary' : 'bg-secondary'
                      }`}>
                        Level {r.urgency} {r.urgency === 5 ? '(Critical)' : ''}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {new Date(r.listingDate).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`badge ${
                        r.status === 'WAITING' ? 'bg-warning text-dark' :
                        r.status === 'MATCHED' ? 'bg-info text-dark' :
                        r.status === 'FULFILLED' ? 'bg-success' : 'bg-secondary'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    {user.role !== 'VIEWER' && (
                      <td className="text-end px-3">
                        {r.status === 'WAITING' && (
                          <button className="btn btn-outline-danger btn-sm py-0 px-2" onClick={() => handleCancel(r._id)}>
                            Cancel
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddWaitlistModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchRequests(); showToast('Patient added to transplant waitlist!', 'success'); }}
        />
      )}
    </div>
  );
}

function AddWaitlistModal({ onClose, onSuccess }) {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [organType, setOrganType] = useState('KIDNEY');
  const [urgency, setUrgency] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/patients?limit=100')
      .then((data) => {
        const list = data.items || [];
        setPatients(list);
        if (list.length > 0) setPatientId(list[0]._id);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId) {
      setError('Please select a patient.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiRequest('/requests', {
        method: 'POST',
        body: { patient: patientId, organType, urgency: Number(urgency) }
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title fs-6 fw-bold">Add Patient to Waitlist</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && <div className="alert alert-danger py-2 px-3 small mb-3">{error}</div>}
              <div className="mb-3">
                <label className="form-label small fw-medium">Select Recipient Patient</label>
                {patients.length === 0 ? (
                  <div className="alert alert-warning small py-2">No patients registered. Please register a recipient first.</div>
                ) : (
                  <select className="form-select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                    {patients.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.firstName} {p.lastName} ({p.bloodType}) - {p.medicalCondition}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Organ Type Needed</label>
                  <select className="form-select" value={organType} onChange={(e) => setOrganType(e.target.value)}>
                    {ORGAN_TYPES.map((ot) => <option key={ot} value={ot}>{ot}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Clinical Urgency (1 - 5)</label>
                  <select className="form-select" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                    <option value="5">5 - Critical / Imminent</option>
                    <option value="4">4 - High Urgency</option>
                    <option value="3">3 - Moderate Urgency</option>
                    <option value="2">2 - Low Urgency</option>
                    <option value="1">1 - Stable Monitoring</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading || patients.length === 0}>
                {loading ? 'Adding...' : 'Add to Waitlist'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ALLOCATIONS PAGE
// -------------------------------------------------------------
function AllocationsPage({ user, showToast }) {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllocations = () => {
    setLoading(true);
    apiRequest('/allocations')
      .then((data) => setAllocations(data.items || []))
      .catch((err) => showToast(err.message, 'danger'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAllocations();
  }, []);

  const handleConfirmTransplant = async (organId) => {
    try {
      await apiRequest(`/organs/${organId}/confirm-transplant`, { method: 'POST' });
      showToast('Transplant confirmed as completed!', 'success');
      fetchAllocations();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="fw-bold mb-1 text-dark">Organ Allocations</h4>
          <p className="text-muted small mb-0">Record of matched donors, recipients, surgery progress, and audit records.</p>
        </div>
      </div>

      <div className="custom-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="py-3 px-3">Allocation ID</th>
                <th>Organ</th>
                <th>Recipient</th>
                <th>Blood Match</th>
                <th>Allocated At</th>
                <th>Status</th>
                {user.role !== 'VIEWER' && <th className="text-end px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2"></span> Loading allocations...
                  </td>
                </tr>
              ) : allocations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">No allocations have been made yet.</td>
                </tr>
              ) : (
                allocations.map((a) => (
                  <tr key={a._id}>
                    <td className="px-3 text-muted font-monospace small">{a._id.slice(-6).toUpperCase()}</td>
                    <td>
                      <span className="fw-semibold text-dark">
                        <i className="bi bi-box2-heart text-danger me-1"></i>
                        {a.organ?.organType || 'Organ'}
                      </span>
                    </td>
                    <td className="fw-medium">
                      {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Unknown Patient'}
                    </td>
                    <td>
                      <span className="badge-blood">{a.organ?.bloodType || '—'}</span>
                      <i className="bi bi-arrow-right mx-1 text-muted"></i>
                      <span className="badge-blood">{a.patient?.bloodType || '—'}</span>
                    </td>
                    <td className="text-muted small">
                      {new Date(a.allocatedAt || a.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${
                        a.status === 'COMPLETED' ? 'bg-success' :
                        a.status === 'PENDING' ? 'bg-warning text-dark' : 'bg-danger'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    {user.role !== 'VIEWER' && (
                      <td className="text-end px-3">
                        {a.status === 'PENDING' && a.organ?._id && (
                          <button
                            className="btn btn-outline-success btn-sm py-0 px-2"
                            onClick={() => handleConfirmTransplant(a.organ._id)}
                          >
                            <i className="bi bi-check2"></i> Confirm Transplant
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// RENDER TO DOM
// -------------------------------------------------------------
const rootElement = document.getElementById('root');
ReactDOM.createRoot(rootElement).render(<App />);
