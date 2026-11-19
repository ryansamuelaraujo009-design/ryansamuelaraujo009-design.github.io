/* ====================================================================
   TYPEWRITER.JS — Efeito de datilografia na saudação do hero
   --------------------------------------------------------------------
   O texto é "digitado" letra a letra, reforçando o visual de terminal
   (combina com o cursor piscando que já existe em CSS).

   REGRAS DE OURO (progressivo e à prova de falhas):
     - Sem JavaScript: o texto já está no HTML e aparece normalmente.
     - Com "reduzir movimento": nada é digitado — só o texto pronto.
     - aria-label mantém o texto COMPLETO para leitores de tela desde
       o início, mesmo enquanto a "digitação" ainda está acontecendo.
   ==================================================================== */

/** Tempo (ms) entre uma letra e a próxima. */
const MS_POR_LETRA = 45;

/** Espera inicial antes de começar a "digitar". */
const ATRASO_INICIAL = 350;

export function initDatilografia() {
  const alvo = document.querySelector('.hero__saudacao');
  if (!alvo) return;

  // Acessibilidade: quem pediu menos movimento recebe o texto pronto
  const menosMovimento = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (menosMovimento) return;

  const textoCompleto = alvo.textContent;
  if (!textoCompleto) return;

  // Leitores de tela anunciam o texto completo desde o início
  alvo.setAttribute('aria-label', textoCompleto);
  alvo.textContent = '';

  let indice = 0;

  function digitar() {
    indice += 1;
    alvo.textContent = textoCompleto.slice(0, indice);

    // Ainda falta letra? Agenda a próxima. Senão, encerra (sem laço eterno).
    if (indice < textoCompleto.length) {
      window.setTimeout(digitar, MS_POR_LETRA);
    }
  }

  window.setTimeout(digitar, ATRASO_INICIAL);
}
