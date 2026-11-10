// Shared motion helpers for the inner pages. Load after gsap.min.js and ScrollTrigger.min.js.
// Everything moves on arrival; the round button pauses and resumes all motion (videos, GSAP, CSS loops).
(() => {
  const S = (window.Site = {});
  S.qs = new URLSearchParams(location.search);

  // split text into word spans holding character spans; keeps <br> and nested inline tags
  S.split = el => { const chars = [], words = [];
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) { const f = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(tok => { if (!tok) return; if (/^\s+$/.test(tok)) return f.append(' ');
          const w = document.createElement('span'); w.className = 'w'; words.push(w);
          [...tok].forEach(c => { const ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c; w.append(ch); chars.push(ch); });
          f.append(w); });
        n.replaceWith(f); }
      else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n); });
    walk(el); return { chars, words }; };

  // pause control
  const btn = document.querySelector('.pause');
  let paused = false;
  S.sync = () => {
    document.querySelectorAll('video').forEach(v => paused ? v.pause() : v.play().catch(() => {}));
    document.documentElement.classList.toggle('motion-paused', paused);
    if (window.gsap) paused ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume();
    if (btn) { btn.textContent = paused ? '▶' : 'II'; btn.setAttribute('aria-label', btn.dataset[paused ? 'play' : 'pause'] || ''); }
  };
  if (btn) btn.onclick = () => { paused = !paused; S.sync(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(t => addEventListener(t, () => { if (!paused) S.sync(); }, { once: true, passive: true }));

  if (!window.gsap) return;
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  S.once = (trigger, start = 'top 85%') => ({ trigger, start, once: true });
  // letters rise out of their words and thicken
  S.riseIn = (el, extra = {}) => { el.classList.add('mask');
    return gsap.from(S.split(el).chars, { yPercent: 115, rotate: 6, fontWeight: 200, duration: 1, ease: 'expo.out', stagger: .02, scrollTrigger: S.once(el), ...extra }); };
  // words clear from a blur
  S.blurIn = (el, extra = {}) => gsap.from(S.split(el).words, { opacity: 0, y: 14, filter: 'blur(8px)', duration: .7, ease: 'power3.out', stagger: .03, scrollTrigger: S.once(el, 'top 90%'), ...extra });
  // anything else: lift in
  S.liftIn = (els, extra = {}) => gsap.from(els, { opacity: 0, y: 40, duration: .9, ease: 'expo.out', stagger: .08, scrollTrigger: S.once(els[0] || els, 'top 88%'), ...extra });
  // magnetic pull toward the pointer (mouse only)
  S.magnetic = (el, k = .35) => { if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const mx = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' }), my = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
    el.addEventListener('pointermove', e => { const b = el.getBoundingClientRect(); mx((e.clientX - b.left - b.width / 2) * k); my((e.clientY - b.top - b.height / 2) * k); });
    el.addEventListener('pointerleave', () => { mx(0); my(0); }); };
  // footer, the same on every page
  addEventListener('DOMContentLoaded', () => { const ft = document.querySelector('footer'); if (!ft) return;
    gsap.timeline({ scrollTrigger: S.once(ft, 'top 92%') })
      .from(ft.querySelector('.logo img'), { clipPath: 'inset(0 100% 0 0)', duration: 1, ease: 'expo.inOut', clearProps: 'clipPath' })
      .from(ft.querySelectorAll('dt, dd'), { opacity: 0, x: 16, duration: .5, ease: 'power3.out', stagger: .04 }, .2); });
})();
