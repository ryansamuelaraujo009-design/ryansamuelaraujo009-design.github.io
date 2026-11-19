/* ====================================================================
   ASSISTENTE.JS — Assistente do negócio de criação de sites
   --------------------------------------------------------------------
   Como funciona (sem IA externa, sem enviar dados para lugar nenhum):
     1. A pergunta é normalizada (minúsculas + sem acentos), para que
        "orçamento" e "orcamento" casem igual.
     2. Cada tópico tem palavras-chave; o tópico com MAIS pontos vence.
     3. Alguns tópicos são DINÂMICOS: recebem as métricas reais
        (mensagens, GitHub, status) e montam a resposta na hora.

   PARA ADICIONAR UM TÓPICO NOVO: copie um bloco do array TOPICOS e
   ajuste "chaves" (o que a pessoa pode digitar) e "responder" (o HTML
   da resposta). É só isso.
   ==================================================================== */

/** Minúsculas + remove acentos + espaços duplos (facilita a busca). */
function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escapa texto do usuário antes de exibir (evita injeção de HTML). */
function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Número no formato pt-BR (1.234). Aceita null/undefined. */
function num(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat('pt-BR').format(valor);
}

/** Data curta (19/11/2026). */
function dataCurta(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

/* --------------------------------------------------------------------
   BASE DE CONHECIMENTO — respostas do negócio (estáticas)
   -------------------------------------------------------------------- */

const TOPICOS = [

  /* ---------- DINÂMICOS (usam as métricas reais do painel) ---------- */

  {
    id: 'visitantes',
    chaves: [
      'quantas pessoas', 'quantas visitas', 'quantas entraram', 'visitantes',
      'acessos', 'quem entrou', 'entraram no site', 'trafego', 'visitas',
    ],
    responder() {
      return `
        <p>📊 O contador de <strong>visitantes</strong> foi desligado — o painel agora conta só o que importa: <strong>cliques nas mensagens</strong>.</p>
        <p>Pergunte <strong>"quantas mensagens"</strong> para ver os totais do GitHub, e-mail e WhatsApp.</p>`;
    },
  },

  {
    id: 'mensagens',
    chaves: [
      'quantas mensagens', 'quantos cliques', 'numero de mensagens',
      'contador de mensagem', 'mensagens', 'cliques', 'clicaram',
      'whatsapp', 'gmail', 'e-mail', 'email', 'chegaram',
    ],
    responder(ctx) {
      const m = ctx.mensagens;
      if (!m || m.status === 'carregando') {
        return '<p>⏳ Ainda estou carregando seus contadores — tente de novo em alguns segundos.</p>';
      }
      if (m.status !== 'ok') {
        return `<p>⚠️ Não consegui buscar os contadores agora (${escapar(m.erro || 'erro desconhecido')}). Tente de novo em instantes.</p>`;
      }
      return `
        <p>💬 <strong>Contador de mensagens (cliques de contato):</strong></p>
        <ul>
          <li><strong>GitHub:</strong> ${num(m.cliques.github)}</li>
          <li><strong>E-mail:</strong> ${num(m.cliques.gmail)}</li>
          <li><strong>WhatsApp:</strong> ${num(m.cliques.whatsapp)}</li>
          <li><strong>Total:</strong> ${num(m.total)}</li>
        </ul>
        <p>É cada clique nos links de contato do seu portfólio. Peça <strong>"resumo"</strong> para ver tudo em uma linha.</p>`;
    },
  },

  {
    id: 'github',
    chaves: [
      'github', 'estrelas', 'estrela', 'stars', 'forks', 'repositorios',
      'repositorio', 'meus repos', 'commits',
    ],
    responder(ctx) {
      const gh = ctx.github;
      if (!gh || gh.status === 'carregando') {
        return '<p>⏳ Ainda estou buscando seus dados do GitHub — tente de novo em instantes.</p>';
      }
      if (gh.status !== 'ok') {
        return `<p>⚠️ Não consegui consultar o GitHub agora (${escapar(gh.erro || 'erro desconhecido')}). ${gh.erro && gh.erro.includes('limite')
          ? 'A API pública permite 60 consultas por hora por conexão — espere um pouco e tente de novo.'
          : 'Tente de novo em alguns minutos.'}</p>`;
      }

      let html = `
        <p>🐙 <strong>Seu GitHub:</strong></p>
        <ul>
          <li><strong>${num(gh.repos)}</strong> ${gh.repos === 1 ? 'repositório público' : 'repositórios públicos'}</li>
          <li><strong>★ ${num(gh.estrelas)}</strong> estrelas · <strong>${num(gh.forks)}</strong> forks</li>
          <li><strong>Último push:</strong> ${dataCurta(gh.ultimoPush)}</li>
        </ul>`;

      if (gh.lista && gh.lista.length) {
        html += '<p><strong>Repositórios mais recentes:</strong></p><ul>';
        for (const r of gh.lista.slice(0, 5)) {
          html += `<li><a href="${escapar(r.html_url)}" target="_blank" rel="noopener">${escapar(r.name)}</a>`
            + ` — ★ ${num(r.stargazers_count)}${r.language ? ` · ${escapar(r.language)}` : ''}</li>`;
        }
        html += '</ul>';
      }

      html += `<p><a href="${escapar(gh.urlPerfil)}" target="_blank" rel="noopener">Ver perfil completo →</a></p>`;
      return html;
    },
  },

  {
    id: 'resumo',
    chaves: [
      'resumo', 'metricas', 'painel', 'como estou', 'desempenho',
      'visao geral', 'como esta', 'meu dashboard', 'números',
    ],
    responder(ctx) {
      const statusSite = ctx.site === null || ctx.site === undefined
        ? '⏳ verificando…'
        : (ctx.site.noAr ? `🟢 <strong>no ar</strong> (${num(ctx.site.ms)} ms)` : '🔴 <strong>inacessível</strong>');

      let mensagens;
      if (ctx.mensagens && ctx.mensagens.status === 'ok') {
        mensagens = `GitHub <strong>${num(ctx.mensagens.cliques.github)}</strong> · E-mail <strong>${num(ctx.mensagens.cliques.gmail)}</strong> · WhatsApp <strong>${num(ctx.mensagens.cliques.whatsapp)}</strong> · total <strong>${num(ctx.mensagens.total)}</strong>`;
      } else if (ctx.mensagens && ctx.mensagens.status === 'carregando') {
        mensagens = 'carregando…';
      } else {
        mensagens = 'indisponível agora';
      }

      let github;
      if (ctx.github && ctx.github.status === 'ok') {
        github = `<strong>${num(ctx.github.repos)}</strong> ${ctx.github.repos === 1 ? 'repositório' : 'repositórios'} · ★ <strong>${num(ctx.github.estrelas)}</strong> · <strong>${num(ctx.github.forks)}</strong> forks`;
      } else if (ctx.github && ctx.github.status === 'carregando') {
        github = 'carregando…';
      } else {
        github = 'indisponível agora';
      }

      return `
        <p>📊 <strong>Seu resumo — só o importante:</strong></p>
        <ul>
          <li><strong>Site:</strong> ${statusSite}</li>
          <li><strong>Mensagens:</strong> ${mensagens}</li>
          <li><strong>GitHub:</strong> ${github}</li>
        </ul>
        <p>Pedir <strong>"mensagens"</strong>, <strong>"github"</strong> ou <strong>"status"</strong> traz o detalhe de cada um.</p>`;
    },
  },

  {
    id: 'status',
    chaves: [
      'site no ar', 'esta no ar', 'esta funcionando', 'funcionando',
      'status do site', 'fora do ar', 'online', 'caiu', 'acessivel',
    ],
    responder(ctx) {
      if (ctx.site === null || ctx.site === undefined) {
        return '<p>⏳ Verificando se seu site está no ar… tente de novo em instantes.</p>';
      }
      if (ctx.site.noAr) {
        return `
          <p>🟢 <strong>Seu portfólio está no ar e respondendo.</strong></p>
          <ul>
            <li>Endereço: <a href="${escapar(ctx.site.url)}" target="_blank" rel="noopener">${escapar(ctx.site.url)}</a></li>
            <li>Tempo de resposta: <strong>${num(ctx.site.ms)} ms</strong></li>
          </ul>
          <p>Publicação via GitHub Pages — quando você der push, o site atualiza sozinho em ~1 minuto.</p>`;
      }
      return `
        <p>🔴 <strong>Não consegui acessar seu site agora.</strong></p>
        <ul>
          <li>Confira se o repositório <code>ryansamuelaraujo009-design.github.io</code> tem arquivos publicados;</li>
          <li>No GitHub: Settings → Pages deve indicar a branch publicada;</li>
          <li>Às vezes é instabilidade momentânea — tente de novo em 1 minuto.</li>
        </ul>`;
    },
  },

  /* ------------------- TÓPICOS DE NEGÓCIO (estáticos) ------------------- */

  {
    id: 'saudacao',
    // Saudação só responde se a mensagem for curta (evita "oi" dentro de frases longas)
    chaves: ['oi', 'ola', 'opa', 'eai', 'e ai', 'hey', 'bom dia', 'boa tarde', 'boa noite'],
    limite: 50,
    responder() {
      return `
        <p>E aí, Ryan! 👋</p>
        <p>Sou seu assistente de <strong>criação de sites</strong>: orçamento, briefing, entrega, divulgação — e as métricas do painel.</p>
        <p>É só perguntar do seu jeito. Digite <strong>"ajuda"</strong> que eu mostro tudo.</p>`;
    },
  },

  {
    id: 'orcamento',
    chaves: [
      'quanto cobrar', 'quanto eu cobro', 'cobrar um site', 'cobro quanto',
      'preco', 'orcamento', 'valor de um site', 'faixa de preco',
      'ganhar dinheiro', 'lucro', 'remuneracao', 'quanto ganho',
    ],
    responder() {
      return `
        <p>💰 <strong>Quanto cobrar:</strong></p>
        <ul>
          <li>Landing page: <strong>R$ 500 a R$ 1.500</strong></li>
          <li>Site institucional (até 5 págs): <strong>R$ 1.500 a R$ 5.000</strong></li>
          <li>Loja virtual: <strong>R$ 5.000+</strong></li>
        </ul>
        <p>Regras de ouro:</p>
        <ul>
          <li><strong>50% de sinal</strong> antes de começar, 50% na entrega</li>
          <li>Domínio, textos, logo e manutenção são <strong>extras</strong></li>
          <li>No começo pode baixar um pouco pra montar portfólio — mas <strong>nunca faça de graça</strong></li>
        </ul>
        <p>Quer um modelo pronto? Pede <strong>"modelo de proposta"</strong>.</p>`;
    },
  },

  {
    id: 'proposta',
    chaves: [
      'modelo de proposta', 'modelo de orcamento', 'template', 'abordar cliente',
      'mensagem para o cliente', 'email para o cliente', 'proposta comercial',
      'primeiro contato',
    ],
    responder() {
      return `
        <p>📋 <strong>Modelo de proposta (copie e adapte):</strong></p>
        <pre>Olá, [nome]! Obrigado pelo interesse.

Entendi que você precisa de [objetivo: vender / agendar / ter presença].
Minha proposta:
• Site de [tipo] com [nº] páginas
• Inclui: formulário, WhatsApp, SEO básico, versão celular
• Prazo: [X] dias úteis após o pagamento do sinal
• Valor: R$ [X] — 50% para iniciar, 50% na entrega
• Ajustes inclusos: 2 rodadas
• Validade desta proposta: 7 dias

Qualquer dúvida, estou à disposição!</pre>
        <ul>
          <li>Diga sempre o que <strong>não</strong> está incluso (evita confusão depois).</li>
          <li>Mande por escrito e peça uma confirmação — já vale como acordo.</li>
          <li>Desconto? Troque algo do escopo em vez de baixar o valor.</li>
        </ul>`;
    },
  },

  {
    id: 'briefing',
    chaves: [
      'briefing', 'o que perguntar', 'perguntar ao cliente', 'requisitos',
      'reuniao com o cliente', 'descobrir o que o cliente', 'o que o cliente quer',
      'primeira conversa',
    ],
    responder() {
      return `
        <p>🗣 <strong>10 perguntas essenciais do briefing:</strong></p>
        <ol>
          <li>Qual o objetivo do site — vender, informar, agendar, marcar presença?</li>
          <li>Quem é o seu cliente ideal (público)?</li>
          <li>Tem sites que você gosta? Quais e por quê?</li>
          <li>Já tem textos, imagens e logo? Quem produz o que faltar?</li>
          <li>Tem domínio próprio (o endereço que se digita no navegador)?</li>
          <li>Tem prazo especial — abertura, evento, campanha?</li>
          <li>Qual o orçamento previsto?</li>
          <li>Quem são seus principais concorrentes?</li>
          <li>Quem vai atualizar o site depois de pronto?</li>
          <li>Precisa de formulário, WhatsApp, mapa, pagamento ou blog?</li>
        </ol>
        <p>Anote as respostas e peça pra cliente <strong>confirmar por escrito</strong> — isso vira o escopo do contrato.</p>`;
    },
  },

  {
    id: 'entrega',
    chaves: [
      'checklist', 'entrega', 'entregar o site', 'finalizar projeto', 'prazo',
      'testar o site', 'rodadas de ajuste', 'revisao', 'antes de entregar',
    ],
    responder() {
      return `
        <p>✅ <strong>Checklist antes de entregar:</strong></p>
        <ul>
          <li>Aberto no <strong>celular</strong> e em pelo menos 2 navegadores</li>
          <li>Title e meta description em cada página (SEO básico)</li>
          <li>Um H1 por página, títulos em ordem lógica</li>
          <li>Imagens comprimidas e com texto alternativo (alt)</li>
          <li>Formulário testado (a mensagem chega no seu e-mail/WhatsApp?)</li>
          <li>Links de contato, redes e botões funcionando</li>
          <li>Domínio no ar com <strong>HTTPS</strong> (cadeado no navegador)</li>
          <li>Google Search Console + sitemap enviados</li>
          <li>Backup guardado e código no GitHub</li>
          <li>Cliente treinado (um vídeo curto de como editar resolve)</li>
        </ul>
        <p><strong>Prazo:</strong> dobre sua estimativa — imprevisto sempre aparece. E combine por escrito as rodadas de ajuste (padrão: <strong>2</strong>).</p>`;
    },
  },

  {
    id: 'divulgacao',
    chaves: [
      'divulgar', 'atrair clientes', 'conseguir clientes', 'marketing',
      'prospecar', 'prospeccao', 'vender', 'redes sociais', 'instagram',
      'indicacao', 'nicho', 'bater meta', 'conseguir trabalho',
    ],
    responder() {
      return `
        <p>📢 <strong>Como atrair clientes:</strong></p>
        <ol>
          <li><strong>Portfólio primeiro</strong> — mostre processo (antes/depois), não só o resultado.</li>
          <li><strong>LinkedIn:</strong> 2 posts por semana — dicas, bastidores, projetos.</li>
          <li><strong>Indicação:</strong> peça a cada cliente satisfeito e ofereça desconto por indicar.</li>
          <li><strong>Nicho:</strong> escolha um segmento (restaurantes, barbearias, academias…) e fale a língua dele.</li>
          <li><strong>Audite 3 sites</strong> do nicho e mande 1 melhoria concreta — de graça, no primeiro contato.</li>
          <li><strong>Contato ativo:</strong> 5 mensagens por semana valem mais que 50 posts sem resposta.</li>
        </ol>`;
    },
  },

  {
    id: 'contrato',
    chaves: [
      'contrato', 'pagamento', 'sinal', 'parcelas', 'pix', 'recibo',
      'formalizar', 'acordo', 'como receber',
    ],
    responder() {
      return `
        <p>✍️ <strong>Combine por escrito (até um e-mail resolve):</strong></p>
        <ul>
          <li><strong>Escopo:</strong> o que entra — e o que <strong>não</strong> entra</li>
          <li><strong>Pagamento:</strong> 50% sinal, 50% na entrega (antes de publicar)</li>
          <li><strong>Ajustes:</strong> quantas rodadas (padrão: 2) e o que vira extra</li>
          <li><strong>Prazo:</strong> e o que acontece se os materiais atrasarem (o prazo congela)</li>
          <li><strong>Domínio e hospedagem:</strong> sempre no nome <strong>DO CLIENTE</strong></li>
          <li><strong>Direitos:</strong> pago = transferidos</li>
        </ul>
        <p>Guarde os comprovantes e emita recibo — protege você e gera confiança.</p>`;
    },
  },

  {
    id: 'dominio',
    chaves: [
      'dominio', 'hospedagem', 'servidor', 'github pages', 'publicar o site',
      'colocar no ar', 'dns', 'https', 'email profissional', 'site proprio',
      'hosting',
    ],
    responder() {
      return `
        <p>🌐 <strong>Domínio × hospedagem × GitHub Pages:</strong></p>
        <ul>
          <li><strong>Domínio</strong> = o endereço (~R$ 30–40/ano).</li>
          <li><strong>Hospedagem</strong> = onde os arquivos moram — o <strong>GitHub Pages</strong> é grátis e é onde seu site está.</li>
        </ul>
        <p><strong>Publicar:</strong> repositório <code>seuusuario.github.io</code> → branch <code>main</code> → Settings → Pages → Save. Em 1–2 min está no ar.</p>
        <p>Domínio próprio: compre, aponte o DNS e o HTTPS sai grátis. <strong>Nunca registre no seu nome</strong> domínio ou hospedagem de cliente.</p>`;
    },
  },

  {
    id: 'manutencao',
    chaves: [
      'manutencao', 'mensalidade', 'atualizar o site', 'suporte ao cliente',
      'recorrente', 'pos entrega', 'planos de manutencao',
    ],
    responder() {
      return `
        <p>🔧 <strong>Manutenção = sua receita recorrente:</strong></p>
        <ul>
          <li>Cobre por: backup, atualizações, textos pequenos e monitoramento.</li>
          <li>Faixa: <strong>R$ 50 a R$ 200/mês</strong> em site pequeno (ajuste ao cliente).</li>
          <li>Defina um limite (ex.: 1h/mês) e o que é extra.</li>
          <li>Ofereça já na entrega: <em>"30 dias de ajustes inclusos; depois tem o plano."</em></li>
        </ul>`;
    },
  },

  {
    id: 'seo',
    chaves: [
      'seo', 'google', 'buscador', 'aparecer no google', 'rankear',
      'indexar', 'posicao no google', 'primeira pagina',
    ],
    responder() {
      return `
        <p>🔍 <strong>SEO básico que TODO site precisa:</strong></p>
        <ul>
          <li>Title + meta description únicos por página; um H1 por página</li>
          <li>Alt nas imagens, URLs limpas e texto relevante</li>
          <li>Rápido, responsivo e com HTTPS</li>
          <li>Google Search Console + sitemap.xml enviados</li>
        </ul>
        <p>Realidade: SEO leva meses. Entregue o básico e cobre <strong>SEO à parte</strong> (mensalidade), com prazo bem claro.</p>`;
    },
  },

  {
    id: 'tecnologia',
    chaves: [
      'qual tecnologia', 'qual linguagem', 'framework', 'stack', 'wordpress',
      'react', 'usar qual', 'melhor ferramenta', 'programar o site',
    ],
    responder() {
      return `
        <p>🛠 <strong>Por onde ir tecnicamente:</strong></p>
        <ul>
          <li><strong>HTML + CSS + JavaScript</strong> (o que você já usa) resolve quase tudo — siga firme com ele.</li>
          <li>Framework (React etc.) só quando o projeto pedir — não use por moda.</li>
          <li>Cliente quer editar sozinho? Aí é CMS (WordPress) — cobre como extra.</li>
          <li>Antes de ferramenta nova, domine: <strong>Git, acessibilidade, performance e teste em celular</strong>.</li>
        </ul>`;
    },
  },

  {
    id: 'novo_site',
    chaves: [
      'quero um site', 'preciso de um site', 'criar um site', 'fazer um site',
      'desenvolver um site', 'novo site', 'cliente quer um site',
      'primeiro projeto',
    ],
    responder() {
      return `
        <p>🚀 <strong>Fluxo de um site novo:</strong></p>
        <ol>
          <li><strong>Briefing</strong> — peça "briefing".</li>
          <li><strong>Proposta por escrito</strong> + sinal de 50% — aí você começa.</li>
          <li><strong>Desenvolvimento</strong> — mostre uma tela antes de fechar (evita retrabalho).</li>
          <li><strong>Checklist de entrega</strong> + treino do cliente.</li>
          <li><strong>Manutenção mensal</strong> — ofereça na hora da entrega.</li>
        </ol>
        <p>Por qual etapa quer começar? É só pedir.</p>`;
    },
  },

  {
    id: 'desconto',
    chaves: [
      'desconto', 'cobrar menos', 'abaixar o preco', 'negociar',
      'cliente quer mais barato', 'mais barato', 'caiu o preco',
    ],
    responder() {
      return `
        <p>💸 <strong>Cliente pedindo desconto? Não baixe o valor — troque escopo:</strong></p>
        <ul>
          <li><em>"Consigo fechar por X"</em> → mas aí saem [páginas/extras]</li>
          <li>Ou ofereça <strong>parcelamento</strong></li>
          <li>Desconto só contra algo: menos rodadas de ajuste ou menos páginas</li>
          <li>Sem acordo? Mantenha o valor e explique o porquê — firmeza gera respeito</li>
        </ul>`;
    },
  },

  {
    id: 'primeiro_cliente',
    chaves: [
      'primeiro cliente', 'primeiro trabalho', 'comecar do zero',
      'nunca tive cliente', 'conseguir cliente hoje', 'sem clientes',
    ],
    responder() {
      return `
        <p>🎯 <strong>Seu primeiro cliente (sem esperar sorte):</strong></p>
        <ol>
          <li>Monte <strong>2–3 projetos fictícios</strong> (restaurante, barbearia…) e publique no portfólio</li>
          <li><strong>Audite 5 sites</strong> do bairro/nicho e mande 1 melhoria concreta — de graça</li>
          <li>Avise no WhatsApp e no LinkedIn que está <strong>pegando projetos</strong></li>
          <li>Poste no LinkedIn 2x/semana mostrando o processo</li>
          <li>Feche o primeiro por <strong>valor justo</strong> (nunca de graça) e peça indicação</li>
        </ol>`;
    },
  },

  {
    id: 'portfolio_tema',
    chaves: [
      'portfolio', 'montar meu site', 'mostrar meu trabalho',
      'meus projetos', 'vitrine',
    ],
    responder() {
      return `
        <p>🎨 <strong>Portfólio que converte:</strong></p>
        <ul>
          <li><strong>3 a 5 projetos</strong> — menos é mais, qualidade acima de quantidade</li>
          <li>Mostre <strong>processo</strong>: problema → solução → resultado</li>
          <li>Projeto fictício vale, mas diga que é fictício (ou faça pra vizinhança)</li>
          <li><strong>GitHub organizado</strong> com README bom</li>
          <li>Em cada projeto: o que o cliente precisava, o que você fez, o resultado</li>
        </ul>`;
    },
  },

  {
    id: 'ajuda',
    chaves: ['ajuda', 'o que voce faz', 'como usar', 'comandos', 'help', 'menu', 'opcoes', 'assuntos'],
    responder() {
      return `
        <p>🤖 <strong>O que sei fazer:</strong> te ajudar no negocio de sites e mostrar suas métricas. Temas:</p>
        <ul>
          <li>💰 <strong>Orçamento</strong> — quanto cobrar</li>
          <li>💸 <strong>Desconto e negociação</strong></li>
          <li>🎯 <strong>Primeiro cliente</strong> · 🎨 <strong>Portfólio</strong></li>
          <li>📋 <strong>Proposta</strong> · 🗣 <strong>Briefing</strong> · 🚀 <strong>Site novo</strong></li>
          <li>✅ <strong>Entrega</strong> · ✍️ <strong>Contrato</strong> · 🔧 <strong>Manutenção</strong></li>
          <li>📢 <strong>Divulgação</strong> · 🌐 <strong>Domínio/publicação</strong></li>
          <li>🔍 <strong>SEO</strong> · 🛠 <strong>Tecnologia</strong></li>
          <li>📊 <strong>Métricas</strong> — "resumo", "mensagens", "github", "status"</li>
        </ul>
        <p>É só perguntar do seu jeito ou usar os atalhos aí embaixo.</p>`;
    },
  },

  {
    id: 'obrigado',
    chaves: ['obrigado', 'obrigada', 'valeu', 'vlw', 'brigado', 'flw', 'show demais', 'perfeito'],
    responder() {
      return '<p>Valeu! 💪 Qualquer coisa é só chamar.</p>';
    },
  },
];

/* --------------------------------------------------------------------
   MOTOR DE RESPOSTAS
   -------------------------------------------------------------------- */

/**
 * Escolhe o melhor tópico para a pergunta e devolve a resposta em HTML.
 * @param {string} entrada Texto digitado pelo usuário.
 * @param {object} ctx Métricas reais {mensagens, github, site}.
 * @returns {string} HTML da resposta (sempre seguro: conteúdo autorado + valores escapados).
 */
export function responder(entrada, ctx = {}) {
  const texto = normalizar(entrada);
  if (!texto) {
    return '<p>Digite uma pergunta — ou escolha um atalho abaixo. 👇</p>';
  }

  let melhor = null;
  let melhorPontos = 0;

  for (const topico of TOPICOS) {
    if (topico.limite && texto.length > topico.limite) continue;

    let pontos = 0;
    for (const chave of topico.chaves) {
      if (texto.includes(chave)) {
        // Frases completas valem mais que palavras soltas
        pontos += chave.includes(' ') ? 2 : 1;
      }
    }
    if (pontos > melhorPontos) {
      melhorPontos = pontos;
      melhor = topico;
    }
  }

  if (!melhor) {
    return `
      <p>🤔 Não entendi direito... Posso ajudar com:</p>
      <ul>
        <li>💰 <strong>"quanto cobrar por um site"</strong></li>
        <li>🗣 <strong>"o que perguntar ao cliente"</strong></li>
        <li>✅ <strong>"checklist de entrega"</strong></li>
        <li>📢 <strong>"como atrair clientes"</strong></li>
        <li>📊 <strong>"meu resumo"</strong> ou <strong>"quantas mensagens"</strong></li>
      </ul>
      <p>Ou digite <strong>"ajuda"</strong> para ver todos os temas.</p>`;
  }

  try {
    return melhor.responder(ctx);
  } catch (erro) {
    console.error('[assistente] Falha ao montar resposta:', erro);
    return '<p>⚠️ Tive um problema ao montar a resposta. Tente de novo.</p>';
  }
}

/** Atalhos exibidos como botões rápidos no chat. */
export const ATALHOS = [
  { rotulo: '💰 Quanto cobrar?', pergunta: 'quanto cobrar por um site' },
  { rotulo: '🗣 O que perguntar?', pergunta: 'o que perguntar ao cliente' },
  { rotulo: '✅ Checklist', pergunta: 'checklist de entrega do site' },
  { rotulo: '📢 Atrair clientes', pergunta: 'como atrair clientes' },
  { rotulo: '📊 Meu resumo', pergunta: 'meu resumo' },
  { rotulo: '💬 Mensagens', pergunta: 'quantas mensagens chegaram no meu portfólio' },
];
