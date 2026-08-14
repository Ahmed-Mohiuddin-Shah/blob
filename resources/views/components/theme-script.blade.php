{{-- Inline in <head> so the first paint matches preference (no flash). --}}
<script>
(() => {
    const KEY = 'theme';
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const get = () => localStorage.getItem(KEY) || 'system';

    const resolveDark = (pref) =>
        pref === 'dark' || (pref !== 'light' && mq.matches);

    const apply = (pref = get()) => {
        root.classList.toggle('dark', resolveDark(pref));
        root.dataset.theme = pref;
    };

    const set = (pref) => {
        if (!['light', 'dark', 'system'].includes(pref)) return;
        localStorage.setItem(KEY, pref);
        apply(pref);
        root.dispatchEvent(new CustomEvent('themechange', { detail: pref }));
    };

    apply();
    mq.addEventListener('change', () => {
        if (get() === 'system') apply('system');
    });

    window.__theme = { get, set, apply };
})();
</script>
