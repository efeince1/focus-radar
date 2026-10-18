const ACTIVE = ['bg-primary-container', 'text-on-primary-container'];
const IDLE = ['text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-surface-container-high'];

export function initNav() {
  const links = [...document.querySelectorAll('nav [data-path]')];
  const sections = links.map((link) => document.getElementById(link.dataset.path)).filter(Boolean);

  const setActive = (id) =>
    links.forEach((link) => {
      const on = link.dataset.path === id;
      link.classList.add(...(on ? ACTIVE : IDLE));
      link.classList.remove(...(on ? IDLE : ACTIVE));
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

  // Ekranın tam ortasındaki ince şeride giren bölüm aktif olur
  const observer = new IntersectionObserver(
    (entries) => entries.filter((e) => e.isIntersecting).forEach((e) => setActive(e.target.id)),
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((section) => observer.observe(section));
}