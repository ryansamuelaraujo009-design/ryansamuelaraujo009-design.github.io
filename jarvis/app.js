'use strict';

// Demo web responsiva: usa o MESMO interpretador do app desktop (bundle.js),
// mas sem Windows, sem API e sem serviço externo.
(function () {
  const core = window.JarvisCore;
  if (!core) {
    document.getElementById('status').textContent = 'Falha ao carregar o interpretador local.';
    return;
  }

  const { engine, brain, training, normalize } = core;
  brain.clearMemory();
  brain.setEnabled(true);
  brain.setProfile({ userName: 'Ryan' });
  brain.ingestTraining(training);

  const el = {
    root: document.getElementById('hologram'),
    status: document.getElementById('status'),
    mic: document.getElementById('mic'),
    micLegenda: document.getElementById('micLegenda'),
    forma: document.getElementById('forma'),
    entrada: document.getElementById('entrada'),
    resposta: document.getElementById('resposta'),
    caption: document.getElementById('caption'),
    badge: document.getElementById('badge'),
    signal: document.getElementById('signal'),
    bars: [...document.querySelectorAll('.wave i')]
  };

  // Mesma regex do app desktop, sem acentos. brain.norm também remove
  // pontuação — "o papai chegou." precisa ativar (era a dica da demo).
  const WAKE = /\b(?:o?\s*papai chegou|o papai chego|acorda a?\s*crianca)\b/;
  const MEMORIA_DEMO = { notes: [], tasks: [] };
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  let listening = false;
  let voiceEnabled = true;
  let recon = null;
  let finalOuvido = '';
  let waveTimer = null;
  let speakToken = 0;

  const ERROS_MIC = {
    'not-allowed': 'Permita o microfone nas configurações do navegador para usar a voz.',
    'service-not-allowed': 'O navegador bloqueou o microfone. Verifique as permissões.',
    'audio-capture': 'Não encontrei um microfone neste aparelho.',
    'no-speech': 'Não ouvi nada. Toque no microfone e tente de novo.',
    'network': 'O reconhecimento de voz precisou de rede e falhou. Use o campo de texto.',
    'aborted': 'Captura interrompida. Toque no microfone para tentar de novo.',
    'language-not-supported': 'Este navegador não reconhece português do Brasil. Use o campo de texto.'
  };

  function visual(mode, caption, badge) {
    el.root.classList.remove('off', 'listening', 'speaking', 'thinking');
    el.root.classList.add(mode || 'off');
    if (caption) el.caption.textContent = String(caption).slice(0, 34);
    if (badge) el.badge.textContent = badge;
  }

  function animateWave() {
    const level = el.root.classList.contains('speaking') ? 14 : 11;
    el.bars.forEach((bar, index) => {
      const altura = 4 + Math.round(Math.random() * level * (0.5 + Math.sin(index + Date.now() / 200) * 0.5));
      bar.style.height = `${altura}px`;
    });
    el.signal.textContent = `SIGNAL ${String(55 + Math.round(Math.random() * 35)).padStart(2, '0')}`;
  }

  function setWave(active) {
    if (active && !reduceMotion?.matches && !waveTimer) waveTimer = setInterval(animateWave, 130);
    if (!active || reduceMotion?.matches) {
      if (waveTimer) clearInterval(waveTimer);
      waveTimer = null;
      el.signal.textContent = 'SIGNAL 00';
      el.bars.forEach((bar) => { bar.style.height = '4px'; });
    }
  }

  function fimDaFala() {
    if (listening) {
      visual('listening', 'Pode falar de novo', 'OUVIDO');
      setWave(true);
    } else {
      visual('off', 'Pronto para testar', 'DEMO');
      setWave(false);
    }
  }

  function speak(text) {
    const token = ++speakToken;
    if (!voiceEnabled) {
      fimDaFala();
      return;
    }
    if (!('speechSynthesis' in window)) {
      visual('off', 'Voz indisponível no navegador', 'DEMO');
      return;
    }

    // Chamada dentro do gesto do usuário: iOS/Safari exigem isso. O visual
    // "thinking" já foi aplicado por responder(); onstart troca para "speaking".
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.25;
    const voices = window.speechSynthesis.getVoices() || [];
    const voz = voices.find((v) => /pt[-_]BR/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang));
    if (voz) utterance.voice = voz;

    utterance.onstart = () => {
      if (token !== speakToken) return;
      visual('speaking', text, 'FALANDO');
      setWave(true);
    };
    utterance.onend = () => {
      if (token !== speakToken) return;
      fimDaFala();
    };
    utterance.onerror = (event) => {
      if (token !== speakToken) return;
      // cancel() ao trocar de resposta gera 'canceled'/'interrupted'.
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      visual('off', 'Sem voz neste aparelho — veja o texto', 'DEMO');
      setWave(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  function lista(tipo) {
    const itens = tipo === 'tasks' ? MEMORIA_DEMO.tasks : MEMORIA_DEMO.notes;
    if (!itens.length) return 'Não há itens salvos nesta demo.';
    return itens.slice(0, 5).map((item, i) => `${tipo === 'tasks' ? `${i + 1}: ` : ''}${item.text}${item.done ? ', concluída' : ''}`).join('. ');
  }

  function responder(raw) {
    const original = String(raw || '').trim();
    if (!original) return;

    const limpo = brain.norm(original);
    const semWake = limpo.replace(WAKE, '').replace(/^[\s,:;.!?\-]+/, '').trim();
    const soWake = !semWake && WAKE.test(limpo);
    el.status.textContent = `Ouvi: ${original}`;

    let resposta;
    if (soWake) {
      resposta = 'Sim, estou aqui. Pode falar.';
    } else {
      let parsed;
      try {
        // brain.norm remove a pontuação que o engine.norm mantém; por isso
        // "o papai chegou, crie uma tarefa..." é interpretado corretamente.
        parsed = engine.parse(semWake || limpo);
      } catch (erro) {
        parsed = { reply: 'Tive um problema ao interpretar isso.' };
      }
      resposta = parsed.reply || 'Não entendi. Pode repetir?';

      if (parsed.write) {
        MEMORIA_DEMO[parsed.write.store === 'notes' ? 'notes' : 'tasks'].unshift(parsed.write.item);
      }
      if (parsed.data?.type === 'notesList' || parsed.data?.type === 'tasksList') {
        resposta = lista(parsed.data.type === 'tasksList' ? 'tasks' : 'notes');
      } else if (parsed.data?.type === 'taskDone') {
        const busca = String(parsed.data.query || '').toLowerCase();
        const tarefa = MEMORIA_DEMO.tasks.find((item) => item.text.toLowerCase().includes(busca));
        if (tarefa) {
          tarefa.done = true;
          resposta = `Tarefa concluída: ${tarefa.text}.`;
        } else {
          resposta = 'Não encontrei essa tarefa na demo.';
        }
      } else if (parsed.intent === 'system') {
        resposta = 'Fechar o app é exclusivo da versão desktop. Aqui você pode continuar testando.';
      } else if (parsed.setting) {
        if ('voiceEnabled' in parsed.setting) voiceEnabled = Boolean(parsed.setting.voiceEnabled);
        resposta += voiceEnabled ? ' (Voz ativada nesta demo.)' : ' (Voz desativada nesta demo; use o texto.)';
      } else if (parsed.action) {
        resposta += ' (Essa ação só funciona no app desktop.)';
      } else if (parsed.webSearch) {
        resposta = `Na demo não faço buscas na web. No app desktop, use “pesquisar ${parsed.webSearch.query}”.`;
      }
    }

    el.resposta.textContent = resposta;
    visual('thinking', 'Processando...', 'ATIVO');
    setWave(true);
    speak(resposta); // sem setTimeout: precisa acontecer no mesmo gesto do usuário
  }

  el.forma.addEventListener('submit', (event) => {
    event.preventDefault();
    const valor = el.entrada.value;
    el.entrada.value = '';
    responder(valor);
  });

  document.querySelectorAll('.dica').forEach((botao) => {
    botao.addEventListener('click', () => responder(botao.textContent));
  });

  function atualizarMic(ativo) {
    listening = ativo;
    el.mic.classList.toggle('ouvindo', ativo);
    el.mic.setAttribute('aria-pressed', String(ativo));
    el.mic.setAttribute('aria-label', ativo ? 'Parar de ouvir' : 'Falar com o Jarvis');
    el.micLegenda.textContent = ativo ? 'ouvindo... toque para parar' : 'toque para falar';
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recon = new SpeechRecognition();
    recon.lang = 'pt-BR';
    recon.interimResults = true;
    recon.continuous = false;
    recon.maxAlternatives = 1;

    recon.onstart = () => { finalOuvido = ''; };

    recon.onresult = (event) => {
      let final = '';
      let parcial = '';
      // event.results traz TODOS os resultados da sessão: reconstruir o final
      // evita duplicar e também evita perder o que chegou antes do fim.
      for (let i = 0; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else parcial += event.results[i][0].transcript;
      }
      finalOuvido = final;
      if (parcial) el.status.textContent = `Ouvindo: ${parcial}`;
      else if (final) el.status.textContent = `Ouvi: ${final}`;
    };

    recon.onerror = (event) => {
      if (event.error === 'no-speech') return; // onend resolve
      el.status.textContent = ERROS_MIC[event.error] || `Não consegui ouvir (${event.error}). Use o campo de texto.`;
      atualizarMic(false);
      visual('off', 'Microfone parado', 'DEMO');
      setWave(false);
    };

    recon.onend = () => {
      const texto = finalOuvido.trim();
      finalOuvido = '';
      atualizarMic(false);
      if (texto) {
        responder(texto);
      } else if (!el.root.classList.contains('speaking')) {
        fimDaFala();
      }
    };

    el.mic.addEventListener('click', () => {
      if (listening) {
        recon.stop();
        return;
      }
      window.speechSynthesis?.cancel();
      try {
        recon.start();
        atualizarMic(true);
        el.status.textContent = 'Ouvindo...';
        visual('listening', 'Ouvindo microfone', 'OUVIDO');
        setWave(true);
      } catch (erro) {
        atualizarMic(false);
        el.status.textContent = erro?.name === 'InvalidStateError'
          ? 'O microfone já está em uso. Toque novamente em instantes.'
          : 'Não consegui iniciar o microfone. Use o campo de texto.';
        visual('off', 'Microfone indisponível', 'DEMO');
        setWave(false);
      }
    });
  } else {
    el.mic.disabled = true;
    el.mic.setAttribute('aria-disabled', 'true');
    el.mic.setAttribute('aria-label', 'Reconhecimento de voz não suportado neste navegador');
    el.mic.style.opacity = '0.55';
    el.micLegenda.textContent = 'voz não suportada — use o texto';
    el.mic.addEventListener('click', () => el.entrada.focus());
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setWave(false);
    else if (el.root.classList.contains('speaking') || el.root.classList.contains('listening')) setWave(true);
  });
  reduceMotion?.addEventListener?.('change', () => setWave(!document.hidden && (
    el.root.classList.contains('speaking') || el.root.classList.contains('listening')
  )));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* demo funciona sem cache */ });
  }

  atualizarMic(false);
  visual('off', 'Pronto para testar', 'DEMO');
})();
