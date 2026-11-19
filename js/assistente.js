/* ====================================================================
   ASSISTENTE.JS — Assistente do negócio de criação de sites
   --------------------------------------------------------------------
   Como funciona (sem IA externa, sem enviar dados para lugar nenhum):
     1. A pergunta é normalizada (minúsculas + sem acentos), para que
        "orçamento" e "orcamento" casem igual.
     2. Cada tópico tem palavras-chave; o tópico com MAIS pontos vence.
     3. Alguns tópicos são DINÂMICOS: recebem as métricas reais
        (visitantes, GitHub, status) e montam a resposta na hora.

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
      'acessos', 'quem entrou', 'entraram no site', 'trafego', 'publico do site',
      'estatisticas do site', 'numero de visitas', 'visitas', 'contador',
    ],
    responder(ctx) {
      const g = ctx.goat;
      if (!g || g.status === 'carregando') {
        return '<p>⏳ Ainda estou carregando suas métricas — tente de novo em alguns segundos.</p>';
      }
      if (g.status !== 'ok') {
        return `
          <p>📊 O contador de visitantes <strong>ainda não está configurado</strong>.</p>
          <p>Para eu conseguir te dizer quantas pessoas entraram no seu site:</p>
          <ol>
            <li>Crie uma conta grátis em <a href="https://www.goatcounter.com/signup" target="_blank" rel="noopener">goatcounter.com</a>;</li>
            <li>Abra <strong>Configurações</strong> aqui no painel e cole o <strong>código</strong> e a <strong>chave de API</strong>;</li>
            <li>Troque <code>SEU-CODE</code> no <code>index.html</code> do portfólio e publique.</li>
          </ol>
          <p>Digite <strong>"configurar"</strong> para ver o passo a passo completo.</p>`;
      }

      let html = `
        <p>📊 <strong>Visitantes do seu portfólio:</strong></p>
        <ul>
          <li><strong>Hoje:</strong> ${num(g.hoje)}</li>
          <li><strong>Últimos 7 dias:</strong> ${num(g.sete)}</li>
          <li><strong>Últimos 30 dias:</strong> ${num(g.trinta)}</li>
        </ul>`;

      if (g.top && g.top.length) {
        html += '<p><strong>As páginas mais vistas (7 dias):</strong></p><ul>';
        for (const p of g.top) {
          html += `<li><code>${escapar(p.path)}</code> — ${num(p.count)}</li>`;
        }
        html += '</ul>';
      }

      if (g.dashboard) {
        html += `<p>Detalhes completos (países, horários, de onde vieram) no <a href="${g.dashboard}" target="_blank" rel="noopener">dashboard do GoatCounter</a>.</p>`;
      }
      return html;
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

      let visitantes;
      if (ctx.goat && ctx.goat.status === 'ok') {
        visitantes = `hoje <strong>${num(ctx.goat.hoje)}</strong> · 7 dias <strong>${num(ctx.goat.sete)}</strong> · 30 dias <strong>${num(ctx.goat.trinta)}</strong>`;
      } else if (ctx.goat && ctx.goat.status === 'carregando') {
        visitantes = 'carregando…';
      } else {
        visitantes = 'contador não configurado';
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
          <li><strong>Visitantes:</strong> ${visitantes}</li>
          <li><strong>GitHub:</strong> ${github}</li>
        </ul>
        <p>Pedir <strong>"visitantes"</strong>, <strong>"github"</strong> ou <strong>"status"</strong> traz o detalhe de cada um.</p>`;
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

  {
    id: 'configurar',
    chaves: [
      'configurar', 'goatcounter', 'chave api', 'sem dados', 'sem visitas',
      'nao aparece', 'como ligar', 'contador nao', 'ligar o contador',
    ],
    responder() {
      return `
        <p>⚙️ <strong>Como ligar o contador de visitas (1 vez, ~2 minutos):</strong></p>
        <ol>
          <li>Crie a conta grátis em <a href="https://www.goatcounter.com/signup" target="_blank" rel="noopener">goatcounter.com</a> (e-mail + senha).</li>
          <li>Copie seu <strong>código</strong>: é o começo do endereço do seu painel (<code>SEU-CODE.goatcounter.com</code>).</li>
          <li>No site do GoatCounter: <strong>Username → API → Create key</strong> (se der opção de permissão, escolha só leitura de estatísticas) e copie a chave.</li>
          <li>Aqui no painel: abra <strong>Configurações</strong>, cole o código e a chave e clique em <strong>Salvar</strong>.</li>
          <li>No <code>index.html</code> do portfólio, troque <code>SEU-CODE</code> no script do contador (o trecho já está lá) e publique no GitHub.</li>
        </ol>
        <p>Pronto: as visitas aparecem em ~10 segundos após a primeira visita (desative o adblocker para testar).</p>`;
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
        <p>Olá, Ryan! 👋</p>
        <p>Sou seu assistente do <strong>negócio de criação de sites</strong>: ajudo com orçamento, briefing, entrega, contrato e divulgação — e mostro o resumo das suas métricas.</p>
        <p>Pergunte à vontade ou use um atalho. Digite <strong>"ajuda"</strong> para ver tudo o que sei.</p>`;
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
        <p>💰 <strong>Como cobrar um site (sem se prejudicar):</strong></p>
        <ol>
          <li><strong>Precifique pelo valor</strong>, não só pelas horas: quanto o site vai gerar para o cliente (vendas, agendamentos, credibilidade).</li>
          <li><strong>Faixas de referência no Brasil</strong> (ajuste ao seu público e à sua região):</li>
        </ol>
        <ul>
          <li>Landing page simples: <strong>R$ 500 a R$ 1.500</strong></li>
          <li>Site institucional (até 5 páginas): <strong>R$ 1.500 a R$ 5.000</strong></li>
          <li>Loja virtual: <strong>R$ 5.000+</strong></li>
        </ul>
        <ul>
          <li>Cobre <strong>50% de sinal</strong> antes de começar e os outros 50% na entrega.</li>
          <li>Textos, logo, domínio e manutenção são <strong>extras</strong> — cobre à parte.</li>
          <li>No começo pode cobrar um pouco menos para montar portfólio, mas <strong>nunca faça de graça</strong>: cliente que não paga valoriza menos.</li>
        </ul>
        <p>Quer um <strong>modelo de proposta pronto</strong>? Pergunte por "modelo de proposta".</p>`;
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
          <li>Sempre explique o que <strong>não</strong> está incluso (evita confusão depois).</li>
          <li>Mande por escrito (e-mail ou WhatsApp) e peça uma confirmação — já vale como acordo inicial.</li>
          <li>Se o cliente pedir desconto, desista de algo em troca (ex.: menos páginas), não só do valor.</li>
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
        <p>Anote as respostas e mande de volta para o cliente <strong>confirmar por escrito</strong> — isso vira o escopo do contrato.</p>`;
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
        <p><strong>Prazo:</strong> dobre o tempo que você estima — imprevistos sempre aparecem. E combine por escrito quantas rodadas de ajustes estão inclusas (padrão: <strong>2</strong>).</p>`;
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
        <p>📢 <strong>Como atrair clientes (o que funciona de verdade):</strong></p>
        <ol>
          <li><strong>Portfólio primeiro</strong> — seu site é sua vitrine; mostre processo (antes/depois), não só o resultado.</li>
          <li><strong>LinkedIn:</strong> publique 2x por semana — dicas rápidas, bastidores, projetos novos.</li>
          <li><strong>GitHub:</strong> repositório organizado com README bom impressiona clientes técnicos e recrutadores.</li>
          <li><strong>Indicação:</strong> peça a cada cliente satisfeito e ofereça um pequeno desconto por indicação.</li>
          <li><strong>Nicho:</strong> escolha um segmento (restaurantes, barbearias, academias…) e fale a língua dele.</li>
          <li><strong>Valor primeiro:</strong> audite 3 sites de empresas do nicho e mande 1 melhoria concreta — sem cobrar nada no primeiro contato.</li>
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
        <p>✍️ <strong>O que combinar por escrito (mesmo que seja só um e-mail):</strong></p>
        <ul>
          <li><strong>Escopo:</strong> o que está incluso — e o que <strong>não</strong> está</li>
          <li><strong>Valor e pagamento:</strong> 50% de sinal antes de começar, 50% na entrega (antes de publicar)</li>
          <li><strong>Ajustes:</strong> quantas rodadas (ex.: 2) e o que vira cobrança extra</li>
          <li><strong>Prazo:</strong> e o que acontece se o cliente atrasar os materiais (o prazo congela)</li>
          <li><strong>Domínio e hospedagem:</strong> sempre no nome <strong>DO CLIENTE</strong></li>
          <li><strong>Direitos:</strong> pagamento total = direitos transferidos</li>
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
          <li><strong>Domínio</strong> = o endereço (ex.: ryan.dev.br). Custa ~R$ 30–40/ano.</li>
          <li><strong>Hospedagem</strong> = onde os arquivos do site moram.</li>
          <li><strong>GitHub Pages</strong> = hospedagem grátis para sites estáticos — é lá que seu portfólio está publicado.</li>
        </ul>
        <p><strong>Para publicar um site no GitHub Pages:</strong></p>
        <ol>
          <li>Crie o repositório <code>seuusuario.github.io</code> (ou <code>nome-do-projeto</code>)</li>
          <li>Envie o código para a branch <code>main</code></li>
          <li>No repositório: <strong>Settings → Pages → branch main → Save</strong></li>
          <li>Em 1–2 minutos o site fica no ar em <code>usuario.github.io</code></li>
        </ol>
        <p>Domínio próprio: compre, aponte o DNS e o HTTPS sai grátis. <strong>Nunca registre domínio ou hospedagem no seu nome para projeto de cliente.</strong></p>`;
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
          <li>Cobre mensalidade por: backup, atualizações de segurança, pequenas alterações de texto e monitoramento.</li>
          <li>Faixa de referência: <strong>R$ 50 a R$ 200/mês</strong> para site pequeno (ajuste ao porte do cliente).</li>
          <li>Defina um limite (ex.: 1h de alterações por mês) e o que é extra.</li>
          <li>Ofereça já na entrega: <em>"inclui 30 dias de ajustes; depois disso, existe o plano de manutenção"</em>.</li>
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
        <p>🔍 <strong>SEO básico que TODO site precisa ter:</strong></p>
        <ul>
          <li>Title único e descritivo + meta description em cada página</li>
          <li>Um H1 por página e hierarquia de títulos lógica</li>
          <li>Texto alternativo nas imagens e URLs limpas</li>
          <li>Carregamento rápido e layout responsivo (o Google olha isso)</li>
          <li>HTTPS ativo, Google Search Console + sitemap.xml enviados</li>
          <li>Conteúdo relevante e atualizado</li>
        </ul>
        <p>Realidade: SEO leva meses. Entregue o básico no site e cobre <strong>SEO como serviço à parte</strong> (mensalidade), com expectativa de prazo bem clara.</p>`;
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
          <li><strong>HTML + CSS + JavaScript</strong> (o que você já usa) resolvem a maioria dos sites pequenos — é uma base sólida.</li>
          <li>Framework (React etc.) só quando o projeto pedir — não use por moda: manutenção e velocidade importam.</li>
          <li>Cliente quer editar sozinho? Avalie um CMS (WordPress) e cobre como extra.</li>
          <li>Antes de acumular ferramentas, domine: <strong>Git, acessibilidade, performance e teste em celular</strong>.</li>
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
        <p>🚀 <strong>Fluxo recomendado para um site novo:</strong></p>
        <ol>
          <li><strong>Briefing</strong> — as perguntas essenciais (peça "briefing").</li>
          <li><strong>Proposta por escrito</strong> — escopo, prazo e valor (tem "modelo de proposta").</li>
          <li><strong>Sinal de 50%</strong> — só então você começa.</li>
          <li><strong>Desenvolvimento</strong> — mostre uma tela antes de terminar (evita retrabalho).</li>
          <li><strong>Checklist de entrega</strong> + treino do cliente.</li>
          <li><strong>Manutenção mensal</strong> — ofereça na hora da entrega.</li>
        </ol>
        <p>Por qual etapa quer começar? É só pedir.</p>`;
    },
  },

  {
    id: 'ajuda',
    chaves: ['ajuda', 'o que voce faz', 'como usar', 'comandos', 'help', 'menu', 'opcoes', 'assuntos'],
    responder() {
      return `
        <p>🤖 <strong>O que eu faço:</strong> te ajudar no negócio de criação de sites e mostrar suas métricas. Temas:</p>
        <ul>
          <li>💰 <strong>Orçamento</strong> — quanto cobrar, faixas de preço</li>
          <li>📋 <strong>Proposta</strong> — modelo pronto para mandar ao cliente</li>
          <li>🗣 <strong>Briefing</strong> — o que perguntar ao cliente</li>
          <li>🚀 <strong>Site novo</strong> — fluxo completo do começo ao fim</li>
          <li>✅ <strong>Entrega</strong> — checklist e prazos</li>
          <li>📢 <strong>Divulgação</strong> — como atrair clientes</li>
          <li>✍️ <strong>Contrato e pagamento</strong></li>
          <li>🌐 <strong>Domínio, hospedagem e publicação</strong></li>
          <li>🔧 <strong>Manutenção recorrente</strong></li>
          <li>🔍 <strong>SEO básico</strong></li>
          <li>📊 <strong>Métricas</strong> — "resumo", "visitantes", "github", "status"</li>
        </ul>
        <p>É só perguntar em palavras suas ou usar os atalhos abaixo.</p>`;
    },
  },

  {
    id: 'obrigado',
    chaves: ['obrigado', 'obrigada', 'valeu', 'vlw', 'brigado', 'flw', 'show demais', 'perfeito'],
    responder() {
      return '<p>De nada! 💪 Se precisar, é só chamar — estou aqui no painel.</p>';
    },
  },
];

/* --------------------------------------------------------------------
   MOTOR DE RESPOSTAS
   -------------------------------------------------------------------- */

/**
 * Escolhe o melhor tópico para a pergunta e devolve a resposta em HTML.
 * @param {string} entrada Texto digitado pelo usuário.
 * @param {object} ctx Métricas reais {goat, github, site}.
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
        <li>📊 <strong>"meu resumo"</strong> ou <strong>"quantas visitas"</strong></li>
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
  { rotulo: '👀 Visitantes', pergunta: 'quantas pessoas entraram no meu site' },
];
