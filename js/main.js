/* ====================================================================
   MAIN.JS — Ponto de entrada do JavaScript do portfólio
   --------------------------------------------------------------------
   Este arquivo importa os módulos e inicializa tudo.
   Ele é carregado no final do index.html com import() dinâmico.

   POR QUE TRY/CATCH AQUI?
   Se qualquer inicialização falhar, removemos a classe "js" do <html>.
   Essa classe é o que esconde os elementos animados — removê-la faz
   todo o conteúdo voltar a ficar visível. Regra de ouro:
   um erro de JavaScript NUNCA deve esconder o conteúdo do site.
   ==================================================================== */

import { initMenu, initNavegacaoAtiva } from './navigation.js';
import { initReveal } from './animations.js';
import { initDatilografia } from './typewriter.js';
import { initTilt } from './tilt.js';

/** Inicializa todos os módulos, na ordem em que fazem sentido. */
function init() {
  initDatilografia();    // datilografia na saudação do hero
  initMenu();            // menu hambúrguer (celular)
  initNavegacaoAtiva();  // destaque da seção atual no menu
  initReveal();          // animação de entrada ao rolar
  initTilt();            // inclinação 3D nos cards de projeto
}

try {
  init();
} catch (erro) {
  document.documentElement.classList.remove('js');
  console.error('[portfólio] Falha ao inicializar:', erro);
}
