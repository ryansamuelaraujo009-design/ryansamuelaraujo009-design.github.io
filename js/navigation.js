/* ====================================================================
   NAVIGATION.JS — Menu hambúrguer e destaque da seção ativa
   --------------------------------------------------------------------
   Duas responsabilidades:
     1. initMenu()           → abre/fecha o menu no celular
     2. initNavegacaoAtiva() → destaca no menu a seção visível na tela

   Como este é um módulo ES (import/export), ele tem escopo próprio:
   nada aqui vaza para o escopo global da página.
   ==================================================================== */

/**
 * Largura máxima (em px) em que o menu hambúrguer fica visível.
 * ATENÇÃO: precisa bater com o breakpoint do CSS
 * (@media (max-width: 720px) no responsive.css).
 * Se um mudar, o outro precisa mudar também.
 */
const LARGURA_MENU_CELULAR = 720;

/* --------------------------------------------------------------------
   1. MENU HAMBÚRGUER
   -------------------------------------------------------------------- */
export function initMenu() {
  const botao = document.querySelector('.menu-botao');
  const menu = document.getElementById('menu-principal');

  // Código defensivo: se os elementos não existirem, nada a fazer
  if (!botao || !menu) return;

  /**
   * Abre ou fecha o menu e sincroniza os atributos de acessibilidade.
   * aria-expanded é O QUE leitores de tela usam para anunciar se o
   * menu está aberto — sem ele, a pessoa não saberia o estado do botão.
   */
  const definirAberto = (aberto) => {
    menu.classList.toggle('aberto', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  };

  const estaAberto = () => menu.classList.contains('aberto');

  // Clique no botão: inverte o estado (abre se fechado, fecha se aberto)
  botao.addEventListener('click', () => definirAberto(!estaAberto()));

  // Clique em um link do menu: navega para a seção E fecha o menu
  menu.addEventListener('click', (evento) => {
    if (evento.target.closest('.nav__link')) definirAberto(false);
  });

  // Clique fora do menu: fecha (comportamento esperado de menus dropdown)
  document.addEventListener('click', (evento) => {
    const clicouFora =
      !menu.contains(evento.target) && !botao.contains(evento.target);
    if (estaAberto() && clicouFora) definirAberto(false);
  });

  // Tecla Esc: fecha o menu (padrão de acessibilidade para menus/modais)
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && estaAberto()) definirAberto(false);
  });

  // Janela virou desktop: o botão some, então o menu também fecha.
  // Sem isso, o menu ficaria "preso" aberto ao maximizar a janela.
  window.addEventListener('resize', () => {
    if (window.innerWidth > LARGURA_MENU_CELULAR) definirAberto(false);
  });
}

/* --------------------------------------------------------------------
   2. DESTAQUE DA SEÇÃO ATIVA
   -------------------------------------------------------------------- */
export function initNavegacaoAtiva() {
  const secoes = document.querySelectorAll('main section[id]');
  const links = document.querySelectorAll('.nav__link');

  // Precisa de IntersectionObserver (navegadores muito antigos não têm)
  if (!secoes.length || !links.length || !('IntersectionObserver' in window)) {
    return;
  }

  // Mapa de consulta: id da seção → link correspondente do menu
  const linksPorId = new Map();
  links.forEach((link) => {
    const id = link.getAttribute('href').replace('#', '');
    linksPorId.set(id, link);
  });

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        // Só nos interessa a seção que acabou de ENTRAR na faixa central
        if (!entrada.isIntersecting) return;

        const linkAtivo = linksPorId.get(entrada.target.id);
        if (!linkAtivo) return;

        // Remove o destaque de todos e aplica apenas ao atual
        links.forEach((link) => link.classList.remove('nav__link--ativo'));
        linkAtivo.classList.add('nav__link--ativo');
      });
    },
    {
      /*
       * rootMargin encolhe a "janela de observação" para uma faixa
       * estreita no meio da tela (entre 45% e 50% da altura).
       * A seção que cruzar essa faixa é considerada a atual.
       *
       * POR QUE NÃO USAR A SEÇÃO INTEIRA?
       * Seções grandes disparariam o observer várias vezes durante a
       * rolagem, fazendo o destaque "piscar" entre itens do menu.
       */
      rootMargin: '-45% 0px -50% 0px',
      threshold: 0,
    }
  );

  secoes.forEach((secao) => observador.observe(secao));
}
