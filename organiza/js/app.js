(() => {
  const STORAGE_KEY = 'organiza_tasks_v1';
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
  const uid = () => 't_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  const todayISO = () => new Date().toISOString().slice(0,10);

  const tips = [
    'Divida tarefas grandes em etapas menores. Isso melhora o progresso e facilita concluir no prazo.',
    'Defina prioridade alta só para o que é realmente urgente. Assim você foca no que importa.',
    'Use o campo Notas para registrar próximos passos, dúvidas ou links úteis.',
    'Atualize o progresso ao terminar cada etapa. O desempenho por tarefa e por categoria muda automaticamente.',
    'Se uma tarefa está atrasada, revise o prazo ou quebre ela em partes menores para retomar o ritmo.',
    'Na planilha, confira prazos e status para ter uma visão geral rápida de trabalho e escola.'
  ];
  let tipIndex = 0;
  let tasks = load();

  function load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); const arr = raw ? JSON.parse(raw) : null; if (Array.isArray(arr)) return arr; } catch {}
    return seed();
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  function seed() {
    const d = new Date();
    const plus = n => { const x=new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
    return [
      {id:uid(), title:'Relatório semanal', type:'trabalho', category:'Relatórios', due:plus(2), priority:'alta', status:'andamento', progress:60, notes:'Revisar dados e enviar por e-mail.'},
      {id:uid(), title:'Estudar Matemática', type:'escola', category:'Matemática', due:plus(1), priority:'media', status:'pendente', progress:20, notes:'Capítulo de equações.'},
      {id:uid(), title:'Apresentação de projeto', type:'trabalho', category:'Projetos', due:plus(5), priority:'alta', status:'pendente', progress:10, notes:'Montar slides e ensaiar.'},
      {id:uid(), title:'Leitura de História', type:'escola', category:'História', due:plus(-1), priority:'media', status:'andamento', progress:50, notes:'Resumir pontos principais.'},
    ];
  }

  function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('is-show'); clearTimeout(toast._tm); toast._tm=setTimeout(()=>t.classList.remove('is-show'),2200); }
  function fmtDate(iso){ if(!iso) return 'Sem prazo'; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
  function isLate(t){ return t.status!=='concluida' && t.due && t.due < todayISO(); }
  function statusLabel(s){ return ({pendente:'Pendente',andamento:'Em andamento',concluida:'Concluída'})[s]||s; }
  function prioLabel(p){ return ({baixa:'Baixa',media:'Média',alta:'Alta'})[p]||p; }
  function typeLabel(t){ return t==='escola'?'Escola':'Trabalho'; }

  function calcPerformance(list){
    if(!list.length) return 0;
    const total = list.reduce((acc,t)=> acc + (t.status==='concluida' ? 100 : Number(t.progress||0)), 0);
    return Math.round(total / list.length);
  }

  function render(){
    const total = tasks.length;
    const done = tasks.filter(t=>t.status==='concluida').length;
    const pending = tasks.filter(t=>t.status!=='concluida').length;
    const late = tasks.filter(isLate).length;
    $('#stat-total').textContent = total;
    $('#stat-done').textContent = done;
    $('#stat-pending').textContent = pending;
    $('#stat-late').textContent = late;

    const overall = calcPerformance(tasks);
    $('#overall-ring').style.setProperty('--pct', overall);
    $('#overall-pct').textContent = overall + '%';
    $('#overall-text').textContent = total ? `Você concluiu ${done} de ${total} tarefa(s). Desempenho geral baseado no progresso e nas conclusões.` : 'Adicione tarefas para acompanhar seu desempenho.';

    renderUpcoming();
    renderTasksTable();
    renderSheet();
    renderPerformance();
  }

  function renderUpcoming(){
    const el = $('#upcoming-list');
    const upcoming = [...tasks].filter(t=>t.status!=='concluida').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,5);
    if(!upcoming.length){ el.innerHTML = '<div class="empty">Nenhuma tarefa pendente. Crie uma nova tarefa para começar.</div>'; return; }
    el.innerHTML = upcoming.map(t=>`
      <div class="item">
        <div>
          <div class="item__title">${esc(t.title)}</div>
          <div class="item__meta">${typeLabel(t.type)} • ${esc(t.category||'Sem categoria')} • ${fmtDate(t.due)}${isLate(t)?' • <span style="color:#ff8f8f">Atrasada</span>':''}</div>
        </div>
        <span class="badge badge--${t.status}">${statusLabel(t.status)}</span>
      </div>`).join('');
  }

  function filteredTasks(){
    const type = $('#filter-type').value;
    const status = $('#filter-status').value;
    return tasks.filter(t => (type==='all'||t.type===type) && (status==='all'||t.status===status))
      .sort((a,b)=> (a.status==='concluida') - (b.status==='concluida') || (a.due||'9999').localeCompare(b.due||'9999'));
  }

  function renderTasksTable(){
    const body = $('#tasks-body');
    const list = filteredTasks();
    if(!list.length){ body.innerHTML = '<tr><td colspan="7"><div class="empty">Nenhuma tarefa encontrada com esses filtros.</div></td></tr>'; return; }
    body.innerHTML = list.map(t=>{
      const perf = t.status==='concluida'?100:Number(t.progress||0);
      return `<tr>
        <td><strong>${esc(t.title)}</strong><div class="item__meta">${esc(t.category||'Sem categoria')}</div></td>
        <td>${typeLabel(t.type)}</td>
        <td>${fmtDate(t.due)}${isLate(t)?'<div class="item__meta" style="color:#ff8f8f">Atrasada</div>':''}</td>
        <td>${prioLabel(t.priority)}</td>
        <td><span class="badge badge--${t.status}">${statusLabel(t.status)}</span></td>
        <td><div class="progress"><span style="width:${perf}%"></span></div><div class="progress-meta">${perf}%</div></td>
        <td><div class="actions">
          <button class="icon-btn" data-edit="${t.id}" title="Editar">✎</button>
          <button class="icon-btn" data-toggle="${t.id}" title="Concluir/Reabrir">✓</button>
          <button class="icon-btn" data-del="${t.id}" title="Excluir">🗑</button>
        </div></td>
      </tr>`;
    }).join('');
    $$('[data-edit]').forEach(b=>b.onclick=()=>openModal(tasks.find(x=>x.id===b.dataset.edit)));
    $$('[data-toggle]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.toggle));
    $$('[data-del]').forEach(b=>b.onclick=()=>delTask(b.dataset.del));
  }

  function renderSheet(){
    const body = $('#sheet-body');
    if(!tasks.length){ body.innerHTML = '<tr><td colspan="8"><div class="empty">Sua planilha está vazia. Adicione tarefas para visualizar aqui.</div></td></tr>'; return; }
    const list = [...tasks].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
    body.innerHTML = list.map(t=>{
      const perf = t.status==='concluida'?100:Number(t.progress||0);
      return `<tr>
        <td>${esc(t.title)}</td><td>${typeLabel(t.type)}</td><td>${esc(t.category||'-')}</td><td>${fmtDate(t.due)}</td>
        <td>${prioLabel(t.priority)}</td><td>${statusLabel(t.status)}</td><td>${perf}%</td><td>${esc(t.notes||'-')}</td>
      </tr>`;
    }).join('');
  }

  function renderPerformance(){
    const catMap = new Map();
    tasks.forEach(t=>{ const k=(t.category||'Sem categoria').trim() || 'Sem categoria'; if(!catMap.has(k)) catMap.set(k,[]); catMap.get(k).push(t); });
    const cats = Array.from(catMap.entries()).map(([name,list])=>({name, pct:calcPerformance(list), count:list.length}))
      .sort((a,b)=>b.pct-a.pct);
    $('#perf-categories').innerHTML = cats.length ? cats.map(c=>barRow(c.name, c.pct, `${c.count} tarefa(s)`)).join('') : '<div class="empty">Sem dados por categoria.</div>';

    const byTask = [...tasks].map(t=>({name:t.title, pct:t.status==='concluida'?100:Number(t.progress||0), meta:typeLabel(t.type)}))
      .sort((a,b)=>b.pct-a.pct).slice(0,8);
    $('#perf-tasks').innerHTML = byTask.length ? byTask.map(t=>barRow(t.name, t.pct, t.meta)).join('') : '<div class="empty">Sem tarefas para analisar.</div>';
  }
  function barRow(name,pct,meta){
    return `<div class="bar-row"><div class="bar-row__top"><span>${esc(name)}</span><span>${pct}% • ${esc(meta)}</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>`;
  }
  function esc(s=''){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  function openModal(task=null){
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
  function closeModal(){ $('#task-modal').close(); }

  function upsertTask(e){
    e.preventDefault();
    const id = $('#task-id').value;
    const data = {
      title: $('#task-title').value.trim(),
      type: $('#task-type').value,
      category: $('#task-category').value.trim(),
      due: $('#task-due').value,
      priority: $('#task-priority').value,
      status: $('#task-status').value,
      progress: Number($('#task-progress').value),
      notes: $('#task-notes').value.trim(),
    };
    if(!data.title) return;
    if(data.status==='concluida') data.progress = 100;
    if(id){ const i=tasks.findIndex(t=>t.id===id); if(i>=0) tasks[i] = {...tasks[i], ...data}; toast('Tarefa atualizada.'); }
    else { tasks.unshift({id:uid(), ...data}); toast('Tarefa criada.'); }
    save(); render(); closeModal();
  }
  function toggleDone(id){
    const t = tasks.find(x=>x.id===id); if(!t) return;
    if(t.status==='concluida'){ t.status='pendente'; t.progress=Math.min(t.progress,95); }
    else { t.status='concluida'; t.progress=100; }
    save(); render();
  }
  function delTask(id){
    const t = tasks.find(x=>x.id===id); if(!t) return;
    if(!confirm(`Excluir "${t.title}"?`)) return;
    tasks = tasks.filter(x=>x.id!==id); save(); render(); toast('Tarefa excluída.');
  }

  function setView(view){
    $$('.nav__item').forEach(b=>b.classList.toggle('is-active', b.dataset.view===view));
    $$('.view').forEach(v=>v.classList.toggle('is-active', v.id === 'view-'+view));
    $('#view-title').textContent = ({dashboard:'Painel',tasks:'Tarefas',sheet:'Planilha',performance:'Desempenho'})[view] || 'Organiza';
    closeSidebar();
  }
  function openSidebar(){ $('#sidebar').classList.add('is-open'); $('#menu-btn').setAttribute('aria-expanded','true'); }
  function closeSidebar(){ $('#sidebar').classList.remove('is-open'); $('#menu-btn').setAttribute('aria-expanded','false'); }

  function showTip(){ $('#help-text').textContent = tips[tipIndex % tips.length]; }
  function openHelp(){ $('#help-card').classList.add('is-open'); $('#help-card').setAttribute('aria-hidden','false'); $('#help-fab').setAttribute('aria-expanded','true'); showTip(); }
  function closeHelp(){ $('#help-card').classList.remove('is-open'); $('#help-card').setAttribute('aria-hidden','true'); $('#help-fab').setAttribute('aria-expanded','false'); }

  function bind(){
    $$('.nav__item').forEach(b=>b.onclick=()=>setView(b.dataset.view));
    $('#menu-btn').onclick=()=> $('#sidebar').classList.contains('is-open') ? closeSidebar() : openSidebar();
    document.addEventListener('click', e=>{ if(window.innerWidth<=980 && $('#sidebar').classList.contains('is-open') && !$('#sidebar').contains(e.target) && !$('#menu-btn').contains(e.target)) closeSidebar(); });
    $('#new-task-btn').onclick=()=>openModal();
    $('#modal-close').onclick=closeModal; $('#task-cancel').onclick=closeModal;
    $('#task-form').onsubmit=upsertTask;
    $('#task-progress').oninput=e=>$('#task-progress-out').textContent=e.target.value+'%';
    $('#filter-type').onchange=renderTasksTable; $('#filter-status').onchange=renderTasksTable;
    $('#add-demo').onclick=()=>{ if(tasks.length && !confirm('Adicionar tarefas de exemplo às suas tarefas atuais?')) return; tasks = seed().concat(tasks); save(); render(); toast('Dados de exemplo adicionados.'); };
    $('#help-fab').onclick=()=> $('#help-card').classList.contains('is-open') ? closeHelp() : openHelp();
    $('#help-close').onclick=closeHelp;
    $('#help-next').onclick=()=>{ tipIndex=(tipIndex+1)%tips.length; showTip(); };
    $('#task-modal').addEventListener('click', e=>{ if(e.target.id==='task-modal') closeModal(); });
  }

  bind(); render(); showTip();
})();
