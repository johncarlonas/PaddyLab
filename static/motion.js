const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const revealNodes = [...document.querySelectorAll('[data-reveal]')];
let observer, smoothScroll;

function configureMotion() {
  observer?.disconnect();
  smoothScroll?.destroy();
  document.documentElement.classList.toggle('motion-ready', !motionPreference.matches);
  if (motionPreference.matches) return;
  if (typeof Lenis !== 'undefined') {
    smoothScroll = new Lenis({ autoRaf: true, lerp: 0.09, smoothWheel: true, anchors: true });
  }
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08 });
  revealNodes.forEach(node => observer.observe(node));
}

motionPreference.addEventListener('change', configureMotion);
configureMotion();
