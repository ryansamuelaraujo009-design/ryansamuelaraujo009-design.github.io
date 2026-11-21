/* ====================================================================
   DATA.JS — Base de leads reais (estabelecimentos brasileiros)
   --------------------------------------------------------------------
   Estabelecimentos reais encontrados em perfis PÚBLICOS do Instagram.
   Critério de inclusão: negócio com perfil ativo, contato público
   (WhatsApp e/ou Instagram) e nenhum site oficial encontrado na pesquisa.

   IMPORTANTE: "sem site" é o que foi detectado no momento da pesquisa
   (nov/2026). Confirme antes de abordar. O campo `fonte` aponta o perfil
   de onde os dados foram tirados — use-o para validar e atualizar.

   Campos de cada lead:
     id        -> identificador único
     nome      -> nome público do estabelecimento
     categoria -> ramo de atuação
     cidade    -> cidade / UF informadas no perfil
     pais      -> Brasil
     lat/lng   -> coordenadas aproximadas da cidade (para o mapa)
     whatsapp  -> telefone público do perfil
     email     -> e-mail público, quando havia
     instagram -> @ do perfil (usado no link de contato)
     afiliado  -> preenchido quando você cadastrar quem captou o lead
     site      -> vazio = nenhum site oficial detectado
     status    -> etapa da prospecção (novo, contatado, ...)
     obs       -> o que o perfil diz sobre vendas/agendamento
     fonte     -> URL do perfil público usado como fonte
   ==================================================================== */

window.BASE_LEADS = [
  // -------------------------- SÃO PAULO / SP --------------------------
  {
    id: 'r001', nome: 'Padaria Estilo São Paulo', categoria: 'Padaria',
    cidade: 'São Paulo, SP', pais: 'Brasil', lat: -23.5997, lng: -46.5611,
    whatsapp: '+55 11 98873-8376', email: '',
    instagram: '@padariaestilosaopaulo', afiliado: '', site: '', status: 'novo',
    obs: 'Av. Baronesa de Muritiba, 387 — Pq. São Rafael. "Peça pelo WhatsApp" no perfil.',
    fonte: 'https://www.instagram.com/padariaestilosaopaulo/'
  },
  {
    id: 'r002', nome: 'Zestzing Padaria Artesanal', categoria: 'Padaria artesanal',
    cidade: 'São Paulo, SP', pais: 'Brasil', lat: -23.5610, lng: -46.6550,
    whatsapp: '+55 11 94340-9515', email: '',
    instagram: '@zestzing_padaria_artesanal', afiliado: '', site: '', status: 'novo',
    obs: 'Encomendas de pães e panetones pelo WhatsApp; horários no perfil.',
    fonte: 'https://www.instagram.com/zestzing_padaria_artesanal/'
  },

  // -------------------------- CAMPINAS / SP --------------------------
  {
    id: 'r003', nome: 'Padaria 019', categoria: 'Padaria artesanal',
    cidade: 'Campinas, SP', pais: 'Brasil', lat: -22.9056, lng: -47.0608,
    whatsapp: '+55 19 98277-0924', email: '',
    instagram: '@padaria019', afiliado: '', site: '', status: 'novo',
    obs: 'Fermentação natural; entregas qua–sáb. Rua Frei José do Monte Carmelo.',
    fonte: 'https://www.instagram.com/padaria019/'
  },
  {
    id: 'r004', nome: 'Padaria e Confeitaria Floresta', categoria: 'Padaria e confeitaria',
    cidade: 'Campinas, SP', pais: 'Brasil', lat: -22.9090, lng: -47.0500,
    whatsapp: '+55 19 3272-6657', email: '',
    instagram: '@padariafloresta_', afiliado: '', site: '', status: 'novo',
    obs: 'Av. Dr. Carlos de Campos, 653 — "ou WhatsApp" no perfil.',
    fonte: 'https://www.instagram.com/padariafloresta_/'
  },

  // -------------------------- RECIFE / PE --------------------------
  {
    id: 'r005', nome: 'B.LEM Padaria Portuguesa', categoria: 'Padaria',
    cidade: 'Recife, PE', pais: 'Brasil', lat: -8.0476, lng: -34.8770,
    whatsapp: '+55 81 98866-6865', email: '',
    instagram: '@blempadaria.recife', afiliado: '', site: '', status: 'novo',
    obs: 'Shopping Recife — o perfil direciona pedidos para o WhatsApp.',
    fonte: 'https://www.instagram.com/blempadaria.recife/'
  },
  {
    id: 'r006', nome: 'Rainha da Várzea Delicatessen', categoria: 'Padaria e buffet',
    cidade: 'Recife, PE', pais: 'Brasil', lat: -8.0400, lng: -34.9500,
    whatsapp: '+55 81 98190-3334', email: '',
    instagram: '@rainhadavarzea.delicatessen', afiliado: '', site: '', status: 'novo',
    obs: 'Desde 1963: padaria, buffet, cafeteria e mercearia. Delivery no WhatsApp.',
    fonte: 'https://www.instagram.com/rainhadavarzea.delicatessen/'
  },
  {
    id: 'r007', nome: 'Barbearia Smoke', categoria: 'Barbearia',
    cidade: 'Recife, PE', pais: 'Brasil', lat: -8.0539, lng: -34.9270,
    whatsapp: '', email: '',
    instagram: '@barbearia_smoke', afiliado: '', site: '', status: 'novo',
    obs: 'Desde 2016; agendamentos pelo WhatsApp (link na bio).',
    fonte: 'https://www.instagram.com/barbearia_smoke/'
  },

  // -------------------------- RIO DE JANEIRO / RJ --------------------------
  {
    id: 'r008', nome: 'Perfil Estúdio de Beleza', categoria: 'Salão de beleza',
    cidade: 'Rio de Janeiro, RJ', pais: 'Brasil', lat: -22.9068, lng: -43.1729,
    whatsapp: '+55 21 98732-3929', email: '',
    instagram: '@perfilestudiodebeleza', afiliado: '', site: '', status: 'novo',
    obs: 'Rua Campo Grande, 1256. Telefones e WhatsApp publicados na bio.',
    fonte: 'https://www.instagram.com/perfilestudiodebeleza/'
  },
  {
    id: 'r009', nome: 'TP Beauty Lounge', categoria: 'Salão de beleza',
    cidade: 'Rio de Janeiro, RJ', pais: 'Brasil', lat: -22.9830, lng: -43.2250,
    whatsapp: '+55 21 99696-5668', email: '',
    instagram: '@tpbeautylounge', afiliado: '', site: '', status: 'novo',
    obs: 'Leblon. "Agendamento apenas pelo" telefone/WhatsApp da bio.',
    fonte: 'https://www.instagram.com/tpbeautylounge/'
  },

  // -------------------------- FORTALEZA / CE --------------------------
  {
    id: 'r010', nome: 'Studio Hair by Sandra', categoria: 'Salão de beleza',
    cidade: 'Fortaleza, CE', pais: 'Brasil', lat: -3.7172, lng: -38.5433,
    whatsapp: '+55 85 99854-8687', email: '',
    instagram: '@studiohairbysandra', afiliado: '', site: '', status: 'novo',
    obs: 'Aldeota. Cabelo, penteados e maquiagem; agende pelo WhatsApp.',
    fonte: 'https://www.instagram.com/studiohairbysandra/'
  },
  {
    id: 'r011', nome: 'S3 Salão de Beleza', categoria: 'Salão de beleza',
    cidade: 'Fortaleza, CE', pais: 'Brasil', lat: -3.7300, lng: -38.5200,
    whatsapp: '', email: '',
    instagram: '@s3salone', afiliado: '', site: '', status: 'novo',
    obs: 'Salão, esmalteria e escovaria; link de WhatsApp na bio.',
    fonte: 'https://www.instagram.com/s3salone/'
  },

  // -------------------------- SALVADOR / BA --------------------------
  {
    id: 'r012', nome: 'Barbearia Gentleman', categoria: 'Barbearia',
    cidade: 'Salvador, BA', pais: 'Brasil', lat: -12.9777, lng: -38.5016,
    whatsapp: '+55 71 99339-4867', email: '',
    instagram: '@barbearia.gentleman', afiliado: '', site: '', status: 'novo',
    obs: 'Salvador Shopping. Agendamento pelo WhatsApp publicado na bio.',
    fonte: 'https://www.instagram.com/barbearia.gentleman/'
  },
  {
    id: 'r013', nome: 'Confeitaria Gourmet Salvador', categoria: 'Confeitaria',
    cidade: 'Salvador, BA', pais: 'Brasil', lat: -12.9900, lng: -38.5100,
    whatsapp: '', email: '',
    instagram: '@confeitariasonho_gourmet', afiliado: '', site: '', status: 'novo',
    obs: 'Kits de festa com tortas, doces e salgados; pedidos via WhatsApp.',
    fonte: 'https://www.instagram.com/confeitariasonho_gourmet/'
  },

  // -------------------------- BRASÍLIA / DF --------------------------
  {
    id: 'r014', nome: 'Pet Shop CEV Brasília', categoria: 'Pet shop',
    cidade: 'Brasília, DF', pais: 'Brasil', lat: -15.7939, lng: -47.8828,
    whatsapp: '+55 61 99111-0476', email: '',
    instagram: '@petshop_cevbrasilia', afiliado: '', site: '', status: 'novo',
    obs: 'Telefone e WhatsApp publicados diretamente na bio.',
    fonte: 'https://www.instagram.com/petshop_cevbrasilia/'
  },
  {
    id: 'r015', nome: 'Casa Renato Petshop', categoria: 'Pet shop',
    cidade: 'Brasília, DF', pais: 'Brasil', lat: -15.8100, lng: -47.9000,
    whatsapp: '+55 61 3242-9991', email: '',
    instagram: '@casa_renato_petshop', afiliado: '', site: '', status: 'novo',
    obs: 'SCLS 308, Bloco C, Loja 20. Banho, tosa e WhatsApp na bio.',
    fonte: 'https://www.instagram.com/casa_renato_petshop/'
  },
  {
    id: 'r016', nome: 'ParkVet Petshop', categoria: 'Pet shop',
    cidade: 'Brasília, DF', pais: 'Brasil', lat: -15.8300, lng: -47.8400,
    whatsapp: '', email: '',
    instagram: '@parkvetbsb', afiliado: '', site: '', status: 'novo',
    obs: 'Candangolândia. Banho e tosa; agendamentos pelo WhatsApp.',
    fonte: 'https://www.instagram.com/parkvetbsb/'
  },
  {
    id: 'r017', nome: 'Peludos & Cia', categoria: 'Pet shop',
    cidade: 'Brasília, DF', pais: 'Brasil', lat: -15.7700, lng: -47.8800,
    whatsapp: '', email: '',
    instagram: '@peludoseciapet', afiliado: '', site: '', status: 'novo',
    obs: 'Especialistas em cachorros de pequeno porte; agende pelo WhatsApp.',
    fonte: 'https://www.instagram.com/peludoseciapet/'
  },

  // -------------------------- CURITIBA / PR --------------------------
  {
    id: 'r018', nome: 'Marcondes Restaurante', categoria: 'Restaurante',
    cidade: 'Curitiba, PR', pais: 'Brasil', lat: -25.4284, lng: -49.2733,
    whatsapp: '+55 41 3205-4982', email: '',
    instagram: '@marcondesrestaurante', afiliado: '', site: '', status: 'novo',
    obs: 'Rua Recife, 220 — Cabral. Reservas e delivery pelo WhatsApp.',
    fonte: 'https://www.instagram.com/marcondesrestaurante/'
  },

  // -------------------------- PORTO ALEGRE / RS --------------------------
  {
    id: 'r019', nome: 'Moita Lanches', categoria: 'Lanchonete',
    cidade: 'Porto Alegre, RS', pais: 'Brasil', lat: -30.0346, lng: -51.2177,
    whatsapp: '', email: '',
    instagram: '@moitalanches', afiliado: '', site: '', status: 'novo',
    obs: 'Av. Ipiranga, 2800. "Pede teu lanche pelo delivery, WhatsApp ou link".',
    fonte: 'https://www.instagram.com/moitalanches/'
  },
  {
    id: 'r020', nome: 'Vó Anita — Lanches & Pratos', categoria: 'Lanchonete',
    cidade: 'Porto Alegre, RS', pais: 'Brasil', lat: -30.0500, lng: -51.2300,
    whatsapp: '', email: '',
    instagram: '@vo_anita_restaurante', afiliado: '', site: '', status: 'novo',
    obs: 'Pedidos pelo link da bio; horários publicados no perfil.',
    fonte: 'https://www.instagram.com/vo_anita_restaurante/'
  },

  // -------------------------- GOIÂNIA / GO --------------------------
  {
    id: 'r021', nome: 'Boutique da Jú — Tricô', categoria: 'Boutique',
    cidade: 'Goiânia, GO', pais: 'Brasil', lat: -16.6869, lng: -49.2648,
    whatsapp: '', email: '',
    instagram: '@boutiquedajugoiania', afiliado: '', site: '', status: 'novo',
    obs: 'Moda feminina em tricô; "peça pelo WhatsApp" na bio.',
    fonte: 'https://www.instagram.com/boutiquedajugoiania/'
  },
  {
    id: 'r022', nome: 'Boa Boutique', categoria: 'Boutique',
    cidade: 'Goiânia, GO', pais: 'Brasil', lat: -16.6700, lng: -49.2500,
    whatsapp: '', email: '',
    instagram: '@boaboutiquegyn', afiliado: '', site: '', status: 'novo',
    obs: 'Ed. B&B Business, Vila Brasília. "Não temos catálogo, peças no Instagram".',
    fonte: 'https://www.instagram.com/boaboutiquegyn/'
  },
  {
    id: 'r023', nome: 'Auto Fix Centro Automotivo', categoria: 'Oficina mecânica',
    cidade: 'Goiânia, GO', pais: 'Brasil', lat: -16.7000, lng: -49.2700,
    whatsapp: '', email: '',
    instagram: '@autofixcentroautomotivo', afiliado: '', site: '', status: 'novo',
    obs: 'Alinhamento, balanceamento, revisão e freios; WhatsApp na bio.',
    fonte: 'https://www.instagram.com/autofixcentroautomotivo/'
  },

  // -------------------------- BELO HORIZONTE / MG --------------------------
  {
    id: 'r024', nome: 'Carbox Oficina Mecânica', categoria: 'Oficina mecânica',
    cidade: 'Belo Horizonte, MG', pais: 'Brasil', lat: -19.9167, lng: -43.9345,
    whatsapp: '', email: '',
    instagram: '@carboxoficina', afiliado: '', site: '', status: 'novo',
    obs: 'Mecânica especializada em nacionais e importados; contato pelo perfil.',
    fonte: 'https://www.instagram.com/carboxoficina/'
  },
  {
    id: 'r025', nome: 'A230 Mecânica Automotiva', categoria: 'Oficina mecânica',
    cidade: 'Belo Horizonte, MG', pais: 'Brasil', lat: -19.9300, lng: -43.9500,
    whatsapp: '', email: '',
    instagram: '@oficina_a230', afiliado: '', site: '', status: 'novo',
    obs: 'Especialista em multimarcas, diesel e diagnóstico; contato pelo perfil.',
    fonte: 'https://www.instagram.com/oficina_a230/'
  }
];
