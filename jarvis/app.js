'use strict';

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

  const WAKE = /\b(?:o?\s*papai chegou|o papai chego|acorda a?\s*crianca)\b/;
  let listening = false;
  let recon = null;
  let waveTimer = null;

  function visual(mode, caption, badge) {
    el.root.classList.remove('off', 'listening', 'speaking', 'thinking');
    el.root.classList.add(mode || 'off');
    if (caption) el.caption.textContent = String(caption).slice(0, 34);
    if (badge) el.badge.textContent = badge;
  }

  function animateWave() {
    const level = el.root.classList.contains('speaking') ? 14 : 11;
    el.bars.forEach((bar, index) => {
      const random = Math.random();
      const altura = 4 + Math.round(random * level * (0.5 + Math.sin(index + Date.now() / 200) * 0.5));
      bar.style.height = `${altura}px`;
    });
    el.signal.textContent = `SIGNAL ${String(55 + Math.round(Math.random() * 35)).padStart(2, '0')}`;
  }

  function setWave(active) {
    if (active && !waveTimer) waveTimer = setInterval(animateWave, 130);
    if (!active && waveTimer) {
      clearInterval(waveTimer);
      waveTimer = null;
      el.signal.textContent = 'SIGNAL 00';
      el.bars.forEach((bar) => { bar.style.height = '4px'; });
    }
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      visual('listening', 'Voz indisponível no navegador', 'DEMO');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.25;
    const voices = window.speechSynthesis.getVoices() || [];
    const voz = voices.find((v) => /pt[-_]BR/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang));
    if (voz) utterance.voice = voz;
    utterance.onstart = () => {
      visual('speaking', text, 'FALANDO');
      setWave(true);
    };
    utterance.onend = () => {
      visual('listening', 'Pode falar de novo', 'OUVIDO');
      setWave(true);
    };
    utterance.onerror = () => {
      visual('listening', 'Sem voz neste aparelho', 'DEMO');
      setWave(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  function responder(raw) {
    const texto = normalize(String(raw || '').trim());
    if (!texto) return;

    const normalizado = engine.norm(texto);
    const semWake = normalizado.replace(WAKE, '').replace(/^[\s,:;-]+/, '').trim();
    const soWake = !semWake && WAKE.test(normalizado);
    el.status.textContent = `Ouvi: ${soWake ? normalizado : semWake || normalizado}`;

    let resposta;
    if (soWake) {
      resposta = 'Sim, estou aqui. Pode falar.';
    } else {
      let parsed;
      try {
        parsed = engine.parse(semWake || normalizado);
      } catch (erro) {
        parsed = { reply: 'Tive um problema ao interpretar isso.' };
      }
      resposta = parsed.reply || 'Não entendi. Pode repetir?';
      if (parsed.action) resposta += ' (Essa ação só funciona no app desktop.)';
      if (parsed.webSearch) resposta += ' (Busca na web disponível só no app desktop.)';
    }

    el.resposta.textContent = resposta;
    visual('thinking', 'Processando...', 'ATIVO');
    setWave(true);
    setTimeout(() => speak(resposta), 180);
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

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recon = new SpeechRecognition();
    recon.lang = 'pt-BR';
    recon.interimResults = true;
    recon.continuous = false;
    recon.maxAlternatives = 1;

    recon.onresult = (event) => {
      let final = '';
      let parcial = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const resultado = event.results[i];
        if (resultado.isFinal) final += resultado[0].transcript;
        else parcial += resultado[0].transcript;
      }
      if (parcial) el.status.textContent = `Ouvindo: ${parcial}`;
      if (final) responder(final);
    };
    recon.onerror = (event) => {
      const mensagem = event.error === 'not-allowed'
        ? 'Permita o microfone para usar a voz.'
        : `Não consegui ouvir (${event.error}). Tente o campo de texto.`;
      el.status.textContent = mensagem;
    };
    recon.onend = () => {
      listening = false;
      el.mic.classList.remove('ouvindo');
      el.micLegenda.textContent = 'toque para falar';
      if (!el.root.classList.contains('speaking')) setWave(false);
    };

    el.mic.addEventListener('click', () => {
      if (listening) {
        recon.stop();
        return;
      }
      window.speechSynthesis?.cancel();
      try {
        recon.start();
        listening = true;
        el.mic.classList.add('ouvindo');
        el.micLegenda.textContent = 'ouvindo... toque para parar';
        el.status.textContent = 'Ouvindo...';
        visual('listening', 'Ouvindo microfone', 'OUVIDO');
        setWave(true);
      } catch (erro) {
        el.status.textContent = 'O microfone já está em uso.';
      }
    });
  } else {
    el.mic.addEventListener('click', () => {
      el.status.textContent = 'Este navegador não tem reconhecimento de voz. Use o campo de texto.';
      el.entrada.focus();
    });
    el.mic.style.opacity = '0.55';
    el.micLegenda.textContent = 'voz não suportada';
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices());
  }

  visual('off', 'Pronto para testar', 'DEMO');
})();
