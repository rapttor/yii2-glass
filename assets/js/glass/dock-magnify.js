// OS X dock magnification for any list of buttons. The element under the pointer grows the most, its neighbours grow less (gaussian falloff),
// and because the sizes are real (width/height follow --s) the others are pushed apart. Smoothed per frame, so it never snaps.
//
//   dockMagnify(rail, '.item', {axis: 'y', max: 1.55, sigma: 46, enabled: () => rail.classList.contains('is-mini')})
//   CSS:  .item { width: calc(var(--b, 44px) * var(--s, 1)); height: calc(var(--b, 44px) * var(--s, 1)); }   icons: width: calc(20px * var(--s, 1))
export function dockMagnify(root, selector, o = {}) {
    const {axis = 'y', max = 1.55, sigma = 46, ease = .24, active = '.is-active', activeScale = 1.1, enabled = () => true} = o;
    let p = null, raf = 0;
    const list = () => [...root.querySelectorAll(selector)];
    const val = new WeakMap();

    function frame() {
        raf = 0; let busy = false; const on = enabled();
        for (const el of list()) {
            let t = 1;
            if (on) {
                t = el.matches(active) ? activeScale : 1;
                if (p !== null) { const r = el.getBoundingClientRect(), c = axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2, d = p - c; t = Math.max(t, 1 + (max - 1) * Math.exp(-(d * d) / (2 * sigma * sigma))); }
            }
            const v = val.get(el) ?? 1, n = v + (t - v) * ease;
            if (Math.abs(t - n) > .002) busy = true;
            val.set(el, n);
            n === 1 && !on ? el.style.removeProperty('--s') : el.style.setProperty('--s', (Math.abs(t - n) > .002 ? n : t).toFixed(3));
        }
        root.classList.toggle('dock-live', on && (busy || p !== null));   // lets CSS drop width/height transitions while the engine animates sizes itself
        if (busy || p !== null) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const move = e => { if (e.pointerType === 'touch' || !enabled()) return; p = axis === 'y' ? e.clientY : e.clientX; kick(); };
    const leave = () => { p = null; kick(); };
    root.addEventListener('pointermove', move); root.addEventListener('pointerleave', leave); root.addEventListener('pointercancel', leave);
    kick();
    return {refresh: kick, destroy() { root.removeEventListener('pointermove', move); root.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); list().forEach(el => el.style.removeProperty('--s')); }};
}
