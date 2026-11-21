/* 预览专用：按 URL 参数生成截图所需的状态。不进 dist。 */
(function () {
  const q = new URLSearchParams(location.search);
  const theme = q.get('theme');
  const view = q.get('view') || 'shelf';
  const seed = q.get('seed') !== '0';
  const scroll = q.get('scroll');

  const waitFor = (fn, cb, tries = 120) => {
    let n = 0;
    const timer = setInterval(() => {
      const hit = fn();
      if (hit) {
        clearInterval(timer);
        cb(hit);
      } else if (++n > tries) {
        clearInterval(timer);
        document.body.dataset.ready = 'timeout';
      }
    }, 100);
  };

  waitFor(
    () => document.querySelector('#btn-save'),
    async (btn) => {
      document.documentElement.dataset.theme = theme || 'light';
      if (seed) {
        const count = Number(q.get('count') || 8);
        for (let i = 0; i < count; i++) {
          btn.click();
          await new Promise((r) => setTimeout(r, 620));
        }
      }
      await new Promise((r) => setTimeout(r, 500));

      if (view === 'reader') {
        document.querySelector('.item')?.click();
        await new Promise((r) => setTimeout(r, 900));
        if (scroll === 'mid') {
          const main = document.querySelector('#main');
          if (main) main.scrollTop = Math.round((main.scrollHeight - main.clientHeight) * 0.18);
        }
      } else if (view === 'settings') {
        document.querySelector('[data-view=settings]')?.click();
      } else if (view === 'ads') {
        document.querySelector('[data-view=settings]')?.click();
        await new Promise((r) => setTimeout(r, 500));
        const main = document.querySelector('#main');
        if (main) main.scrollTop = 150;
      }

      await new Promise((r) => setTimeout(r, 700));
      document.body.dataset.ready = '1';
    },
  );
})();
