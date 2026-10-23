const STORAGE_KEY = 'flashflow_deck_v1';
const REVIEW_KEY = 'flashflow_review_log_v1';

const fileInput = document.getElementById('fileInput');
const sourceText = document.getElementById('sourceText');
const cardLimitInput = document.getElementById('cardLimit');
const difficultyModeSelect = document.getElementById('difficultyMode');
const generateBtn = document.getElementById('generateBtn');
const summaryBox = document.getElementById('summaryBox');
const deckList = document.getElementById('deckList');
const statusPill = document.getElementById('statusPill');
const totalCardsStat = document.getElementById('totalCardsStat');
const todayReviewStat = document.getElementById('todayReviewStat');
const successRateStat = document.getElementById('successRateStat');
const resetDataBtn = document.getElementById('resetDataBtn');
const startReviewBtn = document.getElementById('startReviewBtn');
const reviewCard = document.getElementById('reviewCard');
const cardFront = document.getElementById('cardFront');
const cardBack = document.getElementById('cardBack');
const showAnswerBtn = document.getElementById('showAnswerBtn');
const againBtn = document.getElementById('againBtn');
const goodBtn = document.getElementById('goodBtn');
const easyBtn = document.getElementById('easyBtn');
const cardIndexText = document.getElementById('cardIndexText');
const cardDifficultyText = document.getElementById('cardDifficultyText');

let currentDeck = [];
let activeReviewQueue = [];
let activeIndex = 0;
let reviewLog = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]');

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanText(rawText) {
  return rawText
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\t\u00A0]+/g, ' ')
    .trim();
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!؟])\s+/)
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean);
}

function getKeywords(text) {
  const stopWords = new Set([
    'هذا', 'هذه', 'هذ', 'ذلك', 'الذي', 'التي', 'وكان', 'كانت', 'يكون', 'اكثر', 'أكثر',
    'من', 'عن', 'على', 'في', 'مع', 'مثل', 'كما', 'حتى', 'بعد', 'قبل', 'بين', 'خلال',
    'أو', 'و', 'ثم', 'لكن', 'أن', 'انه', 'ان', 'لا', 'ليس', 'قد', 'هو', 'هي', 'لأن',
    'لذا', 'هناك', 'تم', 'يتم', 'بعض', 'بما', 'عند', 'لذلك', 'أي', 'ال', 'ل', 'ما', 'هذا',
    'تكون', 'يستخدم', 'وهو', 'وهي', 'التي', 'الذي', 'تتم', 'نحو', 'تحت', 'بعد', 'قبل'
  ]);

  const tokens = text
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  const scores = {};
  tokens.forEach((word) => {
    scores[word] = (scores[word] || 0) + 1;
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);
}

function createSummary(text) {
  const sentences = splitSentences(text);
  const topThree = sentences.slice(0, 4).join(' ');
  const keywords = getKeywords(text).join(', ') || 'لا توجد كلمات رئيسية';

  return {
    text: normalizeWhitespace(topThree),
    keywords,
    sentenceCount: sentences.length,
  };
}

function buildQuestion(sentence, keyword) {
  const trimmed = normalizeWhitespace(sentence);
  const normalized = trimmed.toLowerCase();

  if (normalized.includes('هو') || normalized.includes('هي') || normalized.includes('is ') || normalized.includes('are ')) {
    return `ما المقصود بـ "${keyword || 'هذا المفهوم'}"؟`;
  }

  if (normalized.includes('يستخدم') || normalized.includes('used')) {
    return `ما استخدام ${keyword || 'هذا المفهوم'}؟`;
  }

  if (normalized.includes('يعمل') || normalized.includes('works')) {
    return `كيف يعمل ${keyword || 'هذا المفهوم'}؟`;
  }

  if (normalized.includes('يتم')) {
    return `ما الخطوة الأساسية في ${keyword || 'هذا الموضوع'}؟`;
  }

  return `ما الشيء المهم الذي تريد تذكره عن "${keyword || trimmed.slice(0, 34)}"؟`;
}

function generateDeckFromText(rawText, limit = 20) {
  const text = cleanText(rawText);
  if (!text) {
    return { summary: { text: 'لا يوجد نص لتحليله', keywords: '—', sentenceCount: 0 }, cards: [] };
  }

  const summary = createSummary(text);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => normalizeWhitespace(p))
    .filter((p) => p.length > 30)
    .slice(0, 30);

  const keywords = getKeywords(text);
  const cards = [];

  paragraphs.forEach((paragraph, idx) => {
    const sentences = splitSentences(paragraph).filter((s) => s.length > 25);
    sentences.forEach((sentence) => {
      const keyword = keywords.find((word) => sentence.toLowerCase().includes(word.toLowerCase())) || keywords[0] || `مفهوم ${idx + 1}`;
      const question = buildQuestion(sentence, keyword);

      if (!question) return;

      cards.push({
        id: `card-${Date.now()}-${idx}-${Math.random().toString(16).slice(2, 8)}`,
        question,
        answer: sentence,
        source: paragraph,
        difficulty: 'new',
        reviewCount: 0,
        score: 0,
        createdAt: Date.now(),
      });
    });
  });

  const uniqueCards = cards.filter((card, i, arr) => arr.findIndex((item) => item.answer === card.answer) === i);

  return {
    summary,
    cards: uniqueCards.slice(0, limit),
  };
}

function renderSummary(summary) {
  summaryBox.classList.remove('empty-box');
  summaryBox.innerHTML = `
    <p><strong>الملخص:</strong> ${escapeHtml(summary.text || 'لا يوجد ملخص متاح')}</p>
    <br />
    <p><strong>الكلمات الأساسية:</strong> ${escapeHtml(summary.keywords || 'لا توجد كلمات رئيسية')}</p>
    <br />
    <p><strong>عدد الجمل:</strong> ${summary.sentenceCount || 0}</p>
  `;
}

function renderDeck(cards) {
  if (!cards.length) {
    deckList.innerHTML = '<p class="muted">لا توجد بطاقات بعد.</p>';
    return;
  }

  deckList.innerHTML = cards
    .map((card, index) => `
      <div class="deck-item">
        <h4>بطاقة ${index + 1}</h4>
        <p><strong>س:</strong> ${escapeHtml(card.question)}</p>
        <p><strong>ج:</strong> ${escapeHtml(card.answer.substring(0, 120))}${card.answer.length > 120 ? '...' : ''}</p>
      </div>
    `)
    .join('');
}

function getStoredDecks() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveDecks(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
    reader.readAsText(file, 'UTF-8');
  });
}

function updateStats() {
  const deckListData = getStoredDecks();
  const allCards = deckListData.flatMap((deck) => deck.cards || []);
  const today = new Date().toISOString().slice(0, 10);
  const reviewsToday = reviewLog.filter((item) => item.date === today).length;
  const successRate = reviewLog.length
    ? Math.round((reviewLog.filter((item) => item.success).length / reviewLog.length) * 100)
    : 0;

  totalCardsStat.textContent = String(allCards.length);
  todayReviewStat.textContent = String(reviewsToday);
  successRateStat.textContent = `${successRate}%`;
}

function setStatus(label, type = 'neutral') {
  statusPill.textContent = label;
  statusPill.className = `status-pill ${type}`;
}

async function handleGenerate() {
  const rawText = sourceText.value.trim();
  const file = fileInput.files[0];
  const limit = Math.min(60, Math.max(5, Number(cardLimitInput.value) || 20));

  let finalText = rawText;

  if (file && !rawText) {
    try {
      setStatus('جارٍ قراءة الملف...', 'warning');
      finalText = await parseTextFile(file);
      sourceText.value = finalText.slice(0, 5000);
    } catch (error) {
      setStatus('خطأ في الملف', 'warning');
      console.error(error);
      return;
    }
  }

  if (!finalText.trim()) {
    setStatus('أدخل نصًا أولاً', 'warning');
    return;
  }

  setStatus('جارٍ تحليل النص...', 'warning');

  const generated = generateDeckFromText(finalText, limit);
  currentDeck = generated.cards;
  renderSummary(generated.summary);
  renderDeck(currentDeck);

  const existingDecks = getStoredDecks();
  const deckPayload = {
    id: `deck-${Date.now()}`,
    name: file ? file.name : 'محتوى يدوي',
    createdAt: new Date().toISOString(),
    cards: generated.cards,
    summary: generated.summary,
  };

  existingDecks.unshift(deckPayload);
  saveDecks(existingDecks);
  updateStats();
  setStatus('تم إنشاء البطاقات', 'success');
}

function renderReviewCard() {
  const card = activeReviewQueue[activeIndex];
  if (!card) {
    reviewCard.classList.add('hidden');
    setStatus('تمت المراجعة', 'success');
    alert('انتهت جلسة المراجعة الحالية.');
    return;
  }

  cardFront.classList.remove('hidden');
  cardBack.classList.add('hidden');
  cardBack.textContent = card.answer;
  cardFront.textContent = card.question;
  cardIndexText.textContent = `بطاقة ${activeIndex + 1} من ${activeReviewQueue.length}`;
  cardDifficultyText.textContent = `مستوى: ${card.difficulty || 'جديد'}`;
}

function startReview() {
  const storedDecks = getStoredDecks();
  const items = currentDeck.length ? currentDeck : storedDecks.flatMap((deck) => deck.cards || []);

  if (!items.length) {
    alert('لا توجد بطاقات حتى الآن. يرجى إنشاء بطاقات أولاً.');
    return;
  }

  activeReviewQueue = [...items];
  activeIndex = 0;
  reviewCard.classList.remove('hidden');
  renderReviewCard();
  setStatus('جاري المراجعة', 'warning');
}

function recordReview(success) {
  const card = activeReviewQueue[activeIndex];
  if (!card) return;

  const today = new Date().toISOString().slice(0, 10);
  reviewLog.push({
    cardId: card.id,
    success,
    date: today,
    timestamp: Date.now(),
  });
  localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewLog));

  const existingDecks = getStoredDecks();
  existingDecks.forEach((deck) => {
    deck.cards = (deck.cards || []).map((item) => {
      if (item.id !== card.id) return item;
      return {
        ...item,
        difficulty: success ? 'good' : 'new',
        score: success ? (item.score || 0) + 1 : Math.max(0, (item.score || 0) - 1),
        reviewCount: (item.reviewCount || 0) + 1,
      };
    });
  });
  saveDecks(existingDecks);

  activeIndex += 1;
  updateStats();
  renderReviewCard();
}

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const content = await parseTextFile(file);
    sourceText.value = content.slice(0, 6000);
    setStatus('تم تحميل الملف', 'success');
  } catch (error) {
    setStatus('فشل في قراءة الملف', 'warning');
  }
});

generateBtn.addEventListener('click', handleGenerate);
startReviewBtn.addEventListener('click', startReview);
showAnswerBtn.addEventListener('click', () => {
  cardFront.classList.add('hidden');
  cardBack.classList.remove('hidden');
});
againBtn.addEventListener('click', () => recordReview(false));
goodBtn.addEventListener('click', () => recordReview(true));
easyBtn.addEventListener('click', () => recordReview(true));
resetDataBtn.addEventListener('click', () => {
  const confirmed = window.confirm('هل تريد مسح جميع البيانات؟');
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REVIEW_KEY);
  currentDeck = [];
  reviewLog = [];
  deckList.innerHTML = '<p class="muted">لا توجد بطاقات محفوظة.</p>';
  summaryBox.innerHTML = 'سيتم إنشاء ملخص للمحتوى تلقائيًا بعد معالجة الملف.';
  summaryBox.classList.add('empty-box');
  sourceText.value = '';
  fileInput.value = '';
  setStatus('جاهز', 'neutral');
  updateStats();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      console.warn('Service worker not registered');
    });
  });
}

updateStats();
