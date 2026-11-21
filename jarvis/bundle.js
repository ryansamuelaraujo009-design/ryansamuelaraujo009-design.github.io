/* Gerado a partir do código local em jarvis-assistente/lib. Não editar à mão. */
(function () {
  var modules = {};
  function req(id) {
    var key = String(id).replace(/^\.\//, '').replace(/\.js$/, '');
    if (!modules[key]) throw new Error('Modulo não encontrado: ' + id);
    return modules[key].exports;
  }
  function define(name, factory) {
    var module = { exports: {} };
    modules[name] = module;
    factory(module, module.exports, req);
  }

  define("brain", function (module, exports, require) {
'use strict';

/**
 * CÉREBRO LOCAL — memória, TF-IDF + cosseno, Markov e aprendizado da web.
 * Nenhuma API, chave ou modelo externo.
 */

const DEFAULT_PROFILE = {
  enabled: true,
  assistantName: 'J.A.R.V.I.S.',
  userName: 'Ryan',
  style: 'tecnico',
  verbosity: 'medio',
  catchphrase: 'À sua disposição.'
};

const defaultState = () => ({
  version: 1,
  profile: { ...DEFAULT_PROFILE },
  facts: [], examples: [], episodes: [], sentences: [], webKnowledge: [],
  corpus: {},
  stats: { interactions: 0, learned: 0, corrections: 0, memoryHits: 0, webLearned: 0 }
});

const LIMITS = { facts: 200, examples: 300, episodes: 40, sentences: 1200, webKnowledge: 1200, corpus: 6000 };

const STOP_WORDS = new Set(`
a as o os um uma uns umas e em no na nos nas de da do das dos ao aos
que com para por sem sob sobre ate entre apos antes durante contra desde
se sim nao ja ainda so mais menos muito bem foi sao era eram sejam seja
eu mim me meu minha meus minhas voce vc seu sua seus suas ele ela eles elas
isso esta este esse essa esses estas aquilo aqui ai la ali onde quando como
qual quais quem porque pois logo entao mas ou nem
`.trim().split(/\s+/));

const norm = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/["'“”‘’`]/g, ' ')
  .replace(/[,.;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();

const normCase = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/["'“”‘’`]/g, ' ').replace(/\s+/g, ' ').trim();

const clean = (value) => String(value || '')
  .replace(/^[\s"'“”‘’`]+/, '')
  .replace(/[\s"'“”‘’`.,!?;:]+$/, '').trim();

const capitalize = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function stem(word) {
  if (word.length < 4) return word;
  return word
    .replace(/(?:coes)$/, 'cao').replace(/(?:oes)$/, 'ao')
    .replace(/(?:aes)$/, 'ao').replace(/(?:ais)$/, 'al')
    .replace(/(?:am)$/, 'a').replace(/(?:es)$/, '').replace(/s$/, '');
}

function tokens(text) {
  const value = norm(text);
  const single = /\b(?:ctrl|alt|shift|win)\b/.test(value);
  return value.split(/\s+/).map(stem).filter((word) =>
    !STOP_WORDS.has(word) && (word.length > 1 || (single && /^[a-z]$/.test(word))));
}

function features(text) {
  const words = tokens(text);
  const vector = new Map();
  words.forEach((word) => vector.set(word, (vector.get(word) || 0) + 1));
  for (let i = 0; i < words.length - 1; i += 1) {
    const key = `${words[i]}_${words[i + 1]}`;
    vector.set(key, (vector.get(key) || 0) + 1);
  }
  return vector;
}

let state = defaultState();
let persistence = null;

function idfTable() {
  const total = Math.max(1, state.examples.length);
  const df = new Map();
  state.examples.forEach((example) => {
    features(example.phrase).forEach((_tf, key) => df.set(key, (df.get(key) || 0) + 1));
  });
  const idf = new Map();
  df.forEach((count, key) => idf.set(key, Math.log(1 + total / (1 + count))));
  return idf;
}

function cosine(a, b, idf) {
  if (!a.size || !b.size) return 0;
  const fallback = Math.log(1 + Math.max(1, state.examples.length) / 2);
  let dot = 0; let na = 0; let nb = 0;
  a.forEach((tf, key) => {
    const weight = idf.get(key) ?? fallback;
    na += (tf * weight) ** 2;
    if (b.has(key)) dot += tf * b.get(key) * weight * weight;
  });
  b.forEach((tf, key) => {
    const weight = idf.get(key) ?? fallback;
    nb += (tf * weight) ** 2;
  });
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function save() {
  if (!persistence) return;
  try { persistence.save(state); } catch (error) { console.warn('Falha ao salvar cérebro:', error.message); }
}

function attachPersistence(provider) {
  persistence = provider || null;
  const loaded = persistence?.load?.();
  if (!loaded || typeof loaded !== 'object') return;
  const base = defaultState();
  state = {
    ...base, ...loaded,
    profile: { ...base.profile, ...(loaded.profile || {}) },
    stats: { ...base.stats, ...(loaded.stats || {}) },
    facts: Array.isArray(loaded.facts) ? loaded.facts : [],
    examples: Array.isArray(loaded.examples) ? loaded.examples : [],
    episodes: Array.isArray(loaded.episodes) ? loaded.episodes : [],
    sentences: Array.isArray(loaded.sentences) ? loaded.sentences : [],
    webKnowledge: Array.isArray(loaded.webKnowledge) ? loaded.webKnowledge : [],
    corpus: loaded.corpus && typeof loaded.corpus === 'object' ? loaded.corpus : {}
  };
}

const getState = () => structuredClone(state);
const isEnabled = () => state.profile.enabled !== false;

function setEnabled(value) { state.profile.enabled = Boolean(value); save(); return state.profile.enabled; }
function setProfile(patch) { state.profile = { ...state.profile, ...(patch || {}) }; save(); return { ...state.profile }; }

function status() {
  return {
    enabled: isEnabled(),
    interactions: state.stats.interactions,
    learned: state.examples.filter((e) => e.source === 'user').length,
    trained: state.examples.filter((e) => e.source === 'trained').length,
    corrections: state.stats.corrections,
    webLearned: state.webKnowledge.length,
    facts: state.facts.length,
    examples: state.examples.length,
    episodes: state.episodes.length,
    sentences: state.sentences.length,
    profile: { ...state.profile }
  };
}

function addFact(predicate, value) {
  const text = clean(value);
  if (!predicate || !text) return null;
  const found = state.facts.find((fact) => fact.predicate === predicate && norm(fact.value) === norm(text));
  if (found) { found.value = text; found.at = new Date().toISOString(); }
  else {
    state.facts.unshift({ id: uid(), predicate, value: text.slice(0, 180), at: new Date().toISOString(), hits: 0 });
    state.facts = state.facts.slice(0, LIMITS.facts);
  }
  save();
  return text;
}

function teach(phrase, canonical, source = 'user') {
  const from = clean(phrase);
  const to = clean(canonical);
  if (!from || !to) throw new Error('Frase e comando são obrigatórios.');
  const found = state.examples.find((example) => norm(example.phrase) === norm(from));
  if (found) {
    found.canonical = to; found.source = source; found.at = new Date().toISOString();
  } else {
    state.examples.unshift({
      id: uid(), phrase: from.slice(0, 140), canonical: to.slice(0, 180),
      source, hits: 0, at: new Date().toISOString()
    });
    state.examples = state.examples.slice(0, LIMITS.examples);
  }
  if (source === 'user') state.stats.learned += 1;
  save();
  return { phrase: from, canonical: to };
}

function matchLearned(raw, options = {}) {
  const query = features(raw);
  if (!query.size) return null;
  const idf = idfTable();
  const exact = norm(raw);
  let best = null;
  state.examples.forEach((example) => {
    if (options.onlyUser && example.source !== 'user') return;
    if (options.onlyTrained && example.source !== 'trained') return;
    if (options.onlyBuiltin && example.source !== 'builtin') return;
    let score = cosine(query, features(example.phrase), idf);
    const phrase = norm(example.phrase);
    if (phrase === exact) score = 1;
    else if (phrase.includes(exact) || exact.includes(phrase)) score = Math.min(1, score + 0.22);
    if (!best || score > best.score) best = { example, score };
  });
  if (!best) return null;
  const threshold = best.example.source === 'user' ? 0.48
    : best.example.source === 'trained' ? 0.58 : 0.62;
  if (best.score < threshold) return null;
  if (tokens(raw).length === 1 && tokens(best.example.phrase).length > 2 && best.score < 0.8) return null;
  best.example.hits += 1;
  save();
  return {
    canonical: best.example.canonical,
    meta: {
      source: best.example.source === 'user' ? 'aprendido'
        : best.example.source === 'trained' ? 'treinado' : 'atalho',
      confidence: Number(best.score.toFixed(2)),
      phrase: best.example.phrase
    }
  };
}

/* Aprendizado a partir das buscas */
function learnWeb(question, results) {
  const asked = clean(question);
  if (!asked || !Array.isArray(results) || !results.length) return 0;
  let added = 0;
  results.forEach((item) => {
    const answer = clean(item?.snippet || item?.answer || item?.title);
    if (!answer) return;
    if (state.webKnowledge.some((e) => norm(e.question) === norm(asked) && norm(e.answer) === norm(answer))) return;
    state.webKnowledge.unshift({
      id: uid(), question: asked.slice(0, 200), answer: answer.slice(0, 500),
      title: clean(item?.title || '').slice(0, 140),
      domain: clean(item?.domain || item?.link || '').slice(0, 100),
      hits: 0, at: new Date().toISOString()
    });
    added += 1;
    state.sentences.unshift(answer.slice(0, 240));
    tokens(answer).forEach((word) => { state.corpus[word] = Math.min(999, (state.corpus[word] || 0) + 1); });
  });
  state.webKnowledge = state.webKnowledge.slice(0, LIMITS.webKnowledge);
  state.sentences = state.sentences.slice(0, LIMITS.sentences);
  const keys = Object.keys(state.corpus);
  if (keys.length > LIMITS.corpus) keys.slice(0, keys.length - LIMITS.corpus).forEach((key) => delete state.corpus[key]);
  if (added) state.stats.webLearned += added;
  save();
  return added;
}

function findWebAnswer(raw) {
  if (!state.webKnowledge.length) return null;
  const query = features(raw);
  const exact = norm(raw);
  const df = new Map();
  state.webKnowledge.forEach((entry) => {
    features(`${entry.question} ${entry.answer}`).forEach((_tf, key) => df.set(key, (df.get(key) || 0) + 1));
  });
  const idf = new Map();
  const total = state.webKnowledge.length;
  df.forEach((count, key) => idf.set(key, Math.log(1 + total / (1 + count))));
  let best = null;
  state.webKnowledge.forEach((entry) => {
    const score = cosine(query, features(`${entry.question} ${entry.answer}`), idf);
    const final = norm(entry.question) === exact ? 1 : score;
    if (!best || final > best.score) best = { entry, score: final };
  });
  return best;
}

/* Gerador Markov local */
function hash(seed) {
  let value = 2166136261;
  for (const char of String(seed)) { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); }
  return value >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildChain(sentences) {
  const chain = new Map();
  sentences.forEach((sentence) => {
    const words = tokens(sentence);
    if (words.length < 3) return;
    for (let i = 0; i < words.length - 2; i += 1) {
      const key = `${words[i]}|${words[i + 1]}`;
      if (!chain.has(key)) chain.set(key, []);
      chain.get(key).push(words[i + 2]);
    }
  });
  return chain;
}

function generateText(seedText) {
  const sentences = [
    ...state.facts.map((f) => `${f.predicate} ${f.value}`),
    ...state.examples.map((e) => e.canonical),
    ...state.episodes.flatMap((e) => [e.input, e.reply]),
    ...state.webKnowledge.map((item) => item.answer),
    ...state.sentences
  ];
  const chain = buildChain(sentences);
  if (!chain.size) return '';
  const starts = [...chain.keys()];
  const random = mulberry32(hash(`${seedText}|${Date.now()}`));
  let key = starts[Math.floor(random() * starts.length)];
  const words = key.split('|');
  for (let i = 0; i < 18; i += 1) {
    const options = chain.get(key);
    if (!options?.length) break;
    const next = options[Math.floor(random() * options.length)];
    words.push(next);
    key = `${words[words.length - 2]}|${next}`;
  }
  return capitalize(words.join(' '));
}

const OPENERS = {
  tecnico: ['Entendido', 'Registrado', 'Pronto'],
  informal: ['Beleza', 'Anotado', 'Fechado'],
  formal: ['Com certeza', 'Perfeitamente', 'Devidamente registrado'],
  motivacional: ['Vamos nessa', 'Boa iniciativa', 'Isso mesmo']
};

function pick(list, seed) { return list.length ? list[hash(seed) % list.length] : ''; }

function byVerbosity(lines) {
  if (state.profile.verbosity === 'curto') return lines[0];
  if (state.profile.verbosity === 'detalhado') return lines[lines.length - 1];
  return lines[Math.min(1, lines.length - 1)];
}

function greet() {
  const hour = new Date().getHours();
  const time = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const name = state.profile.userName ? `, ${state.profile.userName}` : '';
  return `${time}${name}. ${state.profile.catchphrase}`;
}

function howAreYou() { return 'Estou operando dentro dos parâmetros ideais. E você, como está?'; }

function brainIntro() {
  return [
    'Sou um cérebro local feito só em código, sem API e sem chave.',
    `Tenho ${state.facts.length} fatos, ${state.webKnowledge.length} respostas da web e ${state.stats.interactions} conversas.`,
    'Guardo o que você me ensina e aprendo com o que busco na web.'
  ].join(' ');
}
const selfIntro = brainIntro;

function result(reply, source, extra = {}) {
  return { intent: 'brain', reply, brain: { source, confidence: 1 }, ...extra };
}

function recallReply(facts, raw = '') {
  if (!facts.length) return 'Ainda não guardei isso sobre você. Pode me dizer, por exemplo: meu nome é Ryan.';
  const list = facts.slice(0, 6).map((fact) => `${fact.predicate}: ${fact.value}`).join('. ');
  return `${pick(OPENERS[state.profile.style] || OPENERS.tecnico, raw)}. Segundo minha memória: ${list}.`;
}

function forget(query) {
  const text = clean(query);
  if (!text) return { reply: 'O que devo esquecer?', removed: 0 };
  const q = norm(text);
  const all = /^(tudo|memoria|memoria toda|tudo que voce sabe)$/.test(q);
  let removed = 0;
  if (all) {
    removed = state.facts.length + state.examples.length + state.webKnowledge.length + state.sentences.length;
    state.facts = []; state.examples = []; state.episodes = []; state.webKnowledge = [];
    state.sentences = []; state.corpus = {};
  } else if (q.length < 3) {
    // "esqueça a", "esqueça de" etc. casariam com quase tudo por substring.
    return { reply: 'Diga um termo maior para eu esquecer (pelo menos 3 letras).', removed: 0 };
  } else {
    const matches = (value) => norm(value).includes(q) || q.includes(norm(value));
    const before = state.facts.length + state.examples.length + state.webKnowledge.length;
    state.facts = state.facts.filter((f) => !matches(`${f.predicate} ${f.value}`));
    state.examples = state.examples.filter((e) => !matches(`${e.phrase} ${e.canonical}`));
    state.webKnowledge = state.webKnowledge.filter((e) => !matches(`${e.question} ${e.answer}`));
    removed = before - (state.facts.length + state.examples.length + state.webKnowledge.length);
  }
  save();
  return { reply: `Esquecido: ${removed} item(ns) removido(s).`, removed };
}

function clearMemory() {
  const removed = state.facts.length + state.examples.length + state.episodes.length
    + state.sentences.length + state.webKnowledge.length;
  state.facts = []; state.examples = []; state.episodes = []; state.sentences = [];
  state.webKnowledge = []; state.corpus = {};
  state.stats = { interactions: 0, learned: 0, corrections: 0, memoryHits: 0, webLearned: 0 };
  save();
  return { reply: `Memória zerada. ${removed} itens removidos.`, removed };
}

function handleDirect(raw) {
  const text = normCase(raw);

  if (/^(desativar|desligar|parar) (o )?(cerebro|memoria)/.test(text)) {
    setEnabled(false);
    return result('Cérebro local desativado.', 'perfil');
  }
  if (/^(ativar|ligar) (o )?(cerebro|memoria)/.test(text)) {
    setEnabled(true);
    return result('Cérebro local ativado.', 'perfil');
  }

  let match = text.match(/^(seu nome e|chame-se|mude seu nome para|se chama)\s+(.+)$/);
  if (match) {
    const name = clean(match[2]).slice(0, 40);
    setProfile({ assistantName: name });
    return result(`Pronto. Agora me chamo ${name}.`, 'perfil');
  }

  match = text.match(/^(seja mais|fale de forma|responda de forma|use um tom)\s+(.+)$/);
  if (match) {
    const value = clean(match[2]);
    const patch = {};
    if (/curto|objetiv|resumid|breve/.test(value)) patch.verbosity = 'curto';
    else if (/detalhad|completo|explicad|longo/.test(value)) patch.verbosity = 'detalhado';
    else if (/informal|descontraid|amigavel/.test(value)) patch.style = 'informal';
    else if (/formal|profission/.test(value)) patch.style = 'formal';
    else if (/motiv|animad|energ/.test(value)) patch.style = 'motivacional';
    else patch.style = 'tecnico';
    setProfile(patch);
    return result('Personalidade ajustada.', 'perfil');
  }

  match = text.match(/^(quando|sempre que)\s+(eu\s+)?(disser|falar|digitar)\s+(.+?)\s*,\s*(entao\s+)?(voce\s+)?(deve\s+|pode\s+|vai\s+|precisa\s+|faca\s+|execute\s+|rode\s+)?(.+)$/);
  if (match) {
    const phrase = clean(match[4]);
    const canonical = clean(match[8]);
    teach(phrase, canonical, 'user');
    return result(`Aprendi: quando você disser ${phrase}, eu vou fazer ${canonical}.`, 'aprendizado');
  }

  match = text.match(/(queria dizer|quis dizer|era isso|nao era|errado|corrija|corrigir)\s*,?\s*(.+)$/);
  if (match && state.episodes.length) {
    const canonical = clean(match[2])
      .replace(/^(eu\s+)?(queria|quis)\s+dizer\s+/i, '')
      .replace(/^(era|devia ser)\s+/i, '');
    const last = state.episodes.find((episode) => norm(episode.input) !== text) || state.episodes[0];
    if (canonical && last) {
      teach(last.input, canonical);
      state.stats.corrections += 1;
      save();
      return result(`Corrigido. Vou entender ${last.input} como ${canonical} da próxima vez.`, 'correcao');
    }
  }

  match = text.match(/^(meu nome e|me chamo|eu sou)\s+(.+)$/);
  if (match) {
    const name = clean(match[2]).slice(0, 40);
    setProfile({ userName: name });
    addFact('nome', name);
    return result(`Guardo isso: seu nome é ${name}.`, 'memoria');
  }

  match = text.match(/^(lembre que|lembre-se que|guarda que|lembrar que)\s+(.+)$/);
  if (match) {
    const value = clean(match[2]);
    const parts = value.split(/\s+e\s+|\s+eh\s+/i);
    if (parts.length >= 2) addFact(clean(parts[0]), clean(parts.slice(1).join(' ')));
    else addFact('lembrete', value);
    return result('Guardei isso na memória.', 'memoria');
  }

  if (/^(o que voce sabe sobre mim|fale sobre mim|quem sou eu|meu resumo)/.test(text)) {
    return result(recallReply(state.facts), 'memoria');
  }

  match = text.match(/^(esqueca|esqueca|apague|remova)\s+(.+)$/);
  if (match) {
    const answer = forget(clean(match[2]));
    return result(answer.reply, 'memoria');
  }

  match = text.match(/^(lembra|lembre|voce lembra)( de| que)?\s+(.+)$/);
  if (match) {
    state.stats.memoryHits += 1;
    save();
    return result(recallReply(state.facts.filter((f) => norm(`${f.predicate} ${f.value}`).includes(norm(match[3]))), raw), 'memoria');
  }

  if (/^(como voce funciona|como funciona sua memoria|como voce aprende|qual e seu cerebro|estatisticas)/.test(text)) {
    return result(brainIntro(), 'perfil');
  }
  if (/^(quem e voce|fale sobre voce|sobre voce)/.test(text)) {
    return result(`${brainIntro()} Meu nome é ${state.profile.assistantName}.`, 'perfil');
  }
  return null;
}

function nearestFact(query) {
  const q = features(query);
  let best = null;
  state.facts.forEach((fact) => {
    const score = cosine(q, features(`${fact.predicate} ${fact.value}`), new Map());
    if (!best || score > best.score) best = { fact, score };
  });
  return best;
}

function respond(raw) {
  if (!isEnabled()) return null;
  const text = norm(raw);

  if (/^(obrigad|valeu|agradec)/.test(text)) {
    return { reply: byVerbosity(['De nada.', `Sempre, ${state.profile.userName}.`, 'Se precisar de algo mais, é só chamar.']), brain: { source: 'personalidade', confidence: 0.8 } };
  }
  if (/^(e voce|e você|como voce esta|como você está)/.test(text)) {
    return { reply: howAreYou(), brain: { source: 'personalidade', confidence: 0.8 } };
  }
  if (/^(improvisar|crie uma frase|conte algo|historia|fale algo aleatorio|invente)/.test(text)) {
    const generated = generateText(text);
    if (generated) return { reply: generated, brain: { source: 'gerador-local', confidence: 0.7 } };
  }

  const webHit = findWebAnswer(raw);
  if (webHit && webHit.score > 0.55) {
    webHit.entry.hits += 1;
    state.stats.memoryHits += 1;
    save();
    return {
      reply: webHit.entry.answer,
      brain: { source: 'web', confidence: Number(webHit.score.toFixed(2)) }
    };
  }

  const fact = nearestFact(text);
  if (fact && fact.score > 0.42) {
    fact.fact.hits += 1;
    state.stats.memoryHits += 1;
    save();
    return { reply: `${capitalize(fact.fact.predicate)}: ${fact.fact.value}.`, brain: { source: 'memoria', confidence: Number(fact.score.toFixed(2)) } };
  }

  return {
    reply: byVerbosity([
      'Ainda não sei responder isso.',
      'Posso aprender se você me ensinar, ou buscar na web agora.',
      'Você pode dizer: lembre que ..., ou simplesmente me faça uma pergunta.'
    ]),
    brain: { source: 'local', confidence: 0.3 },
    unknown: true
  };
}

function ingestTraining(data = {}) {
  const added = { facts: 0, examples: 0, sentences: 0 };
  (Array.isArray(data.facts) ? data.facts : []).forEach((item) => {
    const [predicate, value] = Array.isArray(item) ? item : [item?.predicate, item?.value];
    const text = clean(value);
    if (!predicate || !text) return;
    if (state.facts.some((f) => f.predicate === predicate && norm(f.value) === norm(text))) return;
    addFact(predicate, text);
    added.facts += 1;
  });
  (Array.isArray(data.commands) ? data.commands : []).forEach((item) => {
    const [phrase, canonical] = Array.isArray(item) ? item : [item?.phrase, item?.canonical];
    if (!clean(phrase) || !clean(canonical)) return;
    if (state.examples.some((e) => norm(e.phrase) === norm(phrase))) return;
    teach(phrase, canonical, 'trained');
    added.examples += 1;
  });
  const fresh = [];
  (Array.isArray(data.sentences) ? data.sentences : []).forEach((sentence) => {
    const text = clean(sentence);
    if (!text || state.sentences.some((old) => norm(old) === norm(text))) return;
    state.sentences.unshift(text.slice(0, 240));
    fresh.push(text);
    added.sentences += 1;
  });
  state.sentences = state.sentences.slice(0, LIMITS.sentences);
  fresh.forEach((sentence) => tokens(sentence).forEach((word) => { state.corpus[word] = Math.min(999, (state.corpus[word] || 0) + 1); }));
  const keys = Object.keys(state.corpus);
  if (keys.length > LIMITS.corpus) keys.slice(0, keys.length - LIMITS.corpus).forEach((key) => delete state.corpus[key]);
  save();
  return {
    ...added,
    reply: `Base local treinada: ${added.facts} fatos, ${added.examples} comandos e ${added.sentences} frases novos.`
  };
}

function recordInteraction(input, reply) {
  state.stats.interactions += 1;
  state.episodes.unshift({
    input: String(input || '').slice(0, 300),
    reply: String(reply || '').slice(0, 300),
    at: new Date().toISOString()
  });
  state.episodes = state.episodes.slice(0, LIMITS.episodes);
  tokens(`${input} ${reply}`).forEach((word) => { state.corpus[word] = (state.corpus[word] || 0) + 1; });
  const keys = Object.keys(state.corpus);
  if (keys.length > LIMITS.corpus) keys.slice(0, keys.length - LIMITS.corpus).forEach((key) => delete state.corpus[key]);
  save();
}

const BUILTIN = [
  { phrase: 'me diga as horas', canonical: 'que horas sao' },
  { phrase: 'faz uma piada', canonical: 'piada' },
  { phrase: 'me ajuda', canonical: 'ajuda' }
];
BUILTIN.forEach((item, index) => state.examples.push({
  id: `builtin-${index}`, phrase: item.phrase, canonical: item.canonical,
  source: 'builtin', hits: 0, at: new Date(0).toISOString()
}));

module.exports = {
  defaultState, attachPersistence, getState, isEnabled, setEnabled, setProfile, status,
  greet, howAreYou, selfIntro, brainIntro, handleDirect, matchLearned, respond, teach,
  learnWeb, findWebAnswer, recordInteraction, ingestTraining, forget, clearMemory, norm, tokens
};

  });

  define("speech-normalize", function (module, exports, require) {
'use strict';

/** Ajusta a transcrição do Vosk antes de interpretar. Nada sai deste PC. */

const NUMBERS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500,
  quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
  setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900,
  novecentas: 900, mil: 1000
};

// Confusões frequentes do Vosk pequeno em pt-BR em palavras de comando.
const CORRECTIONS = [
  [/\bbloco de nota\b/g, 'bloco de notas'],
  [/\btira um print\b/g, 'tire um print'],
  [/\btira uma captura\b/g, 'tire uma captura'],
  [/\babre\b/g, 'abrir'], [/\babri\b/g, 'abrir'],
  [/\banota\b/g, 'anote'], [/\bcria\b/g, 'criar'],
  [/\blista tarefas\b/g, 'listar tarefas'],
  [/\bque horas sao\b/g, 'que horas sao']
];

function readNumber(tokens, start) {
  let i = start;
  let group = 0;
  let thousands = 0;
  let seen = false;
  let connector = false;

  while (i < tokens.length) {
    const token = tokens[i].replace(/[,;.!?]+$/, '');
    if (token === 'e' || token === 'plus') {
      if (!seen || connector) break;
      connector = true;
      i += 1;
      continue;
    }
    const value = NUMBERS[token];
    if (value === undefined) break;

    if (value === 1000) {
      thousands += group || 1;
      group = 0;
    } else {
      group += value;
    }
    seen = true;
    connector = false;
    i += 1;
  }

  if (!seen) return null;
  if (connector) i -= 1; // não consume um "e" solto no fim da sequência
  if (group >= 1000) {
    thousands += Math.floor(group / 1000);
    group %= 1000;
  }
  return { value: thousands * 1000 + group, end: i };
}

function normalizeTranscript(raw) {
  let text = String(raw || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\bpor\s+cento\b/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
  CORRECTIONS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  if (!text) return '';

  const tokens = text.split(' ');
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const number = readNumber(tokens, i);
    if (number && number.end > i) {
      out.push(String(number.value));
      i = number.end;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }

  return out.join(' ')
    .replace(/\b1 print\b/g, 'um print')
    .replace(/\b1 captura\b/g, 'uma captura')
    .replace(/\s+([%.,!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalizeTranscript };

  });

  define("training-data", function (module, exports, require) {
'use strict';

/** Base de treino local: variações de voz para os comandos já existentes. */

const topics = ['javascript', 'html', 'css', 'react', 'node', 'python', 'ingles', 'matematica', 'seo', 'freelance'];
const study = topics.flatMap((topic) => [
  [`explicar ${topic}`, `explicar ${topic}`],
  [`me explica ${topic}`, `explicar ${topic}`],
  [`me ensine ${topic}`, `explicar ${topic}`],
  [`resumir ${topic}`, `explicar ${topic}`],
  [`o que e ${topic}`, `explicar ${topic}`],
  [`o que voce sabe sobre ${topic}`, `explicar ${topic}`],
  [`me conte sobre ${topic}`, `explicar ${topic}`]
]);

const commands = [
  ['o papai chegou', 'oi'], ['acorda criança', 'oi'], ['salve o papai chegou', 'oi'],
  ['bom dia o papai chegou', 'bom dia'], ['boa tarde acorda criança', 'boa tarde'], ['boa noite o papai chegou', 'boa noite'],
  ['obrigado acorda criança', 'obrigado'], ['valeu o papai chegou', 'valeu'],
  ['como vai você', 'como vai'], ['tudo bem com você', 'tudo bem'],
  ['o que você pode fazer', 'ajuda'], ['me mostre o que você faz', 'ajuda'],
  ['quais são os seus comandos', 'ajuda'], ['me ajuda', 'ajuda'], ['socorro', 'ajuda'],
  ['como você funciona', 'como você funciona'], ['como você aprende', 'como você funciona'],
  ['me fale sobre você', 'quem é voce'], ['quem é você', 'quem é voce'],
  ['qual é o seu nome', 'quem é voce'],
  ['me diga as horas', 'que horas são'], ['que horas são agora', 'que horas são'],
  ['qual é a data de hoje', 'que dia é hoje'], ['que dia é hoje', 'que dia é hoje'],

  ['abre o bloco de notas', 'abrir bloco de notas'], ['abra o notepad', 'abrir bloco de notas'],
  ['inicie o bloco de notas', 'abrir bloco de notas'],
  ['abra a calculadora', 'abrir calculadora'], ['inicie a calculadora', 'abrir calculadora'],
  ['abrir explorer', 'abrir explorador'], ['abra o explorador', 'abrir explorador'],
  ['abrir meus arquivos', 'abrir meus arquivos'], ['abrir google chrome', 'abrir google chrome'],
  ['abra o chrome', 'abrir chrome'], ['abra o edge', 'abrir edge'],
  ['abrir navegador padrão', 'abrir navegador padrão'],
  ['abra o vs code', 'abrir vs code'], ['abrir visual studio code', 'abrir visual studio code'],
  ['tocar spotify', 'abrir spotify'], ['abrir discord', 'abrir discord'],
  ['abrir telegram', 'abrir telegram'], ['abrir word', 'abrir word'], ['abrir excel', 'abrir excel'],
  ['abrir powershell', 'abrir powershell'], ['abrir prompt', 'abrir prompt'], ['abrir terminal', 'abrir terminal'],
  ['abrir pasta downloads', 'abrir pasta downloads'], ['abra a pasta de downloads', 'abrir pasta de downloads'],
  ['abrir área de trabalho', 'abrir area de trabalho'], ['abrir documentos', 'abrir documentos'],
  ['abrir arquivo relatorio', 'abrir arquivo relatorio'],

  ['abra o youtube', 'abrir youtube'], ['vamos para o youtube', 'abrir youtube'],
  ['quero ir no youtube', 'abrir youtube'], ['abra o google', 'abrir google'],
  ['ir para o google', 'abrir google'], ['abra o github', 'abrir github'],
  ['quero abrir o github', 'abrir github'], ['abra o gmail', 'abrir gmail'],
  ['abrir meu email', 'abrir gmail'], ['abrir linkedin', 'abrir linkedin'],
  ['abrir instagram', 'abrir instagram'], ['abrir whatsapp', 'abrir whatsapp'],
  ['abrir netflix', 'abrir netflix'], ['abrir figma', 'abrir figma'],
  ['abrir notion', 'abrir notion'], ['abrir chatgpt', 'abrir chatgpt'],

  ['buscar css grid', 'pesquisar css grid'], ['procurar css grid', 'pesquisar css grid'],
  ['pesquisa sobre css grid', 'pesquisar css grid'],
  ['procurar por javascript', 'pesquisar javascript'],

  ['digitar olá mundo', 'digite olá mundo'], ['escreva olá mundo', 'digite olá mundo'],
  ['pressione ctrl c', 'aperte ctrl c'], ['pressione ctrl v', 'aperte ctrl v'],
  ['aperte ctrl z', 'aperte ctrl z'], ['aperte ctrl s', 'aperte ctrl s'],
  ['aperte alt tab', 'aperte alt tab'], ['aperte enter', 'aperte enter'],
  ['aperte esc', 'aperte esc'], ['aperte win d', 'aperte win d'],
  ['mostrar desktop', 'mostrar desktop'], ['minimizar tudo', 'minimizar tudo'],
  ['tire uma captura', 'tire um print'], ['capturar a tela', 'capturar a tela'],
  ['faça um screenshot', 'tire um print'], ['print da tela', 'tire um print'],

  ['anotar comprar cafe', 'anote comprar cafe'], ['salvar nota comprar cafe', 'anote comprar cafe'],
  ['guardar nota comprar cafe', 'anote comprar cafe'], ['lembrete de comprar cafe', 'anote comprar cafe'],
  ['mostrar minhas notas', 'ler notas'], ['ver notas', 'ler notas'], ['listar minhas notas', 'ler notas'],

  ['adicionar tarefa estudar CSS', 'criar tarefa estudar CSS'],
  ['nova tarefa estudar CSS', 'criar tarefa estudar CSS'],
  ['mostrar tarefas', 'listar tarefas'], ['minhas tarefas', 'listar tarefas'],
  ['ver tarefas', 'listar tarefas'], ['o que tenho que fazer', 'listar tarefas'],

  ...study,

  ['dicas para vender sites', 'como vender sites'], ['quero vender sites', 'como vender sites'],
  ['como precificar um site', 'como vender sites'], ['quanto cobrar por um site', 'como vender sites'],
  ['fazer orçamento para Acme de landing page', 'criar proposta para Acme de landing page'],
  ['gerar proposta para Acme', 'criar proposta para Acme de landing page'],

  ['bloquear windows', 'bloquear o pc'], ['travar a tela', 'bloquear o pc'],
  ['silenciar microfone', 'desligar microfone'], ['desativar o mic', 'desligar microfone'],
  ['ligar o mic', 'ativar microfone'], ['desligar a voz', 'desativar voz'], ['ativar a voz', 'ativar voz'],
  ['conte uma piada', 'piada'], ['me conte uma piada', 'piada'],
  ['me motive', 'motivação'], ['estou desanimado', 'motivação'],
  ['sair do assistente', 'fechar assistente'], ['estatísticas', 'como você funciona'],
  ['o que você sabe sobre mim', 'o que você sabe sobre mim'],
  ['fale sobre mim', 'fale sobre mim'], ['quem sou eu', 'quem sou eu'],
  ['seja mais informal', 'seja mais informal'], ['seja mais formal', 'seja mais formal'],
  ['respostas curtas', 'seja mais curto'],
  ['quando eu disser blz, abra o bloco de notas', 'quando eu disser blz, abra o bloco de notas'],
  ['pode abrir o bloco de notas', 'abrir bloco de notas'],
  ['me abra o chrome', 'abrir chrome'],
  ['abre bloco de nota', 'abrir bloco de notas'],
  ['tira um print', 'tire um print'],
  ['como funciona o flexbox', 'explicar flexbox'],
  ['para que serve o git', 'explicar git'],
  ['quanto e o dobro de doze', 'calcule 2 * 12']
];

const facts = [
  ['nome', 'Ryan'], ['projeto', 'Jarvis, assistente de voz local'],
  ['preferencia', 'sem API, sem chave e sem modelo externo'],
  ['idioma', 'portugues do Brasil'], ['sistema', 'Windows'],
  ['trabalho', 'venda de sites e freelance'], ['estudo', 'CSS, SEO e desenvolvimento web'],
  ['objetivo', 'assistente de voz que conversa e aprende com o usuario']
];

const sentences = [
  'JavaScript roda no navegador e tambem no servidor com Node.js',
  'Use const e let em vez de var para declarar variaveis',
  'Promises e async await simplificam codigo assincrono',
  'HTML descreve a estrutura semantica de uma pagina',
  'CSS controla apresentacao e layout com box model flexbox e grid',
  'React constroi interfaces a partir de componentes pequenos',
  'Node.js roda JavaScript no servidor com event loop nao bloqueante',
  'Python e uma linguagem de sintaxe simples usada em automacao e dados',
  'Para vender sites descubra o problema de negocio antes do preco',
  'SEO aumenta a visibilidade organica com tecnica conteudo e autoridade',
  'Pesquise a intencao de busca antes de escrever qualquer conteudo',
  'Treino espacado funciona melhor que maratona na vespera da prova',
  'Constancia vence intensidade faca um pouco hoje e um pouco amanha',
  'O cerebro local aprende com as correcoes que o usuario faz',
  'A memoria fica somente neste computador sem enviar dados para fora',
  'Comandos aprendidos tem prioridade sobre as regras fixas',
  'Cada correcao vira um exemplo de treino para a proxima conversa',
  'A voz e reconhecida localmente com Vosk em portugues do Brasil',
  'A resposta falada usa a voz Maria instalada no Windows'
];

module.exports = { commands, facts, sentences };

  });

  define("engine", function (module, exports, require) {
'use strict';

/** Interpretador local de comandos e perguntas. Respostas curtas, prontas para voz. */

const brain = require('./brain');
const { normalizeTranscript } = require('./speech-normalize');

const norm = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const capitalize = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
const timeNow = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
const dateNow = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

function mathWords(input) {
  return String(input || '')
    .replace(/\bmais\b/g, '+')
    .replace(/\bmenos\b/g, '-')
    .replace(/\bvezes\b/g, '*')
    .replace(/\bmultiplicado por\b/g, '*')
    .replace(/\bdividido por\b/g, '/')
    .replace(/\bao quadrado\b/g, '**2')
    .replace(/\bao cubo\b/g, '**3')
    .replace(/\bdobro de\b/g, '2*')
    .replace(/\bmetade de\b/g, '0.5*');
}

function safeCalc(input) {
  let expr = mathWords(String(input || '').replace(/^(?:o|a|os|as)\s+/, ''))
    .replace(/[xX×]/g, '*').replace(/[÷]/g, '/')
    .replace(/\s+de\s+/g, '*').replace(/,/g, '.').replace(/\s+/g, '');
  expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  if (!expr || !/^[0-9+\-*/().]+$/.test(expr)) return null;
  try {
    const value = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  } catch { return null; }
}

const KNOWLEDGE = {
  javascript: 'JavaScript é a linguagem da web. Roda no navegador e, com Node.js, também no servidor. Use const e let no lugar de var, e async e await para código assíncrono.',
  html: 'HTML descreve a estrutura semântica de uma página. Use um único h1, imagens com alt descritivo e marcações como header, main e footer.',
  css: 'CSS controla apresentação e layout. Box sizing border box conta padding e borda na largura. Flexbox atua em uma dimensão e grid em duas.',
  react: 'React monta interfaces com componentes pequenos. O estado dirige a interface, listas precisam de key estável e efeitos sincronizam com sistemas externos.',
  node: 'Node.js roda JavaScript no servidor com event loop não bloqueante. Evite tarefas pesadas nele e use variáveis de ambiente para segredos.',
  python: 'Python tem sintaxe simples e é muito usado em automação e dados. Ambientes virtuais isolam dependências e context managers fecham arquivos corretamente.',
  ingles: 'Para inglês técnico, use frases curtas: Could you clarify? Let me recap the next steps. I work with web development.',
  matematica: 'A derivada mede variação instantânea. Probabilidade é casos favoráveis divididos por casos possíveis. Pratique com problemas variados.',
  seo: 'SEO aumenta visibilidade orgânica com técnica, conteúdo e autoridade. Pesquise a intenção de busca antes de escrever e meça conversões, não só cliques.',
  freelance: 'Para vender sites, descubra o problema de negócio antes de falar preço. Descreva entregas e prazos, ofereça três planos e peça parte no início.',
  flexbox: 'Flexbox distribui itens em uma dimensão. Use display flex, justify content para o eixo principal e align items para o eixo cruzado.',
  grid: 'CSS Grid controla linhas e colunas. Defina grid template columns e use gap para espaçamento entre células.',
  'box model': 'O box model tem conteúdo, padding, borda e margem. Com box sizing border box, a largura inclui padding e borda.',
  git: 'Git registra versões do código. Use commit para salvar um ponto, branch para trabalhar separado e merge para integrar.',
  api: 'API é uma interface entre sistemas. Uma REST API usa URLs e métodos HTTP como GET, POST, PUT e DELETE.',
  banco: 'Banco de dados guarda informação estruturada. Relacionais usam tabelas e SQL; documentais guardam objetos como JSON.',
  negociacao: 'Em negociação, ouça primeiro, entenda o orçamento e mostre o valor entregue. Evite descontos sem reduzir escopo.',
  proposta: 'Uma boa proposta traz escopo, entregas, prazo, preço e condições de pagamento. Deixe claro o que não está incluído.'
};

const TOPIC_ALIASES = {
  'html5': 'html', 'css3': 'css', 'flex box': 'flexbox', 'flex': 'flexbox',
  'css grid': 'grid', 'grid css': 'grid', 'box sizing': 'box model',
  'modelo de caixa': 'box model', 'versionamento': 'git', 'github': 'git',
  'rest': 'api', 'rest api': 'api', 'web api': 'api',
  'banco de dados': 'banco', 'database': 'banco', 'sql': 'banco',
  'vender site': 'freelance', 'vender sites': 'freelance', 'precificar': 'freelance',
  'orcamento': 'proposta', 'fechar negocio': 'negociacao'
};

const APPS = {
  'bloco de notas': 'notepad.exe', notepad: 'notepad.exe',
  calculadora: 'calc.exe', explorer: 'explorer.exe', explorador: 'explorer.exe',
  'meus arquivos': 'explorer.exe', 'google chrome': 'chrome.exe', chrome: 'chrome.exe',
  'microsoft edge': 'msedge.exe', edge: 'msedge.exe', 'navegador padrão': 'msedge.exe',
  'visual studio code': 'code.cmd', 'vs code': 'code.cmd',
  spotify: 'spotify.exe', discord: 'Discord.exe', telegram: 'Telegram.exe',
  word: 'WINWORD.EXE', excel: 'EXCEL.EXE', powershell: 'powershell.exe',
  prompt: 'cmd.exe', cmd: 'cmd.exe', terminal: 'wt.exe',
  'pasta downloads': 'explorer.exe shell:Downloads', 'pasta de downloads': 'explorer.exe shell:Downloads',
  'area de trabalho': 'explorer.exe shell:Desktop', documentos: 'explorer.exe shell:Documents'
};

const SITES = {
  youtube: 'https://www.youtube.com', google: 'https://www.google.com',
  github: 'https://github.com', gmail: 'https://mail.google.com',
  linkedin: 'https://www.linkedin.com', instagram: 'https://www.instagram.com',
  whatsapp: 'https://web.whatsapp.com', netflix: 'https://www.netflix.com',
  figma: 'https://www.figma.com', notion: 'https://www.notion.so',
  chatgpt: 'https://chatgpt.com', 'google drive': 'https://drive.google.com'
};

const HOTKEYS = {
  'ctrl c': '^c', 'ctrl v': '^v', 'ctrl z': '^z', 'ctrl s': '^s', 'ctrl a': '^a',
  'alt tab': '%{TAB}', enter: '{ENTER}', esc: '{ESC}', tab: '{TAB}',
  backspace: '{BACKSPACE}', delete: '{DELETE}', 'win d': '^{ESC}'
};

const JOKES = [
  'Por que o CSS foi ao terapeuta? Porque ele tinha muitos problemas de posicionamento.',
  'Um desenvolvedor nunca se perde: ele dá um git commit e volta.',
  'O JavaScript pediu uma Promise ao barman. O barman disse: vou te responder depois.'
];

const simple = (reply, extra = {}) => ({ intent: 'chat', reply, ...extra });
const action = (reply, type, label, payload = {}) => ({ intent: 'action', reply, action: { type, label, payload } });
const withBrain = (result, meta) => { if (meta && result) result.brain = meta; return result; };

function followLearned(learned, options) {
  const derived = parse(learned.canonical, { ...options, skipLearned: true });
  if (derived.webSearch) return withBrain(simple(learned.canonical), learned.meta);
  return withBrain(derived, learned.meta);
}

function capabilities() {
  return 'Posso abrir aplicativos e sites, fazer contas, dizer horas e data, digitar textos, tirar print, guardar notas e tarefas, explicar assuntos de estudo e criar propostas. Também aprendo com o que você me ensina e com o que busco na web.';
}

function study(rawTopic) {
  const topic = TOPIC_ALIASES[norm(rawTopic)] || norm(rawTopic);
  const text = KNOWLEDGE[topic];
  if (text) return withBrain(simple(text), { source: 'estudo', confidence: 0.9 });
  return simple(`Ainda não tenho uma explicação pronta de ${topic}. Posso buscar na web se quiser.`);
}

function proposal(raw) {
  const match = String(raw || '').match(/(?:para|de)\s+([\p{L}\d]+)(?:\s+de\s+([\p{L}\d-]+))?/iu);
  const client = capitalize(match?.[1] || 'Cliente');
  const type = (match?.[2] || 'landing page').toLowerCase();
  const price = type.includes('ecommerce') ? 'quatro mil e quinhentos reais' : 'mil e oitocentos reais';
  return action(`Proposta para ${client} criada.`, 'saveFile', `Salvar proposta para ${client}`, {
    filename: `Proposta - ${client}.txt`,
    content: `PROPOSTA COMERCIAL\n\nCliente: ${client}\nProjeto: ${type}\nValor: ${price}\nPrazo: 10 dias úteis\n`
  });
}

function cleanQuery(value) {
  return String(value || '').replace(/^(de|sobre|por)\s+/i, '').replace(/[.!?]+$/, '').trim();
}

function parse(rawInput, options = {}) {
  const raw = String(rawInput || '').trim();
  const text = norm(normalizeTranscript(raw));
  if (!text) return simple('Não ouvi nada. Pode repetir?');

  const thought = brain.handleDirect(raw);
  if (thought) return withBrain(thought, thought.brain);

  if (!options.skipLearned) {
    const learned = brain.matchLearned(raw, { onlyUser: true });
    if (learned) return followLearned(learned, options);
  }

  if (/^(oi|ola|salve|bom dia|boa tarde|boa noite|e ai|e aí)/.test(text)) {
    return simple(brain.greet(), { brain: { source: 'personalidade', confidence: 0.8 } });
  }
  if (/^(obrigad|valeu)/.test(text)) return simple('De nada.');
  if (/^(como vai|tudo bem)/.test(text)) return simple(brain.howAreYou());
  if (/^(quem e voce|quem é voce)/.test(text)) return simple(brain.selfIntro());
  if (/(ajuda|comandos|o que pode fazer|o que voce faz|menu)/.test(text)) return simple(capabilities());
  if (/^(piada|faz uma piada|conte uma piada)/.test(text)) {
    return simple(JOKES[Math.floor(Math.random() * JOKES.length)]);
  }
  if (/^(motivacao|me motive|estou desanimado|preciso de forca)/.test(text)) {
    return simple('Constância vence intensidade. Faça um pouco hoje e um pouco amanhã. Você já está construindo algo real.');
  }

  if (/(que horas|hora atual|horas sao|que dia|data de hoje)/.test(text)) {
    return simple(`Agora são ${timeNow()}. Hoje é ${dateNow()}.`);
  }

  const calc = text.match(/^(quanto e|calcule|calcula|resultado de|qual e)\s*(.+)$/);
  const expression = calc ? calc[2]
    : (/^[0-9+\-*/().%x×÷,\s]+$/.test(raw) && /[+\-*/x×÷]/.test(raw) ? raw : null);
  if (expression) {
    const value = safeCalc(expression);
    if (value !== null) return simple(`O resultado é ${new Intl.NumberFormat('pt-BR').format(value)}.`);
    if (/[0-9]/.test(expression) && /[+\-*/x×÷%]/.test(expression)) {
      return simple('Não consegui calcular essa expressão. Tente algo como quanto é quinze por cento de duzentos e quarenta.');
    }
  }

  if (/(ativar|ligar|desligar|desativar|silenciar).*(voz|audio|microfone|mic)|^(mudo)$/.test(text)) {
    const enable = /\b(ativar|ligar)\b/.test(text);
    if (/microfone|mic|mudo/.test(text)) {
      return { intent: 'chat', reply: enable ? 'Microfone ativado.' : 'Microfone desligado.', setting: { microphoneMuted: !enable } };
    }
    return { intent: 'chat', reply: enable ? 'Voz ativada.' : 'Voz desativada.', setting: { voiceEnabled: enable } };
  }
  if (/^(fechar assistente|sair do assistente|fechar jarvis|encerrar)/.test(text)) {
    return { intent: 'system', system: 'quit', reply: 'Encerrando o J.A.R.V.I.S.' };
  }
  if (/^(bloquear o pc|bloquear windows|travar a tela)/.test(text)) {
    return action('Vou bloquear o Windows.', 'lockWorkstation', 'Bloquear o Windows');
  }
  if (/^(mostrar desktop|minimizar tudo)/.test(text)) {
    return action('Vou minimizar as janelas.', 'minimize', 'Mostrar desktop');
  }

  const OPEN_WORDS = /\b(?:abrir|abra|abre|inicie|iniciar|quero usar|vamos|pode)\b/g;
  const wantsOpen = (index) => index >= 0
    && [...text.matchAll(OPEN_WORDS)].some((match) => match.index < index);

  const appCandidates = Object.keys(APPS).sort((a, b) => b.length - a.length);
  const appKey = /\bsite\b/.test(text)
    ? null
    : appCandidates.find((key) => wantsOpen(text.indexOf(key)) && text.includes(key));
  if (appKey) {
    const parts = APPS[appKey].split(' ');
    return action(`Abrindo ${appKey}.`, 'openApp', `Abrir ${appKey}`, { exe: parts[0], args: parts.slice(1).join(' ') });
  }

  const siteCandidates = Object.keys(SITES).sort((a, b) => b.length - a.length);
  const siteKey = siteCandidates.find((key) => wantsOpen(text.indexOf(key)) && text.includes(key));
  if (siteKey) {
    return action(`Abrindo ${siteKey}.`, 'openUrl', `Abrir ${siteKey}`, { url: SITES[siteKey] });
  }

  if (/^arquivo\b|^abrir arquivo/.test(text)) {
    const name = text.replace(/^(abrir|abra)?\s*arquivo\s*/, '');
    return action(`Vou procurar ${name} no computador.`, 'openFile', `Abrir ${name}`, { name });
  }

  let match = text.match(/^(pesquisar|buscar|procurar|pesquisa sobre)\s+(.+)$/);
  if (match) {
    const query = cleanQuery(match[2]);
    return action(`Pesquisando ${query} no Google.`, 'openUrl', `Pesquisar ${query}`,
      { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
  }

  match = text.match(/^(digite|digitar|escreva|escrever)\s+(.+)$/);
  if (match) return action('Vou digitar isso.', 'typeText', 'Digitar texto', { text: cleanQuery(match[2]) });
  match = text.match(/^(aperte|pressione)\s+(.+)$/);
  if (match) {
    const keys = HOTKEYS[norm(match[2])];
    if (keys) return action(`Vou pressionar ${match[2]}.`, 'hotkey', `Pressionar ${match[2]}`, { keys });
  }
  if (/^(tire um print|tire uma captura|capturar a tela|faça um screenshot|print da tela)/.test(text)) {
    return action('Vou capturar a tela.', 'screenshot', 'Capturar tela');
  }

  match = text.match(/^(anote|anotar|salvar nota|guardar nota|lembrete de)\s+(.+)$/);
  if (match) return { intent: 'chat', reply: `Anotei: ${cleanQuery(match[2])}.`, write: { store: 'notes', item: { id: Date.now().toString(), text: cleanQuery(match[2]), done: false, at: new Date().toISOString() } } };
  if (/^(ler notas|mostrar minhas notas|ver notas|listar minhas notas)/.test(text)) {
    return { intent: 'chat', reply: 'Aqui estão suas notas.', data: { type: 'notesList' } };
  }
  // "crie uma tarefa ..." vira "crie 1 tarefa ..." na normalização de fala.
  match = text.match(/^(criar|crie|adicionar|adicione|nova|novo)\s+(?:um|uma|1)?\s*tarefa\s+(.+)$/);
  if (match) return { intent: 'chat', reply: `Tarefa criada: ${cleanQuery(match[2])}.`, write: { store: 'tasks', item: { id: Date.now().toString(), text: cleanQuery(match[2]), done: false, at: new Date().toISOString() } } };
  if (/^(listar tarefas|mostrar tarefas|minhas tarefas|ver tarefas)/.test(text)) {
    return { intent: 'chat', reply: 'Aqui estão suas tarefas.', data: { type: 'tasksList' } };
  }
  match = text.match(/^(concluir|marcar)\s+tarefa\s+(.+)$/);
  if (match) return { intent: 'chat', reply: 'Concluindo tarefa.', data: { type: 'taskDone', query: cleanQuery(match[2]).replace(/\s+como concluida$/, '') } };

  match = text.match(/^(explicar|explique|explica|me explica|me explique|me ensine|ensine|resumir|resuma|o que e|aprender|estudar|o que voce sabe sobre|me conte sobre|conte sobre|me fale sobre|fale sobre|como funciona|para que serve|pra que serve|o que faz|diferenca entre|compare)\s+(.+)$/);
  if (match) return study(norm(match[2]).replace(/^(o|a|os|as)\s+/, ''));
  match = text.match(/^(flashcards de|cartoes de|quiz de)\s+(.+)$/);
  if (match) {
    const topic = norm(match[2]);
    return simple(`Flashcards de ${topic} prontos. Ponto um: ${KNOWLEDGE[topic] || 'revise o assunto comigo.'}`);
  }

  if (/^(como vender sites|dicas para vender sites|quero vender sites|como precificar um site|quanto cobrar por um site)/.test(text)) {
    return simple('Para vender sites: entenda o problema do cliente antes do preço, descreva entregas e prazos, ofereça três planos e peça parte do valor na assinatura.');
  }
  if (/^(criar proposta|fazer orcamento|gerar proposta)/.test(text)) return proposal(raw);

  if (!options.skipLearned && brain.isEnabled()) {
    const trained = brain.matchLearned(raw, { onlyTrained: true });
    if (trained) return followLearned(trained, options);
    const alias = brain.matchLearned(raw, { onlyBuiltin: true });
    if (alias) return followLearned(alias, options);
  }

  const local = !options.skipBrain && brain.isEnabled() ? brain.respond(raw) : null;
  if (local && !local.unknown) {
    return withBrain(simple(local.reply, { data: local.data }), local.brain);
  }

  const reason = local?.reply || 'Não tenho essa resposta na memória.';
  return withBrain({
    intent: 'chat',
    reply: `${reason} Vou consultar a web e trazer a resposta aqui.`,
    webSearch: { query: raw, reason },
    data: local?.data || null
  }, local?.brain || { source: 'local', confidence: 0.3 });
}

module.exports = { parse, capabilities, safeCalc, proposal, norm };

  });

  window.JarvisCore = {
    engine: req('engine'),
    brain: req('brain'),
    training: req('training-data'),
    normalize: req('speech-normalize').normalizeTranscript
  };
})();
