/* ====================================================================
   PAINEL.JS — Porta de entrada do painel privado do portfólio
   --------------------------------------------------------------------
   O que este arquivo faz:
     1. Bloqueio por senha (proteção básica — ver aviso no rodapé);
     2. Busca as métricas IMPORTANTES:
        - Mensagens  → cliques nos contatos (GitHub, e-mail, WhatsApp)
        - GitHub API → estrelas, forks, repositórios (dados públicos)
        - Status     → se o site publicado responde
     3. Monta o resumo executivo e o chat com o assistente.

   Os números de mensagens vêm do CountAPI — o mesmo serviço que o
   js/contador.js incrementa quando alguém clica num link de contato
   do portfólio. Sem cadastro, sem chave, sem cookies.
   ==================================================================== */

import { responder, ATALHOS } from './assistente.js';

/* ---------- Identidade do site (troque aqui se mudar de usuário) ---------- */
const USUARIO_GITHUB = 'ryansamuelaraujo009-design';
const URL_SITE = 'https://ryansamuelaraujo009-design.github.io';

/* ---------- Chaves de armazenamento ---------- */
const CHAVE_SENHA = 'painel.senha';
const CHAVE_ACESSO = 'painel.acesso';

/* ---------- Canais contados (as chaves precisam casar com js/contador.js) ---------- */
const CANAIS = [
  { id: 'github', rotulo: 'GitHub', chave: 'devprogramier-msg-github' },
  { id: 'gmail', rotulo: 'E-mail', chave: 'devprogramier-msg-gmail' },
  { id: 'whatsapp', rotulo: 'WhatsApp', chave: 'devprogramier-msg-whatsapp' },
];

/* ---------- Estado das métricas (compartilhado com o assistente) ----------
   status possíveis de mensagens/github: 'carregando' | 'ok' | 'erro'
   site: null (verificando) | { noAr, ms }                                  */
const estado = {
  mensagens: { status: 'carregando' },
  github: { status: 'carregando' },
  site: null,
};

const fmt = new Intl.NumberFormat('pt-BR');
const $ = (seletor) => document.querySelector(seletor);

/* ====================================================================
   1. BLOQUEIO POR SENHA
   --------------------------------------------------------------------
   AVISO HONESTO: como o site é 100% estático, qualquer pessoa com o
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
   2. MÉTRICAS — Mensagens (cliques nos contatos do portfólio)
   ==================================================================== */

const URL_COUNTAPI = 'https://countapi.mileshilliard.com/api/v1';

/** Lê o total de um contador. Contador ainda inexistente = 0 cliques. */
async function lerContador(chave) {
  const resp = await fetch(`${URL_COUNTAPI}/get/${chave}`, { cache: 'no-store' });
  if (!resp.ok) return 0;
  const dados = await resp.json();
  const valor = Number(dados.value);
  return Number.isFinite(valor) ? valor : 0;
}

async function carregarMensagens() {
  try {
    const valores = await Promise.all(CANAIS.map((c) => lerContador(c.chave)));
    const cliques = {};
    let total = 0;
    CANAIS.forEach((c, i) => {
      cliques[c.id] = valores[i];
      total += valores[i];
    });
    estado.mensagens = { status: 'ok', total, cliques };
  } catch (erro) {
    console.error('[painel] Mensagens:', erro);
    estado.mensagens = { status: 'erro', erro: 'falha de conexão' };
  }
}

/* ====================================================================
   3. MÉTRICAS — GitHub (dados públicos, sem token)
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
   4. STATUS DO SITE PUBLICADO
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
  await Promise.allSettled([carregarMensagens(), carregarGithub(), carregarSite()]);
  definirCarregando(false);
  renderizarTudo();
}

/* ====================================================================
   5. RENDERIZAÇÃO (resumo executivo + seções)
   ==================================================================== */

function definirCarregando(sim) {
  for (const id of ['m-total', 'm-github', 'm-gmail', 'm-whatsapp', 'm-estrelas', 'm-repos']) {
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
  renderMensagens();
  renderGithub();
}

function renderResumo() {
  const m = estado.mensagens;
  const gh = estado.github;

  /* Mensagens (cliques de contato) */
  const paresMsg = [
    ['m-total', 'cliques no total'],
    ['m-github', 'cliques no GitHub'],
    ['m-gmail', 'cliques no e-mail'],
    ['m-whatsapp', 'cliques no WhatsApp'],
  ];

  if (m.status === 'ok') {
    $('#m-total').textContent = fmt.format(m.total);
    $('#m-github').textContent = fmt.format(m.cliques.github || 0);
    $('#m-gmail').textContent = fmt.format(m.cliques.gmail || 0);
    $('#m-whatsapp').textContent = fmt.format(m.cliques.whatsapp || 0);
    for (const [id, nota] of paresMsg) setNota(`${id}-nota`, nota);
  } else if (m.status === 'carregando') {
    for (const [id] of paresMsg) {
      document.getElementById(id).textContent = '···';
      setNota(`${id}-nota`, '');
    }
  } else {
    for (const [id] of paresMsg) {
      document.getElementById(id).textContent = '—';
      setNota(`${id}-nota`, m.erro || 'erro ao consultar');
    }
  }

  /* GitHub */
  if (gh.status === 'ok') {
    $('#m-estrelas').textContent = fmt.format(gh.estrelas);
    $('#m-repos').textContent = fmt.format(gh.repos);
    setNota('m-estrelas-nota', `em ${fmt.format(gh.repos)} ${gh.repos === 1 ? 'repositório' : 'repositórios'}`);
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

function renderMensagens() {
  const alvo = $('#msg-conteudo');
  const m = estado.mensagens;

  if (m.status === 'carregando') {
    alvo.innerHTML = '<p class="notificacao">Carregando contadores…</p>';
    return;
  }

  if (m.status === 'erro') {
    alvo.innerHTML = `<p class="notificacao notificacao--erro">Não consegui buscar os contadores: ${escapar(m.erro || 'erro')}.</p>`;
    return;
  }

  let html = '<ul class="msg-numeros">';
  for (const c of CANAIS) {
    html += `<li><strong>${fmt.format(m.cliques[c.id] || 0)}</strong><span>${c.rotulo}</span></li>`;
  }
  html += '</ul>';
  html += `<p class="msg-total">Total: <strong>${fmt.format(m.total)}</strong> cliques</p>`;
  html += '<p class="notificacao">Conta cada clique nos links de contato do portfólio. '
    + 'Sem cadastro e sem cookies — se o serviço reiniciar, os números recomeçam do zero.</p>';
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
   6. CHAT COM O ASSISTENTE
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
   7. INICIALIZAÇÃO
   ==================================================================== */

function iniciar() {
  $('#gate-form').addEventListener('submit', tentarEntrar);
  $('#botao-travar').addEventListener('click', destravar);
  $('#botao-atualizar').addEventListener('click', carregarTudo);
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
