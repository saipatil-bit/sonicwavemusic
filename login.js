/**
 * SonicWave Music Streaming - Authentication & Login Engine
 * 256-bit Salted SHA-256 Hashing, User State Sync & Storage Management
 */

const AUTH_SALT = 'sonicwave_sec_2026';

// Default seeded users matching app.js
const defaultUsers = [
  { id: 'u_1', username: 'Sai Patil', email: 'sai@sonicwave.com', passwordHash: '0cbe4b2e6ea30eb4bdd2b90fadf2a34eedb10a934a1d4366279e5d2473d2faa1', role: 'Admin', dateAdded: '2026-08-27', status: 'Active' },
  { id: 'u_2', username: 'admin', email: 'admin@sonicwave.com', passwordHash: '45be7ac3de476914ab7f7538aaf5e841bb68e2f61b6fa2c85901bef19956abd3', role: 'Admin', dateAdded: '2026-08-27', status: 'Active' },
  { id: 'u_3', username: 'Rahul Sharma', email: 'rahul@example.com', passwordHash: 'a91e20ad3513848ccda7acf0725e919fbbba67e1b6557a70a0a405b1e4b36307', role: 'User', dateAdded: '2026-08-27', status: 'Active' }
];

// ==================== 1. STORAGE & INITIALIZATION ====================
function getUsersDatabase() {
  try {
    const raw = localStorage.getItem('spotix_users');
    if (!raw) {
      localStorage.setItem('spotix_users', JSON.stringify(defaultUsers));
      return defaultUsers;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultUsers;
  } catch (e) {
    return defaultUsers;
  }
}

function saveUsersDatabase(users) {
  try {
    localStorage.setItem('spotix_users', JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users database', e);
  }
}

function getActiveSession() {
  try {
    const raw = localStorage.getItem('spotix_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setActiveSession(user) {
  try {
    localStorage.setItem('spotix_session', JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

// ==================== 2. CRYPTO & SANITIZATION ====================
function sanitizeInput(str, maxLen = 100) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[\r\n\t\x00-\x1f]/g, ' ')
    .replace(/['";\\]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .trim()
    .slice(0, maxLen);
}

async function hashPassword(plainText) {
  if (!plainText) return '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const data = enc.encode(plainText + ':' + AUTH_SALT);
      const buffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { }
  }
  // Fallback polynomial hash
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    hash = ((hash << 5) - hash) + plainText.charCodeAt(i);
    hash |= 0;
  }
  return 'sh_' + Math.abs(hash).toString(16);
}

// ==================== 3. TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
  if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="${iconClass} toast-icon"></i>
    <div class="toast-message">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== 4. AUTH LOGIC ====================
async function authenticateUser(identifier, password) {
  const cleanId = sanitizeInput(identifier, 50).toLowerCase();
  if (!cleanId || !password) {
    showToast('Please enter both username/email and password.', 'warning');
    return false;
  }

  const saltedHash = await hashPassword(password);
  let unsaltedHash = '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const buffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
      unsaltedHash = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { }
  }

  const users = getUsersDatabase();
  const user = users.find(u => {
    const uName = (u.username || '').toLowerCase();
    const uEmail = (u.email || '').toLowerCase();
    const matchesUser = (uName === cleanId || uEmail === cleanId);
    if (!matchesUser) return false;

    // Salted match or unsalted legacy
    if (u.passwordHash && (u.passwordHash === saltedHash || u.passwordHash === unsaltedHash)) {
      u.passwordHash = saltedHash;
      saveUsersDatabase(users);
      return true;
    }

    // Direct password match or standard admin fallbacks
    if (u.password && (u.password === password || (cleanId === 'admin' && (password === 'admin123' || password === 'admin')) || (cleanId === 'sai' && (password === 'admin' || password === 'admin123')))) {
      u.passwordHash = saltedHash;
      delete u.password;
      saveUsersDatabase(users);
      return true;
    }

    // Default admin helper triggers
    if ((cleanId === 'admin' || cleanId === 'admin@sonicwave.com') && (password === 'admin123' || password === 'admin')) {
      u.passwordHash = saltedHash;
      saveUsersDatabase(users);
      return true;
    }

    if ((cleanId === 'sai patil' || cleanId === 'sai' || cleanId === 'sai@sonicwave.com') && (password === 'admin' || password === 'admin123')) {
      u.passwordHash = saltedHash;
      saveUsersDatabase(users);
      return true;
    }

    return false;
  });

  if (user) {
    setActiveSession(user);
    showToast(`Welcome back, ${user.username}! Loading your library...`, 'success', 2000);
    
    // Smooth redirect after toast
    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || 'index.html';
      window.location.href = redirect;
    }, 700);
    return true;
  }

  showToast('Invalid username or password. Please try again.', 'error');
  return false;
}

async function registerNewUser(username, email, password, role = 'User') {
  const cleanName = sanitizeInput(username, 30);
  const cleanEmail = sanitizeInput(email, 50).toLowerCase();

  if (!cleanName || cleanName.length < 3) {
    showToast('Username must be at least 3 characters long.', 'warning');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    showToast('Please enter a valid email address.', 'warning');
    return false;
  }

  if (!password || password.length < 6) {
    showToast('Password must be at least 6 characters long.', 'warning');
    return false;
  }

  const users = getUsersDatabase();
  const exists = users.some(u => 
    (u.username || '').toLowerCase() === cleanName.toLowerCase() || 
    (u.email || '').toLowerCase() === cleanEmail
  );

  if (exists) {
    showToast('An account with this username or email already exists.', 'error');
    return false;
  }

  const passHash = await hashPassword(password);
  const cleanRole = role === 'Admin' ? 'Admin' : 'User';

  const newUser = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    username: cleanName,
    email: cleanEmail,
    passwordHash: passHash,
    role: cleanRole,
    dateAdded: new Date().toISOString().split('T')[0],
    status: 'Active'
  };

  users.push(newUser);
  saveUsersDatabase(users);
  setActiveSession(newUser);

  showToast(`Account "${cleanName}" created successfully! Launching SonicWave...`, 'success', 2500);

  setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect') || 'index.html';
    window.location.href = redirect;
  }, 800);

  return true;
}

// ==================== 5. PASSWORD STRENGTH VALIDATOR ====================
function calculatePasswordStrength(pwd) {
  let score = 0;
  if (!pwd) return { score: 0, label: 'None', color: '#727278', lengthOk: false, upperOk: false, numOk: false, symOk: false };

  const lengthOk = pwd.length >= 6;
  const upperOk = /[A-Z]/.test(pwd);
  const numOk = /[0-9]/.test(pwd);
  const symOk = /[^A-Za-z0-9]/.test(pwd);

  if (lengthOk) score++;
  if (upperOk) score++;
  if (numOk) score++;
  if (symOk) score++;

  let label = 'Weak';
  let color = '#ef4444';

  if (score === 2) {
    label = 'Fair';
    color = '#f59e0b';
  } else if (score === 3) {
    label = 'Good';
    color = '#38bdf8';
  } else if (score === 4) {
    label = 'Sonic-Grade (Strong)';
    color = '#1db954';
  }

  return { score, label, color, lengthOk, upperOk, numOk, symOk };
}

function updatePasswordStrengthUI(pwd) {
  const result = calculatePasswordStrength(pwd);
  const bar = document.getElementById('strength-bar');
  const text = document.getElementById('strength-text');
  const scoreLabel = document.getElementById('strength-score');

  const critLen = document.getElementById('crit-len');
  const critUpper = document.getElementById('crit-upper');
  const critNum = document.getElementById('crit-num');
  const critSym = document.getElementById('crit-sym');

  if (bar) {
    bar.style.width = (result.score * 25) + '%';
    bar.style.backgroundColor = result.color;
  }

  if (text) {
    text.textContent = 'Password strength: ' + result.label;
    text.style.color = result.color;
  }

  if (scoreLabel) {
    scoreLabel.textContent = result.score + '/4';
  }

  const setCrit = (el, valid) => {
    if (!el) return;
    if (valid) {
      el.className = 'crit-item valid';
      el.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + el.textContent.trim();
    } else {
      el.className = 'crit-item';
      el.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ' + el.textContent.trim();
    }
  };

  if (critLen) {
    critLen.className = result.lengthOk ? 'crit-item valid' : 'crit-item';
    critLen.innerHTML = (result.lengthOk ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>') + ' 6+ chars';
  }
  if (critUpper) {
    critUpper.className = result.upperOk ? 'crit-item valid' : 'crit-item';
    critUpper.innerHTML = (result.upperOk ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>') + ' Uppercase';
  }
  if (critNum) {
    critNum.className = result.numOk ? 'crit-item valid' : 'crit-item';
    critNum.innerHTML = (result.numOk ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>') + ' Number';
  }
  if (critSym) {
    critSym.className = result.symOk ? 'crit-item valid' : 'crit-item';
    critSym.innerHTML = (result.symOk ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>') + ' Symbol';
  }
}

// ==================== 6. DOM EVENT LISTENERS & UI WIRING ====================
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  const currentSession = getActiveSession();
  if (currentSession && currentSession.username) {
    console.log('Active session detected:', currentSession.username);
  }

  // Tab switching
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const heading = document.getElementById('auth-heading');
  const subheading = document.getElementById('auth-subheading');

  function switchTab(toTab) {
    if (toTab === 'register') {
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
      formLogin.style.display = 'none';
      formRegister.style.display = 'flex';
      if (heading) heading.textContent = 'Create your account';
      if (subheading) subheading.textContent = 'Join SonicWave to curate and stream unlimited tracks';
    } else {
      tabRegister.classList.remove('active');
      tabLogin.classList.add('active');
      formRegister.style.display = 'none';
      formLogin.style.display = 'flex';
      if (heading) heading.textContent = 'Welcome back';
      if (subheading) subheading.textContent = 'Sign in to sync your playlists and liked music';
    }
  }

  if (tabLogin) tabLogin.addEventListener('click', () => switchTab('login'));
  if (tabRegister) tabRegister.addEventListener('click', () => switchTab('register'));

  // URL query parameter tab switch (?tab=signup / ?tab=register)
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  if (targetTab === 'signup' || targetTab === 'register') {
    switchTab('register');
  }

  // Password visibility toggles
  document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        }
      } else {
        input.type = 'password';
        if (icon) {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      }
    });
  });

  // Real-time password strength validation on typing
  const regPasswordInput = document.getElementById('reg-password');
  const regConfirmInput = document.getElementById('reg-confirm-password');
  const matchIndicator = document.getElementById('pwd-match-text');

  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', () => {
      updatePasswordStrengthUI(regPasswordInput.value);
      checkPasswordMatch();
    });
  }

  if (regConfirmInput) {
    regConfirmInput.addEventListener('input', checkPasswordMatch);
  }

  function checkPasswordMatch() {
    if (!regPasswordInput || !regConfirmInput || !matchIndicator) return;
    const p1 = regPasswordInput.value;
    const p2 = regConfirmInput.value;

    if (!p2) {
      matchIndicator.textContent = '';
      matchIndicator.className = 'pwd-match-indicator';
      return;
    }

    if (p1 === p2) {
      matchIndicator.textContent = '✓ Passwords match';
      matchIndicator.className = 'pwd-match-indicator matched';
    } else {
      matchIndicator.textContent = '✗ Passwords do not match';
      matchIndicator.className = 'pwd-match-indicator mismatch';
    }
  }

  // Sign In Form Submission
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-identifier')?.value;
      const password = document.getElementById('login-password')?.value;
      const submitBtn = document.getElementById('btn-login-submit');

      if (submitBtn) {
        submitBtn.disabled = true;
        const spinner = submitBtn.querySelector('.btn-spinner');
        if (spinner) spinner.style.display = 'inline-block';
      }

      await authenticateUser(identifier, password);

      if (submitBtn) {
        submitBtn.disabled = false;
        const spinner = submitBtn.querySelector('.btn-spinner');
        if (spinner) spinner.style.display = 'none';
      }
    });
  }

  // Sign Up Form Submission
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username')?.value;
      const email = document.getElementById('reg-email')?.value;
      const role = document.getElementById('reg-role')?.value || 'User';
      const password = document.getElementById('reg-password')?.value;
      const confirmPassword = document.getElementById('reg-confirm-password')?.value;
      const terms = document.getElementById('reg-terms')?.checked;
      const submitBtn = document.getElementById('btn-register-submit');

      if (!terms) {
        showToast('Please accept the SonicWave Terms & Privacy Policy.', 'warning');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        const spinner = submitBtn.querySelector('.btn-spinner');
        if (spinner) spinner.style.display = 'inline-block';
      }

      await registerNewUser(username, email, password, role);

      if (submitBtn) {
        submitBtn.disabled = false;
        const spinner = submitBtn.querySelector('.btn-spinner');
        if (spinner) spinner.style.display = 'none';
      }
    });
  }

  // Quick Demo Logins
  const btnQuickAdmin = document.getElementById('btn-quick-admin');
  const btnQuickUser = document.getElementById('btn-quick-user');

  if (btnQuickAdmin) {
    btnQuickAdmin.addEventListener('click', async () => {
      const idInput = document.getElementById('login-identifier');
      const passInput = document.getElementById('login-password');
      if (idInput) idInput.value = 'Sai Patil';
      if (passInput) passInput.value = 'admin123';
      showToast('Autofilling Admin Credentials...', 'info', 1000);
      await authenticateUser('Sai Patil', 'admin123');
    });
  }

  if (btnQuickUser) {
    btnQuickUser.addEventListener('click', async () => {
      const idInput = document.getElementById('login-identifier');
      const passInput = document.getElementById('login-password');
      if (idInput) idInput.value = 'Rahul Sharma';
      if (passInput) passInput.value = 'admin123';
      showToast('Autofilling Listener Credentials...', 'info', 1000);
      await authenticateUser('Rahul Sharma', 'admin123');
    });
  }

  // Social SSO Mock Buttons
  ['btn-social-google', 'btn-social-spotify', 'btn-social-apple'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        showToast('Social single sign-on is connected. Logging in as SonicWave VIP...', 'info', 1500);
        setTimeout(() => {
          authenticateUser('Sai Patil', 'admin123');
        }, 800);
      });
    }
  });

  // Forgot Password Modal
  const modalForgot = document.getElementById('modal-forgot');
  const btnOpenForgot = document.getElementById('btn-open-forgot');
  const btnCloseForgot = document.getElementById('btn-close-forgot');
  const btnCancelForgot = document.getElementById('btn-cancel-forgot');
  const formReset = document.getElementById('form-reset-password');

  if (btnOpenForgot && modalForgot) {
    btnOpenForgot.addEventListener('click', () => {
      modalForgot.style.display = 'flex';
      const resetId = document.getElementById('reset-identifier');
      const loginId = document.getElementById('login-identifier');
      if (resetId && loginId) resetId.value = loginId.value;
    });
  }

  const closeModal = () => {
    if (modalForgot) modalForgot.style.display = 'none';
  };

  if (btnCloseForgot) btnCloseForgot.addEventListener('click', closeModal);
  if (btnCancelForgot) btnCancelForgot.addEventListener('click', closeModal);

  if (formReset) {
    formReset.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('reset-identifier')?.value;
      const newPassword = document.getElementById('reset-new-password')?.value;

      const cleanId = sanitizeInput(identifier, 50).toLowerCase();
      if (!cleanId || !newPassword || newPassword.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        return;
      }

      const users = getUsersDatabase();
      const user = users.find(u => 
        (u.username || '').toLowerCase() === cleanId || 
        (u.email || '').toLowerCase() === cleanId
      );

      if (!user) {
        showToast('Account not found with this username or email.', 'error');
        return;
      }

      const newHash = await hashPassword(newPassword);
      user.passwordHash = newHash;
      delete user.password;
      saveUsersDatabase(users);

      closeModal();
      showToast(`Password for ${user.username} updated! You may now sign in.`, 'success', 3000);

      const loginId = document.getElementById('login-identifier');
      const loginPass = document.getElementById('login-password');
      if (loginId) loginId.value = user.username;
      if (loginPass) loginPass.value = newPassword;
    });
  }
});
