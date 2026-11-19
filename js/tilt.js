/* ====================================================================
   TILT.JS — Inclinação 3D nos cartões de projeto (efeito "premium")
   --------------------------------------------------------------------
   Ao mover o mouse sobre o card, ele inclina levemente seguindo o
   cursor (perspective + rotate). Ao sair, volta ao lugar.

   REGRAS DE OURO:
     - Só rola em dispositivos com mouse real (hover + ponteiro fino).
     - Nunca rola para quem ativou "reduzir movimento".
     - Só age em cards já visíveis (reveal concluído) — assim nunca
       atrapalha a animação de entrada.
     - Usa apenas transform (acelerado pela GPU) — não trava celular.
   ==================================================================== */

/** Inclinação máxima, em graus. */
const INCLINACAO_MAXIMA = 7;

export function initTilt() {
  const cards = document.querySelectorAll('.projeto');
  if (!cards.length) return;

  const podeUsar =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!podeUsar) return;

  cards.forEach((card) => {
    card.addEventListener('pointermove', (evento) => {
      // Card ainda escondido (fora da tela)? Não mexe nele.
      if (!card.classList.contains('reveal--visivel')) return;

      const retangulo = card.getBoundingClientRect();

      // Posição do mouse dentro do card:
      // -0.5 = canto esquerdo/topo   |   +0.5 = canto direito/base
      const x = (evento.clientX - retangulo.left) / retangulo.width - 0.5;
      const y = (evento.clientY - retangulo.top) / retangulo.height - 0.5;

      card.style.transform =
        `perspective(900px) ` +
        `rotateY(${(x * INCLINACAO_MAXIMA).toFixed(2)}deg) ` +
        `rotateX(${(-y * INCLINACAO_MAXIMA).toFixed(2)}deg)`;
    });

    card.addEventListener('pointerleave', () => {
      // Limpa o estilo inline: o card volta para a posição do CSS
      card.style.transform = '';
    });
  });
}
