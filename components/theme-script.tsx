export function ThemeScript() {
  const code = `(function(){var KEY='theme';var root=document.documentElement;var mq=window.matchMedia('(prefers-color-scheme: dark)');var get=function(){return localStorage.getItem(KEY)||'system'};var resolveDark=function(pref){return pref==='dark'||(pref!=='light'&&mq.matches)};var apply=function(pref){pref=pref||get();root.classList.toggle('dark',resolveDark(pref));root.dataset.theme=pref};var set=function(pref){if(['light','dark','system'].indexOf(pref)<0)return;localStorage.setItem(KEY,pref);apply(pref);root.dispatchEvent(new CustomEvent('themechange',{detail:pref}))};apply();mq.addEventListener('change',function(){if(get()==='system')apply('system')});window.__theme={get:get,set:set,apply:apply}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
