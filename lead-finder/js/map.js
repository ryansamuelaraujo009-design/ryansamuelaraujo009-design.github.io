/* ====================================================================
   MAP.JS — Mapa mundial com Leaflet + OpenStreetMap (tema escuro CARTO)
   --------------------------------------------------------------------
   A biblioteca Leaflet vem de CDN no index.html. Aqui só criamos o mapa,
   os pins coloridos por prioridade e a comunicação com a lista de leads.
   ==================================================================== */

(function () {
  'use strict';

  const U = window.LeadUtils;

  const LeadMap = {
    mapa: null,
    pins: null,
    markers: {},
    selecionado: null,
    aoSelecionar: null, // callback preenchido pelo app.js

    init: function () {
      if (!window.L) {
        console.error('Leaflet não carregou. Verifique sua conexão com a internet.');
        return false;
      }

      this.mapa = L.map('mapa', {
        center: [-12, -18],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        scrollWheelZoom: false, // evita o mapa "roubar" o scroll da página
        worldCopyJump: true
      });

      L.control.zoom({ position: 'topright' }).addTo(this.mapa);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(this.mapa);

      this.pins = L.layerGroup().addTo(this.mapa);
      return true;
    },

    /* Cria um pin redondo com "raio" conforme a prioridade. */
    _icone: function (lead, ativo) {
      const prioridade = U.prioridadeDo(lead);
      return L.divIcon({
        className: 'pin-casca' + (ativo ? ' pin-casca--ativo' : ''),
        html: '<span class="pin pin--' + prioridade + '"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -10]
      });
    },

    _popup: function (lead) {
      const esc = U.escapeHtml;
      const prioridade = U.prioridadeDo(lead);
      const status = U.statusInfo(lead.status);

      const contatos = [];
      if (lead.whatsapp) {
        contatos.push('<a class="popup__link" href="' + esc(U.linkWhatsapp(lead)) +
          '" target="_blank" rel="noopener noreferrer">WhatsApp</a>');
      }
      if (lead.email) {
        contatos.push('<a class="popup__link" href="mailto:' + esc(lead.email) +
          '">E-mail</a>');
      }
      if (lead.instagram) {
        contatos.push('<a class="popup__link" href="' + esc(U.linkInstagram(lead)) +
          '" target="_blank" rel="noopener noreferrer">Instagram</a>');
      }

      return '' +
        '<div class="popup">' +
          '<span class="prioridade prioridade--' + prioridade + '">' +
            esc(U.PRIORIDADE_TEXTO[prioridade]) +
          '</span> ' +
          '<span class="status status--' + status.classe + '">' + esc(status.texto) + '</span>' +
          '<h4 class="popup__titulo">' + esc(lead.nome) + '</h4>' +
          '<p class="popup__local">' + esc(lead.cidade) + ', ' + esc(lead.pais) + '</p>' +
          '<p class="popup__linha"><strong>Categoria:</strong> ' + esc(lead.categoria) + '</p>' +
          '<p class="popup__linha"><strong>Afiliado:</strong> ' + esc(lead.afiliado || '—') + '</p>' +
          '<div class="popup__contatos">' + (contatos.join('') || '<span>Sem contatos cadastrados</span>') + '</div>' +
          (lead.fonte
            ? '<a class="popup__fonte" href="' + esc(lead.fonte) +
              '" target="_blank" rel="noopener noreferrer">Perfil de origem ↗</a>'
            : '') +
          '<button type="button" class="popup__botao" data-ver-lead="' + esc(lead.id) + '">Ver detalhes na lista →</button>' +
        '</div>';
    },

    /* Redesenha todos os pins a partir da lista filtrada. */
    renderizar: function (leads) {
      if (!this.mapa) return;
      this.pins.clearLayers();
      this.markers = {};

      const self = this;
      const pontos = [];

      leads.forEach(function (lead) {
        if (!Number.isFinite(Number(lead.lat)) || !Number.isFinite(Number(lead.lng))) return;

        const marker = L.marker([Number(lead.lat), Number(lead.lng)], {
          icon: self._icone(lead, lead.id === self.selecionado),
          title: lead.nome,
          keyboard: true,
          riseOnHover: true
        });

        marker.bindPopup(self._popup(lead), { maxWidth: 280, minWidth: 220 });
        marker.on('click', function () {
          self.selecionado = lead.id;
          if (typeof self.aoSelecionar === 'function') {
            self.aoSelecionar(lead.id, 'mapa');
          }
        });

        marker.addTo(self.pins);
        self.markers[lead.id] = marker;
        pontos.push([Number(lead.lat), Number(lead.lng)]);
      });

      if (pontos.length === 1) {
        this.mapa.setView(pontos[0], 6, { animate: false });
      } else if (pontos.length > 1) {
        this.mapa.fitBounds(pontos, { padding: [34, 34], maxZoom: 5, animate: false });
      } else {
        this.mapa.setView([-12, -18], 2, { animate: false });
      }

      this._atualizarZoomMinimo(pontos.length);
      setTimeout(function () { self.mapa.invalidateSize(); }, 60);
    },

    /* Não deixa o usuário "perder" o mundo ao dar muito zoom out. */
    _atualizarZoomMinimo: function (quantidade) {
      if (!this.mapa) return;
      this.mapa.setMinZoom(quantidade > 0 ? 2 : 1);
    },

    destacar: function (id) {
      if (!this.mapa) return;
      const self = this;
      this.selecionado = id;

      Object.keys(this.markers).forEach(function (key) {
        const lead = self._leadPorId[key];
        if (lead) self.markers[key].setIcon(self._icone(lead, key === id));
      });
    },

    /* Guarda a referência dos leads atuais para conseguir trocar o ícone. */
    definirLeads: function (leads) {
      this._leadPorId = {};
      leads.forEach(function (lead) { this._leadPorId[lead.id] = lead; }, this);
    },

    focar: function (id) {
      const marker = this.markers[id];
      if (!marker || !this.mapa) return;
      const pos = marker.getLatLng();
      this.mapa.flyTo([pos.lat, pos.lng], Math.max(this.mapa.getZoom(), 7), { duration: 0.7 });
      setTimeout(function () { marker.openPopup(); }, 500);
    },

    redimensionar: function () {
      if (this.mapa) this.mapa.invalidateSize();
    }
  };

  LeadMap._leadPorId = {};
  window.LeadMap = LeadMap;
})();
