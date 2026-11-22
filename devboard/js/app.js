(() => {
  const KEY = 'devboard_tasks_v1';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const uid = () => 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const tips = [
    'Arraste um cartão entre colunas para mudar o status rapidamente.',
    'Use etiquetas para agrupar tarefas por projeto, cliente ou disciplina.',
    'Defina prazos realistas e revise a coluna "Fazendo" para evitar excesso de tarefas ao mesmo tempo.',
    'Clique no lápis para editar detalhes, prioridade ou prazo de uma tarefa.'
  ];
  let tipIndex = 0;
  let tasks = load();
  let dragId = null;

  function load() {
    try { const arr = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(arr)) return arr; } catch {}
    return seed();
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(tasks)); }
  function seed() {
    const d = new Date(); const plus = n => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    return [
      { id: uid(), title: 'Planejar sprint', desc: 'Definir prioridades e estimar tarefas.', col: 'todo', priority: 'alta', due: plus(1), tag: 'Planejamento' },
      { id: uid(), title: 'Criar layout do dashboard', desc: 'Montar estrutura visual e componentes.', col: 'doing', priority: 'media', due: plus(3), tag: 'Frontend' },
      { id: uid(), title: 'Configurar repositório', desc: 'README, .gitignore e estrutura inicial.', col: 'done', priority: 'baixa', due: plus(-1), tag: 'Setup' },
    ];
  }

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-show'); clearTimeout(toast._tm); toast._tm = setTimeout(() => t.classList.remove('is-show'), 2200); }
  function esc(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
  function isLate(t) { return t.col !== 'done' && t.due && t.due < todayISO(); }

  function filtered() {
    const q = $('#search').value.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t => `${t.title} ${t.desc} ${t.tag}`.toLowerCase().includes(q));
  }

  function render() {
    const all = filtered();
    const byCol = { todo: [], doing: [], done: [] };
    all.forEach(t => { if (byCol[t.col]) byCol[t.col].push(t); });
    ['todo', 'doing', 'done'].forEach(col => {
      const list = byCol[col];
      $(`#count-${col}`).textContent = list.length;
      $(`#col-${col}`).innerHTML = list.length ? list.map(card).join('') : `<div class="empty">Nenhuma tarefa aqui.</div>`;
    });
    $('#stat-total').textContent = tasks.length;
    $('#stat-todo').textContent = tasks.filter(t => t.col === 'todo').length;
    $('#stat-doing').textContent = tasks.filter(t => t.col === 'doing').length;
    $('#stat-done').textContent = tasks.filter(t => t.col === 'done').length;
    bindCards();
  }

  function card(t) {
    const late = isLate(t);
    return `<article class="card" draggable="true" data-id="${t.id}">
      <div class="card__top"><h3 class="card__title">${esc(t.title)}</h3></div>
      ${t.desc ? `<p class="card__desc">${esc(t.desc)}</p>` : ''}
      <div class="card__meta">
        <span class="badge badge--${t.priority}">${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</span>
        ${t.tag ? `<span class="badge">${esc(t.tag)}</span>` : ''}
        ${t.due ? `<span class="badge ${late ? 'badge--late' : ''}">${late ? 'Atrasada · ' : ''}${fmtDate(t.due)}</span>` : ''}
      </div>
      <div class="card__actions">
        <button class="action-btn" data-edit="${t.id}" title="Editar" aria-label="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-btn" data-move="${t.id}" title="Avançar" aria-label="Avançar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
        <button class="action-btn" data-del="${t.id}" title="Excluir" aria-label="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    </article>`;
  }

  function bindCards() {
    $$('.card[draggable]').forEach(el => {
      el.addEventListener('dragstart', e => { dragId = el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); $$('.dropzone').forEach(z => z.classList.remove('is-over')); });
    });
    $$('[data-edit]').forEach(b => b.onclick = () => openModal(tasks.find(t => t.id === b.dataset.edit)));
    $$('[data-del]').forEach(b => b.onclick = () => delTask(b.dataset.del));
    $$('[data-move]').forEach(b => b.onclick = () => advance(b.dataset.move));
  }

  function advance(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    const order = ['todo', 'doing', 'done'];
    const i = order.indexOf(t.col);
    t.col = order[Math.min(i + 1, 2)];
    save(); render();
  }

  function bindDropzones() {
    $$('.dropzone').forEach(zone => {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('is-over');
        const t = tasks.find(x => x.id === dragId); if (!t) return;
        t.col = zone.dataset.col; save(); render();
      });
    });
  }

  function openModal(task = null, col = 'todo') {
    $('#modal-title').textContent = task ? 'Editar tarefa' : 'Nova tarefa';
    $('#task-id').value = task?.id || '';
    $('#task-title').value = task?.title || '';
    $('#task-desc').value = task?.desc || '';
    $('#task-col').value = task?.col || col;
    $('#task-priority').value = task?.priority || 'media';
    $('#task-due').value = task?.due || '';
    $('#task-tag').value = task?.tag || '';
    $('#task-modal').showModal();
  }
  function closeModal() { $('#task-modal').close(); }
  function upsert(e) {
    e.preventDefault();
    const id = $('#task-id').value;
    const data = {
      title: $('#task-title').value.trim(), desc: $('#task-desc').value.trim(),
      col: $('#task-col').value, priority: $('#task-priority').value,
      due: $('#task-due').value, tag: $('#task-tag').value.trim()
    };
    if (!data.title) return;
    if (id) { const i = tasks.findIndex(t => t.id === id); if (i >= 0) tasks[i] = { ...tasks[i], ...data }; toast('Tarefa atualizada.'); }
    else { tasks.unshift({ id: uid(), ...data }); toast('Tarefa criada.'); }
    save(); render(); closeModal();
  }
  function delTask(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (!confirm(`Excluir "${t.title}"?`)) return;
    tasks = tasks.filter(x => x.id !== id); save(); render(); toast('Tarefa excluída.');
  }

  function showTip() { $('#help-text').textContent = tips[tipIndex % tips.length]; }
  function openHelp() { $('#help-card').classList.add('is-open'); $('#help-fab').setAttribute('aria-expanded', 'true'); showTip(); }
  function closeHelp() { $('#help-card').classList.remove('is-open'); $('#help-fab').setAttribute('aria-expanded', 'false'); }

  // Programming background animation (subtle falling code tokens)
  function initCodeBg() {
    const c = document.getElementById('code-bg');
    if (!c) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = c.getContext('2d');
    const tokens = ['</>', '{}', 'const', '=>', 'async', 'git', 'npm', 'div', 'function', 'return', 'if()', '[]', '===', 'import', 'let', 'API', 'CSS', 'JS', '01', '/* */', '<tag>', '&&', '||', 'null'];
    let w = 0, h = 0, dpr = 1, drops = [], raf = 0, last = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(18, Math.floor(w / 70));
      drops = Array.from({ length: count }, () => makeDrop(true));
    }
    function makeDrop(randomY = false) {
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : -20 - Math.random() * h * 0.3,
        speed: 12 + Math.random() * 22,
        size: 11 + Math.random() * 5,
        alpha: 0.16 + Math.random() * 0.22,
        text: tokens[Math.floor(Math.random() * tokens.length)]
      };
    }
    function draw(ts) {
      if (reduce) return;
      if (!last) last = ts;
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      ctx.clearRect(0, 0, w, h);
      ctx.font = '500 12px "JetBrains Mono", monospace';
      for (const d of drops) {
        d.y += d.speed * dt;
        if (d.y > h + 30) Object.assign(d, makeDrop(false), { x: Math.random() * w });
        ctx.font = `500 ${d.size}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(255, 110, 110, ${d.alpha})`;
        ctx.fillText(d.text, d.x, d.y);
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    if (reduce) {
      ctx.clearRect(0, 0, w, h);
      ctx.font = '500 13px "JetBrains Mono", monospace';
      for (const d of drops) { ctx.fillStyle = `rgba(255,100,100,${d.alpha * 0.7})`; ctx.fillText(d.text, d.x, d.y); }
    } else {
      raf = requestAnimationFrame(draw);
    }
    document.addEventListener('visibilitychange', () => {
      if (reduce) return;
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = 0; raf = requestAnimationFrame(draw); }
    });
  }

  function bind() {
    $('#new-task-btn').onclick = () => openModal();
    $$('[data-add]').forEach(b => b.onclick = () => openModal(null, b.dataset.add));
    $('#modal-close').onclick = closeModal; $('#task-cancel').onclick = closeModal;
    $('#task-form').onsubmit = upsert;
    $('#task-modal').addEventListener('click', e => { if (e.target.id === 'task-modal') closeModal(); });
    $('#search').oninput = render;
    $('#clear-done').onclick = () => {
      const n = tasks.filter(t => t.col === 'done').length;
      if (!n) return toast('Nenhuma tarefa concluída.');
      if (!confirm(`Remover ${n} tarefa(s) concluída(s)?`)) return;
      tasks = tasks.filter(t => t.col !== 'done'); save(); render(); toast('Concluídas removidas.');
    };
    $('#help-fab').onclick = () => $('#help-card').classList.contains('is-open') ? closeHelp() : openHelp();
    $('#help-close').onclick = closeHelp;
    $('#help-next').onclick = () => { tipIndex = (tipIndex + 1) % tips.length; showTip(); };
    bindDropzones();
  }

  initCodeBg();
  bind(); render(); showTip();
})();