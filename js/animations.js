/* ====================================================================
   ANIMATIONS.JS — Animação de entrada ao rolar (reveal)
   --------------------------------------------------------------------
   Elementos entram em cena (fade + subida leve) quando chegam perto
   da área visível da tela.

   COMO FUNCIONA (progressivo e à prova de falhas):
     1. Este módulo SELECIONA os elementos e adiciona a classe .reveal
        neles. Ou seja: sem JavaScript, a classe nunca existe e o
        conteúdo fica 100% visível — nada fica escondido à toa.
     2. IntersectionObserver observa cada elemento.
     3. Ao entrar na tela, adiciona .reveal--visivel → o CSS anima.
     4. O elemento é "desobservado": a animação roda UMA vez só.

   POR QUE NÃO USAR O EVENTO "scroll"?
   O listener de scroll dispara a cada pixel rolagem e é caro.
   IntersectionObserver é nativo, otimizado pelo navegador e não
   bloqueia a interface — é a ferramenta certa para este trabalho.
   ==================================================================== */

/** Seletores dos elementos que recebem a animação de entrada. */
const ALVOS = [
  '.hero__interno',        // conteúdo do hero (aparece ao carregar)
  '.secao__cabecalho',     // título de cada seção
  '.card',                 // todos os cartões (tecnologias, projetos...)
  '.tecnologias__nota',
  '.contato__intro',
  '.contato__lista',
].join(', ');

/*
 * Divide os títulos de seção em letras (<span class="letra">) para a
 * animação de entrada letra a letra.
 *
 * ACESSIBILIDADE: letras separadas fazem leitores de tela soletrarem.
 * Por isso colocamos aria-label com a palavra inteira no <h2> e
 * aria-hidden em cada letra — o leitor de tela lê o aria-label.
 */
function prepararTitulos() {
  document.querySelectorAll('.secao__titulo').forEach((titulo) => {
    const texto = titulo.textContent.trim();
    if (!texto) return;

    titulo.textContent = '';
    titulo.setAttribute('aria-label', texto);

    Array.from(texto).forEach((letra, indice) => {
      // Espaços viram nós de texto simples (span vazio não renderiza espaço)
      if (letra === ' ') {
        titulo.appendChild(document.createTextNode(' '));
        return;
      }

      const span = document.createElement('span');
      span.className = 'letra';
      span.setAttribute('aria-hidden', 'true');
      // Atraso crescente: as letras entram em sequência, da esquerda p/ direita
      span.style.animationDelay = `${120 + indice * 45}ms`;
      span.textContent = letra;
      titulo.appendChild(span);
    });
  });
}

export function initReveal() {
  const elementos = document.querySelectorAll(ALVOS);
  if (!elementos.length) return;

  /*
   * Acessibilidade: quem tem "reduzir movimento" ativado no sistema
   * operacional não deve receber animações. Nesses casos, mostramos
   * tudo imediatamente — sem esconder nada, sem esperar rolagem.
   */
  const menosMovimento = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // Títulos em letras: apenas quando o usuário aceita movimento
  if (!menosMovimento) prepararTitulos();

  if (menosMovimento || !('IntersectionObserver' in window)) {
    elementos.forEach((el) => el.classList.add('reveal', 'reveal--visivel'));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas, obs) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;

        entrada.target.classList.add('reveal--visivel');

        // unobserve: depois de animar, o observer não olha mais
        // para este elemento (economiza processamento)
        obs.unobserve(entrada.target);
      });
    },
    {
      // threshold 0.15 = anima quando 15% do elemento está visível
      threshold: 0.15,
      // Pequeno recuo embaixo: a animação começa um pouco antes
      // do elemento chegar ao rodapé da tela
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elementos.forEach((el) => {
    // Marca como "animável" — daqui para cá o CSS o deixa invisível
    // até entrar na tela. É AQUI que a classe é aplicada (não no HTML).
    el.classList.add('reveal');

    /*
     * ATRASO ESCALONADO: itens do mesmo grupo entram em sequência.
     * Ex.: os cards de Tecnologias aparecem um após o outro.
     * Limitado a 5 posições (350ms) para não deixar nada lento.
     */
    const irmaos = el.parentElement.children;
    const indice = Array.from(irmaos).indexOf(el);
    if (indice > 0 && indice <= 6) {
      el.style.transitionDelay = `${indice * 90}ms`;
    }

    /*
     * Depois que a entrada termina, removemos o atraso escalonado.
     * Por quê? transitionDelay afeta TODAS as transições do elemento —
     * se ficasse eterno, o hover do5º card demoraria450ms para reagir.
     */
    const atrasoMs = parseInt(el.style.transitionDelay, 10) || 0;
    window.setTimeout(() => {
      el.style.transitionDelay = '';
    }, atrasoMs + 800);

    observador.observe(el);
  });
}
