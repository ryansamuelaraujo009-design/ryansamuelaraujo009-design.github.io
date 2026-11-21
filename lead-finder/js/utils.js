/* ====================================================================
   UTILS.JS — Funções auxiliares compartilhadas
   --------------------------------------------------------------------
   Carregado ANTES de map.js e app.js para que todos possam usar
   window.LeadUtils.
   ==================================================================== */

(function () {
  'use strict';

  /* Troca caracteres especiais por entidades HTML.
     Use SEMPRE antes de colocar um dado do usuário dentro de innerHTML —
     é o que impede um "<script>" digitado no formulário de executar. */
  function escapeHtml(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Remove acentos e deixa minúsculo — usado na busca para que
     "sao paulo" encontre "São Paulo". */
  function normalizar(valor) {
    return String(valor == null ? '' : valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /* Score = o quanto o lead está "quente" para abordagem.
     Quanto mais canais de contato, maior a chance de fechar. */
  function calcularScore(lead) {
    let pontos = 0;
    if (lead.whatsapp) pontos += 3;
    if (lead.email) pontos += 2;
    if (lead.instagram) pontos += 2;
    if (!lead.site) pontos += 2; // empresa sem site = alvo principal
    return pontos;
  }

  function classificar(pontos) {
    if (pontos >= 7) return 'alta';
    if (pontos >= 5) return 'media';
    return 'baixa';
  }

  function prioridadeDo(lead) {
    return classificar(calcularScore(lead));
  }

  const PRIORIDADE_TEXTO = {
    alta: 'Alta prioridade',
    media: 'Média prioridade',
    baixa: 'Baixa prioridade'
  };

  /* Etapas da prospecção. A ordem também define o botão "Avançar status". */
  const STATUS = {
    novo: { texto: 'Novo', classe: 'novo', proximo: 'contatado' },
    contatado: { texto: 'Contatado', classe: 'contatado', proximo: 'interessado' },
    interessado: { texto: 'Interessado', classe: 'interessado', proximo: 'fechado' },
    fechado: { texto: 'Fechado', classe: 'fechado', proximo: null },
    descartado: { texto: 'Descartado', classe: 'descartado', proximo: null }
  };

  const STATUS_ORDEM = Object.keys(STATUS);

  function normalizarStatus(valor) {
    const chave = String(valor == null ? '' : valor).toLowerCase().trim();
    return Object.prototype.hasOwnProperty.call(STATUS, chave) ? chave : 'novo';
  }

  function statusInfo(valor) {
    return STATUS[normalizarStatus(valor)];
  }

  /* Só os números, para montar https://wa.me/<numero> */
  function digitos(texto) {
    return String(texto == null ? '' : texto).replace(/\D/g, '');
  }

  function linkWhatsapp(lead) {
    let d = digitos(lead.whatsapp);
    if (!d) return '';

    // Números brasileiros digitados sem DDI (ex.: "(11) 94000-0000")
    // precisam do 55 para o wa.me funcionar.
    const brasil = /brasil/i.test(String(lead.pais || ''));
    if (brasil && (d.length === 10 || d.length === 11)) d = '55' + d;

    return 'https://wa.me/' + d;
  }

  function linkInstagram(lead) {
    if (!lead.instagram) return '';
    return 'https://www.instagram.com/' + lead.instagram.replace(/^@/, '');
  }

  /* Remove o "@" na hora de mostrar (o link usa sem @ de qualquer jeito) */
  function nomeInstagram(texto) {
    return String(texto || '').replace(/^@/, '');
  }

  function gerarId() {
    return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function baixarArquivo(nomeArquivo, conteudo, mime) {
    const blob = new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Libera a memória do blob depois que o download foi disparado
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* CSV com BOM (\uFEFF) para o Excel abrir acentos corretamente. */
  function exportarCSV(leads) {
    const colunas = [
      'nome', 'categoria', 'cidade', 'pais', 'latitude', 'longitude',
      'whatsapp', 'email', 'instagram', 'afiliado', 'site', 'status', 'observacao', 'fonte'
    ];

    function celula(valor) {
      const texto = String(valor == null ? '' : valor);
      return /[",\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
    }

    const linhas = [colunas.join(';')].concat(leads.map(function (lead) {
      return [
        lead.nome, lead.categoria, lead.cidade, lead.pais,
        lead.lat, lead.lng, lead.whatsapp, lead.email,
        lead.instagram, lead.afiliado, lead.site,
        statusInfo(lead.status).texto, lead.obs, lead.fonte
      ].map(celula).join(';');
    }));

    return '\uFEFF' + linhas.join('\r\n');
  }

  /* Ícones em SVG (sem dependência de biblioteca de ícones). */
  const ICONES = {
    busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.25-.58-.5-.5-.68-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.15 6.15 6.58 1.72 12.03 1.72c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.08-18.36C17.19.99 14.83 0 12.32 0 5.92 0 .77 5.16.77 11.55c0 2.04.53 4.03 1.55 5.78L.5 21.49l6.13-1.6a11.46 11.46 0 0 0 4.69 1.12h.01c6.39 0 11.59-5.16 11.59-11.55 0-3.09-1.2-6-3.39-8.19z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 16V4m0 0 4 4m-4-4L8 8M4 17v3h16v-3"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    estrela: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1L12 2z"/></svg>',
    mundo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"/></svg>'
  };

  window.LeadUtils = {
    escapeHtml: escapeHtml,
    normalizar: normalizar,
    calcularScore: calcularScore,
    classificar: classificar,
    prioridadeDo: prioridadeDo,
    PRIORIDADE_TEXTO: PRIORIDADE_TEXTO,
    STATUS: STATUS,
    STATUS_ORDEM: STATUS_ORDEM,
    normalizarStatus: normalizarStatus,
    statusInfo: statusInfo,
    digitos: digitos,
    linkWhatsapp: linkWhatsapp,
    linkInstagram: linkInstagram,
    nomeInstagram: nomeInstagram,
    gerarId: gerarId,
    baixarArquivo: baixarArquivo,
    exportarCSV: exportarCSV,
    ICONES: ICONES
  };
})();
