# LeadFinder

Ferramenta de prospecção de **estabelecimentos brasileiros reais que não têm site detectado**, com WhatsApp, Instagram, cidade/UF, afiliado responsável, status de prospecção e localização no mapa mundial.

> ⚠️ Os 25 leads vêm de **perfis públicos do Instagram**, pesquisados em nov/2026. "Sem site" significa que não foi encontrado um site oficial na pesquisa — confirme antes de abordar. Cada card traz o link `Ver perfil de origem ↗` para você validar e atualizar os dados. Respeite a LGPD e os termos de uso das fontes; use apenas informações públicas e permitidas.

## Como abrir

Dê duplo clique em `index.html`. É necessário ter internet para carregar:

- Leaflet (biblioteca do mapa)
- Tiles do OpenStreetMap/CARTO (as imagens do mapa)
- Google Fonts (opcional — o site continua legível sem elas)

Se preferir servir via HTTP local:

```bash
cd lead-finder
python -m http.server 8000
# abra http://localhost:8000
```

## O que o site faz

- **Busca e filtros**: texto livre, categoria, cidade/UF (via país), afiliado, **site (sem/com)**, **status**, prioridade e canais de contato.
- **Pontuação**: WhatsApp (+3), e-mail (+2), Instagram (+2) e sem site (+2). A prioridade (alta/média/baixa) vem dessa pontuação.
- **Status de prospecção**: Novo → Contatado → Interessado → Fechado (ou Descartado). O botão `Marcar como ... →` no card avança a etapa com um clique; o filtro de status permite trabalhar só uma etapa.
- **Mapa mundial**: um pin por lead, colorido pela prioridade. Clique no pin para ver os dados e o link da fonte; clique em "Ver detalhes na lista" para ir ao card.
- **Contatos prontos**: links diretos para `wa.me` (com DDI 55 automático para números brasileiros sem código do país), `mailto:` e Instagram.
- **Cadastro e edição**: botão "Adicionar lead" no topo; cada card tem "Editar" e "Excluir".
- **Coordenadas automáticas**: no formulário, o botão "Buscar pela cidade" usa a API Nominatim (gratuita, do OpenStreetMap). A latitude deve ficar entre −90 e 90 e a longitude entre −180 e 180; elas são validadas antes de salvar.
- **Exportação**: CSV com BOM (abre com acentos no Excel) dos leads filtrados, incluindo status e fonte.
- **Importação**: JSON com uma lista de leads (aceita `latitude`, `longitude`, `observacao` e `fonte`).
- **Persistência**: os dados ficam no `localStorage` deste navegador (chave `leadfinder.leads.v2`). "Restaurar base" volta aos 25 leads reais.
- **Fonte rastreável**: cada lead registra a URL do perfil de origem, exibida no card e no popup do mapa.

## Estrutura

```
lead-finder/
├── index.html          # marcação da página
├── README.md
├── css/
│   ├── reset.css       # reset básico
│   ├── styles.css      # tema escuro/vermelho + componentes
│   └── responsive.css  # tablet e celular
└── js/
    ├── data.js         # 25 leads reais (com fonte)
    ├── utils.js        # escape HTML, score, status, links, CSV
    ├── map.js          # Leaflet + pins + popups
    └── app.js          # filtros, lista, formulário, storage, import/export
```

## Formato do JSON para importação

```json
[
  {
    "id": "meu-lead-01",
    "nome": "Padaria Central",
    "categoria": "Padaria",
    "cidade": "São Paulo, SP",
    "pais": "Brasil",
    "lat": -23.5505,
    "lng": -46.6333,
    "whatsapp": "+55 11 98873-8376",
    "email": "contato@exemplo.example",
    "instagram": "@padariacentral",
    "afiliado": "Ryan Samuel",
    "site": "",
    "status": "novo",
    "obs": "Sem presença online detectada",
    "fonte": "https://www.instagram.com/padariacentral/"
  }
]
```

## Observações legais

Esta é uma ferramenta de organização de leads. A coleta e o uso de dados de empresas devem seguir a LGPD (no Brasil) e as leis locais: use apenas informações públicas e permitidas, não inclua dados pessoais de pessoas físicas sem base legal e respeite os termos de uso das plataformas consultadas. O campo "sem site" é uma observação do momento da pesquisa, não uma afirmação definitiva.
