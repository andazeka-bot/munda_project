/* MUNDA — shared site behaviour */
(function () {
  'use strict';

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    links.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }

  /* ---------- reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---------- contact form ---------- */
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('form-status');
      const btn = form.querySelector('button[type="submit"]');
      const original = btn ? btn.textContent : '';

      if (status) { status.className = 'form-status'; status.textContent = ''; }
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      const payload = {
        name: form.name.value,
        email: form.email.value,
        company: form.company.value,
        subject: form.subject.value,
        message: form.message.value,
      };

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (status) {
          if (res.ok && data.ok) {
            status.className = 'form-status ok';
            status.textContent = data.message;
            form.reset();
          } else {
            status.className = 'form-status err';
            status.textContent = (data.errors || ['Something went wrong.']).join(' ');
          }
        }
      } catch (err) {
        if (status) {
          status.className = 'form-status err';
          status.textContent = 'Network error — please try again.';
        }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      }
    });
  }

  /* ---------- footer year ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
})();
