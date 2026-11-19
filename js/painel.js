/* ====================================================================
   PAINEL.JS — Porta de entrada do painel privado do portfólio
   --------------------------------------------------------------------
   O que este arquivo faz:
     1. Bloqueio por senha (proteção básica — ver aviso no rodapé);
     2. Busca as métricas IMPORTANTES:
        - GoatCounter  → quantas pessoas entraram no seu site
        - GitHub API   → estrelas, forks, repositórios (dados públicos)
        - Status       → se o site publicado responde
     3. Monta o resumo executivo e o chat com o assistente.

   ONDE FICAM AS CONFIGURAÇÕES?
     localStorage["painel.config"] = { codigo, chave }  (só neste navegador)
   ==================================================================== */

import { responder, ATALHOS } from './assistente.js';

/* ---------- Identidade do site (troque aqui se mudar de usuário) ---------- */
const USUARIO_GITHUB = 'ryansamuelaraujo009-design';
const URL_SITE = 'https://ryansamuelaraujo009-design.github.io';

/* ---------- Chaves de armazenamento ---------- */
const CHAVE_CONFIG = 'painel.config';
const CHAVE_SENHA = 'painel.senha';
const CHAVE_ACESSO = 'painel.acesso';

/* ---------- Estado das métricas (compartilhado com o assistente) ----------
   status possíveis de goat/github: 'carregando' | 'ok' | 'nao-config' | 'erro'
   site: null (verificando) | { noAr, ms }                                      */
const estado = {
  goat: { status: 'carregando' },
  github: { status: 'carregando' },
  site: null,
};

const fmt = new Intl.NumberFormat('pt-BR');
const $ = (seletor) => document.querySelector(seletor);

/* ====================================================================
   1. ARMAZENAMENTO (config e senha)
   ==================================================================== */

function lerConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem(CHAVE_CONFIG));
    if (cfg && typeof cfg === 'object') {
      return { codigo: cfg.codigo || '', chave: cfg.chave || '' };
    }
  } catch { /* JSON inválido — ignora e usa o padrão */ }
  return { codigo: '', chave: '' };
}

function salvarConfig(cfg) {
  localStorage.setItem(CHAVE_CONFIG, JSON.stringify(cfg));
}

/**
 * Aceita o código de várias formas ("meucodigo",
 * "https://meucodigo.goatcounter.com/count" etc.) e devolve só o código.
 */
function limparCodigo(bruto) {
  return String(bruto)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\.goatcounter\.com.*$/i, '')
    .replace(/\/.*$/, '')
    .trim();
}

/* ====================================================================
   2. BLOQUEIO POR SENHA
   --------------------------------------------------------------------
   AVISO HONESTO: como o site é100% estático, qualquer pessoa com o
   endereço pode abrir o código desta página. A senha protege contra
   olhares curiosos (e evita que alguém mexa por engano), mas NÃO é
   segurança real. Não coloque aqui dados sensíveis.
   ==================================================================== */

function iniciarGate() {
  const temSenha = Boolean(localStorage.getItem(CHAVE_SENHA));
  const destravado = sessionStorage.getItem(CHAVE_ACESSO) === '1';

  if (destravado) {
    mostrarApp();
    return;
  }
  mostrarGate(temSenha ? 'entrar' : 'criar');
}

function mostrarGate(modo) {
  const gate = $('#gate');
  const app = $('#app');
  app.hidden = true;
  gate.hidden = false;

  const titulo = $('#gate-titulo');
  const texto = $('#gate-texto');
  const campoExtra = $('#gate-confirmar');
  const erro = $('#gate-erro');
  erro.hidden = true;

  if (modo === 'criar') {
    titulo.textContent = 'Crie sua senha';
    texto.textContent = 'Primeira vez: defina uma senha para o painel (fica guardada só neste navegador).';
    campoExtra.hidden = false;
    $('#gate-entrada').value = '';
    $('#gate-confirmar-input').value = '';
    $('#gate-botao').textContent = 'Criar e entrar';
    $('#gate-form').dataset.modo = 'criar';
  } else {
    titulo.textContent = 'Painel privado';
    texto.textContent = 'Digite sua senha para acessar o painel do portfólio.';
    campoExtra.hidden = true;
    $('#gate-entrada').value = '';
    $('#gate-botao').textContent = 'Entrar';
    $('#gate-form').dataset.modo = 'entrar';
  }
  $('#gate-entrada').focus();
}

function tentarEntrar(evento) {
  evento.preventDefault();
  const modo = $('#gate-form').dataset.modo;
  const erro = $('#gate-erro');
  const senha = $('#gate-entrada').value;

  if (modo === 'criar') {
    const confirmar = $('#gate-confirmar-input').value;
    if (senha.length < 4) {
      erro.textContent = 'Use pelo menos 4 caracteres.';
      erro.hidden = false;
      return;
    }
    if (senha !== confirmar) {
      erro.textContent = 'As duas senhas não são iguais.';
      erro.hidden = false;
      return;
    }
    localStorage.setItem(CHAVE_SENHA, senha); // proteção básica, não criptografia
  } else if (senha !== localStorage.getItem(CHAVE_SENHA)) {
    erro.textContent = 'Senha incorreta. Tente de novo.';
    erro.hidden = false;
    return;
  }

  sessionStorage.setItem(CHAVE_ACESSO, '1');
  mostrarApp();
}

function mostrarApp() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  iniciarChat();
  carregarTudo();
}

function destravar() {
  sessionStorage.removeItem(CHAVE_ACESSO);
  location.reload();
}

/* ====================================================================
   3. MÉTRICAS — GoatCounter (visitantes do site)
   ==================================================================== */

function dataLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function carregarGoat() {
  const cfg = lerConfig();
  if (!cfg.codigo || !cfg.chave) {
    estado.goat = { status: 'nao-config' };
    return;
  }

  try {
    const agora = new Date();
    const inicio30 = new Date(agora);
    inicio30.setDate(inicio30.getDate() - 29);
    inicio30.setHours(0, 0, 0, 0);

    const inicio7 = new Date(agora);
    inicio7.setDate(inicio7.getDate() - 6);
    inicio7.setHours(0, 0, 0, 0);

    const base = `https://${cfg.codigo}.goatcounter.com/api/v0`;
    const cabecalho = { Authorization: `Bearer ${cfg.chave}` };
    const params = (ini) =>
      `start=${encodeURIComponent(ini.toISOString())}&end=${encodeURIComponent(agora.toISOString())}`;

    const [respTotal, respHits] = await Promise.all([
      fetch(`${base}/stats/total?${params(inicio30)}`, { headers: cabecalho }),
      fetch(`${base}/stats/hits?${params(inicio7)}&limit=3&group=day`, { headers: cabecalho }),
    ]);

    if (respTotal.status === 401 || respTotal.status === 403) {
      estado.goat = { status: 'erro', erro: 'chave inválida ou sem permissão' };
      return;
    }
    if (!respTotal.ok) {
      estado.goat = { status: 'erro', erro: `resposta ${respTotal.status} do GoatCounter` };
      return;
    }

    const dados = await respTotal.json();

    // Soma por dia a partir do campo "daily" de cada dia do período
    const hojeStr = dataLocal(agora);
    const seteStr = dataLocal(inicio7);
    let hoje = 0;
    let sete = 0;
    let trinta = 0;
    for (const dia of dados.stats || []) {
      if (!dia || !dia.day) continue;
      const valor = dia.daily || 0;
      trinta += valor;
      if (dia.day === hojeStr) hoje = valor;
      if (dia.day >= seteStr) sete += valor;
    }
    // Reserva: se o resumo diário vier vazio mas o total existir, usa o total
    if (trinta === 0 && dados.total) trinta = dados.total;

    let top = [];
    if (respHits.ok) {
      const hits = await respHits.json();
      top = (hits.hits || [])
        .filter((h) => h && !h.event && h.path)
        .slice(0, 3)
        .map((h) => ({ path: h.path, count: h.count || 0 }));
    }

    estado.goat = {
      status: 'ok',
      hoje, sete, trinta, top,
      dashboard: `https://${cfg.codigo}.goatcounter.com`,
    };
  } catch (erro) {
    console.error('[painel] GoatCounter:', erro);
    estado.goat = { status: 'erro', erro: 'falha de conexão' };
  }
}

/* ====================================================================
   4. MÉTRICAS — GitHub (dados públicos, sem token)
   ==================================================================== */

async function carregarGithub() {
  try {
    const resp = await fetch(
      `https://api.github.com/users/${USUARIO_GITHUB}/repos?per_page=100&sort=pushed`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );

    if (resp.status === 403) {
      estado.github = {
        status: 'erro',
        erro: 'limite de consultas do GitHub atingido (60/hora sem chave)',
      };
      return;
    }
    if (!resp.ok) {
      estado.github = { status: 'erro', erro: `resposta ${resp.status}` };
      return;
    }

    const todos = await resp.json();
    const proprios = Array.isArray(todos) ? todos.filter((r) => !r.fork) : [];

    const estrelas = proprios.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const forks = proprios.reduce((s, r) => s + (r.forks_count || 0), 0);
    let ultimoPush = null;
    for (const r of proprios) {
      if (r.pushed_at && (!ultimoPush || r.pushed_at > ultimoPush)) {
        ultimoPush = r.pushed_at;
      }
    }

    estado.github = {
      status: 'ok',
      repos: proprios.length,
      estrelas,
      forks,
      ultimoPush,
      lista: proprios.slice(0, 6),
      urlPerfil: `https://github.com/${USUARIO_GITHUB}`,
    };
  } catch (erro) {
    console.error('[painel] GitHub:', erro);
    estado.github = { status: 'erro', erro: 'falha de conexão' };
  }
}

/* ====================================================================
   5. STATUS DO SITE PUBLICADO
   --------------------------------------------------------------------
   Usa mode "no-cors": a resposta é opaca (sem ler o conteúdo), mas se a
   promessa resolver é sinal de que o endereço respondeu.
   ==================================================================== */

async function carregarSite() {
  const t0 = performance.now();
  try {
    await fetch(`${URL_SITE}/`, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
    estado.site = { noAr: true, ms: Math.round(performance.now() - t0), url: URL_SITE };
  } catch {
    estado.site = { noAr: false, url: URL_SITE };
  }
}

async function carregarTudo() {
  definirCarregando(true);
  await Promise.allSettled([carregarGoat(), carregarGithub(), carregarSite()]);
  definirCarregando(false);
  renderizarTudo();
}

/* ====================================================================
   6. RENDERIZAÇÃO (resumo executivo + seções)
   ==================================================================== */

function definirCarregando(sim) {
  for (const id of ['m-hoje', 'm-sete', 'm-trinta', 'm-estrelas', 'm-repos']) {
    const el = document.getElementById(id);
    if (el && sim) el.textContent = '···';
  }
  const botao = $('#botao-atualizar');
  if (botao) botao.disabled = sim;
}

function setNota(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto || '';
}

function renderizarTudo() {
  renderResumo();
  renderStatus();
  renderGoat();
  renderGithub();
}

function renderResumo() {
  const g = estado.goat;
  const gh = estado.github;

  /* Visitantes */
  if (g.status === 'ok') {
    $('#m-hoje').textContent = fmt.format(g.hoje);
    $('#m-sete').textContent = fmt.format(g.sete);
    $('#m-trinta').textContent = fmt.format(g.trinta);
    setNota('m-hoje-nota', 'acessos no portfólio');
    setNota('m-sete-nota', 'acessos na semana');
    setNota('m-trinta-nota', 'acessos no mês');
  } else if (g.status === 'nao-config') {
    for (const [v, n] of [['m-hoje', 'm-hoje-nota'], ['m-sete', 'm-sete-nota'], ['m-trinta', 'm-trinta-nota']]) {
      document.getElementById(v).textContent = '—';
      setNota(n, 'contador não configurado');
    }
  } else if (g.status === 'erro') {
    for (const [v, n] of [['m-hoje', 'm-hoje-nota'], ['m-sete', 'm-sete-nota'], ['m-trinta', 'm-trinta-nota']]) {
      document.getElementById(v).textContent = '—';
      setNota(n, g.erro || 'erro ao consultar');
    }
  }

  /* GitHub */
  if (gh.status === 'ok') {
    $('#m-estrelas').textContent = fmt.format(gh.estrelas);
    $('#m-repos').textContent = fmt.format(gh.repos);
    setNota('m-estrelas-nota', `em ${fmt.format(gh.repos)} repositórios`);
    setNota('m-repos-nota', 'projetos públicos');
  } else if (gh.status === 'carregando') {
    $('#m-estrelas').textContent = '···';
    $('#m-repos').textContent = '···';
  } else {
    $('#m-estrelas').textContent = '—';
    $('#m-repos').textContent = '—';
    setNota('m-estrelas-nota', gh.erro || 'indisponível');
    setNota('m-repos-nota', gh.erro || 'indisponível');
  }
}

function renderStatus() {
  const chip = $('#chip-status');
  if (!estado.site) {
    chip.textContent = '… verificando';
    chip.className = 'chip chip--neutro';
    return;
  }
  if (estado.site.noAr) {
    chip.textContent = `site no ar · ${fmt.format(estado.site.ms)} ms`;
    chip.className = 'chip chip--ok';
  } else {
    chip.textContent = 'site inacessível';
    chip.className = 'chip chip--erro';
  }
}

function renderGoat() {
  const alvo = $('#goat-conteudo');
  const g = estado.goat;

  if (g.status === 'carregando') {
    alvo.innerHTML = '<p class="notificacao">Carregando visitantes…</p>';
    return;
  }

  if (g.status === 'nao-config') {
    alvo.innerHTML = `
      <p class="card__vazio">
        O contador de visitantes ainda não foi configurado. Assim que você
        ligar o GoatCounter, os números aparecem aqui automaticamente.
      </p>
      <p class="notificacao">Passo a passo: pergunte <strong>"configurar"</strong> ao assistente
      ou abra <strong>Configurações</strong> aqui embaixo.</p>`;
    return;
  }

  if (g.status === 'erro') {
    alvo.innerHTML = `<p class="notificacao notificacao--erro">Não consegui buscar os visitantes: ${g.erro || 'erro'}.</p>`;
    return;
  }

  let html = `
    <ul class="goat-numeros">
      <li><strong>${fmt.format(g.hoje)}</strong><span>hoje</span></li>
      <li><strong>${fmt.format(g.sete)}</strong><span>7 dias</span></li>
      <li><strong>${fmt.format(g.trinta)}</strong><span>30 dias</span></li>
    </ul>`;

  if (g.top && g.top.length) {
    html += '<p class="subtitulo">Mais vistos (7 dias)</p><ul class="lista-top">';
    for (const p of g.top) {
      html += `<li><code>${escapar(p.path)}</code><span>${fmt.format(p.count)}</span></li>`;
    }
    html += '</ul>';
  }

  html += `<a class="link-externo" href="${g.dashboard}" target="_blank" rel="noopener">Ver dashboard completo →</a>`;
  alvo.innerHTML = html;
}

function renderGithub() {
  const alvo = $('#repos-conteudo');
  const gh = estado.github;

  if (gh.status === 'carregando') {
    alvo.innerHTML = '<p class="notificacao">Carregando repositórios…</p>';
    return;
  }
  if (gh.status === 'erro') {
    alvo.innerHTML = `<p class="notificacao notificacao--erro">${gh.erro || 'Erro ao consultar o GitHub'}.</p>`;
    return;
  }

  let html = '<ul class="lista-repos">';
  for (const r of gh.lista || []) {
    html += `
      <li>
        <a href="${escapar(r.html_url)}" target="_blank" rel="noopener">${escapar(r.name)}</a>
        <span class="repo-meta">
          ★ ${fmt.format(r.stargazers_count || 0)}
          ${r.language ? ` · ${escapar(r.language)}` : ''}
        </span>
      </li>`;
  }
  html += '</ul>';
  html += `<a class="link-externo" href="${escapar(gh.urlPerfil)}" target="_blank" rel="noopener">Ver todos no GitHub →</a>`;
  alvo.innerHTML = html;
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ====================================================================
   7. CHAT COM O ASSISTENTE
   ==================================================================== */

function iniciarChat() {
  if (iniciarChat.jaIniciou) return;
  iniciarChat.jaIniciou = true;

  /* Atalhos rápidos */
  const alvoAtalhos = $('#chat-atalhos');
  for (const a of ATALHOS) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'atalho';
    botao.textContent = a.rotulo;
    botao.addEventListener('click', () => enviarMensagem(a.pergunta));
    alvoAtalhos.appendChild(botao);
  }

  /* Formulário */
  $('#chat-form').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const campo = $('#chat-entrada');
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    enviarMensagem(texto);
  });

  /* Boas-vindas */
  adicionarBot(responder('oi', estado));
}

function adicionarBot(html) {
  const hist = $('#chat-hist');
  const msg = document.createElement('div');
  msg.className = 'msg msg--bot';
  msg.innerHTML = html;
  hist.appendChild(msg);
  hist.scrollTop = hist.scrollHeight;
}

function adicionarUsuario(texto) {
  const hist = $('#chat-hist');
  const msg = document.createElement('div');
  msg.className = 'msg msg--eu';
  msg.textContent = texto;
  hist.appendChild(msg);
  hist.scrollTop = hist.scrollHeight;
}

function enviarMensagem(texto) {
  adicionarUsuario(texto);
  // Resposta "digitando…" curta deixa a conversa mais natural
  const hist = $('#chat-hist');
  const espera = document.createElement('div');
  espera.className = 'msg msg--bot msg--espera';
  espera.textContent = '…';
  hist.appendChild(espera);
  hist.scrollTop = hist.scrollHeight;

  setTimeout(() => {
    espera.remove();
    adicionarBot(responder(texto, estado));
  }, 350);
}

/* ====================================================================
   8. CONFIGURAÇÕES (código + chave do GoatCounter)
   ==================================================================== */

function iniciarConfig() {
  const cfg = lerConfig();
  $('#cfg-codigo').value = cfg.codigo || '';
  $('#cfg-chave').value = cfg.chave || '';
  atualizarEstadoConfig(cfg);

  $('#cfg-form').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const novo = {
      codigo: limparCodigo($('#cfg-codigo').value),
      chave: $('#cfg-chave').value.trim(),
    };
    salvarConfig(novo);
    $('#cfg-status').textContent = novo.codigo && novo.chave
      ? 'Salvo ✓ buscando dados…'
      : 'Salvo (sem contador — nada será buscado).';
    atualizarEstadoConfig(novo);
    carregarTudo();
  });

  $('#cfg-limpar').addEventListener('click', () => {
    localStorage.removeItem(CHAVE_CONFIG);
    $('#cfg-codigo').value = '';
    $('#cfg-chave').value = '';
    $('#cfg-status').textContent = 'Configuração apagada.';
    atualizarEstadoConfig({ codigo: '', chave: '' });
    estado.goat = { status: 'nao-config' };
    renderizarTudo();
  });
}

function atualizarEstadoConfig(cfg) {
  const el = $('#cfg-estado');
  if (cfg.codigo && cfg.chave) {
    el.textContent = `Configurado: ${cfg.codigo}.goatcounter.com`;
    el.className = 'cfg-estado cfg-estado--ok';
  } else {
    el.textContent = 'Não configurado';
    el.className = 'cfg-estado';
  }
}

/* ====================================================================
   9. INICIALIZAÇÃO
   ==================================================================== */

function iniciar() {
  $('#gate-form').addEventListener('submit', tentarEntrar);
  $('#botao-travar').addEventListener('click', destravar);
  $('#botao-atualizar').addEventListener('click', carregarTudo);
  iniciarConfig();
  iniciarGate();
}

try {
  iniciar();
} catch (erro) {
  console.error('[painel] Falha ao inicializar:', erro);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<p class="notificacao notificacao--erro">Falha ao iniciar o painel. Veja o console (F12).</p>',
  );
}
