(() => {
  const TASKS_KEY = 'organiza_tasks_v2';
  const GMAIL_CFG_KEY = 'organiza_gmail_cfg_v1';
  const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const uid = () => 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const tips = [
    'Divida tarefas grandes em etapas menores para acompanhar o progresso com mais clareza.',
    'Use a aba Gmail para importar itens importantes. O acesso é somente leitura e exige sua permissão.',
    'Atualize o status e o progresso das tarefas para manter o desempenho realista.',
    'Na planilha, revise prazos e prioridades para decidir o que fazer primeiro.',
    'Se um e-mail virar tarefa, ajuste categoria e prazo para ele entrar no seu planejamento.'
  ];
  let tipIndex = 0;
  let tasks = loadTasks();
  let gmailTokenClient = null;
  let gmailAccessToken = null;
  let gmailItems = [];

  function loadTasks() {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) return arr;
    } catch {}
    // migrate v1 if present
    try {
      const raw = localStorage.getItem('organiza_tasks_v1');
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) return arr;
    } catch {}
    return seed();
  }
  function saveTasks() { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
  function loadGmailCfg() {
    try { return JSON.parse(localStorage.getItem(GMAIL_CFG_KEY) || '{}'); } catch { return {}; }
  }
  function saveGmailCfg(cfg) { localStorage.setItem(GMAIL_CFG_KEY, JSON.stringify(cfg)); }

  function seed() {
    const d = new Date();
    const plus = n => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    return [
      { id: uid(), title: 'Relatório semanal', type: 'trabalho', category: 'Relatórios', due: plus(2), priority: 'alta', status: 'andamento', progress: 60, notes: 'Revisar dados e enviar por e-mail.' },
      { id: uid(), title: 'Estudar Matemática', type: 'escola', category: 'Matemática', due: plus(1), priority: 'media', status: 'pendente', progress: 20, notes: 'Capítulo de equações.' },
      { id: uid(), title: 'Apresentação de projeto', type: 'trabalho', category: 'Projetos', due: plus(5), priority: 'alta', status: 'pendente', progress: 10, notes: 'Montar slides e ensaiar.' }
    ];
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove('is-show'), 2400);
  }
  function esc(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(iso) {
    if (!iso) return 'Sem prazo';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function isLate(t) { return t.status !== 'concluida' && t.due && t.due < todayISO(); }
  function statusLabel(s) { return ({ pendente: 'Pendente', andamento: 'Em andamento', concluida: 'Concluída' })[s] || s; }
  function prioLabel(p) { return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta' })[p] || p; }
  function typeLabel(t) { return t === 'escola' ? 'Escola' : 'Trabalho'; }
  function calcPerformance(list) {
    if (!list.length) return 0;
    const total = list.reduce((acc, t) => acc + (t.status === 'concluida' ? 100 : Number(t.progress || 0)), 0);
    return Math.round(total / list.length);
  }

  function render() {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'concluida').length;
    const pending = tasks.filter(t => t.status !== 'concluida').length;
    const late = tasks.filter(isLate).length;
    $('#stat-total').textContent = total;
    $('#stat-done').textContent = done;
    $('#stat-pending').textContent = pending;
    $('#stat-late').textContent = late;

    const overall = calcPerformance(tasks);
    $('#overall-ring').style.setProperty('--pct', overall);
    $('#overall-pct').textContent = overall + '%';
    $('#overall-text').textContent = total ? `${done} de ${total} tarefa(s) concluída(s).` : 'Adicione tarefas para ver seu desempenho.';

    const work = tasks.filter(t => t.type === 'trabalho');
    const school = tasks.filter(t => t.type === 'escola');
    const wp = calcPerformance(work), sp = calcPerformance(school);
    $('#work-pct').textContent = wp + '%'; $('#work-bar').style.width = wp + '%';
    $('#school-pct').textContent = sp + '%'; $('#school-bar').style.width = sp + '%';

    renderUpcoming();
    renderTasksTable();
    renderSheet();
    renderPerformance();
    renderGmail();
  }

  function renderUpcoming() {
    const el = $('#upcoming-list');
    const upcoming = [...tasks].filter(t => t.status !== 'concluida').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 5);
    if (!upcoming.length) { el.innerHTML = '<div class="empty">Nenhuma tarefa pendente.</div>'; return; }
    el.innerHTML = upcoming.map(t => `
      <div class="item">
        <div>
          <div class="item__title">${esc(t.title)}</div>
          <div class="item__meta">${typeLabel(t.type)} · ${esc(t.category || 'Sem categoria')} · ${fmtDate(t.due)}${isLate(t) ? ' · <span style="color:#c97b1a">Atrasada</span>' : ''}</div>
        </div>
        <span class="badge badge--${t.status}">${statusLabel(t.status)}</span>
      </div>`).join('');
  }

  function filteredTasks() {
    const type = $('#filter-type').value;
    const status = $('#filter-status').value;
    return tasks.filter(t => (type === 'all' || t.type === type) && (status === 'all' || t.status === status))
      .sort((a, b) => (a.status === 'concluida') - (b.status === 'concluida') || (a.due || '9999').localeCompare(b.due || '9999'));
  }

  function renderTasksTable() {
    const body = $('#tasks-body');
    const list = filteredTasks();
    if (!list.length) { body.innerHTML = '<tr><td colspan="7"><div class="empty">Nenhuma tarefa encontrada.</div></td></tr>'; return; }
    body.innerHTML = list.map(t => {
      const perf = t.status === 'concluida' ? 100 : Number(t.progress || 0);
      return `<tr>
        <td><strong>${esc(t.title)}</strong><div class="item__meta">${esc(t.category || 'Sem categoria')}</div></td>
        <td>${typeLabel(t.type)}</td>
        <td>${fmtDate(t.due)}${isLate(t) ? '<div class="item__meta" style="color:#c97b1a">Atrasada</div>' : ''}</td>
        <td><span class="badge badge--${t.priority}">${prioLabel(t.priority)}</span></td>
        <td><span class="badge badge--${t.status}">${statusLabel(t.status)}</span></td>
        <td><div class="progress"><div class="bar"><span style="width:${perf}%"></span></div><span class="num">${perf}%</span></div></td>
        <td><div class="actions">
          <button class="action-btn" data-edit="${t.id}" title="Editar" aria-label="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn" data-toggle="${t.id}" title="Concluir/Reabrir" aria-label="Concluir ou reabrir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6L9 17l-5-5"/></svg></button>
          <button class="action-btn" data-del="${t.id}" title="Excluir" aria-label="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div></td>
      </tr>`;
    }).join('');
    $$('[data-edit]').forEach(b => b.onclick = () => openModal(tasks.find(x => x.id === b.dataset.edit)));
    $$('[data-toggle]').forEach(b => b.onclick = () => toggleDone(b.dataset.toggle));
    $$('[data-del]').forEach(b => b.onclick = () => delTask(b.dataset.del));
  }

  function renderSheet() {
    const body = $('#sheet-body');
    if (!tasks.length) { body.innerHTML = '<tr><td colspan="8"><div class="empty">Sua planilha está vazia.</div></td></tr>'; return; }
    const list = [...tasks].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    body.innerHTML = list.map(t => {
      const perf = t.status === 'concluida' ? 100 : Number(t.progress || 0);
      return `<tr>
        <td>${esc(t.title)}</td><td>${typeLabel(t.type)}</td><td>${esc(t.category || '-')}</td><td>${fmtDate(t.due)}</td>
        <td>${prioLabel(t.priority)}</td><td>${statusLabel(t.status)}</td><td>${perf}%</td><td>${esc(t.notes || '-')}</td>
      </tr>`;
    }).join('');
  }

  function renderPerformance() {
    const catMap = new Map();
    tasks.forEach(t => { const k = (t.category || 'Sem categoria').trim() || 'Sem categoria'; if (!catMap.has(k)) catMap.set(k, []); catMap.get(k).push(t); });
    const cats = Array.from(catMap.entries()).map(([name, list]) => ({ name, pct: calcPerformance(list), count: list.length })).sort((a, b) => b.pct - a.pct);
    $('#perf-categories').innerHTML = cats.length ? cats.map(c => barRow(c.name, c.pct, `${c.count} tarefa(s)`)).join('') : '<div class="empty">Sem dados.</div>';
    const byTask = [...tasks].map(t => ({ name: t.title, pct: t.status === 'concluida' ? 100 : Number(t.progress || 0), meta: typeLabel(t.type) })).sort((a, b) => b.pct - a.pct).slice(0, 8);
    $('#perf-tasks').innerHTML = byTask.length ? byTask.map(t => barRow(t.name, t.pct, t.meta)).join('') : '<div class="empty">Sem tarefas.</div>';
  }
  function barRow(name, pct, meta) {
    return `<div class="bar-row"><div class="bar-row__top"><span>${esc(name)}</span><span>${pct}% · ${esc(meta)}</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>`;
  }

  // Tasks CRUD
  function openModal(task = null) {
    $('#modal-title').textContent = task ? 'Editar tarefa' : 'Nova tarefa';
    $('#task-id').value = task?.id || '';
    $('#task-title').value = task?.title || '';
    $('#task-type').value = task?.type || 'trabalho';
    $('#task-category').value = task?.category || '';
    $('#task-due').value = task?.due || '';
    $('#task-priority').value = task?.priority || 'media';
    $('#task-status').value = task?.status || 'pendente';
    $('#task-progress').value = task?.progress ?? 0;
    $('#task-progress-out').textContent = (task?.progress ?? 0) + '%';
    $('#task-notes').value = task?.notes || '';
    $('#task-modal').showModal();
  }
  function closeModal() { $('#task-modal').close(); }
  function upsertTask(e) {
    e.preventDefault();
    const id = $('#task-id').value;
    const data = {
      title: $('#task-title').value.trim(), type: $('#task-type').value, category: $('#task-category').value.trim(),
      due: $('#task-due').value, priority: $('#task-priority').value, status: $('#task-status').value,
      progress: Number($('#task-progress').value), notes: $('#task-notes').value.trim()
    };
    if (!data.title) return;
    if (data.status === 'concluida') data.progress = 100;
    if (id) { const i = tasks.findIndex(t => t.id === id); if (i >= 0) tasks[i] = { ...tasks[i], ...data }; toast('Tarefa atualizada.'); }
    else { tasks.unshift({ id: uid(), ...data }); toast('Tarefa criada.'); }
    saveTasks(); render(); closeModal();
  }
  function toggleDone(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (t.status === 'concluida') { t.status = 'pendente'; t.progress = Math.min(t.progress, 95); }
    else { t.status = 'concluida'; t.progress = 100; }
    saveTasks(); render();
  }
  function delTask(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (!confirm(`Excluir "${t.title}"?`)) return;
    tasks = tasks.filter(x => x.id !== id); saveTasks(); render(); toast('Tarefa excluída.');
  }

  // Gmail
  function getGmailCfg() { return { clientId: '', ...loadGmailCfg() }; }
  function setGmailStatus(text, ok = false) {
    const el = $('#gmail-status');
    el.textContent = text;
    el.classList.toggle('is-ok', ok);
  }
  function initGmailUI() {
    const cfg = getGmailCfg();
    $('#gmail-client-id').value = cfg.clientId || '';
    $('#gmail-disconnect-btn').hidden = !gmailAccessToken;
    $('#gmail-connect-btn').hidden = !!gmailAccessToken;
    setGmailStatus(gmailAccessToken ? 'Conectado' : 'Não conectado', !!gmailAccessToken);
  }

  function ensureGmailTokenClient() {
    const { clientId } = getGmailCfg();
    if (!clientId) { toast('Configure o Client ID do Google.'); $('#gmail-config').hidden = false; return null; }
    if (!window.google?.accounts?.oauth2) { toast('Biblioteca do Google não carregou. Tente novamente.'); return null; }
    if (!gmailTokenClient || gmailTokenClient._clientId !== clientId) {
      gmailTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: GMAIL_SCOPE,
        callback: (resp) => {
          if (resp.error) { console.error(resp); toast('Permissão não concedida.'); return; }
          gmailAccessToken = resp.access_token;
          initGmailUI();
          fetchImportantEmails();
        }
      });
      gmailTokenClient._clientId = clientId;
    }
    return gmailTokenClient;
  }

  function connectGmail() {
    const client = ensureGmailTokenClient();
    if (!client) return;
    client.requestAccessToken({ prompt: gmailAccessToken ? '' : 'consent' });
  }
  function disconnectGmail() {
    if (gmailAccessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(gmailAccessToken, () => {});
    }
    gmailAccessToken = null; gmailItems = [];
    initGmailUI(); renderGmail();
    toast('Gmail desconectado.');
  }

  async function gmailApi(path) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      headers: { Authorization: `Bearer ${gmailAccessToken}` }
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gmail API ${res.status}: ${txt}`);
    }
    return res.json();
  }

  function header(msg, name) {
    return (msg.payload?.headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  }
  function decodeB64(data = '') {
    try { return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/')))); } catch { return ''; }
  }
  function getBody(msg) {
    const p = msg.payload; if (!p) return '';
    if (p.body?.data) return decodeB64(p.body.data);
    const parts = p.parts || [];
    const plain = parts.find(x => x.mimeType === 'text/plain' && x.body?.data);
    if (plain) return decodeB64(plain.body.data);
    const html = parts.find(x => x.mimeType === 'text/html' && x.body?.data);
    if (html) return decodeB64(html.body.data).replace(/<[^>]+>/g, ' ');
    for (const part of parts) { if (part.parts) { const nested = getBody({ payload: part }); if (nested) return nested; } }
    return msg.snippet || '';
  }

  function classifyEmail(subject, from, body, date) {
    const text = `${subject} ${body}`.toLowerCase();
    const rules = [
      { type: 'prazo', label: 'Prazo', kws: ['prazo', 'deadline', 'entrega', 'vencimento', 'due', 'até', 'ate dia', 'limite'] },
      { type: 'reuniao', label: 'Reunião', kws: ['reunião', 'reuniao', 'meeting', 'call', 'agenda', 'convite', 'meet', 'zoom', 'teams'] },
      { type: 'financeiro', label: 'Financeiro', kws: ['fatura', 'pagamento', 'boleto', 'nota fiscal', 'invoice', 'pix', 'cobrança', 'cobranca', 'recibo'] },
      { type: 'tarefa', label: 'Tarefa', kws: ['tarefa', 'ação', 'acao', 'pendente', 'solicito', 'favor', 'confirmar', 'enviar', 'revisar', 'entregar', 'atividade', 'trabalho', 'prova', 'assignment'] },
    ];
    let best = null, score = 0;
    for (const r of rules) {
      const s = r.kws.reduce((a, k) => a + (text.includes(k) ? 1 : 0), 0);
      if (s > score) { score = s; best = r; }
    }
    const important = score > 0 || /urgent|importante|importante|asap/i.test(text);
    if (!important) return null;
    const dateMatch = text.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/);
    const detail = dateMatch ? `Data mencionada: ${dateMatch[1]}` : (best?.label || 'Importante');
    return { kind: best?.type || 'tarefa', kindLabel: best?.label || 'Importante', detail };
  }

  async function fetchImportantEmails() {
    if (!gmailAccessToken) return;
    setGmailStatus('Carregando...', true);
    $('#gmail-body').innerHTML = '<tr><td colspan="6"><div class="empty">Buscando e-mails importantes...</div></td></tr>';
    try {
      const list = await gmailApi('/messages?maxResults=25&q=newer_than:30d');
      const msgs = list.messages || [];
      if (!msgs.length) { gmailItems = []; setGmailStatus('Conectado', true); renderGmail(); return; }
      const details = await Promise.all(msgs.map(m => gmailApi(`/messages/${m.id}?format=full`).catch(() => null)));
      gmailItems = details.filter(Boolean).map(msg => {
        const subject = header(msg, 'Subject') || '(Sem assunto)';
        const from = header(msg, 'From').replace(/<.*?>/g, '').replace(/"/g, '').trim() || 'Remetente';
        const date = header(msg, 'Date');
        const body = getBody(msg).slice(0, 2000);
        const cls = classifyEmail(subject, from, body, date);
        if (!cls) return null;
        return {
          id: msg.id, subject, from, date: date ? new Date(date).toLocaleDateString('pt-BR') : '-',
          snippet: msg.snippet || '', kind: cls.kind, kindLabel: cls.kindLabel, detail: cls.detail
        };
      }).filter(Boolean);
      setGmailStatus(`Conectado · ${gmailItems.length} item(ns)`, true);
      renderGmail();
    } catch (err) {
      console.error(err);
      setGmailStatus('Erro ao conectar', false);
      $('#gmail-body').innerHTML = `<tr><td colspan="6"><div class="empty">Não foi possível ler o Gmail. Verifique o Client ID, a permissão e se a Gmail API está ativa.</div></td></tr>`;
      if (String(err).includes('401')) { gmailAccessToken = null; initGmailUI(); }
    }
  }

  function renderGmail() {
    const body = $('#gmail-body');
    const filter = $('#gmail-filter')?.value || 'all';
    const items = gmailItems.filter(i => filter === 'all' || i.kind === filter);
    if (!gmailAccessToken) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty">Conecte seu Gmail para montar uma planilha com itens importantes. O acesso é somente leitura e depende da sua permissão.</div></td></tr>';
      return;
    }
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty">Nenhum item importante encontrado neste filtro.</div></td></tr>';
      return;
    }
    body.innerHTML = items.map(i => `<tr>
      <td><strong>${esc(i.subject)}</strong><div class="item__meta">${esc(i.snippet).slice(0, 90)}</div></td>
      <td><span class="badge">${esc(i.kindLabel)}</span></td>
      <td>${esc(i.from)}</td>
      <td>${esc(i.date)}</td>
      <td>${esc(i.detail)}</td>
      <td><button class="btn btn--ghost btn--sm" data-gmail-task="${esc(i.id)}">Criar tarefa</button></td>
    </tr>`).join('');
    $$('[data-gmail-task]').forEach(b => b.onclick = () => createTaskFromGmail(b.dataset.gmailTask));
  }

  function createTaskFromGmail(id) {
    const item = gmailItems.find(x => x.id === id); if (!item) return;
    const exists = tasks.some(t => t.notes?.includes(`gmail:${id}`));
    if (exists) { toast('Essa tarefa já foi criada.'); return; }
    tasks.unshift({
      id: uid(), title: item.subject.slice(0, 90), type: 'trabalho',
      category: item.kindLabel, due: '', priority: item.kind === 'prazo' ? 'alta' : 'media',
      status: 'pendente', progress: 0, notes: `Importado do Gmail (${item.from}). ${item.detail}. gmail:${id}`
    });
    saveTasks(); render(); toast('Tarefa criada a partir do Gmail.');
  }

  // Navigation / UI
  function setView(view) {
    $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + view));
    const names = { dashboard: ['Visão geral', 'Painel'], tasks: ['Organização', 'Tarefas'], sheet: ['Visão em tabela', 'Planilha'], gmail: ['Integração', 'Gmail'], performance: ['Acompanhamento', 'Desempenho'] };
    const n = names[view] || ['Organiza', 'Organiza'];
    $('#view-eyebrow').textContent = n[0];
    $('#view-title').textContent = n[1];
    closeSidebar();
  }
  function openSidebar() { $('#sidebar').classList.add('is-open'); $('#menu-btn').setAttribute('aria-expanded', 'true'); }
  function closeSidebar() { $('#sidebar').classList.remove('is-open'); $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  function showTip() { $('#help-text').textContent = tips[tipIndex % tips.length]; }
  function openHelp() { $('#help-card').classList.add('is-open'); $('#help-fab').setAttribute('aria-expanded', 'true'); showTip(); }
  function closeHelp() { $('#help-card').classList.remove('is-open'); $('#help-fab').setAttribute('aria-expanded', 'false'); }

  function bind() {
    $$('.nav__item').forEach(b => b.onclick = () => setView(b.dataset.view));
    $('#menu-btn').onclick = () => $('#sidebar').classList.contains('is-open') ? closeSidebar() : openSidebar();
    document.addEventListener('click', e => {
      if (window.innerWidth <= 860 && $('#sidebar').classList.contains('is-open') && !$('#sidebar').contains(e.target) && !$('#menu-btn').contains(e.target)) closeSidebar();
    });
    $('#new-task-btn').onclick = () => openModal();
    $('#modal-close').onclick = closeModal; $('#task-cancel').onclick = closeModal;
    $('#task-form').onsubmit = upsertTask;
    $('#task-progress').oninput = e => $('#task-progress-out').textContent = e.target.value + '%';
    $('#filter-type').onchange = renderTasksTable; $('#filter-status').onchange = renderTasksTable;
    $('#task-modal').addEventListener('click', e => { if (e.target.id === 'task-modal') closeModal(); });

    $('#help-fab').onclick = () => $('#help-card').classList.contains('is-open') ? closeHelp() : openHelp();
    $('#help-close').onclick = closeHelp;
    $('#help-next').onclick = () => { tipIndex = (tipIndex + 1) % tips.length; showTip(); };

    $('#gmail-config-btn').onclick = () => { $('#gmail-config').hidden = !$('#gmail-config').hidden; };
    $('#gmail-save-config').onclick = () => {
      const clientId = $('#gmail-client-id').value.trim();
      saveGmailCfg({ clientId });
      gmailTokenClient = null;
      toast(clientId ? 'Configuração salva.' : 'Client ID removido.');
      initGmailUI();
    };
    $('#gmail-connect-btn').onclick = connectGmail;
    $('#gmail-disconnect-btn').onclick = disconnectGmail;
    $('#gmail-refresh-btn').onclick = () => { if (!gmailAccessToken) { toast('Conecte o Gmail primeiro.'); return; } fetchImportantEmails(); };
    $('#gmail-filter').onchange = renderGmail;
  }

  bind();
  initGmailUI();
  render();
  showTip();
})();