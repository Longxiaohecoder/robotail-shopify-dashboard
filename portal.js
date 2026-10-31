'use strict';
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(name, updateHash = true) {
    const blog = name === 'blog';
    document.getElementById('shop-panel').hidden = blog;
    document.getElementById('blog-panel').hidden = !blog;
    tabs.forEach(tab => {
      const active = tab.id === (blog ? 'tab-blog' : 'tab-shopify');
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (blog) {
      const frame = document.getElementById('blog-dashboard-frame');
      if (!frame.getAttribute('src')) frame.setAttribute('src', frame.dataset.src);
    }
    if (updateHash) history.replaceState(null, '', blog ? '#blog' : '#shopify');
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.id === 'tab-blog' ? 'blog' : 'shopify'));
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(i + 1) % tabs.length];
      target.click(); target.focus();
    });
  });
  window.addEventListener('hashchange', () => select(location.hash === '#blog' ? 'blog' : 'shopify', false));
  select(location.hash === '#blog' ? 'blog' : 'shopify', false);
})();
