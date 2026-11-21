const STORAGE_KEY = 'slideforge_projects_v1';
const CURRENT_KEY = 'slideforge_current_v1';

const TEMPLATES = [
  {
    id:'escola-historia', name:'Trabalho Escolar: História', category:'educacao', catLabel:'Educação', effect:'aurora',
    desc:'Modelo para trabalhos escolares com capa, contexto, fatos e conclusão.',
    slides:[
      S('hero','A Revolução <span class="accent">Industrial</span>','Como as máquinas transformaram o trabalho, as cidades e a vida cotidiana.',['Contexto histórico','Mudanças sociais','Legado até hoje'],'ink','#eb4040','Trabalho de História','aurora'),
      S('content','Contexto histórico','Entenda quando e por que tudo começou.',['Início na Inglaterra no século XVIII','Avanço das máquinas a vapor','Crescimento das fábricas e cidades'],'wine','#eb4040','Introdução','float'),
      S('timeline','Linha do tempo','Principais marcos do período.',['1760: início da mecanização','1800: expansão das indústrias','1850: mudanças urbanas e sociais'],'graphite','#f5b301','Fatos importantes','grid'),
      S('split','Impactos na sociedade','Compare os lados positivos e negativos.',['Mais produção e inovação','Condições difíceis de trabalho','Surgimento de novos direitos'],'dark','#eb4040','Análise','shine'),
      S('quote','A história ajuda a entender o presente.','Use esta frase para reforçar a importância do tema.','','ember','#f5b301','Reflexão','aurora'),
      S('content','Conclusão','Feche o trabalho com clareza.',['Resumo dos principais pontos','O que aprendemos com o tema','Fontes e agradecimentos'],'red','#f4eeee','Encerramento','float'),
    ]
  },
  {
    id:'escola-ciencias', name:'Feira de Ciências', category:'educacao', catLabel:'Educação', effect:'grid',
    desc:'Ideal para experimentos, método científico e apresentação de resultados.',
    slides:[
      S('hero','Energia <span class="accent">Solar</span>','Como a luz do sol pode virar eletricidade de forma limpa.',['Pergunta','Hipótese','Resultado'],'ocean','#f5b301','Feira de Ciências','grid'),
      S('content','Objetivo do experimento','O que queremos descobrir?',['Entender como a energia solar funciona','Testar em diferentes condições','Comparar com outras fontes'],'graphite','#f5b301','Objetivo','float'),
      S('cards','Materiais e método','Mostre o passo a passo do experimento.',['Painel solar pequeno','Lâmpada e multímetro','Registro dos resultados'],'dark','#eb4040','Método','shine'),
      S('stats','Resultados','Destaque os dados mais importantes.',['85%|Eficiência máxima','3x|Mais luz, mais energia','0|Emissão direta'],'wine','#eb4040','Dados','aurora'),
      S('quote','Ciência é fazer perguntas.','E testar as respostas com cuidado e curiosidade.','','ink','#f5b301','Mensagem','float'),
      S('content','Conclusão','O que aprendemos com o projeto?',['A hipótese foi confirmada','A energia solar é viável','Próximos testes possíveis'],'ocean','#f4eeee','Conclusão','grid'),
    ]
  },
  {
    id:'escola-livro', name:'Seminário de Livro', category:'educacao', catLabel:'Educação', effect:'float',
    desc:'Perfeito para resumo de livro, personagens, temas e opinião pessoal.',
    slides:[
      S('hero','Seminário do <span class="accent">Livro</span>','Apresente a obra, o autor e os pontos que mais chamaram atenção.',['Autor e contexto','Personagens','Mensagem do livro'],'paper','#eb4040','Língua Portuguesa','float'),
      S('content','Sobre a obra','Informações essenciais para começar.',['Título e autor','Ano e contexto','Gênero da obra'],'wine','#eb4040','Introdução','shine'),
      S('cards','Personagens principais','Quem move a história?',['Protagonista: objetivos e desafios','Antagonista: conflitos gerados','Personagens secundários: apoio à trama'],'dark','#f5b301','Personagens','float'),
      S('timeline','Momentos-chave','Organize os acontecimentos principais.',['Início: apresentação do cenário','Conflito: problema central','Desfecho: resolução da história'],'graphite','#eb4040','Enredo','grid'),
      S('quote','Toda boa história deixa uma marca.','Compartilhe a mensagem que o livro passou para você.','','ember','#f5b301','Opinião','aurora'),
      S('content','Conclusão e recomendação','Finalize com sua visão sobre a obra.',['Tema principal aprendido','Pontos fortes do livro','Vale a pena ler? Por quê?'],'paper','#eb4040','Encerramento','float'),
    ]
  },
  {
    id:'trab-reuniao', name:'Reunião de Equipe', category:'negocios', catLabel:'Trabalho', effect:'shine',
    desc:'Para reuniões, alinhamentos, status semanal e decisões do time.',
    slides:[
      S('hero','Reunião de <span class="accent">Alinhamento</span>','Objetivos, progresso e próximos passos do time.',['Status atual','Bloqueios','Decisões'],'dark','#eb4040','Trabalho','shine'),
      S('content','Agenda','O que vamos tratar hoje.',['Resultados da semana','Pontos de atenção','Próximas prioridades'],'graphite','#eb4040','Agenda','float'),
      S('stats','Indicadores','Números que mostram o progresso.',['92%|Tarefas concluídas','4|Projetos ativos','2|Pontos de atenção'],'wine','#f5b301','Resultados','aurora'),
      S('split','Desafios e soluções','O que está travando e como resolver.',['Bloqueio identificado','Ação proposta','Responsável definido'],'dark','#eb4040','Plano','grid'),
      S('timeline','Próximos passos','Cronograma para a próxima semana.',['Hoje: definir responsáveis','Quarta: revisar entrega','Sexta: apresentar resultado'],'ink','#eb4040','Cronograma','shine'),
      S('content','Decisões finais','Registre o que foi combinado.',['Responsáveis definidos','Prazos confirmados','Próxima reunião agendada'],'red','#f4eeee','Encerramento','float'),
    ]
  },
  {
    id:'trab-proposta', name:'Proposta Profissional', category:'negocios', catLabel:'Trabalho', effect:'aurora',
    desc:'Apresente proposta comercial, projeto ou serviço com visual profissional.',
    slides:[
      S('hero','Proposta <span class="accent">Comercial</span>','Uma solução clara para gerar valor e resultado.',['Problema','Solução','Investimento'],'ember','#eb4040','Proposta','aurora'),
      S('content','O desafio','O que precisa ser resolvido.',['Situação atual','Impacto no negócio','Oportunidade de melhoria'],'dark','#eb4040','Contexto','float'),
      S('cards','Nossa solução','Como vamos entregar resultado.',['Diagnóstico e planejamento','Execução com acompanhamento','Entrega e otimização'],'wine','#eb4040','Serviço','shine'),
      S('stats','Resultados esperados','O que o cliente pode ganhar.',['+30%|Mais eficiência','-20%|Menos retrabalho','4 sem|Prazo estimado'],'graphite','#f5b301','Valor','grid'),
      S('timeline','Cronograma','Etapas da implementação.',['Semana 1: diagnóstico','Semana 2-3: execução','Semana 4: entrega e ajustes'],'dark','#eb4040','Prazo','float'),
      S('hero','Vamos começar?','Entre em contato para aprovar a proposta e iniciar o projeto.',['Email: seuemail@exemplo.com','Telefone: (00) 00000-0000','Site: seusite.com'],'red','#f4eeee','Contato','aurora'),
    ]
  },
  {
    id:'trab-treinamento', name:'Treinamento Profissional', category:'negocios', catLabel:'Trabalho', effect:'grid',
    desc:'Para treinamentos, integração e capacitação de equipe.',
    slides:[
      S('hero','Treinamento de <span class="accent">Equipe</span>','Capacitação prática para melhorar processos e resultados.',['Objetivos','Conteúdo','Prática'],'ocean','#f5b301','Capacitação','grid'),
      S('content','Objetivos do treinamento','O que a equipe vai aprender.',['Entender o processo correto','Aplicar boas práticas','Reduzir erros no dia a dia'],'dark','#f5b301','Objetivos','float'),
      S('cards','Conteúdo principal','Módulos do treinamento.',['Módulo 1: fundamentos','Módulo 2: prática guiada','Módulo 3: avaliação e dúvidas'],'graphite','#eb4040','Módulos','shine'),
      S('split','Boas práticas','Faça e evite durante o processo.',['Faça: siga o checklist','Faça: registre as etapas','Evite: pular validações'],'wine','#eb4040','Orientações','aurora'),
      S('quote','Conhecimento compartilhado fortalece o time.','Aprender juntos gera resultados melhores.','','ember','#f5b301','Mensagem','float'),
      S('content','Encerramento','Próximos passos após o treinamento.',['Material de apoio disponível','Canal para dúvidas','Avaliação de aprendizado'],'ocean','#f4eeee','Conclusão','grid'),
    ]
  },
  {
    id:'escola-matematica', name:'Aula de Matemática', category:'educacao', catLabel:'Educação', effect:'shine',
    desc:'Perfeito para explicar conceitos, exemplos e exercícios de forma visual.',
    slides:[
      S('hero','Matemática <span class="accent">sem medo</span>','Aprenda o conceito, veja exemplos e pratique com confiança.',['Conceito','Exemplos','Exercícios'],'dark','#eb4040','Aula de Matemática','shine'),
      S('content','Conceito do dia','Explique a ideia principal de forma simples.',['Definição clara','Onde usamos no dia a dia','Pontos importantes'],'graphite','#eb4040','Conceito','float'),
      S('cards','Exemplos práticos','Mostre como resolver passo a passo.',['Exemplo 1: entenda o problema','Exemplo 2: aplique a fórmula','Exemplo 3: confira o resultado'],'wine','#f5b301','Exemplos','aurora'),
      S('stats','Regras rápidas','Destaques para lembrar na hora da prova.',['3|Passos para resolver','1|Fórmula principal','100%|Atenção ao sinal'],'ink','#eb4040','Dicas','grid'),
      S('timeline','Como resolver','Um roteiro simples para qualquer exercício.',['Leia: entenda o enunciado','Calcule: aplique o método','Revise: confirme a resposta'],'dark','#eb4040','Passo a passo','shine'),
      S('content','Exercício e conclusão','Finalize com prática e resumo.',['Exercício para a turma','Resumo do que aprendemos','Dúvidas e próximos passos'],'red','#f4eeee','Encerramento','float'),
    ]
  },
];

function S(layout, title, subtitle, bullets, bg, accent, kicker = 'SlideForge', effect = 'none', image = '', imageAlt = '', imageCaption = '', bgImage = '') {
  const arr = Array.isArray(bullets) ? bullets : String(bullets||'').split('\n').filter(Boolean);
  return { id: uid(), layout, title, subtitle, bullets: arr, note: '', bg, accent, kicker, effect, image, imageAlt, imageCaption, bgImage };
}
function uid() { return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function escapeHTML(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function sanitizeTitleHTML(str = '') {
  // Allow only <span class="accent">...</span> from our templates; escape rest.
  const placeholders = [];
  let safe = String(str).replace(/<span\s+class="accent">(.*?)<\/span>/gi, (_, inner) => {
    const token = `@@ACCENT_${placeholders.length}@@`;
    placeholders.push(escapeHTML(inner));
    return token;
  });
  safe = escapeHTML(safe);
  placeholders.forEach((inner, i) => { safe = safe.replace(`@@ACCENT_${i}@@`, `<span class="accent">${inner}</span>`); });
  return safe;
}

const state = {
  view: 'home',
  templateFilter: 'all',
  project: null,
  activeSlide: 0,
  presentIndex: 0,
};

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function loadProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveProjects(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
function persistCurrent() {
  if (!state.project) return;
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ project: state.project, activeSlide: state.activeSlide }));
}
function loadCurrent() {
  try { return JSON.parse(localStorage.getItem(CURRENT_KEY)); } catch { return null; }
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
}

function setView(view) {
  state.view = view;
  $$('.view').forEach(v => v.classList.remove('is-visible'));
  const target = $(`#view-${view}`);
  if (target) target.classList.add('is-visible');
  $$('.nav-item[data-view]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.view === view));
  const titles = {
    home: ['Área de trabalho', 'Crie apresentaçÁµes com impacto'],
    templates: ['Biblioteca', 'Modelos prontos para começar'],
    editor: ['Editor', state.project ? state.project.name : 'Novo slide'],
    projects: ['Seus arquivos', 'Projetos salvos neste navegador'],
    ai: ['Assistente IA', 'Gere slides automaticamente a partir de um tema'],
  };
  const [eyebrow, title] = titles[view] || titles.home;
  $('#topbar-eyebrow').textContent = eyebrow;
  $('#topbar-title').textContent = title;
  closeMobileSidebar();
  if (view === 'editor') renderEditor();
  if (view === 'projects' || view === 'home') renderProjects();
  if (view === 'templates' || view === 'home') renderTemplates();
  updateStats();
}

function updateStats() {
  const projects = loadProjects();
  $('#stat-projects').textContent = String(projects.length);
  $('#stat-templates').textContent = String(TEMPLATES.length);
}

function defaultProject(name = 'Apresentação sem título') {
  return {
    id: uid(), name, updatedAt: Date.now(),
    slides: [S('hero', 'Seu título <span class="accent">impactante</span>', 'Escreva um subtítulo claro e direto para contextualizar sua apresentação.', ['Ponto principal','Mensagem clara','Chamada para ação'], 'dark', '#eb4040', 'DEV.programier', 'aurora')],
  };
}

function newProjectFromTemplate(templateId) {
  const tpl = TEMPLATES.find(t => t.id === templateId);
  const project = tpl ? { id: uid(), name: tpl.name, updatedAt: Date.now(), slides: clone(tpl.slides).map(sl => ({ ...sl, id: uid() })) } : defaultProject();
  state.project = project;
  state.activeSlide = 0;
  persistCurrent();
  setView('editor');
  toast(tpl ? `Modelo "${tpl.name}" carregado.` : 'Novo projeto criado.');
}

function openProject(id) {
  const p = loadProjects().find(x => x.id === id);
  if (!p) return toast('Projeto não encontrado.');
  state.project = clone(p);
  state.activeSlide = 0;
  persistCurrent();
  setView('editor');
}

function saveCurrentProject() {
  if (!state.project) { toast('Nada para salvar.'); return; }
  state.project.updatedAt = Date.now();
  const list = loadProjects();
  const idx = list.findIndex(p => p.id === state.project.id);
  if (idx >= 0) list[idx] = clone(state.project); else list.unshift(clone(state.project));
  saveProjects(list);
  persistCurrent();
  renderProjects();
  updateStats();
  toast('Projeto salvo neste navegador.');
}

function duplicateProject(id) {
  const list = loadProjects();
  const p = list.find(x => x.id === id);
  if (!p) return;
  const copy = clone(p);
  copy.id = uid();
  copy.name = p.name + ' (cópia)';
  copy.updatedAt = Date.now();
  copy.slides.forEach(sl => sl.id = uid());
  list.unshift(copy);
  saveProjects(list);
  renderProjects(); updateStats();
  toast('Projeto duplicado.');
}

function deleteProject(id) {
  if (!confirm('Excluir este projeto? Essa ação não pode ser desfeita.')) return;
  const list = loadProjects().filter(p => p.id !== id);
  saveProjects(list);
  if (state.project && state.project.id === id) { state.project = null; localStorage.removeItem(CURRENT_KEY); }
  renderProjects(); updateStats();
  toast('Projeto excluído.');
}
function getActiveSlide() { return state.project?.slides[state.activeSlide]; }

function renderTemplates() {
  const filter = state.templateFilter;
  const items = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter);
  const html = items.map(t => templateCard(t)).join('');
  $('#templates-grid').innerHTML = html || emptyState('Nenhum modelo nessa categoria', 'Tente outro filtro.');
  $('#home-templates').innerHTML = TEMPLATES.slice(0, 3).map(t => templateCard(t)).join('');
  bindTemplateActions($('#templates-grid'));
  bindTemplateActions($('#home-templates'));
  $$('#template-filters .filter').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.filter === filter);
  });
}

function templateThumb(t) {
  const sl = t.slides[0];
  const bg = bgStyle(sl.bg, sl.accent, sl.bgImage);
  return `<div class="card__thumb"><div class="card__thumb-inner fx-thumb fx-${escapeHTML(sl.effect||t.effect||'none')}" style="${bg}">
    <div class="fx-layer"></div>
    <div class="thumb-kicker">${escapeHTML(sl.kicker || 'Modelo')}</div>
    <div class="thumb-title">${sanitizeTitleHTML(sl.title)}</div>
    <div class="thumb-sub">${escapeHTML(sl.subtitle || '')}</div>
  </div></div>`;
}

function templateCard(t) {
  return `<article class="card">
    ${templateThumb(t)}
    <div class="card__body">
      <div class="card__meta"><span class="card__cat">${escapeHTML(t.catLabel)}</span><span class="card__badge">${t.slides.length} slides</span></div>
      <h3 class="card__title">${escapeHTML(t.name)}</h3>
      <p class="card__desc">${escapeHTML(t.desc)}</p>
      <div class="card__actions">
        <button class="btn btn--primary" data-use-template="${t.id}" type="button">Usar modelo</button>
      </div>
    </div>
  </article>`;
}

function bindTemplateActions(root) {
  $$('[data-use-template]', root).forEach(btn => btn.addEventListener('click', () => newProjectFromTemplate(btn.dataset.useTemplate)));
}

function renderProjects() {
  const projects = loadProjects().sort((a,b) => b.updatedAt - a.updatedAt);
  const html = projects.map(projectCard).join('');
  const empty = emptyState('Nenhum projeto salvo', 'Crie um slide do zero ou comece com um modelo.', '<button class="btn btn--primary" id="empty-new" type="button">Criar projeto</button>');
  $('#projects-grid').innerHTML = html || empty;
  $('#home-projects').innerHTML = projects.slice(0, 3).map(projectCard).join('') || emptyState('Seus projetos aparecem aqui', 'Quando você salvar, eles ficam disponíveis nesta seção.');
  bindProjectActions($('#projects-grid'));
  bindProjectActions($('#home-projects'));
  const emptyNew = $('#empty-new');
  if (emptyNew) emptyNew.addEventListener('click', () => { state.project = defaultProject(); state.activeSlide = 0; persistCurrent(); setView('editor'); });
}

function projectCard(p) {
  const sl = p.slides[0] || S('title','Sem título','',[], 'dark','#eb4040');
  const bg = bgStyle(sl.bg, sl.accent);
  const date = new Date(p.updatedAt).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
  return `<article class="card">
    <div class="card__thumb"><div class="card__thumb-inner fx-thumb fx-${escapeHTML(sl.effect||'none')}" style="${bg}">
      <div class="fx-layer"></div>
      <div class="thumb-kicker">${escapeHTML(sl.kicker || 'Projeto')}</div>
      <div class="thumb-title">${sanitizeTitleHTML(sl.title || 'Sem título')}</div>
      <div class="thumb-sub">${escapeHTML(sl.subtitle || '')}</div>
    </div></div>
    <div class="card__body">
      <div class="card__meta"><span class="card__cat">${p.slides.length} slide${p.slides.length>1?'s':''}</span><span class="card__badge">${date}</span></div>
      <h3 class="card__title">${escapeHTML(p.name)}</h3>
      <p class="card__desc">${escapeHTML(sl.subtitle || 'Projeto de apresentação salvo localmente.')}</p>
      <div class="card__actions">
        <button class="btn btn--primary" data-open-project="${p.id}" type="button">Abrir</button>
        <button class="btn btn--ghost btn--icon" data-dup-project="${p.id}" type="button" title="Duplicar" aria-label="Duplicar projeto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="btn btn--ghost btn--icon" data-del-project="${p.id}" type="button" title="Excluir" aria-label="Excluir projeto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div>
    </div>
  </article>`;
}

function bindProjectActions(root) {
  $$('[data-open-project]', root).forEach(b => b.addEventListener('click', () => openProject(b.dataset.openProject)));
  $$('[data-dup-project]', root).forEach(b => b.addEventListener('click', () => duplicateProject(b.dataset.dupProject)));
  $$('[data-del-project]', root).forEach(b => b.addEventListener('click', () => deleteProject(b.dataset.delProject)));
}

function emptyState(title, desc, action = '') {
  return `<div class="empty"><div class="empty__icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><h3 class="empty__title">${escapeHTML(title)}</h3><p class="empty__desc">${escapeHTML(desc)}</p>${action}</div>`;
}
function bgStyle(bg, accent = '#eb4040', bgImage = '') {
  const map = {
    dark: 'linear-gradient(160deg,rgba(26,16,17,.88),rgba(11,6,7,.92) 70%), radial-gradient(120% 100% at 100% 0%, rgba(179,15,15,.28), transparent 55%)',
    red: 'linear-gradient(135deg,rgba(179,15,15,.82),rgba(90,0,0,.88)), radial-gradient(100% 100% at 20% 0%, rgba(255,255,255,.12), transparent 45%)',
    wine: 'linear-gradient(145deg,rgba(42,16,18,.88),rgba(16,6,6,.92)), radial-gradient(100% 100% at 80% 0%, rgba(235,64,64,.2), transparent 50%)',
    graphite: 'linear-gradient(145deg,rgba(37,33,34,.88),rgba(13,11,11,.92)), radial-gradient(100% 100% at 80% 0%, rgba(255,255,255,.06), transparent 45%)',
    ember: 'linear-gradient(145deg,rgba(26,10,10,.84),rgba(61,14,14,.7) 55%, rgba(10,6,7,.92)), radial-gradient(120% 80% at 80% 10%, rgba(235,64,64,.28), transparent 45%)',
    ocean: 'linear-gradient(155deg,rgba(23,17,27,.86),rgba(9,7,11,.92) 70%), radial-gradient(120% 90% at 10% 10%, rgba(245,179,1,.18), transparent 45%)',
    ink: 'linear-gradient(160deg,rgba(29,24,25,.86),rgba(9,6,7,.93) 75%), radial-gradient(100% 80% at 80% 0%, rgba(255,255,255,.08), transparent 45%)',
    paper: 'linear-gradient(160deg,rgba(32,22,23,.86),rgba(18,12,13,.92) 70%), radial-gradient(90% 70% at 100% 0%, rgba(235,64,64,.14), transparent 45%)',
  };
  const overlay = map[bg] || map.dark;
  const img = (bgImage || '').trim();
  const bgPart = img
    ? `background-image: ${overlay}, url("${String(img).replace(/"/g,'%22')}"); background-size: cover; background-position: center;`
    : `background-image: ${overlay};`;
  return `${bgPart}--accent:${accent};`;
}

function renderEditor() {
  if (!state.project) { state.project = defaultProject(); state.activeSlide = 0; }
  if (state.activeSlide >= state.project.slides.length) state.activeSlide = state.project.slides.length - 1;
  renderSlidesList();
  renderCanvas();
  syncProps();
  $('#topbar-title').textContent = state.project.name;
}

function renderSlidesList() {
  const list = $('#slides-list');
  list.innerHTML = state.project.slides.map((sl, i) => {
    const active = i === state.activeSlide ? 'is-active' : '';
    return `<div class="slide-thumb ${active}" data-index="${i}" role="button" tabindex="0" aria-label="Slide ${i+1}">
      <span class="slide-thumb__num">${i+1}</span>
      <div class="slide-thumb__preview"><div class="mini" style="${bgStyle(sl.bg, sl.accent, sl.bgImage)}"><div class="mini__title">${escapeHTML(stripTags(sl.title) || 'Sem título')}</div><div class="mini__sub">${escapeHTML(sl.subtitle || '')}</div></div></div>
    </div>`;
  }).join('');
  $$('.slide-thumb', list).forEach(el => {
    el.addEventListener('click', () => { state.activeSlide = Number(el.dataset.index); renderEditor(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  });
}

function stripTags(str='') { return String(str).replace(/<[^>]*>/g, ''); }

function renderCanvas() {
  const sl = getActiveSlide();
  if (!sl) return;
  $('#canvas-info').textContent = `Slide ${state.activeSlide + 1} de ${state.project.slides.length}`;
  $('#canvas-bg').style.cssText = bgStyle(sl.bg, sl.accent, sl.bgImage) || 'background-image: linear-gradient(160deg,#1a1011,#0b0607 70%);--accent:#eb4040;';
  $('#canvas-bg').className = `slide-canvas__bg fx-bg fx-${sl.effect||'none'}`;
  $('#canvas-content').innerHTML = slideHTML(sl, false);
  $('#canvas-content').className = `slide-canvas__content layout-${sl.layout} fx-content fx-${sl.effect||'none'}${sl.image ? ' has-media' : ''}`;
}

function slideHTML(sl, present) {
  const kicker = `<div class="sc-kicker">${escapeHTML(sl.kicker || 'SlideForge')}</div>`;
  const title = `<h2 class="sc-title">${sanitizeTitleHTML(sl.title || 'Seu título')}</h2>`;
  const renderEssay = (text) => {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const paras = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paras.length <= 1) return `<div class="sc-essay"><p>${escapeHTML(raw).replace(/\n/g,'<br>')}</p></div>`;
    return `<div class="sc-essay">${paras.map(p => `<p>${escapeHTML(p).replace(/\n/g,'<br>')}</p>`).join('')}</div>`;
  };
  const sub = sl.subtitle ? renderEssay(sl.subtitle) : '';
  const items = (sl.bullets || []).filter(b => b.trim());
  const bullets = items.length ? `<ul class="sc-bullets">${items.map(b=>`<li>${escapeHTML(b)}</li>`).join('')}</ul>` : '';
  const footer = `<div class="sc-bar"></div><div class="sc-footer"><span>${escapeHTML(state.project?.name || 'SlideForge')}</span><span>${state.activeSlide + 1}</span></div>`;
  const fx = `<div class="sc-fx" aria-hidden="true"><span class="fx-orb fx-orb-a"></span><span class="fx-orb fx-orb-b"></span><span class="fx-grid"></span><span class="fx-shine"></span></div>`;
  const imgSrc = (sl.image || '').trim();
  const imgAlt = escapeHTML(sl.imageAlt || stripTags(sl.title) || 'Imagem do slide');
  const imgCaption = sl.imageCaption ? `<figcaption class="sc-media__caption">${escapeHTML(sl.imageCaption)}</figcaption>` : '';
  const media = imgSrc ? `<figure class="sc-media"><img class="sc-media__img" src="${escapeHTML(imgSrc)}" alt="${imgAlt}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.sc-media').style.display='none'">${imgCaption}</figure>` : '';

  if (sl.layout === 'hero') {
    const chips = items.length ? `<div class="sc-chips">${items.map(b=>`<span class="sc-chip">${escapeHTML(b)}</span>`).join('')}</div>` : '';
    const heroRight = media ? `<div class="hero-art hero-art--media">${media}</div>` : `<div class="hero-art"><div class="hero-ring"></div><div class="hero-ring hero-ring-b"></div><div class="hero-core"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></svg></div></div>`;
    return `${fx}<div class="hero-copy">${kicker}${title}${sub}${chips}</div>${heroRight}${footer}`;
  }
  if (sl.layout === 'cards') {
    const cards = (items.length?items:['Adicione um item','Adicione um item','Adicione um item']).slice(0,3).map((b,i)=>`<div class="sc-card"><span class="sc-card-n">0${i+1}</span><p>${escapeHTML(b)}</p></div>`).join('');
    const body = media ? `<div class="sc-content-grid"><div class="sc-content-copy">${sub}<div class="sc-cards">${cards}</div></div>${media}</div>` : `${sub}<div class="sc-cards">${cards}</div>`;
    return `${fx}${kicker}${title}${body}${footer}`;
  }
  if (sl.layout === 'timeline') {
    const steps = (items.length?items:['Etapa 1','Etapa 2','Etapa 3']).slice(0,4).map((b,i)=>{const [h,...r]=b.split(':'); const body=r.join(':').trim(); return `<div class="sc-step"><span class="sc-step-dot"></span><div><strong>${escapeHTML(body?h.trim():`Etapa ${i+1}`)}</strong><span>${escapeHTML(body?body:b)}</span></div></div>`;}).join('');
    const body = media ? `<div class="sc-content-grid"><div class="sc-content-copy">${sub}<div class="sc-timeline">${steps}</div></div>${media}</div>` : `${sub}<div class="sc-timeline">${steps}</div>`;
    return `${fx}${kicker}${title}${body}${footer}`;
  }
  if (sl.layout === 'stats') {
    const stats = (items.length?items:['100%|Resultado','3|Pontos principais','1|Objetivo']).slice(0,3).map(b=>{const [v,...r]=b.split('|'); return `<div class="sc-stat"><strong>${escapeHTML(v.trim())}</strong><span>${escapeHTML(r.join('|').trim()||'Dado importante')}</span></div>`;}).join('');
    const body = media ? `<div class="sc-content-grid"><div class="sc-content-copy">${sub}<div class="sc-stats">${stats}</div></div>${media}</div>` : `${sub}<div class="sc-stats">${stats}</div>`;
    return `${fx}${kicker}${title}${body}${footer}`;
  }
  if (sl.layout === 'content') {
    const body = media ? `<div class="sc-content-grid">${media}<div class="sc-content-copy">${sub}${bullets}</div></div>` : `${sub}${bullets}`;
    return `${fx}${kicker}${title}${body}${footer}`;
  }
  if (sl.layout === 'split') {
    const aside = media ? `<div class="sc-split-aside sc-split-aside--media">${media}</div>` : `<div class="sc-split-aside"><div class="aside-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div></div>`;
    return `${fx}<div><div class="sc-kicker">${escapeHTML(sl.kicker || 'SlideForge')}</div><h2 class="sc-title">${sanitizeTitleHTML(sl.title || 'Seu título')}</h2>${sub}${bullets}</div>
      ${aside}
      <div class="sc-bar" style="grid-column:1/-1"></div><div class="sc-footer" style="grid-column:1/-1"><span>${escapeHTML(state.project?.name || 'SlideForge')}</span><span>${state.activeSlide + 1}</span></div>`;
  }
  if (sl.layout === 'quote') {
    return `${fx}${kicker}${title}${sub}${media}${footer}`;
  }
  return `${fx}<div style="max-width:100%">${kicker}${title}${sub}${bullets}${media}</div>${footer}`;
}

function syncProps() {
  const sl = getActiveSlide(); if (!sl) return;
  const nameInput = $('#prop-project-name');
  if (nameInput) nameInput.value = state.project.name || '';
  $('#prop-title').value = stripTags(sl.title);
  $('#prop-subtitle').value = sl.subtitle || '';
  $('#prop-bullets').value = (sl.bullets || []).join('\n');
  $('#prop-note').value = sl.note || '';
  const img = $('#prop-image'); if (img) img.value = sl.image || '';
  const imgAlt = $('#prop-image-alt'); if (imgAlt) imgAlt.value = sl.imageAlt || '';
  const imgCap = $('#prop-image-caption'); if (imgCap) imgCap.value = sl.imageCaption || '';
  const bgImg = $('#prop-bg-image'); if (bgImg) bgImg.value = sl.bgImage || '';
  $$('#layout-options .layout-opt').forEach(b => b.classList.toggle('is-active', b.dataset.layout === sl.layout));
  $$('#bg-options .color-swatch').forEach(b => b.classList.toggle('is-active', b.dataset.bg === sl.bg));
  $$('#accent-options .color-swatch').forEach(b => b.classList.toggle('is-active', b.dataset.accent === sl.accent));
  $$('#effect-options .effect-opt').forEach(b => b.classList.toggle('is-active', b.dataset.effect === (sl.effect || 'none')));
}

function updateActiveSlide(patch) {
  const sl = getActiveSlide(); if (!sl) return;
  Object.assign(sl, patch);
  state.project.updatedAt = Date.now();
  renderSlidesList();
  renderCanvas();
  persistCurrent();
}

function addSlide() {
  const base = getActiveSlide();
  const n = state.project.slides.length + 1;
  const sl = S('content', `Novo slide ${n}`, 'Edite este texto para adicionar seu conteúdo.', ['Primeiro ponto', 'Segundo ponto', 'Terceiro ponto'], base?.bg || 'dark', base?.accent || '#eb4040', base?.kicker || 'SlideForge', base?.effect || 'none');
  state.project.slides.splice(state.activeSlide + 1, 0, sl);
  state.activeSlide += 1;
  renderEditor(); persistCurrent();
}

function duplicateSlide() {
  const sl = getActiveSlide(); if (!sl) return;
  const copy = clone(sl); copy.id = uid();
  state.project.slides.splice(state.activeSlide + 1, 0, copy);
  state.activeSlide += 1;
  renderEditor(); persistCurrent();
}

function deleteSlide() {
  if (state.project.slides.length <= 1) return toast('A apresentação precisa ter pelo menos 1 slide.');
  state.project.slides.splice(state.activeSlide, 1);
  state.activeSlide = Math.max(0, state.activeSlide - 1);
  renderEditor(); persistCurrent();
}

function moveSlide(dir) {
  const i = state.activeSlide;
  const j = i + dir;
  if (j < 0 || j >= state.project.slides.length) return;
  const arr = state.project.slides;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  state.activeSlide = j;
  renderEditor(); persistCurrent();
}
/* Presentation */
function openPresenter() {
  if (!state.project || !state.project.slides.length) return;
  state.presentIndex = state.activeSlide;
  renderPresenter();
  $('#presenter').classList.add('is-open');
  $('#presenter').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closePresenter() {
  $('#presenter').classList.remove('is-open');
  $('#presenter').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function renderPresenter() {
  const sl = state.project.slides[state.presentIndex];
  if (!sl) return;
  $('#present-bg').style.cssText = bgStyle(sl.bg, sl.accent, sl.bgImage) || 'background-image: linear-gradient(160deg,#1a1011,#0b0607 70%);--accent:#eb4040;';
  $('#present-bg').className = `slide-canvas__bg fx-bg fx-${sl.effect||'none'}`;
  $('#present-content').innerHTML = slideHTMLForIndex(sl, state.presentIndex);
  $('#present-content').className = `slide-canvas__content layout-${sl.layout} fx-content fx-${sl.effect||'none'}${sl.image ? ' has-media' : ''}`;
  $('#present-counter').textContent = `${state.presentIndex + 1} / ${state.project.slides.length}`;
}
function slideHTMLForIndex(sl, index) {
  const prev = state.activeSlide;
  state.activeSlide = index;
  const html = slideHTML(sl, true);
  state.activeSlide = prev;
  return html;
}
function presentNav(dir) {
  const next = state.presentIndex + dir;
  if (next < 0 || next >= state.project.slides.length) return;
  state.presentIndex = next;
  renderPresenter();
}

/* Mobile sidebar */
function openMobileSidebar() {
  $('.sidebar').classList.add('is-open');
  $('#mobile-menu-btn').setAttribute('aria-expanded', 'true');
  let overlay = $('.sidebar-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.className = 'sidebar-overlay'; document.body.appendChild(overlay); overlay.addEventListener('click', closeMobileSidebar); }
  overlay.classList.add('is-visible');
}
function closeMobileSidebar() {
  $('.sidebar').classList.remove('is-open');
  const btn = $('#mobile-menu-btn'); if (btn) btn.setAttribute('aria-expanded', 'false');
  const overlay = $('.sidebar-overlay'); if (overlay) overlay.classList.remove('is-visible');
}

/* Export */
function exportProject() {
  if (!state.project) return;
  // Print: render all slides into canvas-stage temporarily
  const stage = $('#canvas-stage');
  const original = stage.innerHTML;
  stage.innerHTML = state.project.slides.map((sl, i) => {
    state.activeSlide = i;
    return `<div class="slide-canvas" style="margin:0 auto 1rem;"> <div class="slide-canvas__bg fx-bg fx-${sl.effect||'none'}" style="${bgStyle(sl.bg, sl.accent, sl.bgImage)}"></div><div class="slide-canvas__content layout-${sl.layout} fx-content fx-${sl.effect||'none'}${sl.image ? ' has-media' : ''}">${slideHTML(sl, false)}</div></div>`;
  }).join('');
  window.print();
  setTimeout(() => { stage.innerHTML = original; renderEditor(); }, 300);
}

/* Events */


// --- AI generation ---
function setAIStatus(msg, type='') {
  const el = $('#ai-status');
  if (!el) return;
  el.className = 'ai-status' + (type ? ' is-' + type : '');
  el.innerHTML = msg;
}
function setAISources(items) {
  const el = $('#ai-sources');
  if (!el) return;
  if (!items || !items.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="ai-sources__title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Fontes consultadas</div>' + items.map(i => `<a class="ai-source-link" href="${escapeHTML(i.url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHTML(i.title)}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M7 7h10v10"/></svg></a>`).join('');
}

async function fetchJSON(url, timeout=10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

function splitSentences(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 25);
}
function cleanText(s) { return String(s || '').replace(/\[[0-9]+\]/g,'').replace(/\s+/g,' ').trim(); }
function short(s, n=120) { s = cleanText(s); return s.length > n ? s.slice(0, n-1).trim() + '…' : s; }

async function wikiSummary(lang, titleOrQuery, bySearch=false) {
  const q = encodeURIComponent(titleOrQuery);
  if (bySearch) {
    const sr = await fetchJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&origin=*&srlimit=1`);
    const title = sr?.query?.search?.[0]?.title;
    if (!title) return null;
    return wikiSummary(lang, title, false);
  }
  const s = await fetchJSON(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${q}`);
  if (!s?.extract) return null;
  return {
    title: s.title || titleOrQuery,
    extract: cleanText(s.extract),
    description: cleanText(s.description || ''),
    url: s.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${q}`,
    lang,
  };
}

async function wikiSections(lang, title) {
  try {
    const sec = await fetchJSON(`https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`);
    return (sec?.parse?.sections || []).map(x => cleanText(x.line)).filter(x => x && !/refer|nota|liga|ver tamb|bibliogr|fontes|leitura/i.test(x)).slice(0, 8);
  } catch { return []; }
}

async function wikiExtractParagraphs(lang, title) {
  try {
    const data = await fetchJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(title)}&format=json&origin=*`);
    const page = Object.values(data?.query?.pages || {})[0];
    const text = cleanText(page?.extract || '');
    return splitSentences(text).slice(0, 12);
  } catch { return []; }
}

function normalizeTopicForImage(topic='') {
  const t = cleanText(topic).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map = {
    'estrelas': 'estrela astronomia', 'estrela': 'estrela astronomia',
    'stars': 'star astronomy', 'star': 'star astronomy',
    'planetas': 'planeta sistema solar', 'planeta': 'planeta astronomia',
    'lua': 'Lua satelite natural', 'sol': 'Sol estrela',
    'constelacao': 'constelacao astronomia', 'constelacoes': 'constelacao astronomia',
    'galaxia': 'galaxia astronomia', 'galaxias': 'galaxia astronomia',
  };
  for (const [k,v] of Object.entries(map)) {
    if (t === k || t.includes(k)) return v;
  }
  return cleanText(topic);
}

function isRelevantImage(title='', topic='', query='') {
  const t = (title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const k = (topic + ' ' + query).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const bad = ['cao','cachorro','dog','canis','logo','brasao','coat of arms','icon','mapa de localizacao','map','bandeira','flag','disambiguation','desambig','surname','sobrenome','filme','movie','album','single','musica','song','video game','jogo','personagem','character','comic','football','futebol','clube'];
  if (bad.some(b => t.includes(b))) return false;
  // If it's a very short ambiguous term like estrela, require astronomy-related hints
  const astroHints = ['estrela','star','astronom','constel','galax','nebulo','supernova','sol','solar','planeta','planet','lua','moon','cosmo','space','espaco','universo','orion','sirius'];
  const wantsAstro = /\bestrela|\bestrelas|\bstar|\bstars\b/.test(k);
  if (wantsAstro) return astroHints.some(h => t.includes(h));
  return true;
}

async function fetchWikiImage(title, lang='pt') {
  try {
    const q = encodeURIComponent(title);
    const data = await fetchJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&titles=${q}&prop=pageimages|pageprops&piprop=thumbnail&pithumbsize=960&format=json&origin=*`);
    const page = Object.values(data?.query?.pages || {})[0];
    const src = page?.thumbnail?.source || '';
    if (src) return { src, alt: page?.title || title, caption: page?.title || title, title: page?.title || title };
  } catch {}
  return null;
}

async function searchWikiImages(query, lang='pt', limit=8) {
  try {
    const q = encodeURIComponent(query);
    const data = await fetchJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=${limit}&prop=pageimages|description&piprop=thumbnail&pithumbsize=960&format=json&origin=*`);
    const pages = Object.values(data?.query?.pages || {});
    return pages.filter(p => p?.thumbnail?.source).map(p => ({
      src: p.thumbnail.source,
      alt: p.title || query,
      caption: p.title || query,
      title: p.title || '',
    }));
  } catch { return []; }
}

async function findSlideImage(topic, slideTitle, bullets, usedSrcs) {
  const baseTopic = cleanText(topic);
  const imgTopic = normalizeTopicForImage(baseTopic);
  const cleanSlide = cleanText(slideTitle).replace(/<[^>]*>/g,'').trim();
  const bulletHint = (bullets || []).map(b => cleanText(b).split(/[|:]/).pop().trim()).filter(Boolean).slice(0,2).join(' ');
  const queries = [];
  if (cleanSlide && !/introdu|conclus|resumo|próxim|agenda|encerram/i.test(cleanSlide)) queries.push(`${imgTopic} ${cleanSlide}`);
  if (bulletHint) queries.push(`${imgTopic} ${bulletHint}`);
  queries.push(imgTopic);
  if (imgTopic !== baseTopic) queries.push(baseTopic);

  for (const q of queries) {
    for (const lang of ['pt','en']) {
      const imgs = await searchWikiImages(q, lang, 8);
      const img = imgs.find(i => i.src && !usedSrcs.has(i.src) && isRelevantImage(i.title || i.caption || i.alt, baseTopic, q));
      if (img) { usedSrcs.add(img.src); return img; }
    }
  }
  // final fallback: topic thumbnail only if relevant
  for (const lang of ['pt','en']) {
    const img = await fetchWikiImage(imgTopic, lang);
    if (img?.src && !usedSrcs.has(img.src) && isRelevantImage(img.title || img.caption, baseTopic, imgTopic)) { usedSrcs.add(img.src); return img; }
  }
  return null;
}

async function searchWebTopic(topic) {
  const sources = [];
  let summary = null;
  let sections = [];
  let facts = [];
  let related = [];
  let images = [];

  const attempts = [
    () => wikiSummary('pt', topic, false),
    () => wikiSummary('pt', topic, true),
    () => wikiSummary('en', topic, false),
    () => wikiSummary('en', topic, true),
  ];
  for (const fn of attempts) {
    try { summary = await fn(); if (summary?.extract) break; } catch {}
  }

  if (summary) {
    sources.push({ title: summary.title, url: summary.url });
    const [secs, paras, imgsPt, imgsEn] = await Promise.all([
      wikiSections(summary.lang, summary.title),
      wikiExtractParagraphs(summary.lang, summary.title),
      searchWikiImages(normalizeTopicForImage(summary.title || topic), 'pt', 8),
      searchWikiImages(normalizeTopicForImage(summary.title || topic), 'en', 8),
    ]);
    sections = secs;
    facts = paras;
    images = [...imgsPt, ...imgsEn].filter(i => isRelevantImage(i.title || i.caption || i.alt, topic, summary.title || topic));
  }

  // DuckDuckGo fallback/supplement
  try {
    const ddg = await fetchJSON(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`);
    const text = cleanText(ddg?.AbstractText || ddg?.Definition || '');
    if (text) {
      if (!summary) summary = { title: ddg.Heading || topic, extract: text, description: '', url: ddg?.AbstractURL || '', lang: 'pt' };
      facts = facts.concat(splitSentences(text));
      if (ddg?.AbstractURL) sources.push({ title: ddg.Heading || topic, url: ddg.AbstractURL });
    }
    if (ddg?.Image) { const ddgImg = { src: ddg.Image.startsWith('http') ? ddg.Image : `https://duckduckgo.com${ddg.Image}`, alt: ddg.Heading || topic, caption: ddg.Heading || topic, title: ddg.Heading || topic }; if (isRelevantImage(ddgImg.title, topic, topic)) images.push(ddgImg); }
    const rel = (ddg?.RelatedTopics || []).flatMap(t => t.Topics ? t.Topics : [t]).filter(t => t.Text && t.FirstURL).slice(0,5);
    rel.forEach(t => related.push({ title: cleanText(t.Text.split(' - ')[0]).slice(0,60), url: t.FirstURL }));
  } catch {}

  // Related from Wikipedia search
  try {
    const lang = summary?.lang || 'pt';
    const rel = await fetchJSON(`https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(topic)}&gsrlimit=6&prop=info|extracts|pageimages&inprop=url&exintro=1&explaintext=1&exsentences=1&piprop=thumbnail&pithumbsize=960&format=json&origin=*`);
    Object.values(rel?.query?.pages || {}).forEach(p => {
      if (p.title && p.fullurl) related.push({ title: cleanText(p.title), url: p.fullurl, extract: cleanText(p.extract || '') });
      if (p?.thumbnail?.source) { const im = { src: p.thumbnail.source, alt: p.title, caption: p.title, title: p.title }; if (isRelevantImage(im.title, topic, topic)) images.push(im); }
    });
  } catch {}

  // Dedupe sources/related/images
  const seen = new Set();
  const uniqSources = [];
  [...sources, ...related].forEach(s => { const u = s.url; if (u && !seen.has(u)) { seen.add(u); uniqSources.push({ title: s.title, url: u }); } });
  const uniqRelated = [];
  const seenT = new Set();
  related.forEach(r => { const k=(r.title||'').toLowerCase(); if(k && !seenT.has(k)) { seenT.add(k); uniqRelated.push(r); } });
  const uniqImages = [];
  const seenI = new Set();
  images.forEach(img => { const src = img?.src; if (src && !seenI.has(src)) { seenI.add(src); uniqImages.push(img); } });

  return { summary: summary?.extract || '', title: summary?.title || topic, description: summary?.description || '', sections, facts, related: uniqRelated.slice(0,6), sources: uniqSources.slice(0,5), images: uniqImages.slice(0,12) };
}

function pickBullets(info, extra, count=4) {
  const out = [];
  const push = (v) => { v = cleanText(v).replace(/^[-•\d.\s]+/, ''); if (v.length < 4) return; const k=v.toLowerCase(); if (!out.some(o=>o.toLowerCase()===k)) out.push(v); };
  (info.sections || []).forEach(s => push(short(s, 70)));
  (info.facts || []).forEach(f => { push(short(f, 180)); });
  String(extra||'').split(/[,\n]/).map(x=>x.trim()).filter(Boolean).forEach(x => push(short(x, 90)));
  (info.related || []).forEach(r => { if (r.extract) push(short(r.extract, 160)); else push(short(r.title, 100)); });
  const fillers = ['Conceito principal', 'Exemplos práticos', 'Pontos importantes', 'Aplicações no dia a dia', 'Curiosidades relevantes'];
  for (let i=0; out.length < count && i<fillers.length; i++) push(fillers[i]);
  return out.slice(0, count);
}

function audienceConfig(audience) {
  if (audience === 'escola') return { kicker:'Trabalho Escolar', bgMain:'ocean', bgAlt:'wine', bgDark:'ink', accent:'#f5b301', accent2:'#eb4040', introLabel:'Introdução', conclusionLabel:'Conclusão' };
  if (audience === 'trabalho') return { kicker:'Apresentação Profissional', bgMain:'dark', bgAlt:'graphite', bgDark:'wine', accent:'#eb4040', accent2:'#f5b301', introLabel:'Contexto', conclusionLabel:'Próximos passos' };
  return { kicker:'Apresentação', bgMain:'ink', bgAlt:'wine', bgDark:'dark', accent:'#eb4040', accent2:'#f5b301', introLabel:'Visão geral', conclusionLabel:'Conclusão' };
}

function fitSlideText(sl) {
  // Light normalization only; do not cut sentences/content aggressively.
  sl.kicker = cleanText(sl.kicker || 'SlideForge');
  sl.title = String(sl.title || '').trim();
  sl.subtitle = cleanText(sl.subtitle || '');
  let bullets = Array.isArray(sl.bullets) ? sl.bullets.filter(Boolean).map(b => String(b).trim()) : [];
  if (sl.layout === 'quote') bullets = [];
  sl.bullets = bullets;
  sl.imageCaption = cleanText(sl.imageCaption || '');
  return sl;
}

function fitAllSlideText(slides) {
  (slides || []).forEach(fitSlideText);
  return slides;
}

async function attachImagesToSlides(slides, topic, info) {
  const used = new Set();
  const pool = Array.isArray(info.images) ? [...info.images] : [];
  const takeFromPool = () => {
    while (pool.length) {
      const img = pool.shift();
      if (img?.src && !used.has(img.src)) { used.add(img.src); return img; }
    }
    return null;
  };

  for (let i = 0; i < slides.length; i++) {
    const sl = slides[i];
    let img = null;
    if (sl.layout !== 'quote') {
      img = takeFromPool();
      if (!img) img = await findSlideImage(topic, stripTags(sl.title), sl.bullets, used);
      if (img?.src) {
        sl.image = img.src;
        sl.imageAlt = cleanText(img.alt || stripTags(sl.title) || topic);
        sl.imageCaption = cleanText(img.caption || img.title || 'Imagem relacionada ao tema');
      }
    }
    // thematic background: use a related image, preferably different from inline image
    let bgImg = takeFromPool();
    if (!bgImg) bgImg = await findSlideImage(topic, topic + ' ' + stripTags(sl.title), [], used);
    if (bgImg?.src) {
      sl.bgImage = bgImg.src;
    } else if (img?.src) {
      // fallback: reuse inline image as subtle background only when no other found
      sl.bgImage = img.src;
    }
    fitSlideText(sl);
  }
  return slides;
}

function buildEssayParagraphs(topic, info, sectionTitleText, idx, total) {
  const clean = (t) => cleanText(t).replace(/\s+/g, ' ').trim();
  const pool = [];
  const summarySents = splitSentences(info.summary || '');
  summarySents.forEach(s => { if (s.length > 30) pool.push(clean(s)); });
  (info.facts || []).forEach(f => { const c = clean(f); if (c.length > 35) pool.push(c); });
  (info.sections || []).forEach(sec => { const c = clean(sec); if (c.length > 20) pool.push(`Um aspecto importante sobre ${topic} é ${c.toLowerCase()}.`); });
  (info.related || []).forEach(r => { if (r.extract) pool.push(clean(r.extract)); });

  // dedupe
  const seen = new Set();
  const uniq = [];
  pool.forEach(t => { const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); uniq.push(t); } });

  const take = (n) => { const out=[]; while(out.length<n && uniq.length){ out.push(uniq.shift()); } return out; };
  const ensurePunct = (t) => /[.!?]$/.test(t) ? t : t + '.';

  if (idx === 0) {
    const p1 = take(2).join(' ') || `O tema ${topic} é relevante e desperta interesse por sua importância no contexto atual.`;
    const p2 = take(2).join(' ') || `Ao compreender ${topic}, é possível perceber seus principais conceitos, aplicações e impactos de forma mais clara.`;
    return [ensurePunct(p1), ensurePunct(p2)].join('\n\n');
  }
  if (idx === total - 1) {
    const p1 = take(2).join(' ') || `Em síntese, ${topic} apresenta aspectos fundamentais que merecem atenção e compreensão.`;
    const p2 = take(2).join(' ') || `Portanto, conhecer esse tema contribui para uma visão mais ampla e crítica, permitindo relacionar seus pontos principais ao cotidiano e aos estudos.`;
    return [ensurePunct(p1), ensurePunct(p2)].join('\n\n');
  }

  const angle = String(sectionTitleText || '').toLowerCase();
  let starter = `Ao abordar ${topic}, é importante destacar ${sectionTitleText.toLowerCase()}.`;
  if (/como funciona|funcionamento|desenvolvimento/.test(angle)) starter = `Para compreender melhor ${topic}, é importante analisar seu contexto, suas principais características e os acontecimentos que marcaram sua trajetória.`;
  else if (/contexto|origem/.test(angle)) starter = `Para entender ${topic}, é fundamental conhecer o contexto em que surgiu e os fatores que influenciaram sua origem.`;
  else if (/exemplo|aplica/.test(angle)) starter = `No que diz respeito às aplicações de ${topic}, percebe-se sua presença em diferentes situações e contextos.`;
  else if (/import|pontos|aspectos/.test(angle)) starter = `Entre os aspectos mais importantes de ${topic}, destacam-se elementos que ajudam a compreender sua relevância.`;
  else if (/curios|detalhes/.test(angle)) starter = `Além dos pontos principais, ${topic} também apresenta detalhes e curiosidades que enriquecem sua compreensão.`;
  else if (/contexto|cenário|atual/.test(angle)) starter = `Ao analisar o contexto de ${topic}, observa-se como esse tema se relaciona com a realidade atual.`;
  else if (/estratég|recomenda|próxim/.test(angle)) starter = `Ao considerar ${topic} de forma prática, é possível identificar caminhos, estratégias e recomendações relevantes.`;

  const body = take(3).join(' ');
  const p1 = ensurePunct(starter + (body ? ' ' + body : ''));
  const extra = take(2).join(' ');
  const p2 = ensurePunct(extra || `Dessa forma, o estudo de ${topic} amplia o entendimento sobre o assunto e favorece uma análise mais completa.`);
  return [p1, p2].join('\n\n');
}

async function buildAISlides({ topic, audience, slidesCount, tone, effect, extra, info }) {
  const cfg = audienceConfig(audience);
  const total = Math.max(5, Math.min(8, Number(slidesCount) || 6));
  const summary = cleanText(info.summary) || `Apresentação sobre ${topic}.`;
  const slides = [];
  const fx = (d='float') => effect === 'none' ? 'none' : (effect || d);
  const t = escapeForTitle(topic);

  // Intro/hero: short essay lead
  slides.push(S('hero', t, buildEssayParagraphs(topic, info, 'Introdução', 0, total), [], cfg.bgMain, cfg.accent2, cfg.kicker, fx('aurora')));

  const pool = ['content','split','content','split','content'];
  let i = 0;
  while (slides.length < total - 1) {
    const layout = pool[i % pool.length];
    const section = sectionTitle(i, topic, audience);
    const text = buildEssayParagraphs(topic, info, section, slides.length, total);
    const bg = [cfg.bgAlt, 'dark', 'graphite', 'wine', cfg.bgDark][i % 5];
    slides.push(S(layout, section, text, [], bg, i % 2 ? cfg.accent2 : cfg.accent, 'Desenvolvimento', fx(['float','shine','aurora','grid'][i%4])));
    i++;
  }

  slides.push(S('content', cfg.conclusionLabel, buildEssayParagraphs(topic, info, 'Conclusão', total - 1, total), [], 'red', '#f4eeee', 'Encerramento', fx('aurora')));

  await attachImagesToSlides(slides, topic, info);
  return slides;
}

function sectionTitle(i, topic, audience) {
  const school = ['Contexto e origem', 'Desenvolvimento do tema', 'Exemplos e aplicações', 'Pontos importantes', 'Curiosidades'];
  const work = ['Cenário atual', 'Pontos estratégicos', 'Análise prática', 'Oportunidades', 'Recomendações'];
  const general = ['Contexto e origem', 'Desenvolvimento do tema', 'Aspectos importantes', 'Detalhes relevantes', 'Aplicações'];
  const arr = audience === 'escola' ? school : audience === 'trabalho' ? work : general;
  return arr[i % arr.length];
}

function escapeForTitle(topic) {
  const safe = escapeHTML(cleanText(topic));
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const last = parts.pop();
    return `${parts.join(' ')} <span class="accent">${last}</span>`;
  }
  return `<span class="accent">${safe || 'Tema'}</span>`;
}

async function handleAIGenerate(e) {
  e.preventDefault();
  const topic = $('#ai-topic').value.trim();
  if (!topic) return;
  const audience = $('#ai-audience').value;
  const slidesCount = $('#ai-slides').value;
  const tone = $('#ai-tone').value;
  const effect = $('#ai-effect').value;
  const extra = $('#ai-extra').value.trim();
  const btn = $('#ai-generate');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Gerando...';
  setAIStatus('<span class="spinner"></span>Buscando informações na web sobre o tema...', 'loading');
  setAISources([]);
  try {
    const info = await searchWebTopic(topic);
    if (!info.summary && !info.sections.length && !info.facts.length) {
      setAIStatus('Não encontrei informações suficientes na web. Tente um tema mais específico ou verifique sua conexão.', 'error');
      toast('Não foi possível buscar informações para esse tema.');
      return;
    }
    setAIStatus('<span class="spinner"></span>Organizando conteúdo e montando os slides...', 'loading');
    await new Promise(r => setTimeout(r, 250));
    setAIStatus('<span class="spinner"></span>Buscando imagens relacionadas ao tema...', 'loading');
    const slides = await buildAISlides({ topic, audience, slidesCount, tone, effect, extra, info });
    const name = topic.length > 60 ? topic.slice(0,57) + '...' : topic;
    state.project = { id: uid(), name, updatedAt: Date.now(), slides };
    state.activeSlide = 0;
    persistCurrent();
    setAISources(info.sources);
    setAIStatus(`Apresentação criada com ${slides.length} slides. Abrindo no editor...`, 'ok');
    toast('Apresentação gerada com sucesso!');
    setView('editor');
  } catch (err) {
    console.error(err);
    setAIStatus('Ocorreu um erro ao buscar informações. Verifique sua conexão e tente novamente.', 'error');
    toast('Erro ao gerar apresentação.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l1.9 4.6L18.5 8.5l-4.6 1.9L12 15l-1.9-4.6L5.5 8.5l4.6-1.9L12 2z"/><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/></svg> Gerar apresentação';
  }
}
function bindEvents() {
  // Navigation
  $$('[data-view]').forEach(el => el.addEventListener('click', (e) => {
    const view = el.dataset.view;
    if (view) { e.preventDefault(); setView(view); }
  }));

  $('#btn-new-blank').addEventListener('click', () => { state.project = defaultProject(); state.activeSlide = 0; persistCurrent(); setView('editor'); toast('Novo projeto criado.'); });
  $('#home-create').addEventListener('click', () => $('#btn-new-blank').click());
  $('#projects-new').addEventListener('click', () => $('#btn-new-blank').click());

  // Topbar
  $('#btn-save').addEventListener('click', saveCurrentProject);
  $('#btn-present').addEventListener('click', () => { if (state.view !== 'editor') { if (!state.project) state.project = defaultProject(); setView('editor'); setTimeout(openPresenter, 150); } else openPresenter(); });
  $('#btn-export').addEventListener('click', () => { if (state.view !== 'editor') { if (state.project) { setView('editor'); setTimeout(exportProject, 200); } else toast('Abra um projeto para exportar.'); } else exportProject(); });

  // Mobile menu
  $('#mobile-menu-btn').addEventListener('click', () => { $('.sidebar').classList.contains('is-open') ? closeMobileSidebar() : openMobileSidebar(); });

  // Template filters
  $$('#template-filters .filter').forEach(btn => btn.addEventListener('click', () => { state.templateFilter = btn.dataset.filter; renderTemplates(); }));

  // Editor controls
  $('#btn-add-slide').addEventListener('click', addSlide);
  $('#btn-dup-slide').addEventListener('click', duplicateSlide);
  $('#btn-delete-slide').addEventListener('click', deleteSlide);
  $('#btn-move-up').addEventListener('click', () => moveSlide(-1));
  $('#btn-move-down').addEventListener('click', () => moveSlide(1));

  // Props
  const projectNameInput = $('#prop-project-name');
  if (projectNameInput) projectNameInput.addEventListener('input', e => {
    state.project.name = e.target.value.trim() || 'Apresentação sem título';
    state.project.updatedAt = Date.now();
    $('#topbar-title').textContent = state.project.name;
    persistCurrent();
  });
  $('#prop-title').addEventListener('input', e => {
    const raw = e.target.value.trim();
    const val = raw ? escapeHTML(raw) : 'Sem título';
    updateActiveSlide({ title: val });
  });
  $('#prop-subtitle').addEventListener('input', e => updateActiveSlide({ subtitle: e.target.value }));
  $('#prop-bullets').addEventListener('input', e => updateActiveSlide({ bullets: e.target.value.split('\n').map(x => x.replace(/\r/g,'')) }));
  $('#prop-note').addEventListener('input', e => updateActiveSlide({ note: e.target.value }));
  const bindImg = (id, key) => { const el = document.getElementById(id); if (el) el.addEventListener('input', e => updateActiveSlide({ [key]: e.target.value })); };
  bindImg('prop-image', 'image');
  bindImg('prop-image-alt', 'imageAlt');
  bindImg('prop-image-caption', 'imageCaption');
  bindImg('prop-bg-image', 'bgImage');
  const clearImg = document.getElementById('btn-clear-image'); if (clearImg) clearImg.addEventListener('click', () => { updateActiveSlide({ image:'', imageAlt:'', imageCaption:'' }); syncProps(); });
  const clearBgImg = document.getElementById('btn-clear-bg-image'); if (clearBgImg) clearBgImg.addEventListener('click', () => { updateActiveSlide({ bgImage:'' }); syncProps(); });

  $$('#layout-options .layout-opt').forEach(btn => btn.addEventListener('click', () => { updateActiveSlide({ layout: btn.dataset.layout }); syncProps(); }));
  $$('#bg-options .color-swatch').forEach(btn => btn.addEventListener('click', () => { updateActiveSlide({ bg: btn.dataset.bg }); syncProps(); }));
  $$('#accent-options .color-swatch').forEach(btn => btn.addEventListener('click', () => { updateActiveSlide({ accent: btn.dataset.accent }); syncProps(); }));
  $$('#effect-options .effect-opt').forEach(btn => btn.addEventListener('click', () => { updateActiveSlide({ effect: btn.dataset.effect }); syncProps(); }));

  // AI
  const aiForm = $('#ai-form');
  if (aiForm) aiForm.addEventListener('submit', handleAIGenerate);

  // Presenter
  $('#present-close').addEventListener('click', closePresenter);
  $('#present-prev').addEventListener('click', () => presentNav(-1));
  $('#present-next').addEventListener('click', () => presentNav(1));
  $('#presenter').addEventListener('click', (e) => { if (e.target === $('#presenter') || e.target.classList.contains('presenter__stage')) presentNav(1); });

  document.addEventListener('keydown', (e) => {
    const inPresenter = $('#presenter').classList.contains('is-open');
    if (inPresenter) {
      if (e.key === 'Escape') closePresenter();
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); presentNav(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); presentNav(-1); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrentProject(); }
    if (e.key === 'F5') { e.preventDefault(); openPresenter(); }
    if (e.key === 'Escape') closeMobileSidebar();
  });
}

function init() {
  bindEvents();
  const saved = loadCurrent();
  if (saved?.project) { state.project = saved.project; state.activeSlide = saved.activeSlide || 0; }
  updateStats();
  renderTemplates();
  renderProjects();
  setView('home');
}

init();
