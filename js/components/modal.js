/**
 * modal.js — Generic Modal Component with Focus Trap and Accessibility
 */

let activeModal = null;

/**
 * Open a modal.
 * @param {Object} opts
 * @param {string}   opts.title
 * @param {string}   opts.bodyHTML
 * @param {string}   [opts.footerHTML]
 * @param {string}   [opts.size]       — '', 'modal-lg', 'modal-xl'
 * @param {Function} [opts.onOpen]     — called after modal is in DOM
 * @param {Function} [opts.onClose]    — called when modal closes
 */
function openModal({ title, bodyHTML, footerHTML = '', size = '', onOpen, onClose }) {
  closeModal(); // Ensure no stale modals

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'active-modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal ${size} animate-scale-in" id="active-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">${title}</h2>
        <button class="modal-close" id="modal-close-btn" aria-label="Close modal">
          <svg aria-hidden="true"><use href="icons/sprite.svg#icon-close"/></svg>
        </button>
      </div>
      <div class="modal-body" id="modal-body">
        ${bodyHTML}
      </div>
      ${footerHTML ? `<div class="modal-footer" id="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);
  activeModal = { backdrop, onClose };

  // Close handlers
  backdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  // ESC key
  document.addEventListener('keydown', handleModalKeydown);

  // Focus first focusable element
  requestAnimationFrame(() => {
    const focusable = backdrop.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
    const firstInput = Array.from(focusable).find(el => el.tagName !== 'BUTTON');
    (firstInput || focusable[0])?.focus();
  });

  if (onOpen) onOpen(backdrop);
  return backdrop;
}

function closeModal() {
  const backdrop = document.getElementById('active-modal-backdrop');
  if (backdrop) {
    backdrop.remove();
  }
  document.removeEventListener('keydown', handleModalKeydown);
  if (activeModal?.onClose) activeModal.onClose();
  activeModal = null;
}

function handleModalKeydown(e) {
  if (e.key === 'Escape') closeModal();

  // Focus trap
  if (e.key === 'Tab') {
    const modal = document.getElementById('active-modal');
    if (!modal) return;
    const focusable = modal.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
    const focusArr  = Array.from(focusable).filter(el => !el.disabled);
    if (focusArr.length === 0) return;
    const first = focusArr[0];
    const last  = focusArr[focusArr.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }
}
