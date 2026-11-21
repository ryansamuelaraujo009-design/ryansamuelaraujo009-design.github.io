/* ====================================================================
   APP.JS — Controlador da aplicação
   --------------------------------------------------------------------
   Responsável por: filtros, lista de cards, estatísticas, formulário,
   localStorage, importação/exportação e conversa com o mapa (map.js).
   ==================================================================== */

(function () {
  'use strict';

  const U = window.LeadUtils;
  const CHAVE_LOCAL = 'leadfinder.leads.v2';

  const state = {
    leads: [],
    visiveis: [],
    selecionado: null,
    editandoId: null,
    filtros: {
      busca: '',
      categoria: '',
      pais: '',
      afiliado: '',
      site: '',
      status: '',
      prioridade: '',
      ordem: 'score',
      canais: { whatsapp: false, email: false, instagram: false }
    }
  };

  const els = {};

  /* ----------------------------------------------------------------
     PERSISTÊNCIA
     ---------------------------------------------------------------- */

  function clonarBase() {
    return (window.BASE_LEADS || []).map(function (lead) {
      return Object.assign({}, lead);
    });
  }

  function carregarLeads() {
    try {
      const bruto = localStorage.getItem(CHAVE_LOCAL);
      if (bruto) {
        const dados = JSON.parse(bruto);
        if (Array.isArray(dados)) return dados;
      }
    } catch (erro) {
      console.warn('Não foi possível ler os leads salvos:', erro);
    }
    return clonarBase();
  }

  function salvarLeads() {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(state.leads));
    } catch (erro) {
      toast('Não foi possível salvar neste navegador (armazenamento cheio?).', 'erro');
    }
  }

  /* ----------------------------------------------------------------
     NOTIFICAÇÕES
     ---------------------------------------------------------------- */

  function toast(mensagem, tipo) {
    const item = document.createElement('div');
    item.className = 'toast' + (tipo === 'erro' ? ' toast--erro' : '');
    item.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    item.textContent = mensagem;
    els.toasts.appendChild(item);
    setTimeout(function () { item.remove(); }, 3500);
  }

  /* ----------------------------------------------------------------
     FILTROS E ORDENAÇÃO
     ---------------------------------------------------------------- */

  function aplicarFiltros() {
    const f = state.filtros;
    const termo = U.normalizar(f.busca);
    const canais = Object.keys(f.canais).filter(function (chave) {
      return f.canais[chave];
    });

    const lista = state.leads.filter(function (lead) {
      if (f.categoria && lead.categoria !== f.categoria) return false;
      if (f.pais && lead.pais !== f.pais) return false;
      if (f.afiliado && lead.afiliado !== f.afiliado) return false;
      if (f.site === 'sem' && !!lead.site) return false;
      if (f.site === 'com' && !lead.site) return false;
      if (f.status && U.normalizarStatus(lead.status) !== f.status) return false;
      if (f.prioridade && U.prioridadeDo(lead) !== f.prioridade) return false;

      // Marcar mais de um canal = o lead precisa ter TODOS os marcados.
      if (canais.length && !canais.every(function (canal) { return !!lead[canal]; })) {
        return false;
      }

      if (termo) {
        const texto = [
          lead.nome, lead.categoria, lead.cidade, lead.pais,
          lead.afiliado, lead.instagram, lead.email, lead.obs
        ].join(' ');
        if (U.normalizar(texto).indexOf(termo) === -1) return false;
      }

      return true;
    });

    const ordem = f.ordem;
    lista.sort(function (a, b) {
      if (ordem === 'score') {
        const diferenca = U.calcularScore(b) - U.calcularScore(a);
        if (diferenca) return diferenca;
        return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      }
      if (ordem === 'cidade') {
        return String(a.cidade).localeCompare(String(b.cidade), 'pt-BR');
      }
      if (ordem === 'afiliado') {
        return String(a.afiliado).localeCompare(String(b.afiliado), 'pt-BR');
      }
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });

    state.visiveis = lista;

    // Se o lead selecionado saiu do resultado, limpa a seleção.
    if (state.selecionado && !lista.some(function (l) { return l.id === state.selecionado; })) {
      state.selecionado = null;
      if (window.LeadMap) window.LeadMap.destacar(null);
    }
  }

  /* ----------------------------------------------------------------
     RENDERIZAÇÃO
     ---------------------------------------------------------------- */

  function renderizarStats() {
    const lista = state.visiveis;
    const paises = new Set(lista.map(function (l) { return l.pais; }).filter(Boolean));
    const semSite = lista.filter(function (l) { return !l.site; }).length;
    const comZap = lista.filter(function (l) { return !!l.whatsapp; }).length;

    const dados = [
      { valor: lista.length, rotulo: 'Leads encontrados', destaque: true },
      { valor: semSite, rotulo: 'Sem site' },
      { valor: comZap, rotulo: 'Com WhatsApp' },
      { valor: paises.size, rotulo: 'Países no mapa' }
    ];

    els.stats.innerHTML = dados.map(function (item) {
      return '<article class="card stat' + (item.destaque ? ' stat--destaque' : '') + '">' +
        '<strong class="stat__valor">' + item.valor + '</strong>' +
        '<span class="stat__rotulo">' + U.escapeHtml(item.rotulo) + '</span>' +
        '</article>';
    }).join('');
  }

  function contatoHTML(lead) {
    const esc = U.escapeHtml;
    const botoes = [];

    if (lead.whatsapp) {
      botoes.push(
        '<a class="contato contato--zap" href="' + esc(U.linkWhatsapp(lead)) +
        '" target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp de ' + esc(lead.nome) + '">' +
        U.ICONES.whatsapp + ' WhatsApp</a>'
      );
    }
    if (lead.email) {
      botoes.push(
        '<a class="contato" href="mailto:' + esc(lead.email) +
        '" aria-label="Enviar e-mail para ' + esc(lead.nome) + '">' +
        U.ICONES.email + ' E-mail</a>'
      );
    }
    if (lead.instagram) {
      botoes.push(
        '<a class="contato contato--insta" href="' + esc(U.linkInstagram(lead)) +
        '" target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram de ' + esc(lead.nome) + '">' +
        U.ICONES.instagram + ' Instagram</a>'
      );
    }

    botoes.push(
      '<button type="button" class="contato contato--mapa" data-focar="' + esc(lead.id) + '">' +
      U.ICONES.mapa + ' No mapa</button>'
    );

    return botoes.join('');
  }

  function cardHTML(lead) {
    const esc = U.escapeHtml;
    const pontos = U.calcularScore(lead);
    const prioridade = U.classificar(pontos);
    const status = U.statusInfo(lead.status);
    const proximo = status.proximo ? U.statusInfo(status.proximo) : null;
    const selecionado = lead.id === state.selecionado;

    return '' +
      '<article class="card lead' + (selecionado ? ' lead--selecionado' : '') +
        '" data-id="' + esc(lead.id) + '" tabindex="0">' +
        '<div class="lead__topo">' +
          '<div>' +
            '<h3 class="lead__nome">' + esc(lead.nome) + '</h3>' +
            '<p class="lead__local">' + U.ICONES.mapa + ' ' +
              esc(lead.cidade || 'Cidade não informada') +
              (lead.pais ? ', ' + esc(lead.pais) : '') +
            '</p>' +
          '</div>' +
          '<span class="prioridade prioridade--' + prioridade + '">' +
            esc(U.PRIORIDADE_TEXTO[prioridade]) +
          '</span>' +
        '</div>' +

        '<div class="lead__tags">' +
          '<span class="status status--' + status.classe + '">' + esc(status.texto) + '</span>' +
          (lead.categoria ? '<span class="tag">' + esc(lead.categoria) + '</span>' : '') +
          (lead.site
            ? '<span class="tag">Com site</span>'
            : '<span class="tag tag--sem-site">Sem site</span>') +
          (lead.afiliado
            ? '<span class="tag tag--afiliado">Afiliado: ' + esc(lead.afiliado) + '</span>'
            : '') +
        '</div>' +

        '<div class="lead__score">' +
          '<div class="lead__score-topo">' +
            '<span>Pontuação do lead</span><span>' + pontos + '/9</span>' +
          '</div>' +
          '<div class="barra"><span style="width:' + Math.round((pontos / 9) * 100) + '%"></span></div>' +
        '</div>' +

        (lead.obs ? '<p class="lead__obs">' + esc(lead.obs) + '</p>' : '') +

        (lead.fonte
          ? '<a class="lead__fonte" href="' + esc(lead.fonte) +
            '" target="_blank" rel="noopener noreferrer">Ver perfil de origem ↗</a>'
          : '') +

        '<div class="lead__contatos">' + contatoHTML(lead) + '</div>' +

        '<div class="lead__acoes">' +
          (proximo
            ? '<button type="button" class="acaolink acaolink--avancar" data-avancar="' +
              esc(lead.id) + '">Marcar como ' + esc(proximo.texto) + ' →</button>'
            : '') +
          '<button type="button" class="acaolink" data-editar="' + esc(lead.id) + '">Editar</button>' +
          '<button type="button" class="acaolink acaolink--perigo" data-excluir="' + esc(lead.id) + '">Excluir</button>' +
        '</div>' +
      '</article>';
  }

  function renderizarLista() {
    els.contador.textContent = '(' + state.visiveis.length + ')';

    if (!state.visiveis.length) {
      els.lista.innerHTML =
        '<div class="card vazio">' + U.ICONES.busca +
        '<strong>Nenhum lead encontrado</strong>' +
        '<p>Tente limpar os filtros ou adicionar um novo lead.</p>' +
        '</div>';
      return;
    }

    els.lista.innerHTML = state.visiveis.map(cardHTML).join('');
  }

  function renderizarTudo() {
    aplicarFiltros();
    renderizarStats();
    renderizarLista();

    if (window.LeadMap) {
      window.LeadMap.definirLeads(state.visiveis);
      window.LeadMap.renderizar(state.visiveis);
      if (state.selecionado) window.LeadMap.destacar(state.selecionado);
    }
  }

  /* ----------------------------------------------------------------
     SELEÇÃO E MAPA
     ---------------------------------------------------------------- */

  function encontrarCard(id) {
    return Array.prototype.find.call(
      document.querySelectorAll('.lead'),
      function (el) { return el.getAttribute('data-id') === id; }
    );
  }

  function selecionarLead(id, origem) {
    state.selecionado = id;

    Array.prototype.forEach.call(document.querySelectorAll('.lead'), function (el) {
      el.classList.toggle('lead--selecionado', el.getAttribute('data-id') === id);
    });

    if (window.LeadMap) window.LeadMap.destacar(id);

    if (origem === 'mapa' || origem === 'popup') {
      const card = encontrarCard(id);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ----------------------------------------------------------------
     SELECTS E AUTOCOMPLETE
     ---------------------------------------------------------------- */

  function valoresUnicos(campo) {
    return Array.from(new Set(
      state.leads.map(function (l) { return String(l[campo] || '').trim(); }).filter(Boolean)
    )).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  function preencherSelect(select, valores, textoVazio) {
    const atual = select.value;
    select.innerHTML = '<option value="">' + textoVazio + '</option>' +
      valores.map(function (valor) {
        return '<option value="' + U.escapeHtml(valor) + '">' + U.escapeHtml(valor) + '</option>';
      }).join('');
    select.value = atual;
  }

  function preencherFiltros() {
    preencherSelect(els.fCategoria, valoresUnicos('categoria'), 'Todas');
    preencherSelect(els.fPais, valoresUnicos('pais'), 'Todos');
    preencherSelect(els.fAfiliado, valoresUnicos('afiliado'), 'Todos');

    els.listaCategorias.innerHTML = valoresUnicos('categoria').map(function (v) {
      return '<option value="' + U.escapeHtml(v) + '"></option>';
    }).join('');
    els.listaPaises.innerHTML = valoresUnicos('pais').map(function (v) {
      return '<option value="' + U.escapeHtml(v) + '"></option>';
    }).join('');
    els.listaAfiliados.innerHTML = valoresUnicos('afiliado').map(function (v) {
      return '<option value="' + U.escapeHtml(v) + '"></option>';
    }).join('');
  }

  /* ----------------------------------------------------------------
     FORMULÁRIO
     ---------------------------------------------------------------- */

  const CAMPOS_FORM = {
    nome: 'c-nome', categoria: 'c-categoria', afiliado: 'c-afiliado',
    status: 'c-status', cidade: 'c-cidade', pais: 'c-pais', lat: 'c-lat', lng: 'c-lng',
    whatsapp: 'c-whatsapp', email: 'c-email', instagram: 'c-instagram',
    site: 'c-site', obs: 'c-obs'
  };

  function abrirModal(lead) {
    state.editandoId = lead ? lead.id : null;

    Object.keys(CAMPOS_FORM).forEach(function (chave) {
      const campo = document.getElementById(CAMPOS_FORM[chave]);
      campo.value = lead && lead[chave] != null ? lead[chave] : '';
    });

    els.modalTitulo.textContent = lead ? 'Editar lead' : 'Adicionar lead';
    els.modalSubtitulo.textContent = lead
      ? 'Atualize as informações da empresa.'
      : 'Preencha os dados da empresa que você encontrou.';
    els.btnSalvar.textContent = lead ? 'Salvar alterações' : 'Salvar lead';

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { els.cNome.focus(); }, 40);
  }

  function fecharModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
    state.editandoId = null;
  }

  function salvarFormulario(evento) {
    evento.preventDefault();

    const nome = els.cNome.value.trim();
    if (!nome) {
      toast('Informe o nome da empresa.', 'erro');
      els.cNome.focus();
      return;
    }

    const lat = parseFloat(els.cLat.value);
    const lng = parseFloat(els.cLng.value);

    if ((els.cLat.value.trim() && !Number.isFinite(lat)) ||
        (els.cLng.value.trim() && !Number.isFinite(lng))) {
      toast('Latitude e longitude precisam ser números.', 'erro');
      return;
    }
    if (Number.isFinite(lat) !== Number.isFinite(lng)) {
      toast('Informe latitude e longitude juntas (ou deixe as duas em branco).', 'erro');
      return;
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      toast('Coordenadas inválidas: latitude entre -90 e 90, longitude entre -180 e 180.', 'erro');
      return;
    }

    const dados = {
      nome: nome,
      categoria: els.cCategoria.value.trim(),
      afiliado: els.cAfiliado.value.trim(),
      status: U.normalizarStatus(els.cStatus.value),
      cidade: els.cCidade.value.trim(),
      pais: els.cPais.value.trim(),
      lat: Number.isFinite(lat) ? lat : '',
      lng: Number.isFinite(lng) ? lng : '',
      whatsapp: els.cWhatsapp.value.trim(),
      email: els.cEmail.value.trim(),
      instagram: els.cInstagram.value.trim(),
      site: els.cSite.value.trim(),
      obs: els.cObs.value.trim()
    };

    if (state.editandoId) {
      const indice = state.leads.findIndex(function (l) { return l.id === state.editandoId; });
      if (indice >= 0) state.leads[indice] = Object.assign({}, state.leads[indice], dados);
      toast('Lead atualizado.');
    } else {
      state.leads.unshift(Object.assign({ id: U.gerarId() }, dados));
      toast('Lead adicionado à base.');
    }

    salvarLeads();
    preencherFiltros();
    fecharModal();
    renderizarTudo();
  }

  function excluirLead(id) {
    const lead = state.leads.find(function (l) { return l.id === id; });
    if (!lead) return;
    if (!confirm('Excluir o lead "' + lead.nome + '"?')) return;

    state.leads = state.leads.filter(function (l) { return l.id !== id; });
    if (state.selecionado === id) state.selecionado = null;
    salvarLeads();
    preencherFiltros();
    renderizarTudo();
    toast('Lead excluído.');
  }

  function avancarStatus(id) {
    const lead = state.leads.find(function (l) { return l.id === id; });
    if (!lead) return;

    const atual = U.statusInfo(lead.status);
    if (!atual.proximo) return;

    lead.status = atual.proximo;
    salvarLeads();
    renderizarTudo();
    toast('"' + lead.nome + '" agora está ' + U.statusInfo(lead.status).texto.toLowerCase() + '.');
  }

  /* Busca coordenadas no Nominatim (OpenStreetMap), sem chave de API. */
  function buscarCoordenadas() {
    const cidade = els.cCidade.value.trim();
    const pais = els.cPais.value.trim();
    if (!cidade) {
      toast('Digite a cidade antes de buscar.', 'erro');
      els.cCidade.focus();
      return;
    }

    const botao = els.btnGeocode;
    botao.disabled = true;
    botao.textContent = 'Buscando...';

    const consulta = cidade + (pais ? ', ' + pais : '');
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(consulta);

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (resposta) {
        if (!resposta.ok) throw new Error('falha');
        return resposta.json();
      })
      .then(function (dados) {
        if (!dados.length) throw new Error('vazio');
        els.cLat.value = Number(dados[0].lat).toFixed(4);
        els.cLng.value = Number(dados[0].lon).toFixed(4);
        toast('Coordenadas encontradas!');
      })
      .catch(function () {
        toast('Não achei essa cidade. Digite latitude e longitude manualmente.', 'erro');
      })
      .finally(function () {
        botao.disabled = false;
        botao.textContent = 'Buscar pela cidade →';
      });
  }

  /* ----------------------------------------------------------------
     IMPORTAR / EXPORTAR
     ---------------------------------------------------------------- */

  function normalizarImportado(item) {
    return {
      id: String(item.id || U.gerarId()),
      nome: String(item.nome || item.name || '').trim(),
      categoria: String(item.categoria || '').trim(),
      cidade: String(item.cidade || '').trim(),
      pais: String(item.pais || '').trim(),
      lat: item.lat != null ? item.lat : (item.latitude != null ? item.latitude : ''),
      lng: item.lng != null ? item.lng : (item.longitude != null ? item.longitude : ''),
      whatsapp: String(item.whatsapp || '').trim(),
      email: String(item.email || '').trim(),
      instagram: String(item.instagram || '').trim(),
      afiliado: String(item.afiliado || '').trim(),
      site: String(item.site || '').trim(),
      status: U.normalizarStatus(item.status),
      obs: String(item.obs || item.observacao || '').trim(),
      fonte: String(item.fonte || '').trim()
    };
  }

  function importarJSON(arquivo) {
    const leitor = new FileReader();

    leitor.onload = function () {
      try {
        const conteudo = JSON.parse(leitor.result);
        const bruto = Array.isArray(conteudo)
          ? conteudo
          : (conteudo && Array.isArray(conteudo.leads) ? conteudo.leads : null);
        if (!bruto) throw new Error('formato');

        const importados = bruto
          .map(normalizarImportado)
          .filter(function (lead) { return lead.nome; });
        if (!importados.length) throw new Error('vazio');

        const substituir = confirm(
          'Substituir a base atual pelos ' + importados.length + ' leads importados?\n\n' +
          'OK = substituir  ·  Cancelar = adicionar à lista atual'
        );

        if (substituir) {
          state.leads = importados;
        } else {
          const ids = new Set(state.leads.map(function (l) { return l.id; }));
          importados.forEach(function (lead) {
            if (ids.has(lead.id)) lead.id = U.gerarId();
            state.leads.unshift(lead);
          });
        }

        state.selecionado = null;
        salvarLeads();
        preencherFiltros();
        renderizarTudo();
        toast(importados.length + ' leads importados.');
      } catch (erro) {
        toast('Arquivo inválido. Esperava um JSON com uma lista de leads.', 'erro');
      }
      els.arquivoJson.value = '';
    };

    leitor.onerror = function () {
      toast('Não foi possível ler o arquivo.', 'erro');
      els.arquivoJson.value = '';
    };

    leitor.readAsText(arquivo);
  }

  /* ----------------------------------------------------------------
     EVENTOS
     ---------------------------------------------------------------- */

  function vincularEventos() {
    // Filtros
    els.fBusca.addEventListener('input', function () {
      state.filtros.busca = els.fBusca.value;
      renderizarTudo();
    });

    [['fCategoria', 'categoria'], ['fPais', 'pais'], ['fAfiliado', 'afiliado'],
     ['fSite', 'site'], ['fStatus', 'status'],
     ['fPrioridade', 'prioridade'], ['fOrdem', 'ordem']].forEach(function (par) {
      els[par[0]].addEventListener('change', function () {
        state.filtros[par[1]] = els[par[0]].value;
        renderizarTudo();
      });
    });

    document.querySelectorAll('[data-canal]').forEach(function (input) {
      input.addEventListener('change', function () {
        state.filtros.canais[input.getAttribute('data-canal')] = input.checked;
        renderizarTudo();
      });
    });

    els.formFiltros.addEventListener('submit', function (e) { e.preventDefault(); });

    els.btnLimpar.addEventListener('click', function () {
      els.fBusca.value = '';
      els.fCategoria.value = '';
      els.fPais.value = '';
      els.fAfiliado.value = '';
      els.fSite.value = '';
      els.fStatus.value = '';
      els.fPrioridade.value = '';
      els.fOrdem.value = 'score';
      document.querySelectorAll('[data-canal]').forEach(function (input) { input.checked = false; });

      state.filtros = {
        busca: '', categoria: '', pais: '', afiliado: '', site: '', status: '',
        prioridade: '', ordem: 'score',
        canais: { whatsapp: false, email: false, instagram: false }
      };
      renderizarTudo();
    });

    // Exportar / importar / restaurar
    els.btnExportar.addEventListener('click', function () {
      if (!state.visiveis.length) {
        toast('Não há leads para exportar com esses filtros.', 'erro');
        return;
      }
      const csv = U.exportarCSV(state.visiveis);
      U.baixarArquivo('leads-leadfinder.csv', csv, 'text/csv;charset=utf-8');
      toast(state.visiveis.length + ' leads exportados em CSV.');
    });

    els.btnImportar.addEventListener('click', function () { els.arquivoJson.click(); });
    els.arquivoJson.addEventListener('change', function () {
      if (els.arquivoJson.files[0]) importarJSON(els.arquivoJson.files[0]);
    });

    els.btnResetar.addEventListener('click', function () {
      if (!confirm('Restaurar a base de 25 leads reais? Isso apaga os dados salvos neste navegador.')) return;
      state.leads = clonarBase();
      state.selecionado = null;
      salvarLeads();
      preencherFiltros();
      renderizarTudo();
      toast('Base de leads reais restaurada.');
    });

    // Lista de leads (delegação de eventos)
    els.lista.addEventListener('click', function (evento) {
      const botaoFocar = evento.target.closest('[data-focar]');
      if (botaoFocar) {
        selecionarLead(botaoFocar.getAttribute('data-focar'), 'lista');
        if (window.LeadMap) window.LeadMap.focar(botaoFocar.getAttribute('data-focar'));
        return;
      }

      const botaoAvancar = evento.target.closest('[data-avancar]');
      if (botaoAvancar) {
        avancarStatus(botaoAvancar.getAttribute('data-avancar'));
        return;
      }

      const botaoEditar = evento.target.closest('[data-editar]');
      if (botaoEditar) {
        const lead = state.leads.find(function (l) { return l.id === botaoEditar.getAttribute('data-editar'); });
        if (lead) abrirModal(lead);
        return;
      }

      const botaoExcluir = evento.target.closest('[data-excluir]');
      if (botaoExcluir) {
        excluirLead(botaoExcluir.getAttribute('data-excluir'));
        return;
      }

      // Clique nos links de contato não deve mudar a seleção
      if (evento.target.closest('a, button')) return;

      const card = evento.target.closest('.lead');
      if (card) selecionarLead(card.getAttribute('data-id'), 'lista');
    });

    els.lista.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      const card = evento.target.closest('.lead');
      if (card && evento.target === card) {
        evento.preventDefault();
        selecionarLead(card.getAttribute('data-id'), 'lista');
      }
    });

    // Botão "Ver detalhes" dentro do popup do mapa
    document.addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-ver-lead]');
      if (alvo) selecionarLead(alvo.getAttribute('data-ver-lead'), 'popup');
    });

    // Modal
    els.btnAdicionar.addEventListener('click', function () { abrirModal(null); });
    els.modalFechar.addEventListener('click', fecharModal);
    els.btnCancelar.addEventListener('click', fecharModal);
    els.modal.addEventListener('click', function (evento) {
      if (evento.target === els.modal) fecharModal();
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && !els.modal.hidden) fecharModal();
    });

    els.formLead.addEventListener('submit', salvarFormulario);
    els.btnGeocode.addEventListener('click', buscarCoordenadas);

    window.addEventListener('resize', function () {
      if (window.LeadMap) window.LeadMap.redimensionar();
    });
  }

  /* ----------------------------------------------------------------
     INÍCIO
     ---------------------------------------------------------------- */

  function cachearElementos() {
    [
      'stats', 'form-filtros', 'f-busca', 'f-categoria', 'f-pais', 'f-afiliado',
      'f-site', 'f-status', 'f-prioridade', 'f-ordem',
      'btn-limpar', 'btn-exportar', 'btn-importar',
      'arquivo-json', 'btn-resetar', 'contador', 'lista', 'btn-adicionar',
      'modal', 'modal-titulo', 'modal-subtitulo', 'modal-fechar', 'form-lead',
      'btn-cancelar', 'btn-salvar', 'btn-geocode', 'toasts', 'c-nome',
      'c-categoria', 'c-afiliado', 'c-status', 'c-cidade', 'c-pais', 'c-lat', 'c-lng',
      'c-whatsapp', 'c-email', 'c-instagram', 'c-site', 'c-obs',
      'lista-categorias', 'lista-paises', 'lista-afiliados', 'icone-busca'
    ].forEach(function (id) {
      const chave = id.replace(/-([a-z])/g, function (_, letra) { return letra.toUpperCase(); });
      els[chave] = document.getElementById(id);
    });
  }

  function iniciar() {
    cachearElementos();
    els.iconeBusca.innerHTML = U.ICONES.busca;

    state.leads = carregarLeads();

    if (window.LeadMap) {
      window.LeadMap.init();
      window.LeadMap.aoSelecionar = function (id) { selecionarLead(id, 'mapa'); };
    }

    preencherFiltros();
    vincularEventos();
    renderizarTudo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
