const LIBRARY_FOLDER = "AcDec Music 26-27";

const state = {
  pieces: [],
  deck: [],
  roundIndex: 0,
  correct: 0,
  incorrect: 0,
  answered: false,
  snippetStopTimer: null,
  decodedCache: new Map(),
  snippet: null,
};

const els = {
  loading: document.querySelector("#loading"),
  game: document.querySelector("#game"),
  error: document.querySelector("#errorState"),
  finished: document.querySelector("#finished"),
  answers: document.querySelector("#answers"),
  replay: document.querySelector("#replaySnippet"),
  status: document.querySelector("#snippetStatus"),
  feedback: document.querySelector("#feedback"),
  feedbackBadge: document.querySelector("#feedbackBadge"),
  feedbackKicker: document.querySelector("#feedbackKicker"),
  correctTitle: document.querySelector("#correctTitle"),
  fullControls: document.querySelector("#fullPieceControls"),
  fullAudio: document.querySelector("#fullAudio"),
  next: document.querySelector("#nextRound"),
  progressText: document.querySelector("#progressText"),
  scoreText: document.querySelector("#scoreText"),
  progressBar: document.querySelector("#progressBar"),
  finalScore: document.querySelector("#finalScore"),
  finalMessage: document.querySelector("#finalMessage"),
};

let snippetAudio = new Audio();
snippetAudio.preload = "metadata";

function cleanTitle(filename) {
  let title = filename.replace(/\.mp3$/i, "");
  title = title
    .replace(/^Adams_\s*/, "Adams: ")
    .replace(/^Berlioz_\s*/, "Berlioz: ")
    .replace(/W\. 247_\s*/, "W. 247: ")
    .replace(/^The Launching_\s*/, "The Launching: ")
    .replace(/\s_\s?/g, " ")
    .replace(/_A_/g, "A")
    .replace(/_/g, "");
  return title.replace(/\s+/g, " ").trim();
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadLibrary() {
  els.loading.hidden = false;
  try {
    const response = await fetch("manifest.json");
    if (!response.ok) throw new Error("Manifest unavailable");
    const files = await response.json();
    state.pieces = files.map((entry) => ({
      file: entry.file,
      title: cleanTitle(entry.file),
      url: `${LIBRARY_FOLDER}/${encodeURIComponent(entry.file)}`,
    }));
    if (state.pieces.length !== 14) throw new Error("Expected 14 pieces");
    restart();
  } catch (error) {
    els.loading.hidden = true;
    els.error.hidden = false;
  }
}

function restart() {
  clearSnippetTimer();
  snippetAudio.pause();
  els.fullAudio.pause();
  state.deck = shuffle(state.pieces);
  state.roundIndex = 0;
  state.correct = 0;
  state.incorrect = 0;
  els.finished.hidden = true;
  els.error.hidden = true;
  els.game.hidden = false;
  els.loading.hidden = true;
  startRound();
}

function clearSnippetTimer() {
  if (state.snippetStopTimer) clearTimeout(state.snippetStopTimer);
  state.snippetStopTimer = null;
  els.replay.classList.remove("playing");
}

function updateStats() {
  els.scoreText.textContent = `${state.correct} correct · ${state.incorrect} incorrect`;
  els.progressText.textContent = `Round ${Math.min(state.roundIndex + 1, 14)} of 14`;
  els.progressBar.style.width = `${(state.roundIndex / 14) * 100}%`;
}

async function startRound() {
  clearSnippetTimer();
  snippetAudio.pause();
  els.fullAudio.pause();
  state.answered = false;
  state.snippet = null;
  els.feedback.hidden = true;
  els.fullControls.hidden = true;
  els.loading.hidden = false;
  els.game.hidden = true;

  const piece = state.deck[state.roundIndex];
  try {
    await prepareSnippet(piece);
  } catch (_) {
    state.snippet = { start: 0, duration: 6 };
  }

  els.loading.hidden = true;
  els.game.hidden = false;
  renderChoices(piece);
  updateStats();
  els.status.textContent = `Short clip · ${Math.round(state.snippet.duration)} seconds`;
  await playSnippet();
}

function renderChoices(piece) {
  const distractors = shuffle(state.pieces.filter((item) => item !== piece)).slice(0, 3);
  const choices = shuffle([piece, ...distractors]);
  els.answers.innerHTML = "";
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = choice.title;
    button.addEventListener("click", () => submitAnswer(choice, piece));
    els.answers.appendChild(button);
  });
}

async function submitAnswer(choice, piece) {
  if (state.answered) return;
  state.answered = true;
  clearSnippetTimer();
  snippetAudio.pause();
  const isCorrect = choice === piece;

  state.roundIndex;
  if (isCorrect) state.correct += 1;
  else state.incorrect += 1;

  document.querySelectorAll(".answer-button").forEach((button) => {
    button.disabled = true;
    if (button.textContent === piece.title) button.classList.add(isCorrect ? "correct" : "reveal");
  });

  if (!isCorrect) {
    const selected = [...document.querySelectorAll(".answer-button")]
      .find((button) => button.textContent === choice.title);
    if (selected) selected.classList.add("wrong");
  }

  els.feedback.hidden = false;
  els.feedbackBadge.textContent = isCorrect ? "✓" : "×";
  els.feedbackBadge.className = `feedback-badge${isCorrect ? "" : " wrong"}`;
  els.feedbackKicker.textContent = isCorrect ? "Correct" : "The piece was";
  els.correctTitle.textContent = piece.title;
  els.fullControls.hidden = isCorrect;

  if (!isCorrect) {
    els.fullAudio.src = piece.url;
    els.fullAudio.load();
  } else {
    els.fullAudio.removeAttribute("src");
  }

  els.progressText.textContent = `Completed ${state.roundIndex + 1} of 14`;
  els.progressBar.style.width = `${((state.roundIndex + 1) / 14) * 100}%`;
  els.scoreText.textContent = `${state.correct} correct · ${state.incorrect} incorrect`;

  els.next.textContent = state.roundIndex === 13 ? "See final score →" : "Next piece →";
}

async function prepareSnippet(piece) {
  const duration = await getDuration(piece.url);
  const length = 5 + Math.random() * 2;
  const safeLength = Math.min(length, duration - 1);
  let start = 0;

  if (duration >= 8) {
    const margin = 2;
    const maxStart = Math.max(margin, duration - safeLength - margin);
    start = margin + Math.random() * (maxStart - margin);

    try {
      const buffer = await decodeAudio(piece.url);
      const candidates = [];
      for (let i = 0; i < 12; i++) {
        const candidate = margin + Math.random() * (Math.max(margin, duration - safeLength - margin) - margin);
        candidates.push(candidate);
      }
      const usable = candidates.find((candidate) => hasAudioInRange(buffer, candidate, safeLength));
      if (usable !== undefined) start = usable;
    } catch (_) {
      // Browser may not expose decoded audio; the random bounded range still works.
    }
  }

  state.snippet = { start: Math.max(0, start), duration: safeLength };
}

function getDuration(url) {
  return new Promise((resolve, reject) => {
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => Number.isFinite(probe.duration) ? resolve(probe.duration) : reject();
    probe.onerror = reject;
    probe.src = url;
  });
}

async function decodeAudio(url) {
  if (state.decodedCache.has(url)) return state.decodedCache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Audio fetch failed");
  const bytes = await response.arrayBuffer();
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = await context.decodeAudioData(bytes.slice(0));
  await context.close();
  state.decodedCache.set(url, buffer);
  return buffer;
}

function hasAudioInRange(buffer, start, length) {
  const sampleRate = buffer.sampleRate;
  const first = Math.max(0, Math.floor(start * sampleRate));
  const last = Math.min(buffer.length, Math.ceil((start + length) * sampleRate));
  const blockSize = Math.floor(sampleRate * 0.1);
  let activeBlocks = 0;
  let totalBlocks = 0;

  for (let offset = first; offset < last; offset += blockSize) {
    let sumSquares = 0;
    let count = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = offset; i < Math.min(offset + blockSize, last); i += 4) {
        sumSquares += data[i] * data[i];
        count++;
      }
    }
    const rms = count ? Math.sqrt(sumSquares / count) : 0;
    totalBlocks++;
    if (rms > 0.012) activeBlocks++;
  }

  return totalBlocks > 0 && activeBlocks / totalBlocks > 0.55;
}

async function playSnippet() {
  if (!state.snippet) return;
  clearSnippetTimer();
  const piece = state.deck[state.roundIndex];
  if (snippetAudio.src !== new URL(piece.url, location.href).href) {
    snippetAudio.src = piece.url;
  }

  await new Promise((resolve) => {
    const ready = () => { snippetAudio.removeEventListener("canplay", ready); resolve(); };
    if (snippetAudio.readyState >= 2) resolve();
    else { snippetAudio.addEventListener("canplay", ready); snippetAudio.load(); }
  });

  snippetAudio.currentTime = state.snippet.start;
  try { await snippetAudio.play(); } catch (_) { return; }
  els.replay.classList.add("playing");
  els.status.textContent = `Playing · ${Math.round(state.snippet.duration)} seconds`;
  state.snippetStopTimer = setTimeout(() => {
    snippetAudio.pause();
    els.replay.classList.remove("playing");
    els.status.textContent = `Short clip · ${Math.round(state.snippet.duration)} seconds`;
  }, state.snippet.duration * 1000);
}

els.replay.addEventListener("click", playSnippet);
els.next.addEventListener("click", () => {
  if (state.roundIndex >= 13) {
    finishGame();
  } else {
    state.roundIndex++;
    startRound();
  }
});

document.querySelector("#restartTop").addEventListener("click", restart);
document.querySelector("#restartBottom").addEventListener("click", restart);

function finishGame() {
  clearSnippetTimer();
  snippetAudio.pause();
  els.fullAudio.pause();
  els.game.hidden = true;
  els.finished.hidden = false;
  els.progressText.textContent = "Practice complete";
  els.progressBar.style.width = "100%";
  els.finalScore.textContent = `${state.correct} of 14 correct`;
  const percentage = Math.round((state.correct / 14) * 100);
  els.finalMessage.textContent = percentage >= 85
    ? `Excellent listening — ${percentage}% accuracy.`
    : percentage >= 60
      ? `Good progress — ${percentage}% accuracy. A replay round will help.`
      : `Keep listening — ${percentage}% accuracy. Repeat the pieces you missed.`;
}

loadLibrary();
