/* ============================================================
   McPanel — app.js
   SPA em JS puro: rotas por hash, API REST do painel,
   console via SSE e polling de jobs.
   ============================================================ */
(() => {
  'use strict';

  // ------------------------------------------------------------------
  // Estado global
  // ------------------------------------------------------------------
  const state = {
    status: null,
    instances: [],
    software: null,      // { software: [...], fabricLoaders: [...] }
    route: { name: 'dashboard', params: {} },
    jobs: new Map(),     // jobId → { onDone }
    lastLines: new Map(), // instanceId → seq
    files: { path: '', data: null },
    jobsSeen: new Set(),
  };

  const watchers = []; // cleanups da view atual
  let eventSource = null;

  // ------------------------------------------------------------------
  // Helpers DOM
  // ------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function fmtBytes(n) {
    if (n == null || isNaN(n)) return '-';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, v = Number(n);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
  }

  function fmtDur(ms) {
    if (ms == null) return '-';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  function fmtAgo(ts) {
    if (!ts) return '-';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h atrás`;
    return new Date(ts).toLocaleDateString('pt-BR');
  }

  function fmtDownloads(n) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n || 0);
  }

  // ------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------
  class ApiError extends Error {
    constructor(msg, status) { super(msg); this.status = status; }
  }

  async function api(path, { method = 'GET', body } = {}) {
    const opt = { method, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, opt);
    } catch {
      throw new ApiError('Não consegui falar com o painel. Ele ainda está rodando?', 0);
    }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 300) }; }
    if (!res.ok) throw new ApiError(data.error || `Erro HTTP ${res.status}`, res.status);
    return data;
  }

  async function apiRaw(path, { method = 'PUT', body, contentType = 'application/octet-stream' } = {}) {
    let res;
    try {
      res = await fetch(path, { method, headers: { 'Content-Type': contentType }, body });
    } catch {
      throw new ApiError('Falha de conexão com o painel.', 0);
    }
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) throw new ApiError(data.error || `Erro HTTP ${res.status}`, res.status);
    return data;
  }

  // ------------------------------------------------------------------
  // Toast / Modal
  // ------------------------------------------------------------------
  function toast(message, type = 'info', title = null, timeout = 4600) {
    const box = $('#toasts');
    const icon = { info: 'ℹ', success: '✓', error: '✕', warn: '⚠' }[type] || 'ℹ';
    const node = el(`<div class="toast ${type}">
      <b>${icon} ${esc(title || { info: 'Aviso', success: 'Pronto', error: 'Erro', warn: 'Atenção' }[type])}</b>
      <span>${esc(message)}</span>
    </div>`);
    box.appendChild(node);
    const kill = () => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 320);
    };
    node.addEventListener('click', kill);
    if (timeout) setTimeout(kill, timeout);
    return node;
  }

  function closeModal() {
    const bd = $('#modal-backdrop');
    bd.hidden = true;
    $('#modal').innerHTML = '';
  }

  // modal → Promise resolve(userClickedConfirm)
  function modal({ title, body, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false, hideConfirm = false }) {
    return new Promise((resolve) => {
      const bd = $('#modal-backdrop');
      const m = $('#modal');
      m.innerHTML = `
        <h3>${esc(title)}</h3>
        <div class="m-body">${body}</div>
        <div class="m-actions">
          <button class="btn" data-act="cancel">${esc(cancelText)}</button>
          ${hideConfirm ? '' : `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${esc(confirmText)}</button>`}
        </div>`;
      bd.hidden = false;
      const done = (v) => { closeModal(); cleanup(); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      const onBd = (e) => { if (e.target === bd && danger) done(false); };
      function cleanup() {
        document.removeEventListener('keydown', onKey);
        bd.removeEventListener('click', onBd);
      }
      document.addEventListener('keydown', onKey);
      bd.addEventListener('click', onBd);
      $('[data-act=cancel]', m).onclick = () => done(false);
      const ok = $('[data-act=ok]', m);
      if (ok) ok.onclick = () => done(true);
      setTimeout(() => {
        const f = m.querySelector('input,select,textarea');
        if (f) f.focus();
      }, 60);
    });
  }

  async function confirmDialog(message, { title = 'Confirmar', confirmText = 'Confirmar', bodyExtra = '' } = {}) {
    return modal({
      title,
      body: `<p>${esc(message)}</p>${bodyExtra}`,
      confirmText,
      danger: true,
    });
  }

  // ------------------------------------------------------------------
  // Jobs (dock de progresso + polling)
  // ------------------------------------------------------------------
  const jobState = new Map(); // id → job (último snapshot)

  function watchJob(jobId, { onDone = null, silent = false } = {}) {
    if (!jobId) return;
    state.jobs.set(jobId, { onDone });
    if (!silent) renderJobDock();
    pollOnce(jobId).catch(() => {});
  }

  async function pollOnce(jobId) {
    const meta = state.jobs.get(jobId);
    if (!meta) return;
    let job;
    try {
      ({ job } = await api(`/api/jobs/${jobId}`));
    } catch (err) {
      if (err.status === 404) { state.jobs.delete(jobId); renderJobDock(); }
      return;
    }
    const prev = jobState.get(jobId);
    jobState.set(jobId, job);
    const finished = job.status !== 'running';
    renderJobDock();

    if (finished && (!prev || prev.status === 'running')) {
      if (job.status === 'done') {
        if (!silentJob(job)) toast(job.message || `${job.label} concluído.`, 'success');
        if (meta.onDone) { try { meta.onDone(job); } catch (e) { console.error(e); } }
      } else {
        toast(job.error || `${job.label} falhou.`, 'error', 'Falha na operação', 9000);
        if (meta.onDone) { try { meta.onDone(job); } catch (e) { console.error(e); } }
      }
      state.jobs.delete(jobId);
      refreshInstances().catch(() => {});
      refreshStatus().catch(() => {});
      setTimeout(renderJobDock, 4000);
    }
  }

  function silentJob(job) {
    return ['start', 'stop', 'restart'].includes(job.type);
  }

  function jobPct(job) {
    return job.progress == null ? null : Math.round(job.progress * 100);
  }

  function renderJobDock() {
    const dock = $('#jobdock');
    const ids = [...state.jobs.keys()];
    const running = ids.map((i) => jobState.get(i)).filter((j) => j && j.status === 'running');
    const justFinished = [...jobState.entries()]
      .filter(([id, j]) => j.status !== 'running' && state.jobsSeen.has(id) === false)
      .slice(-2);

    // jobs recém-concluídos que já não são assistidos
    const list = [];
    for (const j of running) list.push(j);
    for (const [, j] of justFinished) list.push(j);

    if (!list.length) {
      dock.hidden = true;
      dock.innerHTML = '';
      // marca tudo como visto
      for (const [id, j] of jobState) if (j.status !== 'running') state.jobsSeen.add(id);
      return;
    }
    dock.hidden = false;
    dock.innerHTML = list.map((job) => {
      const pct = jobPct(job);
      const cls = job.status === 'error' ? 'error' : job.status === 'done' ? 'done' : '';
      const statusTxt = job.status === 'running' ? 'executando' : job.status === 'done' ? 'concluído' : 'erro';
      const badge = job.status === 'running' ? 'blue' : job.status === 'done' ? 'green' : 'red';
      const log = (job.log || []).slice(-6).join('\n');
      return `<div class="jobcard ${cls}" data-job="${job.id}">
        <div class="jt">
          <span>${esc(job.label || job.type)}</span>
          <span class="st badge ${badge}">${statusTxt}</span>
        </div>
        ${job.status === 'running' ? `<div class="progress ${pct == null ? 'indet' : ''}"><i style="width:${pct == null ? 34 : pct}%"></i></div>` : ''}
        <div class="jm">${esc(job.message || job.error || '')}${pct != null && job.status === 'running' ? ` · ${pct}%` : ''}</div>
        ${log ? `<div class="log">${esc(log)}</div>` : ''}
      </div>`;
    }).join('');
    for (const [id, j] of jobState) if (j.status !== 'running') state.jobsSeen.add(id);
  }

  // ------------------------------------------------------------------
  // Polling geral
  // ------------------------------------------------------------------
  async function refreshStatus() {
    try {
      state.status = await api('/api/status');
      paintSidebar();
    } catch (err) {
      const h = $('#health');
      if (h) { h.className = 'health bad'; $('.health-text', h).textContent = 'painel offline'; }
    }
  }

  async function refreshInstances() {
    try {
      const data = await api('/api/instances');
      state.instances = data.instances || [];
      paintLiveBits();
      return state.instances;
    } catch {
      return state.instances;
    }
  }

  function paintSidebar() {
    const s = state.status;
    if (!s) return;
    const h = $('#health');
    const running = s.running || 0;
    const jobs = s.jobs || 0;
    h.className = 'health' + (jobs ? ' warn' : '');
    $('.health-text', h).textContent = jobs
      ? `${jobs} tarefa(s) em andamento`
      : running
        ? `${running} servidor(es) no ar`
        : 'painel pronto';
    $('#brand-sub').textContent = `v${s.panel} · ${s.software.length} softwares`;
    $('#sidebar-meta').innerHTML =
      `Node ${esc(s.node)}<br>${esc(s.dataDir)}`;
  }

  function paintLiveBits() {
    // badge de status + botões no cabeçalho do servidor
    const badge = $('#srv-status');
    if (badge) {
      const inst = currentInstance();
      if (inst) {
        badge.className = `badge ${statusBadge(inst.status)}`;
        badge.textContent = statusLabel(inst.status);
        const up = $('#srv-uptime');
        if (up) up.textContent = inst.uptimeMs ? fmtDur(inst.uptimeMs) : '—';
        updateServerButtons(inst);
      }
    }
    // cards da lista de servidores (se existirem)
    $$('.server-card[data-id]').forEach((card) => {
      const inst = state.instances.find((i) => i.id === card.dataset.id);
      if (!inst) return;
      card.classList.toggle('running', inst.status === 'running');
      const st = $('.st-badge', card);
      if (st) { st.className = `badge st-badge ${statusBadge(inst.status)}`; st.textContent = statusLabel(inst.status); }
      const up = $('.st-uptime', card);
      if (up) up.textContent = inst.uptimeMs ? fmtDur(inst.uptimeMs) : '—';
      const btns = $('.server-actions', card);
      if (btns) btns.innerHTML = serverCardButtons(inst);
    });
    // estatísticas do painel
    const statRunning = $('#stat-running');
    if (statRunning) {
      const total = state.instances.length;
      const running = state.instances.filter((i) => i.status === 'running').length;
      const installing = state.instances.filter((i) => ['installing', 'starting', 'stopping'].includes(i.status)).length;
      $('#stat-total').textContent = total;
      statRunning.textContent = running;
      $('#stat-stopped').textContent = total - running - installing;
      $('#stat-installing').textContent = installing;
    }
  }

  // ------------------------------------------------------------------
  // Roteador
  // ------------------------------------------------------------------
  function parseHash() {
    const raw = (location.hash || '#/').replace(/^#/, '');
    const parts = raw.split('/').filter(Boolean);
    if (!parts.length) return { name: 'dashboard', params: {} };
    if (parts[0] === 'servers') return { name: 'servers', params: {} };
    if (parts[0] === 'new') return { name: 'new', params: {} };
    if (parts[0] === 'jobs') return { name: 'jobs', params: {} };
    if (parts[0] === 'system') return { name: 'system', params: {} };
    if (parts[0] === 'server' && parts[1]) {
      return { name: 'server', params: { id: parts[1], tab: parts[2] || 'console' } };
    }
    return { name: 'dashboard', params: {} };
  }

  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function cleanupView() {
    if (eventSource) { eventSource.close(); eventSource = null; }
    for (const fn of watchers.splice(0)) {
      try { fn(); } catch { /* ignore */ }
    }
  }

  function setActiveNav() {
    const r = state.route;
    const key = r.name === 'server' ? 'servers' : r.name;
    $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
    document.title = r.name === 'server'
      ? `${(currentInstance() || {}).name || 'Servidor'} — McPanel`
      : 'McPanel — Servidores Minecraft';
  }

  async function render() {
    cleanupView();
    state.route = parseHash();
    setActiveNav();
    const main = $('#main');
    main.innerHTML = `<div class="loading"><span class="spin"></span> carregando…</div>`;
    try {
      switch (state.route.name) {
        case 'servers': await viewServers(main); break;
        case 'new': await viewNew(main); break;
        case 'jobs': await viewJobs(main); break;
        case 'system': await viewSystem(main); break;
        case 'server': await viewServer(main); break;
        default: await viewDashboard(main);
      }
    } catch (err) {
      main.innerHTML = `<div class="empty">
        <div class="big">⚠</div>
        <h3>Não consegui carregar esta tela</h3>
        <p>${esc(err.message)}</p>
        <button class="btn btn-primary" onclick="location.hash='#/'">Voltar ao painel</button>
      </div>`;
    }
    paintLiveBits();
  }

  function currentInstance() {
    return state.instances.find((i) => i.id === state.route.params.id) || null;
  }

  // ------------------------------------------------------------------
  // Blocos reutilizáveis
  // ------------------------------------------------------------------
  function statusBadge(st) {
    return {
      running: 'green', stopped: 'gray', starting: 'amber', stopping: 'amber',
      installing: 'blue', orphan: 'purple', error: 'red', deleting: 'red',
    }[st] || 'gray';
  }

  function statusLabel(st) {
    return {
      running: 'no ar', stopped: 'parado', starting: 'iniciando', stopping: 'parando',
      installing: 'instalando', orphan: 'processo órfão', error: 'erro', deleting: 'excluindo',
    }[st] || st;
  }

  function serverCardButtons(inst) {
    const busy = ['installing', 'deleting', 'starting', 'stopping'].includes(inst.status);
    const st = inst.status;
    if (st === 'orphan') {
      return `<button class="btn btn-sm btn-danger" data-act="kill">Encerrar processo</button>
              <a class="btn btn-sm" href="#/server/${inst.id}/console">Console</a>`;
    }
    if (st === 'installing' || st === 'deleting') {
      return `<button class="btn btn-sm" disabled><span class="spin"></span> ${st === 'deleting' ? 'excluindo' : 'instalando'}</button>
              <a class="btn btn-sm" href="#/server/${inst.id}/console">Detalhes</a>`;
    }
    const startBtn = st === 'running'
      ? `<button class="btn btn-sm" data-act="stop" ${busy ? 'disabled' : ''}>Parar</button>`
      : `<button class="btn btn-sm btn-primary" data-act="start" ${busy ? 'disabled' : ''}>Iniciar</button>`;
    return `${startBtn}
      <a class="btn btn-sm" href="#/server/${inst.id}/console">Console</a>
      <button class="btn btn-sm btn-ghost" data-act="more" title="Mais ações">⋯</button>`;
  }

  function serverCard(inst) {
    const swIcon = { paper: '⚡', purpur: '🥒', vanilla: '🍦', fabric: '🧵', arclight: '🔥' }[inst.software] || '▣';
    return `<div class="server-card ${inst.status === 'running' ? 'running' : ''}" data-id="${inst.id}">
      <div class="server-top">
        <div class="server-icon">${swIcon}</div>
        <div style="min-width:0;flex:1">
          <h3 class="server-name">${esc(inst.name)}</h3>
          <div class="server-meta">
            <span>${esc(inst.softwareName)} ${esc(inst.version)}</span>
            <span>·</span>
            <span>:${inst.port}</span>
            <span>·</span>
            <span class="st-uptime">${inst.uptimeMs ? fmtDur(inst.uptimeMs) : '—'}</span>
          </div>
        </div>
        <span class="badge st-badge ${statusBadge(inst.status)}">${statusLabel(inst.status)}</span>
      </div>
      <div class="server-props">
        <span class="chip"><b>${inst.ram}</b> MB</span>
        <span class="chip"><b>${inst.maxPlayers}</b> jogadores</span>
        <span class="chip">${inst.onlineMode ? '🔒 original' : '🔓 aberto'}</span>
        ${inst.modpack ? `<span class="chip">🧰 ${esc(inst.modpack.name)}</span>` : ''}
        ${inst.loader ? `<span class="chip">${esc(inst.loader)}${inst.loaderVersion ? ' ' + esc(inst.loaderVersion) : ''}</span>` : ''}
      </div>
      ${inst.status === 'error' && inst.error ? `<div class="banner danger" style="margin:0"><span class="bi">✕</span><span>${esc(String(inst.error).slice(0, 400))}</span></div>` : ''}
      <div class="server-actions">${serverCardButtons(inst)}</div>
    </div>`;
  }

  // Delegação de cliques nos cards de servidor
  function bindServerCards(root) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('[data-id]');
      if (!card) return;
      const id = card.dataset.id;
      const act = btn.dataset.act;
      if (act === 'more') { await moreActions(id); return; }
      await instanceAction(id, act, btn);
    });
  }

  async function instanceAction(id, act, btn) {
    if (btn) btn.disabled = true;
    try {
      if (act === 'kill') {
        const ok = await confirmDialog('Encerrar o processo antigo que ainda está rodando?', { title: 'Encerrar processo', confirmText: 'Encerrar' });
        if (!ok) return;
        await api(`/api/instances/${id}/kill`, { method: 'POST', body: {} });
        toast('Processo encerrado.', 'success');
      } else if (act === 'delete') {
        const inst = state.instances.find((i) => i.id === id);
        const ok = await confirmDialog(
          `Isso apaga PERMANENTEMENTE a pasta do servidor, mundo, plugins e mods. Não dá pra desfazer.`,
          { title: `Excluir "${inst ? inst.name : id}"?`, confirmText: 'Excluir tudo' }
        );
        if (!ok) return;
        const { jobId } = await api(`/api/instances/${id}`, { method: 'DELETE' });
        watchJob(jobId, { onDone: () => { navigate('#/servers'); } });
        toast('Excluindo servidor…', 'info');
        navigate('#/servers');
      } else {
        const { jobId } = await api(`/api/instances/${id}/${act}`, { method: 'POST', body: {} });
        watchJob(jobId);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      if (btn && document.contains(btn)) btn.disabled = false;
      setTimeout(() => refreshInstances().catch(() => {}), 350);
    }
  }

  async function moreActions(id) {
    const inst = state.instances.find((i) => i.id === id);
    if (!inst) return;
    const choice = await new Promise((resolve) => {
      const bd = $('#modal-backdrop'), m = $('#modal');
      m.innerHTML = `
        <h3>${esc(inst.name)}</h3>
        <div class="m-body">
          <p class="muted small">Escolha uma ação para este servidor.</p>
          <div class="col" style="margin-top:14px">
            <button class="btn btn-block" data-c="restart">↻ Reiniciar</button>
            <button class="btn btn-block" data-c="reinstall">⟳ Reinstalar jar (${esc(inst.softwareName)} ${esc(inst.version)})</button>
            <a class="btn btn-block" href="#/server/${inst.id}/config" data-c="config">⚙ Configurações</a>
            <a class="btn btn-block" href="#/server/${inst.id}/backups" data-c="backups">🗄 Backups</a>
            <button class="btn btn-block btn-danger" data-c="delete">🗑 Excluir servidor</button>
          </div>
        </div>
        <div class="m-actions"><button class="btn" data-act="cancel">Fechar</button></div>`;
      bd.hidden = false;
      const close = (v) => { closeModal(); resolve(v); };
      $('[data-act=cancel]', m).onclick = () => close(null);
      m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]');
        if (b) close(b.dataset.c);
      }, { once: false });
    });
    if (choice === 'delete') await instanceAction(id, 'delete');
    else if (choice === 'restart' || choice === 'reinstall') await instanceAction(id, choice);
    else if (choice) navigate(`#/server/${id}/${choice}`);
  }

  // ------------------------------------------------------------------
  // View: Dashboard
  // ------------------------------------------------------------------
  async function viewDashboard(root) {
    await Promise.all([refreshStatus(), refreshInstances()]);
    const s = state.status || {};
    const total = state.instances.length;
    const running = state.instances.filter((i) => i.status === 'running').length;
    const installing = state.instances.filter((i) => ['installing', 'starting', 'stopping'].includes(i.status)).length;
    const javaOk = s.java && (s.java.runtimes['21'] || s.java.runtimes['25'] || s.java.system);
    const recent = state.instances.slice(0, 6);

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Painel</h1>
          <p class="page-sub">Crie e gerencie servidores Minecraft de verdade na sua máquina — com plugins, mods e modpacks.</p>
        </div>
        <div class="page-actions">
          <a class="btn" href="#/system">♥ Sistema</a>
          <a class="btn btn-primary" href="#/new">＋ Criar servidor</a>
        </div>
      </div>

      ${javaOk ? '' : `<div class="banner info">
        <span class="bi">☕</span>
        <div>
          <b>Java ainda não está instalado</b> — sem problema: o painel baixa um JRE automaticamente no primeiro start.
          Quer adiantar agora? <a href="#" id="setup-java">Clique aqui para preparar o Java</a>.
        </div>
      </div>`}

      <div class="grid grid-4 mb">
        <div class="stat text-green"><div class="k">Servidores</div><div class="v" id="stat-total">${total}</div><div class="d">criados neste painel</div></div>
        <div class="stat text-green"><div class="k">No ar</div><div class="v" id="stat-running">${running}</div><div class="d">rodando agora</div></div>
        <div class="stat"><div class="k">Parados</div><div class="v" id="stat-stopped">${total - running - installing}</div><div class="d">aguardando início</div></div>
        <div class="stat text-amber"><div class="k">Trabalhando</div><div class="v" id="stat-installing">${installing}</div><div class="d">instalando/iniciando</div></div>
      </div>

      <div class="card mb">
        <div class="card-title">Seus servidores <a class="hint" href="#/servers">ver todos →</a></div>
        ${state.instances.length
          ? `<div class="grid grid-3">${recent.map(serverCard).join('')}</div>`
          : `<div class="empty">
              <div class="big">⛏</div>
              <h3>Nenhum servidor ainda</h3>
              <p>Crie seu primeiro servidor Minecraft. O painel baixa o jar, prepara o Java e deixa tudo pronto pra você só clicar em <b>Iniciar</b>.</p>
              <a class="btn btn-primary" href="#/new">＋ Criar primeiro servidor</a>
            </div>`}
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Como funciona</div>
          <ol class="col small muted" style="line-height:2;padding-left:18px;margin:0">
            <li><b class="text-green">Criar</b> — escolha software (Paper, Fabric, Arclight…), versão e RAM.</li>
            <li><b class="text-green">Instalar</b> — o painel baixa o jar, aceita o EULA e instala AuthMe se for modo aberto.</li>
            <li><b class="text-green">Iniciar</b> — Java é baixado automaticamente se você não tiver.</li>
            <li><b class="text-green">Jogar</b> — conecte em <span class="mono text-green">localhost:${total ? state.instances[0].port : 25565}</span>.</li>
          </ol>
        </div>
        <div class="card">
          <div class="card-title">Ambiente</div>
          <dl class="kv">
            <dt>Painel</dt><dd>v${esc(s.panel || '?')} · Node ${esc(s.node || '?')}</dd>
            <dt>Pasta de dados</dt><dd class="mono small">${esc(s.dataDir || '—')}</dd>
            <dt>Softwares</dt><dd>${esc((s.software || []).join(', '))}</dd>
            <dt>Java</dt><dd>${javaOk ? '✓ disponível (baixado sob demanda)' : '— será baixado no primeiro start'}</dd>
            <dt>Uptime do painel</dt><dd>${fmtDur(s.uptimeMs)}</dd>
          </dl>
        </div>
      </div>`;

    bindServerCards(root);
    const sj = $('#setup-java');
    if (sj) sj.onclick = async (e) => {
      e.preventDefault();
      try {
        const { jobId } = await api('/api/runtime/setup', { method: 'POST', body: {} });
        watchJob(jobId, { onDone: () => { toast('Java instalado com sucesso.', 'success'); render(); } });
      } catch (err) { toast(err.message, 'error'); }
    };

    // loop de atualização enquanto estiver no dashboard
    const t = setInterval(() => refreshInstances().catch(() => {}), 2500);
    watchers.push(() => clearInterval(t));
  }

  // ------------------------------------------------------------------
  // View: lista de servidores
  // ------------------------------------------------------------------
  async function viewServers(root) {
    await refreshInstances();
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Servidores</h1>
          <p class="page-sub">Todos os servidores criados neste painel. Clique em um card para abrir o console, players, plugins e backups.</p>
        </div>
        <div class="page-actions"><a class="btn btn-primary" href="#/new">＋ Novo servidor</a></div>
      </div>
      <div id="servers-grid"></div>`;

    const grid = $('#servers-grid');
    const paint = () => {
      if (!state.instances.length) {
        grid.innerHTML = `<div class="empty">
          <div class="big">▤</div>
          <h3>Nenhum servidor</h3>
          <p>Comece criando um servidor Paper pra testar — é o mais simples e rápido.</p>
          <a class="btn btn-primary" href="#/new">＋ Criar servidor</a>
        </div>`;
        return;
      }
      grid.innerHTML = `<div class="grid grid-3">${state.instances.map(serverCard).join('')}</div>`;
    };
    paint();
    bindServerCards(grid);
    const t = setInterval(() => { refreshInstances().then(paint).catch(() => {}); }, 2500);
    watchers.push(() => clearInterval(t));
  }

  // ------------------------------------------------------------------
  // View: criar servidor
  // ------------------------------------------------------------------
  async function viewNew(root) {
    if (!state.software) {
      state.software = await api('/api/software').catch(() => ({ software: [], fabricLoaders: [] }));
    }
    const list = state.software.software || [];
    const loaders = state.software.fabricLoaders || [];
    const first = list[0] || { id: 'paper', versions: [] };

    root.innerHTML = `
      <div class="breadcrumb"><a href="#/">Painel</a><span class="sep">/</span><span>Criar servidor</span></div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Criar servidor</h1>
          <p class="page-sub">Escolha o software, a versão e quanto de RAM dar. O download e a instalação são feitos automaticamente.</p>
        </div>
      </div>

      <form id="new-form" class="col" style="gap:18px">
        <div class="card">
          <div class="card-title">1 · Software <span class="hint">define se você terá plugins, mods ou modpacks</span></div>
          <div class="sw-pick" id="sw-pick">
            ${list.map((s, i) => `
              <div class="sw-option ${i === 0 ? 'sel' : ''}" data-sw="${s.id}">
                <h4>${s.emoji} ${esc(s.name)}</h4>
                <p>${esc(s.desc)}</p>
                <div class="tags">
                  <span class="tag ${s.supports.plugins ? 'on' : 'off'}">plugins</span>
                  <span class="tag ${s.supports.mods ? 'on' : 'off'}">mods</span>
                  <span class="tag ${s.supports.modpacks ? 'on' : 'off'}">modpacks</span>
                </div>
              </div>`).join('')}
          </div>
          ${list.some((s) => s.error) ? `<div class="banner warn mt"><span class="bi">⚠</span><span>Não consegui listar as versões de: ${esc(list.filter((s) => s.error).map((s) => s.name).join(', '))}. Verifique sua internet.</span></div>` : ''}
        </div>

        <div class="card">
          <div class="card-title">2 · Versão</div>
          <div class="form-grid">
            <div class="field">
              <label class="label" for="f-name">Nome do servidor</label>
              <input class="input" id="f-name" maxlength="40" placeholder="Meu Server" required />
            </div>
            <div class="field">
              <label class="label" for="f-version">Versão do Minecraft</label>
              <select class="select" id="f-version"></select>
            </div>
            <div class="field hidden" id="wrap-loader">
              <label class="label" for="f-loader">Loader</label>
              <select class="select" id="f-loader"></select>
              <span class="help" id="loader-help"></span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">3 · Recursos e rede</div>
          <div class="form-grid">
            <div class="field full">
              <label class="label" for="f-ram">RAM do servidor</label>
              <div class="range-row">
                <input type="range" id="f-ram" min="512" max="3072" step="256" value="1024" />
                <span class="range-val" id="ram-val">1024 MB</span>
              </div>
              <span class="help" id="ram-help"></span>
            </div>
            <div class="field">
              <label class="label" for="f-port">Porta</label>
              <input class="input" id="f-port" type="number" min="1" max="65535" value="25565" />
              <span class="help">Porta padrão do Minecraft: 25565.</span>
            </div>
            <div class="field">
              <label class="label" for="f-max">Máx. de jogadores</label>
              <input class="input" id="f-max" type="number" min="1" max="500" value="10" />
            </div>
            <div class="field">
              <label class="label" for="f-gamemode">Modo de jogo</label>
              <select class="select" id="f-gamemode">
                <option value="survival">Sobrevivência</option>
                <option value="creative">Criativo</option>
                <option value="adventure">Aventura</option>
                <option value="spectator">Espectador</option>
              </select>
            </div>
            <div class="field">
              <label class="label" for="f-difficulty">Dificuldade</label>
              <select class="select" id="f-difficulty">
                <option value="peaceful">Pacífico</option>
                <option value="easy">Fácil</option>
                <option value="normal" selected>Normal</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
            <div class="field full">
              <label class="label" for="f-motd">MOTD (mensagem no servidor)</label>
              <input class="input" id="f-motd" maxlength="80" placeholder="Meu Server" />
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">4 · Jogadores</div>
          <div class="col" style="gap:16px">
            <label class="switch">
              <input type="checkbox" id="f-online" checked />
              <span class="track"></span>
              <span class="switch-label"><b>Somente clientes originais (online-mode)</b><br>
                <span class="help">Desative para permitir clientes <b>piratas/cracked</b> também — mas aí instale o AuthMe (feito automaticamente).</span>
              </span>
            </label>
            <div id="cracked-hint" class="banner warn hidden" style="margin:0">
              <span class="bi">🔓</span>
              <span><b>Modo aberto (original + pirata).</b> O painel instala o <b>AuthMe</b> automaticamente em servidores Paper/Purpur/Arclight para exigir login por senha — sem isso, qualquer um entra com o nome de quem já joga.</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="f-autostart" checked />
              <span class="track"></span>
              <span class="switch-label">Iniciar automaticamente ao terminar a instalação</span>
            </label>
            <label class="check">
              <input type="checkbox" id="f-eula" required />
              <span>Eu li e concordo com o <a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">EULA da Mojang</a> (obrigatório para rodar um servidor).</span>
            </label>
          </div>
        </div>

        <div class="row end">
          <a class="btn" href="#/servers">Cancelar</a>
          <button class="btn btn-primary btn-lg" type="submit" id="btn-create">⛏ Criar servidor</button>
        </div>
      </form>`;

    // ---- lógica do formulário ----
    const sel = $('#f-version');
    const selLoader = $('#f-loader');
    const wrapLoader = $('#wrap-loader');
    let currentSw = first;

    function fillVersions(sw) {
      currentSw = sw;
      const versions = sw.versions || [];
      sel.innerHTML = versions.length
        ? versions.map((v, i) => `<option value="${esc(v)}" ${i === 0 ? 'selected' : ''}>${esc(v)}${i === 0 ? ' (mais recente)' : ''}</option>`).join('')
        : `<option value="">— sem versões —</option>`;
      if (!versions.length) toast(`${sw.name} não retornou versões. Verifique a internet.`, 'warn');

      // loaders
      if (sw.id === 'fabric') {
        wrapLoader.classList.remove('hidden');
        selLoader.innerHTML = loaders.map((l, i) => `<option value="${esc(l)}" ${i === 0 ? 'selected' : ''}>Fabric Loader ${esc(l)}</option>`).join('');
        $('#loader-help').textContent = 'O loader é o "mod loader" do Fabric — mantenha o mais recente, salvo incompatibilidade.';
      } else if (sw.id === 'arclight') {
        wrapLoader.classList.remove('hidden');
        selLoader.innerHTML = ['forge', 'neoforge', 'fabric'].map((l) => `<option value="${l}">Arclight ${l}</option>`).join('');
        $('#loader-help').textContent = 'Forge = mods antigos/amadurecidos; NeoForge = linha nova; Fabric = leve. Mods precisam bater com o loader escolhido.';
      } else {
        wrapLoader.classList.add('hidden');
      }
      updateRamHelp();
    }

    function updateRamHelp() {
      const ram = Number($('#f-ram').value);
      $('#ram-val').textContent = `${ram} MB`;
      const total = 3.5; // GB da máquina
      let msg = `Recomendado para poucos jogadores. Sua máquina tem ~${total} GB de RAM — deixe pelo menos 1 GB livre para o Windows.`;
      if (ram >= 2048) msg = '⚠ Com 2 GB ou mais, feche outros programas. Essa máquina tem ~3,5 GB no total.';
      $('#ram-help').textContent = msg;
      $('#ram-help').className = ram >= 2048 ? 'help warn' : 'help';
    }

    $('#sw-pick').addEventListener('click', (e) => {
      const opt = e.target.closest('[data-sw]');
      if (!opt) return;
      $$('.sw-option').forEach((o) => o.classList.remove('sel'));
      opt.classList.add('sel');
      const sw = list.find((s) => s.id === opt.dataset.sw);
      if (sw) fillVersions(sw);
    });

    $('#f-ram').addEventListener('input', updateRamHelp);
    $('#f-online').addEventListener('change', (e) => {
      $('#cracked-hint').classList.toggle('hidden', e.target.checked);
    });

    fillVersions(first);
    if (!$('#f-motd').value) $('#f-name').addEventListener('input', (e) => { $('#f-motd').placeholder = e.target.value || 'Meu Server'; });

    $('#new-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-create');
      if (!$('#f-eula').checked) { toast('É preciso aceitar o EULA para criar o servidor.', 'warn'); return; }
      const payload = {
        name: $('#f-name').value.trim(),
        software: currentSw.id,
        version: $('#f-version').value,
        ram: Number($('#f-ram').value),
        port: Number($('#f-port').value),
        maxPlayers: Number($('#f-max').value),
        gamemode: $('#f-gamemode').value,
        difficulty: $('#f-difficulty').value,
        motd: $('#f-motd').value.trim() || $('#f-name').value.trim(),
        onlineMode: $('#f-online').checked,
        autoStart: $('#f-autostart').checked,
        eula: true,
      };
      if (!payload.name) { toast('Dê um nome ao servidor.', 'warn'); return; }
      if (!payload.version) { toast('Escolha uma versão.', 'warn'); return; }
      if (currentSw.id === 'fabric') payload.loaderVersion = $('#f-loader').value;
      if (currentSw.id === 'arclight') payload.loader = $('#f-loader').value;

      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> criando…';
      try {
        const { instance, jobId } = await api('/api/instances', { method: 'POST', body: payload });
        watchJob(jobId, {
          onDone: (job) => {
            if (job.status === 'done') toast(`${instance.name} instalado!`, 'success');
          },
        });
        toast('Instalação iniciada — acompanhe o progresso no cantinho.', 'info');
        navigate(`#/server/${instance.id}/console`);
      } catch (err) {
        toast(err.message, 'error', 'Não criei o servidor');
        btn.disabled = false;
        btn.innerHTML = '⛏ Criar servidor';
      }
    });
  }

  // ------------------------------------------------------------------
  // View: servidor (abas)
  // ------------------------------------------------------------------
  const TABS = [
    ['console', '▣ Console'],
    ['players', '☺ Jogadores'],
    ['plugins', '⚙ Plugins'],
    ['mods', '⛏ Mods'],
    ['modpacks', '🧰 Modpacks'],
    ['config', '⚙ Config'],
    ['files', '📁 Arquivos'],
    ['backups', '🗄 Backups'],
  ];

  async function viewServer(root) {
    await Promise.all([refreshStatus(), refreshInstances()]);
    const inst = currentInstance();
    if (!inst) {
      root.innerHTML = `<div class="empty">
        <div class="big">❔</div>
        <h3>Servidor não encontrado</h3>
        <p>Ele pode ter sido excluído.</p>
        <a class="btn btn-primary" href="#/servers">Ver servidores</a>
      </div>`;
      return;
    }
    const tab = state.route.params.tab;
    const sw = (state.software?.software || []).find((s) => s.id === inst.software);

    root.innerHTML = `
      <div class="breadcrumb">
        <a href="#/">Painel</a><span class="sep">/</span>
        <a href="#/servers">Servidores</a><span class="sep">/</span>
        <span>${esc(inst.name)}</span>
      </div>

      <div class="page-head">
        <div class="row" style="gap:14px">
          <div class="server-icon" style="width:52px;height:52px;font-size:26px">${{ paper: '⚡', purpur: '🥒', vanilla: '🍦', fabric: '🧵', arclight: '🔥' }[inst.software] || '▣'}</div>
          <div>
            <div class="row" style="gap:10px">
              <h1 class="page-title" style="margin:0">${esc(inst.name)}</h1>
              <span id="srv-status" class="badge ${statusBadge(inst.status)}">${statusLabel(inst.status)}</span>
            </div>
            <p class="page-sub" style="margin-top:6px">
              ${esc(inst.softwareName)} ${esc(inst.version)}${inst.loader ? ` · ${esc(inst.loader)}${inst.loaderVersion ? ' ' + esc(inst.loaderVersion) : ''}` : ''}
              · porta <span class="mono text-green">${inst.port}</span>
              · <span id="srv-uptime" class="mono">${inst.uptimeMs ? fmtDur(inst.uptimeMs) : '—'}</span>
              · ${inst.onlineMode ? '🔒 original' : '🔓 aberto (cracked)'}
            </p>
          </div>
        </div>
        <div class="page-actions" id="srv-actions"></div>
      </div>

      <div id="srv-banners"></div>

      <div class="tabs">
        ${TABS.map(([k, label]) => {
          const visible = isTabVisible(k, inst);
          return visible ? `<a class="tab ${k === tab ? 'active' : ''}" href="#/server/${inst.id}/${k}">${label}</a>` : '';
        }).join('')}
      </div>

      <div id="tab-body"><div class="loading"><span class="spin"></span> carregando…</div></div>`;

    paintServerActions(inst);
    paintBanners(inst, sw);

    const body = $('#tab-body');
    switch (tab) {
      case 'players': await tabPlayers(body, inst); break;
      case 'plugins': await tabPackages(body, inst, 'plugin'); break;
      case 'mods': await tabPackages(body, inst, 'mod'); break;
      case 'modpacks': await tabModpacks(body, inst); break;
      case 'config': await tabConfig(body, inst); break;
      case 'files': await tabFiles(body, inst); break;
      case 'backups': await tabBackups(body, inst); break;
      default: await tabConsole(body, inst);
    }

    const t = setInterval(() => refreshInstances().catch(() => {}), 2500);
    watchers.push(() => clearInterval(t));
  }

  function isTabVisible(tab, inst) {
    if (tab === 'plugins') return !!inst.supports?.plugins;
    if (tab === 'mods') return !!inst.supports?.mods;
    if (tab === 'modpacks') return !!inst.supports?.modpacks;
    return true;
  }

  function paintBanners(inst, sw) {
    const box = $('#srv-banners');
    if (!box) return;
    const out = [];
    if (inst.status === 'orphan') {
      out.push(`<div class="banner danger"><span class="bi">⚠</span>
        <div>Existe um processo antigo deste servidor rodando (o painel foi reiniciado). Ele não está conectado ao console.
        <div class="row mt"><button class="btn btn-sm btn-danger" data-hact="kill">Encerrar processo antigo</button></div></div></div>`);
    }
    if (!inst.onlineMode) {
      out.push(`<div class="banner warn"><span class="bi">🔓</span>
        <span><b>Modo aberto:</b> clientes originais <i>e</i> piratas entram. ${inst.supports?.plugins ? 'AuthMe protege os logins — crie senhas com <span class="mono">/register senha senha</span> após entrar.' : 'Este software não tem AuthMe: use um proxy de autenticação se quiser proteção de conta.'}</span></div>`);
    }
    if (inst.status === 'error' && inst.error) {
      out.push(`<div class="banner danger"><span class="bi">✕</span><span><b>Falha:</b> ${esc(String(inst.error).slice(0, 600))}</span></div>`);
    }
    if (inst.legacyWarning) {
      out.push(`<div class="banner info"><span class="bi">🕰</span><span>Versão antiga (${esc(inst.version)}). Pode não rodar com Java moderno — se falhar, tente uma versão 1.17+.</span></div>`);
    }
    if (!sw && inst.software && inst.status === 'error') {
      out.push(`<div class="banner warn"><span class="bi">⚠</span><span>O jar do servidor não existe mais. Use <b>Reinstalar</b> (⋯ → Reinstalar jar).</span></div>`);
    }
    box.innerHTML = out.join('');
    box.querySelectorAll('[data-hact]').forEach((b) => {
      b.onclick = () => instanceAction(inst.id, b.dataset.hact, b);
    });
  }

  function paintServerActions(inst) {
    const box = $('#srv-actions');
    if (!box) return;
    const busy = ['installing', 'deleting', 'starting', 'stopping'].includes(inst.status);
    const running = inst.status === 'running';
    const orphan = inst.status === 'orphan';
    const installing = ['installing', 'deleting'].includes(inst.status);

    box.innerHTML = `
      ${orphan
        ? `<button class="btn btn-danger" data-hact="kill">Encerrar processo</button>`
        : running
          ? `<button class="btn" id="btn-restart" ${busy ? 'disabled' : ''}>↻ Reiniciar</button>
             <button class="btn btn-primary" id="btn-stop" ${busy ? 'disabled' : ''}>■ Parar</button>`
          : `<button class="btn btn-primary" id="btn-start" ${busy || inst.status === 'error' ? 'disabled' : ''} title="${inst.status === 'error' ? 'Corrija o erro (ou reinstale) antes de iniciar' : ''}">▶ Iniciar</button>`}
      <button class="btn" data-hact="reinstall" ${busy || running ? 'disabled' : ''}>⟳ Reinstalar</button>
      <button class="btn btn-ghost btn-danger" data-hact="delete" ${busy ? 'disabled' : ''}>🗑</button>`;

    const bStart = $('#btn-start', box);
    if (bStart) bStart.onclick = () => instanceAction(inst.id, 'start', bStart);
    const bStop = $('#btn-stop', box);
    if (bStop) bStop.onclick = () => instanceAction(inst.id, 'stop', bStop);
    const bRe = $('#btn-restart', box);
    if (bRe) bRe.onclick = () => instanceAction(inst.id, 'restart', bRe);
    box.querySelectorAll('[data-hact]').forEach((b) => {
      b.onclick = () => instanceAction(inst.id, b.dataset.hact, b);
    });
    void installing;
  }

  function updateServerButtons(inst) {
    // re-pinta apenas se o status mudou de forma visível
    const label = $('#srv-status')?.textContent;
    if (label && label !== statusLabel(inst.status)) paintServerActions(inst);
  }

  // ------------------------------------------------------------------
  // Aba: Console
  // ------------------------------------------------------------------
  async function tabConsole(root, inst) {
    root.innerHTML = `
      <div class="console-wrap">
        <div class="console-bar">
          <span class="lights"><i></i><i></i><i></i></span>
          <span>console — ${esc(inst.name)}</span>
          <span style="margin-left:auto" id="conn-state">conectando…</span>
        </div>
        <div class="console-out" id="console-out"><span class="console-line sys">[Painel] conectando ao console…</span></div>
        <div class="console-hint">Comandos com <span class="mono">/</span> ou sem. Ex.: <span class="mono">list</span>, <span class="mono">/op seu_nick</span>, <span class="mono">stop</span></div>
        <form class="console-input" id="cmd-form">
          <input class="input" id="cmd-input" placeholder="${inst.status === 'running' ? 'digite um comando…' : 'servidor parado'}" autocomplete="off" ${inst.status === 'running' ? '' : 'disabled'} />
          <button class="btn btn-primary" type="submit" ${inst.status === 'running' ? '' : 'disabled'}>Enviar</button>
        </form>
      </div>`;

    const out = $('#console-out');
    const state_ = $('#conn-state');
    const nearBottom = () => out.scrollHeight - out.scrollTop - out.clientHeight < 70;
    let stick = true;

    function classify(line) {
      const t = line.text;
      let cls = '';
      if (line.src === 'err') cls = 'err';
      else if (line.src === 'cmd') cls = 'cmd';
      else if (line.src === 'sys') cls = 'sys';
      else if (/\[(ERROR|SEVERE)\]/.test(t)) cls = 'err';
      else if (/\bWARN(ING)?\b/.test(t)) cls = 'warn';
      else if (/\bDone \(/.test(t)) cls = 'ok';
      return cls;
    }

    function addLine(line) {
      const div = document.createElement('div');
      div.className = `console-line ${classify(line)}`;
      div.textContent = line.text;
      out.appendChild(div);
      while (out.childNodes.length > 3000) out.removeChild(out.firstChild);
      if (stick) out.scrollTop = out.scrollHeight;
    }

    out.addEventListener('scroll', () => { stick = nearBottom(); });

    // histórico + stream
    try {
      const hist = await api(`/api/instances/${inst.id}/console`);
      for (const l of hist.lines || []) addLine(l);
    } catch { /* segue */ }

    eventSource = new EventSource(`/api/instances/${inst.id}/console/stream`);
    eventSource.onopen = () => { state_.textContent = '● ao vivo'; state_.className = 'text-green'; };
    eventSource.onerror = () => { state_.textContent = '● reconectando…'; state_.className = 'text-amber'; };
    eventSource.onmessage = (e) => {
      try { addLine(JSON.parse(e.data)); } catch { /* ignore */ }
    };

    $('#cmd-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#cmd-input');
      const cmd = input.value.trim();
      if (!cmd) return;
      input.value = '';
      try {
        await api(`/api/instances/${inst.id}/command`, { method: 'POST', body: { command: cmd } });
      } catch (err) {
        toast(err.message, 'error');
        input.value = cmd;
      }
    });

    // se o status mudar (start/stop), reabilita o input
    const t = setInterval(() => {
      const live = currentInstance();
      if (!live) return;
      const input = $('#cmd-input');
      const btn = $('#cmd-form button');
      if (!input || !btn) return;
      const running = live.status === 'running';
      if (running && input.disabled) {
        input.disabled = false; btn.disabled = false;
        input.placeholder = 'digite um comando…';
      } else if (!running && !input.disabled) {
        input.disabled = true; btn.disabled = true;
        input.placeholder = 'servidor parado';
      }
    }, 2000);
    watchers.push(() => clearInterval(t));
  }

  // ------------------------------------------------------------------
  // Aba: Jogadores
  // ------------------------------------------------------------------
  async function tabPlayers(root, inst) {
    root.innerHTML = `<div class="loading"><span class="spin"></span> carregando jogadores…</div>`;

    const render = (data) => {
      const online = data.online || [];
      const wl = data.whitelist || [];
      const ops = data.ops || [];
      const bans = data.bans || [];
      root.innerHTML = `
        <div class="grid grid-4 mb">
          <div class="stat text-green"><div class="k">Online</div><div class="v">${online.length}</div><div class="d">de ${data.max}</div></div>
          <div class="stat"><div class="k">Operadores</div><div class="v">${ops.length}</div><div class="d">comandos admin</div></div>
          <div class="stat"><div class="k">Whitelist</div><div class="v">${wl.length}</div><div class="d">${data.whitelistOn ? 'ativada' : 'desativada'}</div></div>
          <div class="stat text-red"><div class="k">Banidos</div><div class="v">${bans.length}</div><div class="d">contas banidas</div></div>
        </div>

        ${!data.running ? `<div class="banner info"><span class="bi">■</span><span>Servidor parado — inicie-o para ver quem está online e aplicar ações em tempo real.</span></div>` : ''}
        ${data.rconOk === false && data.running ? `<div class="banner warn"><span class="bi">⚠</span><span>RCON indisponível: ${esc(data.rconError || 'sem resposta')}. Os comandos vão pelo console.</span></div>` : ''}
        ${!data.onlineMode ? `<div class="banner warn"><span class="bi">🔓</span><span>Modo aberto: nicks podem ser sequestrados. O AuthMe exige <span class="mono">/register</span> e <span class="mono">/login</span> — ensine seus jogadores a criarem senha.</span></div>` : ''}

        <div class="card mb">
          <div class="card-title">Online agora <span class="hint">clique em um jogador para ações</span></div>
          ${online.length
            ? `<div class="pkg-list">${online.map((p) => `
                <div class="pkg">
                  <div class="pkg-icon fallback">☺</div>
                  <div class="pkg-body"><div class="pkg-name">${esc(p)}</div>
                  <div class="pkg-desc">online neste servidor</div></div>
                  <div class="pkg-actions">
                    <button class="btn btn-sm" data-p="kick" data-n="${esc(p)}">Kick</button>
                    <button class="btn btn-sm btn-danger" data-p="ban" data-n="${esc(p)}">Banir</button>
                    <button class="btn btn-sm" data-p="op" data-n="${esc(p)}">OP</button>
                  </div>
                </div>`).join('')}</div>`
            : `<p class="muted small" style="margin:0">Ninguém online agora (ou o servidor está parado).</p>`}
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-title">Operadores (ops.json)</div>
            ${ops.length ? `<div class="row">${ops.map((o) => `<span class="chip">${esc(o.name || o)} <button class="btn-ghost btn-sm" data-p="deop" data-n="${esc(o.name || o)}" style="border:0;background:none;cursor:pointer;color:var(--text-3)">✕</button></span>`).join('')}</div>` : '<p class="muted small" style="margin:0">Nenhum operador.</p>'}
          </div>
          <div class="card">
            <div class="card-title">Whitelist</div>
            ${wl.length ? `<div class="row">${wl.map((w) => `<span class="chip">${esc(w.name || w)}</span>`).join('')}</div>` : '<p class="muted small" style="margin:0">Lista vazia — adicione jogadores pelo campo abaixo.</p>'}
            <form class="row mt" id="wl-form">
              <input class="input" id="wl-name" placeholder="nick do jogador" style="max-width:220px" />
              <button class="btn btn-sm" type="submit">＋ Adicionar à whitelist</button>
            </form>
          </div>
        </div>

        ${bans.length ? `
        <div class="card mt">
          <div class="card-title">Banidos</div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Jogador</th><th>Motivo</th><th class="acts"></th></tr></thead>
            <tbody>${bans.map((b) => `<tr><td>${esc(b.name || '?')}</td><td class="muted">${esc(b.reason || '—')}</td>
              <td class="acts"><button class="btn btn-sm" data-p="pardon" data-n="${esc(b.name || '')}">Desbanir</button></td></tr>`).join('')}</tbody>
          </table></div>
        </div>` : ''}

        <div class="card mt">
          <div class="card-title">Ação manual</div>
          <form class="row" id="pa-form">
            <select class="select" id="pa-act" style="max-width:210px">
              <option value="kick">Kick</option>
              <option value="ban">Banir</option>
              <option value="pardon">Desbanir</option>
              <option value="op">Dar OP</option>
              <option value="deop">Tirar OP</option>
              <option value="whitelist_add">Whitelist +</option>
              <option value="whitelist_remove">Whitelist −</option>
            </select>
            <input class="input" id="pa-name" placeholder="nick" style="max-width:200px" required />
            <button class="btn" type="submit">Aplicar</button>
          </form>
        </div>`;

      const doAction = async (action, target) => {
        try {
          await api(`/api/instances/${inst.id}/players`, { method: 'POST', body: { action, target } });
          toast(`Ação "${action}" enviada para ${target}.`, 'success');
          setTimeout(load, 700);
        } catch (err) { toast(err.message, 'error'); }
      };

      root.querySelectorAll('[data-p]').forEach((b) => {
        b.onclick = () => doAction(b.dataset.p, b.dataset.n);
      });
      const wlForm = $('#wl-form', root);
      if (wlForm) wlForm.onsubmit = (e) => {
        e.preventDefault();
        const n = $('#wl-name', root).value.trim();
        if (n) doAction('whitelist_add', n);
      };
      const pa = $('#pa-form', root);
      if (pa) pa.onsubmit = (e) => {
        e.preventDefault();
        const n = $('#pa-name', root).value.trim();
        if (n) doAction($('#pa-act', root).value, n);
      };
    };

    async function load() {
      try {
        const data = await api(`/api/instances/${inst.id}/players`);
        data.whitelistOn = false;
        render(data);
      } catch (err) {
        root.innerHTML = `<div class="empty"><div class="big">☺</div><h3>Sem dados</h3><p>${esc(err.message)}</p></div>`;
      }
    }

    await load();
    const t = setInterval(() => {
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      load().catch(() => {});
    }, 5000);
    watchers.push(() => clearInterval(t));
  }

  // ------------------------------------------------------------------
  // Aba: Plugins / Mods
  // ------------------------------------------------------------------
  async function tabPackages(root, inst, kind) {
    const isPlugin = kind === 'plugin';
    const title = isPlugin ? 'Plugins' : 'Mods';
    root.innerHTML = `
      <div class="search-bar">
        <input class="input" id="q" placeholder="Buscar ${title.toLowerCase()} no Modrinth…" autocomplete="off" />
        <button class="btn btn-primary" id="btn-search">🔍 Buscar</button>
        <button class="btn" id="btn-top">Mais baixados</button>
        <span style="flex:1"></span>
        <label class="btn">
          ↑ Enviar arquivo .jar
          <input type="file" id="upload" accept=".jar,.zip" hidden />
        </label>
      </div>

      <div class="grid grid-2">
        <div>
          <div class="card-title">${title} instalados <span class="hint" id="pkg-count"></span></div>
          <div class="pkg-list" id="installed"><div class="loading"><span class="spin"></span></div></div>
        </div>
        <div>
          <div class="card-title">Resultados da busca <span class="hint">Modrinth</span></div>
          <div class="pkg-list" id="results"><div class="empty" style="padding:34px"><p>Digite um nome ou clique em "Mais baixados".</p></div></div>
        </div>
      </div>`;

    // ---- instalados ----
    async function loadInstalled() {
      const box = $('#installed');
      try {
        const { packages } = await api(`/api/instances/${inst.id}/packages?kind=${kind}`);
        $('#pkg-count').textContent = packages.length ? `${packages.length} arquivo(s)` : '';
        if (!packages.length) {
          box.innerHTML = `<div class="empty" style="padding:26px"><p>Nenhum ${isPlugin ? 'plugin' : 'mod'} instalado ainda.</p></div>`;
          return;
        }
        box.innerHTML = packages.map((p) => `
          <div class="pkg">
            <div class="pkg-icon fallback">${isPlugin ? '⚙' : '⛏'}</div>
            <div class="pkg-body">
              <div class="pkg-name">${esc(p.name.replace(/\.jar$/i, ''))} ${p.disabled ? '<span class="badge amber">desativado</span>' : ''}</div>
              <div class="pkg-stats"><span>${fmtBytes(p.size)}</span><span>${fmtAgo(p.mtime)}</span></div>
            </div>
            <div class="pkg-actions">
              <button class="btn btn-sm" data-ren="${esc(p.name)}">Renomear</button>
              <button class="btn btn-sm btn-danger" data-del="${esc(p.name)}">Excluir</button>
            </div>
          </div>`).join('');

        box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
          const ok = await confirmDialog(`Excluir ${b.dataset.del}?`, { title: 'Excluir arquivo', confirmText: 'Excluir' });
          if (!ok) return;
          try {
            await api(`/api/instances/${inst.id}/packages?kind=${kind}&name=${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' });
            toast('Arquivo excluído. Reinicie o servidor para aplicar.', 'success');
            loadInstalled();
          } catch (err) { toast(err.message, 'error'); }
        });
        box.querySelectorAll('[data-ren]').forEach((b) => b.onclick = async () => {
          const name = b.dataset.ren;
          const disabled = name.endsWith('.disabled');
          const newName = disabled ? name.replace(/\.disabled$/, '') : `${name}.disabled`;
          try {
            // renomeia via API de arquivo
            await apiRaw(`/api/instances/${inst.id}/file?path=${encodeURIComponent((isPlugin ? 'plugins/' : 'mods/') + newName)}`,
              { method: 'PUT', body: '', contentType: 'text/plain' });
            await api(`/api/instances/${inst.id}/file?path=${encodeURIComponent((isPlugin ? 'plugins/' : 'mods/') + name)}`, { method: 'DELETE' });
            toast(disabled ? 'Ativado (renomeado).' : 'Desativado (.disabled).', 'success');
            loadInstalled();
          } catch (err) { toast(err.message, 'error'); }
        });
      } catch (err) {
        box.innerHTML = `<div class="empty" style="padding:26px"><p>${esc(err.message)}</p></div>`;
      }
    }

    // ---- busca ----
    async function search(q, force = false) {
      const box = $('#results');
      box.innerHTML = `<div class="loading"><span class="spin"></span> buscando…</div>`;
      try {
        const { hits } = await api(`/api/search?kind=${kind}&q=${encodeURIComponent(q)}&mc=${encodeURIComponent(inst.version)}`);
        if (!hits.length) {
          box.innerHTML = `<div class="empty" style="padding:34px"><p>Nada encontrado para "${esc(q)}" (MC ${esc(inst.version)}).</p></div>`;
          return;
        }
        box.innerHTML = hits.map((h) => `
          <div class="pkg">
            ${h.icon ? `<img class="pkg-icon" src="${esc(h.icon)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : `<div class="pkg-icon fallback">${isPlugin ? '⚙' : '⛏'}</div>`}
            <div class="pkg-body">
              <div class="pkg-name">${esc(h.title)}</div>
              <div class="pkg-desc">${esc(h.description)}</div>
              <div class="pkg-stats"><span>↓ ${fmtDownloads(h.downloads)}</span><span>${esc(h.author)}</span></div>
            </div>
            <div class="pkg-actions"><button class="btn btn-sm btn-primary" data-inst="${esc(h.id)}" data-t="${esc(h.title)}">Instalar</button></div>
          </div>`).join('');
        box.querySelectorAll('[data-inst]').forEach((b) => b.onclick = () => installFlow(b.dataset.inst, b.dataset.t, b));
        void force;
      } catch (err) {
        box.innerHTML = `<div class="empty" style="padding:34px"><p>${esc(err.message)}</p></div>`;
      }
    }

    async function installFlow(projectId, projectName, btn) {
      if (btn) btn.disabled = true;
      try {
        const { versions } = await api(`/api/projects/${encodeURIComponent(projectId)}/versions?kind=${kind}&mc=${encodeURIComponent(inst.version)}`);
        if (!versions.length) { toast('Nenhuma versão disponível para esta MC.', 'warn'); return; }
        // compatíveis com a MC atual primeiro
        versions.sort((a, b) => Number(b.gameVersions.includes(inst.version)) - Number(a.gameVersions.includes(inst.version)));
        const opts = versions.slice(0, 40).map((v) => {
          const exact = v.gameVersions.includes(inst.version);
          const loadersTxt = v.loaders?.length ? ' · ' + v.loaders.slice(0, 3).join('/') : '';
          const vg = exact ? `✓ MC ${inst.version}` : `MC ${v.gameVersions.slice(0, 3).join(', ')}`;
          return `<option value="${esc(v.id)}" ${exact ? '' : ''}>${esc(v.versionNumber)} — ${esc(vg)}${esc(loadersTxt)}</option>`;
        }).join('');
        const pick = await new Promise((resolve) => {
          const bd = $('#modal-backdrop'), m = $('#modal');
          m.innerHTML = `
            <h3>Instalar ${esc(projectName)}</h3>
            <div class="m-body">
              <p class="muted small">Servidor: <b>${esc(inst.softwareName)} ${esc(inst.version)}</b> — deixe a versão recomendada, a menos que saiba o que está fazendo.</p>
              <div class="field" style="margin-top:12px">
                <label class="label">Versão</label>
                <select class="select" id="pick-v">${opts}</select>
              </div>
            </div>
            <div class="m-actions">
              <button class="btn" data-a="cancel">Cancelar</button>
              <button class="btn btn-primary" data-a="ok">Instalar</button>
            </div>`;
          bd.hidden = false;
          const close = (v) => { closeModal(); resolve(v); };
          $('[data-a=cancel]', m).onclick = () => close(null);
          $('[data-a=ok]', m).onclick = () => close($('#pick-v', m).value);
        });
        if (!pick) return;
        const { jobId } = await api(`/api/instances/${inst.id}/install`, {
          method: 'POST',
          body: { kind, projectId, versionId: pick },
        });
        watchJob(jobId, { onDone: (j) => { if (j.status === 'done') { toast(`${projectName} instalado.`, 'success'); loadInstalled(); } } });
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        if (btn && document.contains(btn)) btn.disabled = false;
      }
    }

    $('#btn-search').onclick = () => search($('#q').value.trim());
    $('#btn-top').onclick = () => search('');
    $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') search($('#q').value.trim()); });
    $('#upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await apiRaw(`/api/instances/${inst.id}/upload?kind=${kind}&filename=${encodeURIComponent(file.name)}`, {
          method: 'POST', body: file, contentType: 'application/octet-stream',
        });
        toast(`${file.name} enviado para ${isPlugin ? 'plugins/' : 'mods/'}.`, 'success');
        loadInstalled();
      } catch (err) { toast(err.message, 'error'); }
      e.target.value = '';
    });

    await loadInstalled();
    if (!isPlugin) search('', true); // mods já mostram os mais baixados
  }

  // ------------------------------------------------------------------
  // Aba: Modpacks
  // ------------------------------------------------------------------
  async function tabModpacks(root, inst) {
    root.innerHTML = `
      ${inst.modpack ? `<div class="banner success"><span class="bi">🧰</span><span><b>${esc(inst.modpack.name)}</b> está instalado neste servidor. Os jogadores precisam do mesmo modpack no cliente.</span></div>` : ''}
      <div class="banner info"><span class="bi">ℹ</span><span>Modpacks do Modrinth (<span class="mono">.mrpack</span>) só funcionam em servidores <b>Fabric</b> ou <b>Arclight</b>${['fabric', 'arclight'].includes(inst.software) ? '' : ' — este servidor é ' + esc(inst.softwareName) + ', então crie outro com Fabric/Arclight para usar modpacks'}.</span></div>

      <div class="search-bar">
        <input class="input" id="mp-q" placeholder="Buscar modpack (ex.: Cobblemon, Advent of Skyblock)…" autocomplete="off" />
        <button class="btn btn-primary" id="mp-search">🔍 Buscar</button>
        <button class="btn" id="mp-top">Mais baixados</button>
      </div>
      <div class="pkg-list" id="mp-results"><div class="empty" style="padding:34px"><p>Busque um modpack para começar.</p></div></div>`;

    const supported = ['fabric', 'arclight'].includes(inst.software);

    async function search(q) {
      const box = $('#mp-results');
      box.innerHTML = `<div class="loading"><span class="spin"></span> buscando no Modrinth…</div>`;
      try {
        const { hits } = await api(`/api/search?kind=modpack&q=${encodeURIComponent(q)}&mc=${encodeURIComponent(inst.version)}`);
        if (!hits.length) {
          box.innerHTML = `<div class="empty" style="padding:34px"><p>Nenhum modpack para MC ${esc(inst.version)}. Tente outra versão.</p></div>`;
          return;
        }
        box.innerHTML = hits.map((h) => `
          <div class="pkg">
            ${h.icon ? `<img class="pkg-icon" src="${esc(h.icon)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : `<div class="pkg-icon fallback">🧰</div>`}
            <div class="pkg-body">
              <div class="pkg-name">${esc(h.title)}</div>
              <div class="pkg-desc">${esc(h.description)}</div>
              <div class="pkg-stats"><span>↓ ${fmtDownloads(h.downloads)}</span><span>${esc(h.author)}</span><span>${esc((h.categories || []).slice(0, 4).join(' · '))}</span></div>
            </div>
            <div class="pkg-actions"><button class="btn btn-sm btn-primary" data-mp="${esc(h.id)}" data-t="${esc(h.title)}" ${supported ? '' : 'disabled title="servidor não suporta modpacks"'}>Instalar</button></div>
          </div>`).join('');
        box.querySelectorAll('[data-mp]').forEach((b) => b.onclick = () => installPack(b.dataset.mp, b.dataset.t, b));
      } catch (err) {
        box.innerHTML = `<div class="empty" style="padding:34px"><p>${esc(err.message)}</p></div>`;
      }
    }

    async function installPack(projectId, name, btn) {
      if (btn) btn.disabled = true;
      try {
        const { versions } = await api(`/api/projects/${encodeURIComponent(projectId)}/versions?kind=modpack&mc=${encodeURIComponent(inst.version)}`);
        if (!versions.length) { toast('Nenhuma versão compatível com esta MC.', 'warn'); return; }
        const opts = versions.slice(0, 30).map((v) => `<option value="${esc(v.id)}">${esc(v.versionNumber)} — ${esc(v.gameVersions.join(', '))}</option>`).join();
        const ok = await modal({
          title: `Instalar modpack`,
          body: `<p>Escolha a versão de <b>${esc(name)}</b>:</p>
                 <div class="field" style="margin-top:10px"><label class="label">Versão</label><select class="select" id="mp-v">${opts}</select></div>
                 <p class="help warn mt">⚠ O servidor precisa estar de acordo com o loader exigido pelo pack (Fabric/Forge/NeoForge). Se necessário, o painel troca o build automaticamente. O download pode levar vários minutos.</p>`,
          confirmText: 'Instalar modpack',
        });
        if (!ok) return;
        const versionId = $('#mp-v')?.value;
        const { jobId } = await api(`/api/instances/${inst.id}/modpack`, { method: 'POST', body: { projectId, versionId } });
        watchJob(jobId, { onDone: (j) => { if (j.status === 'done') { toast('Modpack instalado! Reinicie o servidor.', 'success'); render(); } } });
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        if (btn && document.contains(btn)) btn.disabled = false;
      }
    }

    $('#mp-search').onclick = () => search($('#mp-q').value.trim());
    $('#mp-top').onclick = () => search('');
    $('#mp-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') search($('#mp-q').value.trim()); });
    await search('');
  }

  // ------------------------------------------------------------------
  // Aba: Config
  // ------------------------------------------------------------------
  async function tabConfig(root, inst) {
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Configurações do servidor</div>
          <form id="cfg" class="form-grid">
            <div class="field full">
              <label class="label" for="c-name">Nome</label>
              <input class="input" id="c-name" maxlength="40" value="${esc(inst.name)}" />
            </div>
            <div class="field full">
              <label class="label" for="c-motd">MOTD</label>
              <input class="input" id="c-motd" maxlength="80" value="${esc(inst.motd || '')}" />
            </div>
            <div class="field">
              <label class="label" for="c-ram">RAM (MB)</label>
              <input class="input" id="c-ram" type="number" min="512" max="6144" step="256" value="${inst.ram}" />
              <span class="help">Máx. 3072 recomendado nesta máquina (3,5 GB).</span>
            </div>
            <div class="field">
              <label class="label" for="c-port">Porta</label>
              <input class="input" id="c-port" type="number" min="1" max="65535" value="${inst.port}" />
            </div>
            <div class="field">
              <label class="label" for="c-max">Máx. jogadores</label>
              <input class="input" id="c-max" type="number" min="1" max="500" value="${inst.maxPlayers}" />
            </div>
            <div class="field">
              <label class="label" for="c-vd">View distance</label>
              <input class="input" id="c-vd" type="number" min="2" max="32" value="${inst.viewDistance || 6}" />
              <span class="help">Menos = mais FPS pros jogadores.</span>
            </div>
            <div class="field">
              <label class="label" for="c-gm">Modo de jogo</label>
              <select class="select" id="c-gm">
                ${['survival', 'creative', 'adventure', 'spectator'].map((g) => `<option ${g === inst.gamemode ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="label" for="c-df">Dificuldade</label>
              <select class="select" id="c-df">
                ${['peaceful', 'easy', 'normal', 'hard'].map((d) => `<option ${d === inst.difficulty ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>
            <div class="field full">
              <label class="switch">
                <input type="checkbox" id="c-online" ${inst.onlineMode ? 'checked' : ''} />
                <span class="track"></span>
                <span class="switch-label">Somente clientes originais (online-mode)<br><span class="help">Desmarque para aceitar piratas/cracked.</span></span>
              </label>
            </div>
            <div class="field full">
              <label class="switch">
                <input type="checkbox" id="c-wl" ${inst.whitelist ? 'checked' : ''} />
                <span class="track"></span>
                <span class="switch-label">Ativar whitelist</span>
              </label>
            </div>
            <div class="field full row end">
              <span class="help" id="cfg-msg"></span>
              <button class="btn btn-primary" type="submit">💾 Salvar</button>
            </div>
          </form>
        </div>

        <div>
          <div class="card mb">
            <div class="card-title">Trocar versão</div>
            <form id="ver-form" class="col">
              <div class="field">
                <label class="label" for="v-sel">Nova versão do Minecraft</label>
                <select class="select" id="v-sel"><option>carregando…</option></select>
              </div>
              <div class="field hidden" id="v-loader-wrap">
                <label class="label" for="v-loader">Fabric loader</label>
                <select class="select" id="v-loader"></select>
              </div>
              <button class="btn" type="submit">⟳ Trocar versão e reinstalar</button>
              <span class="help warn">⚠ Isso reinstala o jar (o mundo costuma continuar funcionando, mas faça backup antes se for versões bem diferentes, ex.: 1.12 → 1.21).</span>
            </form>
          </div>

          <div class="card">
            <div class="card-title">Identidade</div>
            <dl class="kv">
              <dt>ID</dt><dd class="mono">${esc(inst.id)}</dd>
              <dt>Pasta</dt><dd class="mono small">${esc(inst.dir)}</dd>
              <dt>Java</dt><dd>${esc(javaNeed(inst.version))}</dd>
              <dt>Arquivo</dt><dd class="mono small">${esc(inst.serverJar || '—')}</dd>
              <dt>RCON</dt><dd class="mono small">porta privada ativa (uso interno)</dd>
              <dt>Criado</dt><dd>${new Date(inst.createdAt).toLocaleString('pt-BR')}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-title">server.properties (avançado) <span class="hint">edite direto o arquivo</span></div>
        <div class="row mb">
          <button class="btn btn-sm" id="pp-reload">↻ Recarregar</button>
          <button class="btn btn-sm btn-primary" id="pp-save">💾 Salvar properties</button>
          <span class="help" id="pp-msg"></span>
        </div>
        <textarea class="editor" id="pp" style="min-height:260px" spellcheck="false">carregando…</textarea>
      </div>`;

    const loadProps = async () => {
      try {
        const { props } = await api(`/api/instances/${inst.id}/properties`);
        $('#pp').value = Object.entries(props).map(([k, v]) => `${k}=${v}`).join('\n');
      } catch (err) { $('#pp').value = `# erro: ${err.message}`; }
    };
    await loadProps();
    $('#pp-reload').onclick = loadProps;
    $('#pp-save').onclick = async () => {
      const props = {};
      for (const line of $('#pp').value.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#') || t.startsWith('!')) continue;
        const i = t.indexOf('=');
        if (i > 0) props[t.slice(0, i).trim()] = t.slice(i + 1);
      }
      try {
        await api(`/api/instances/${inst.id}/properties`, { method: 'PUT', body: { props } });
        $('#pp-msg').textContent = '✓ salvo';
        $('#pp-msg').className = 'help text-green';
      } catch (err) { toast(err.message, 'error'); }
    };

    // versões disponíveis para troca
    try {
      if (!state.software) state.software = await api('/api/software');
      const sw = (state.software.software || []).find((s) => s.id === inst.software);
      const sel = $('#v-sel');
      sel.innerHTML = (sw?.versions || []).map((v) => `<option value="${esc(v)}" ${v === inst.version ? 'selected' : ''}>${esc(v)}</option>`).join('') || '<option value="">sem versões</option>';
      if (inst.software === 'fabric') {
        $('#v-loader-wrap').classList.remove('hidden');
        $('#v-loader').innerHTML = (state.software.fabricLoaders || []).map((l) => `<option ${l === inst.loaderVersion ? 'selected' : ''}>${esc(l)}</option>`).join('');
      }
    } catch { /* offline */ }

    $('#ver-form').onsubmit = async (e) => {
      e.preventDefault();
      const version = $('#v-sel').value;
      if (!version) return;
      const ok = await confirmDialog(`Trocar ${inst.name} para ${version}? O jar será reinstalado.`, { title: 'Trocar versão', confirmText: 'Trocar' });
      if (!ok) return;
      try {
        const body = { version };
        if (inst.software === 'fabric') body.loaderVersion = $('#v-loader').value;
        const { jobId } = await api(`/api/instances/${inst.id}/version`, { method: 'POST', body });
        watchJob(jobId, { onDone: (j) => { if (j.status === 'done') { toast('Versão trocada.', 'success'); render(); } } });
      } catch (err) { toast(err.message, 'error'); }
    };

    $('#cfg').onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#cfg-msg');
      msg.textContent = 'salvando…';
      try {
        const body = {
          name: $('#c-name').value.trim(),
          motd: $('#c-motd').value,
          ram: Number($('#c-ram').value),
          port: Number($('#c-port').value),
          maxPlayers: Number($('#c-max').value),
          viewDistance: Number($('#c-vd').value),
          gamemode: $('#c-gm').value,
          difficulty: $('#c-df').value,
          onlineMode: $('#c-online').checked,
          whitelist: $('#c-wl').checked,
        };
        const { restartNeeded } = await api(`/api/instances/${inst.id}`, { method: 'PATCH', body });
        msg.textContent = restartNeeded ? '✓ salvo (reinicie para aplicar)' : '✓ salvo';
        msg.className = 'help ' + (restartNeeded ? 'text-amber' : 'text-green');
        toast(restartNeeded ? 'Salvo. Reinicie o servidor para aplicar.' : 'Configurações salvas.', 'success');
        refreshInstances().catch(() => {});
      } catch (err) {
        msg.textContent = '';
        toast(err.message, 'error');
      }
    };
  }

  function javaNeed(v) {
    return parseInt(String(v).split('.')[0], 10) >= 26 ? 'Java 25 (baixado sob demanda)' : 'Java 21 (baixado sob demanda)';
  }

  // ------------------------------------------------------------------
  // Aba: Arquivos
  // ------------------------------------------------------------------
  async function tabFiles(root, inst) {
    const base = inst.dir;
    root.innerHTML = `
      <div class="banner info"><span class="bi">📁</span><span>Pasta do servidor: <span class="mono">${esc(base)}</span></span></div>
      <div class="card">
        <div class="card-title">
          <span id="crumbs"></span>
          <span class="hint row">
            <label class="btn btn-sm">↑ Enviar arquivo<input type="file" id="fu" hidden /></label>
            <button class="btn btn-sm" id="f-new">＋ Novo arquivo</button>
            <button class="btn btn-sm" id="f-reload">↻</button>
          </span>
        </div>
        <div class="file-list" id="fl"><div class="loading"><span class="spin"></span></div></div>
      </div>`;

    let path = '';

    async function load(p) {
      path = p || '';
      const box = $('#fl');
      try {
        const data = await api(`/api/instances/${inst.id}/list?path=${encodeURIComponent(path)}`);
        const parts = path ? path.split('/') : [];
        $('#crumbs').innerHTML = `<a data-g="">raiz</a>` + parts.map((seg, i) =>
          `<span class="sep">/</span><a data-g="${esc(parts.slice(0, i + 1).join('/'))}">${esc(seg)}</a>`).join('');
        $('#crumbs').querySelectorAll('[data-g]').forEach((a) => a.onclick = () => load(a.dataset.g));

        if (!data.entries.length) {
          box.innerHTML = `<div class="empty" style="padding:26px"><p>Pasta vazia.</p></div>`;
        } else {
          box.innerHTML = data.entries.map((e) => `
            <div class="file-row" data-name="${esc(e.name)}" data-type="${e.type}">
              <span class="ico">${e.type === 'dir' ? '📁' : fileIcon(e.name)}</span>
              <span class="nm">${esc(e.name)}</span>
              <span class="sz">${e.type === 'dir' ? '—' : fmtBytes(e.size)}</span>
              <button class="btn btn-sm btn-ghost del" title="Excluir">🗑</button>
            </div>`).join('');
          box.querySelectorAll('.file-row').forEach((row) => {
            const name = row.dataset.name;
            const full = path ? `${path}/${name}` : name;
            row.onclick = (e) => {
              if (e.target.closest('.del')) return;
              if (row.dataset.type === 'dir') load(full);
              else openEditor(full);
            };
            row.querySelector('.del').onclick = async () => {
              const ok = await confirmDialog(`Excluir ${full}?`, { title: 'Excluir arquivo/pasta', confirmText: 'Excluir' });
              if (!ok) return;
              try {
                await api(`/api/instances/${inst.id}/file?path=${encodeURIComponent(full)}`, { method: 'DELETE' });
                toast('Excluído.', 'success');
                load(path);
              } catch (err) { toast(err.message, 'error'); }
            };
          });
        }
      } catch (err) {
        box.innerHTML = `<div class="empty" style="padding:26px"><p>${esc(err.message)}</p></div>`;
      }
    }

    async function openEditor(rel) {
      const isText = /\.(txt|yml|yaml|json|properties|cfg|conf|toml|ini|log|md|xml|mcfunction|lang|csv|shtml|html|js|css)$/i.test(rel) ||
        !/\.[a-z0-9]+$/i.test(rel);
      const ok = await modal({
        title: rel,
        hideConfirm: true,
        cancelText: 'Fechar',
        body: `<div id="ed-wrap"><div class="loading"><span class="spin"></span> abrindo…</div></div>`,
      });
      void ok;
      try {
        const f = await api(`/api/instances/${inst.id}/file?path=${encodeURIComponent(rel)}`);
        const wrap = $('#ed-wrap');
        if (f.encoding === 'base64' || !isText) {
          wrap.innerHTML = `<p class="muted">Arquivo binário (${fmtBytes(f.size)}) — não dá pra editar no navegador.</p>
            <div class="row"><a class="btn btn-sm" href="/api/instances/${inst.id}/file?path=${encodeURIComponent(rel)}" download>↓ Baixar</a></div>`;
          return;
        }
        wrap.innerHTML = `
          <textarea class="editor" id="ed" spellcheck="false">${esc(f.content)}</textarea>
          <div class="row end mt">
            <span class="help" id="ed-msg"></span>
            <button class="btn btn-primary" id="ed-save">💾 Salvar</button>
          </div>`;
        $('#ed-save').onclick = async () => {
          try {
            await apiRaw(`/api/instances/${inst.id}/file?path=${encodeURIComponent(rel)}`, {
              method: 'PUT', body: $('#ed').value, contentType: 'text/plain; charset=utf-8',
            });
            $('#ed-msg').textContent = '✓ salvo';
            $('#ed-msg').className = 'help text-green';
            toast(`${rel} salvo.`, 'success');
          } catch (err) { toast(err.message, 'error'); }
        };
      } catch (err) {
        $('#ed-wrap').innerHTML = `<p class="text-red">${esc(err.message)}</p>`;
      }
    }

    $('#f-reload').onclick = () => load(path);
    $('#f-new').onclick = async () => {
      const ok = await modal({
        title: 'Novo arquivo',
        body: `<div class="field"><label class="label">Nome (pasta atual: /${esc(path)})</label>
               <input class="input" id="nf" placeholder="arquivo.txt" /></div>`,
        confirmText: 'Criar',
      });
      if (!ok) return;
      const name = $('#nf')?.value?.trim();
      if (!name) return;
      try {
        await apiRaw(`/api/instances/${inst.id}/file?path=${encodeURIComponent(path ? `${path}/${name}` : name)}`, {
          method: 'PUT', body: '', contentType: 'text/plain',
        });
        load(path);
      } catch (err) { toast(err.message, 'error'); }
    };
    $('#fu').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await apiRaw(`/api/instances/${inst.id}/file?path=${encodeURIComponent(path ? `${path}/${file.name}` : file.name)}`, {
          method: 'PUT', body: file, contentType: 'application/octet-stream',
        });
        toast('Arquivo enviado.', 'success');
        load(path);
      } catch (err) { toast(err.message, 'error'); }
      e.target.value = '';
    });

    await load('');
  }

  function fileIcon(name) {
    const e = name.split('.').pop().toLowerCase();
    if (['jar', 'zip', 'gz'].includes(e)) return '🧱';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(e)) return '🖼';
    if (['yml', 'yaml', 'json', 'properties', 'cfg', 'toml', 'txt', 'log'].includes(e)) return '📄';
    return '📃';
  }

  // ------------------------------------------------------------------
  // Aba: Backups
  // ------------------------------------------------------------------
  async function tabBackups(root, inst) {
    root.innerHTML = `
      <div class="banner info"><span class="bi">🗄</span><span>Backups guardam o mundo e as configs. Para criar ou restaurar, o servidor precisa estar <b>parado</b> (senão o mundo fica corrompido).</span></div>
      <div class="card">
        <div class="card-title">Backups <span class="hint" id="bk-count"></span></div>
        <div class="row mb">
          <button class="btn btn-primary" id="bk-new">＋ Criar backup agora</button>
          <button class="btn" id="bk-reload">↻ Atualizar</button>
        </div>
        <div id="bk-list"><div class="loading"><span class="spin"></span></div></div>
      </div>`;

    async function load() {
      const box = $('#bk-list');
      try {
        const { backups } = await api(`/api/instances/${inst.id}/backups`);
        $('#bk-count').textContent = backups.length ? `${backups.length} arquivo(s)` : '';
        if (!backups.length) {
          box.innerHTML = `<div class="empty" style="padding:30px"><p>Nenhum backup ainda.</p></div>`;
          return;
        }
        box.innerHTML = `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Arquivo</th><th>Tamanho</th><th>Criado</th><th class="acts"></th></tr></thead>
          <tbody>${backups.map((b) => `<tr>
            <td class="mono small">${esc(b.name)}</td>
            <td class="num">${fmtBytes(b.size)}</td>
            <td>${new Date(b.mtime).toLocaleString('pt-BR')}</td>
            <td class="acts">
              <a class="btn btn-sm" href="/api/instances/${inst.id}/backups/download?name=${encodeURIComponent(b.name)}">↓</a>
              <button class="btn btn-sm" data-rs="${esc(b.name)}">Restaurar</button>
              <button class="btn btn-sm btn-danger" data-dl="${esc(b.name)}">✕</button>
            </td></tr>`).join('')}</tbody></table></div>`;

        box.querySelectorAll('[data-rs]').forEach((b) => b.onclick = async () => {
          const ok = await confirmDialog(
            `Restaurar ${b.name}? Os arquivos atuais serão SOBRITOS pelos do backup (o mundo volta pra como estava).`,
            { title: 'Restaurar backup', confirmText: 'Restaurar' }
          );
          if (!ok) return;
          try {
            await api(`/api/instances/${inst.id}/backups/restore`, { method: 'POST', body: { name: b.dataset.rs } });
            toast('Backup restaurado. Inicie o servidor.', 'success');
          } catch (err) { toast(err.message, 'error'); }
        });
        box.querySelectorAll('[data-dl]').forEach((b) => b.onclick = async () => {
          const ok = await confirmDialog(`Excluir ${b.dataset.dl}?`, { title: 'Excluir backup', confirmText: 'Excluir' });
          if (!ok) return;
          try {
            await api(`/api/instances/${inst.id}/backups?name=${encodeURIComponent(b.dataset.dl)}`, { method: 'DELETE' });
            load();
          } catch (err) { toast(err.message, 'error'); }
        });
      } catch (err) {
        box.innerHTML = `<div class="empty" style="padding:30px"><p>${esc(err.message)}</p></div>`;
      }
    }

    $('#bk-reload').onclick = load;
    $('#bk-new').onclick = async () => {
      try {
        const { jobId } = await api(`/api/instances/${inst.id}/backups`, { method: 'POST', body: {} });
        watchJob(jobId, { onDone: () => load() });
      } catch (err) { toast(err.message, 'error'); }
    };
    await load();
  }

  // ------------------------------------------------------------------
  // View: Tarefas
  // ------------------------------------------------------------------
  async function viewJobs(root) {
    const { jobs } = await api('/api/jobs');
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Tarefas</h1>
          <p class="page-sub">Operações longas do painel: instalações, downloads, backups e exclusões.</p>
        </div>
      </div>
      <div class="card">
        ${jobs.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Tarefa</th><th>Status</th><th>Progresso</th><th>Resultado / erro</th><th>Quando</th></tr></thead>
          <tbody>${jobs.map((j) => `<tr>
            <td><b>${esc(j.label)}</b></td>
            <td><span class="badge ${j.status === 'done' ? 'green' : j.status === 'error' ? 'red' : 'blue'}">${j.status === 'running' ? 'executando' : j.status === 'done' ? 'concluído' : 'erro'}</span></td>
            <td style="min-width:150px">
              ${j.status === 'running'
                ? `<div class="progress ${j.progress == null ? 'indet' : ''}"><i style="width:${j.progress == null ? 34 : Math.round(j.progress * 100)}%"></i></div>
                   <div class="small muted" style="margin-top:5px">${esc(j.message || '')}</div>`
                : `<span class="small muted">${j.progress != null ? Math.round(j.progress * 100) + '%' : '—'}</span>`}
            </td>
            <td class="small ${j.error ? 'text-red' : 'muted'}">${esc(j.error || (j.result ? JSON.stringify(j.result) : '—'))}</td>
            <td class="small muted">${new Date(j.createdAt).toLocaleTimeString('pt-BR')}</td>
          </tr>`).join('')}</tbody></table></div>`
        : `<div class="empty" style="padding:34px"><p>Nenhuma tarefa registrada.</p></div>`}
      </div>`;
  }

  // ------------------------------------------------------------------
  // View: Sistema
  // ------------------------------------------------------------------
  async function viewSystem(root) {
    await refreshStatus();
    const s = state.status || {};
    const j = s.java || { runtimes: {}, system: null };
    const hasAny = j.runtimes?.['21'] || j.runtimes?.['25'] || j.system;

    const jCard = (label, info, major) => `
      <div class="card">
        <div class="card-title">${label} <span class="hint">${info ? '✓' : '—'}</span></div>
        ${info
          ? `<dl class="kv"><dt>Versão</dt><dd>${esc(info.version)}</dd><dt>Caminho</dt><dd class="small mono">${esc(info.path)}</dd></dl>`
          : `<p class="muted small" style="margin:0 0 12px">Não encontrado. Será baixado automaticamente no primeiro start.</p>
             <button class="btn btn-sm btn-primary" data-java="${major}">⬇ Baixar agora</button>`}
      </div>`;

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Sistema</h1>
          <p class="page-sub">Saúde do painel, Java e tarefas recentes.</p>
        </div>
        <div class="page-actions"><a class="btn" href="#/jobs">⚙ Ver todas as tarefas</a></div>
      </div>

      <div class="grid grid-4 mb">
        <div class="stat text-green"><div class="k">Painel</div><div class="v" style="font-size:20px">online</div><div class="d">${fmtDur(s.uptimeMs)} de atividade</div></div>
        <div class="stat"><div class="k">Node</div><div class="v" style="font-size:20px">${esc(s.node || '?')}</div><div class="d">${esc(s.platform || '')}</div></div>
        <div class="stat"><div class="k">Servidores</div><div class="v">${s.instances ?? 0}</div><div class="d">${s.running || 0} no ar</div></div>
        <div class="stat text-amber"><div class="k">Tarefas ativas</div><div class="v">${s.jobs || 0}</div><div class="d">em andamento</div></div>
      </div>

      ${hasAny ? '' : `<div class="banner warn"><span class="bi">☕</span><span><b>Nenhum Java instalado.</b> Tudo bem: o painel baixa um JRE oficial (Adoptium/Temurin) automaticamente, sem pedir admin. Pode adiantar abaixo.</span></div>`}

      <div class="grid grid-2 mb">
        ${jCard('Java 21 (MC 1.20 → 1.21.x)', j.runtimes?.['21'], 21)}
        ${jCard('Java 25 (MC 26.x)', j.runtimes?.['25'], 25)}
        ${j.system
          ? `<div class="card"><div class="card-title">Java do sistema <span class="hint">✓</span></div>
             <dl class="kv"><dt>Versão</dt><dd>${esc(j.system.version)}</dd><dt>Caminho</dt><dd class="small mono">${esc(j.system.path)}</dd></dl></div>`
          : ''}
      </div>

      <div class="card mb">
        <div class="card-title">Armazenamento</div>
        <dl class="kv">
          <dt>Pasta de dados</dt><dd class="mono small">${esc(s.dataDir || '—')}</dd>
          <dt>Servidores</dt><dd class="mono small">${esc(s.serversDir || '—')}</dd>
          <dt>Estado</dt><dd class="mono small">${esc(s.stateFile || '—')}</dd>
          <dt>Softwares</dt><dd>${esc((s.software || []).join(', '))}</dd>
        </dl>
        <div class="banner info mt"><span class="bi">💡</span><span>Dica: os dados ficam fora do OneDrive de propósito — sincronização quebra arquivos de mundo. Não mova essa pasta para dentro do OneDrive.</span></div>
      </div>

      <div class="card">
        <div class="card-title">Tarefas recentes <a class="hint" href="#/jobs">ver tudo →</a></div>
        <div id="sys-jobs"><div class="loading"><span class="spin"></span></div></div>
      </div>`;

    $$('[data-java]').forEach((b) => b.onclick = async () => {
      try {
        const { jobId } = await api('/api/runtime/setup', { method: 'POST', body: { majors: [Number(b.dataset.java)] } });
        watchJob(jobId, { onDone: (jj) => { if (jj.status === 'done') { toast('Java instalado.', 'success'); render(); } } });
      } catch (err) { toast(err.message, 'error'); }
    });

    try {
      const { jobs } = await api('/api/jobs');
      $('#sys-jobs').innerHTML = jobs.length
        ? jobs.slice(0, 8).map((t) => `<div class="file-row" style="cursor:default">
            <span class="ico">${t.status === 'running' ? '⚙' : t.status === 'done' ? '✓' : '✕'}</span>
            <span class="nm">${esc(t.label)}</span>
            <span class="sz">${t.status === 'running' ? (t.message || 'executando…') : t.error || 'concluído'}</span>
          </div>`).join('')
        : '<p class="muted small">Nenhuma tarefa.</p>';
    } catch {
      $('#sys-jobs').innerHTML = '<p class="muted small">Sem dados.</p>';
    }
  }

  // ------------------------------------------------------------------
  // Loop principal
  // ------------------------------------------------------------------
  function boot() {
    // navegação
    window.addEventListener('hashchange', render);
    $$('.nav-item').forEach((a) => {
      a.addEventListener('click', () => {
        // força render mesmo com hash igual
        setTimeout(() => { if (location.hash === a.getAttribute('href')) render(); }, 0);
      });
    });

    // polling global de jobs assistidos
    setInterval(() => {
      for (const id of [...state.jobs.keys()]) pollOnce(id).catch(() => {});
      renderJobDock();
    }, 900);

    // status global
    refreshStatus().catch(() => {});
    setInterval(() => refreshStatus().catch(() => {}), 6000);

    // primeira renderização
    refreshInstances().then(render).catch(render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
