/**
 * toast.js — Non-blocking Toast Notification System
 */

const TOAST_DURATION = 3500;

function showToast({ type = 'info', title, message, duration = TOAST_DURATION }) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'icon-check-circle',
    error:   'icon-x-circle',
    warning: 'icon-alert',
    info:    'icon-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg class="toast-icon ${type}" aria-hidden="true">
      <use href="icons/sprite.svg#${icons[type] || icons.info}"/>
    </svg>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-dismiss" aria-label="Dismiss">
      <svg aria-hidden="true"><use href="icons/sprite.svg#icon-close"/></svg>
    </button>
  `;

  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400);
  };

  toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

// Convenience wrappers
const toast = {
  success: (title, message) => showToast({ type: 'success', title, message }),
  error:   (title, message) => showToast({ type: 'error',   title, message, duration: 5000 }),
  warning: (title, message) => showToast({ type: 'warning', title, message }),
  info:    (title, message) => showToast({ type: 'info',    title, message })
};
