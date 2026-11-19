/* ====================================================================
   CONTADOR.JS — Conta cliques nos canais de contato do portfólio
   --------------------------------------------------------------------
   Quando alguém clica num link com data-contador="github" | "gmail" |
   "whatsapp", um clique é registrado no CountAPI (grátis, sem
   cadastro, sem chave, sem cookies). Os totais aparecem no painel
   privado (painel.html → seção "Mensagens").

   O registro é "fire-and-forget": o clique é enviado sem segurar a
   navegação e sem mostrar erro ao visitante — se falhar, simplesmente
   não conta. Nada de dados pessoais, só um número por canal.
   ==================================================================== */

const BASE = 'https://countapi.mileshilliard.com/api/v1';

/* Prefixo próprio para as chaves não colidirem com as de outros
   usuários do serviço (as chaves são públicas — nada sensível aqui). */
const PREFIXO = 'devprogramier-msg';

document.addEventListener(
  'click',
  (evento) => {
    const alvo = evento.target.closest('a[data-contador]');
    if (!alvo) return;

    const canal = alvo.dataset.contador;
    if (!canal) return;

    fetch(`${BASE}/hit/${PREFIXO}-${canal}`, { cache: 'no-store', keepalive: true }).catch(() => {
      /* Silencioso de propósito: contar clique nunca pode quebrar o link */
    });
  },
  { capture: true },
);
