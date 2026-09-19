/* ===================== Utilidades ===================== */

function formatBRL(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/* ===================== Máscara de moeda ===================== */
/* Os campos de valor são <input type="text">. Enquanto a pessoa digita,
   os dígitos são tratados como centavos e o campo já mostra formatado
   em Reais (ex: digitar 2000 vira R$ 20,00). O valor numérico real fica
   guardado em input.dataset.cents. */

function attachCurrencyMask(input, initialReais) {
  if (!input) return;

  function render(cents) {
    const safe = Math.max(0, Math.round(cents) || 0);
    input.dataset.cents = String(safe);
    input.value = safe === 0 ? '' : formatBRL(safe / 100);
  }

  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '');
    const cents = digits ? parseInt(digits, 10) : 0;
    render(cents);
    input.dispatchEvent(new CustomEvent('money:change', { bubbles: true }));
  });

  // Campo de valor se comporta como um "valor único": ao focar, seleciona
  // tudo, então clicar e digitar substitui o número em vez de emendar
  // dígitos no final (o que deixava o campo "embolado").
  input.addEventListener('focus', () => input.select());
  input.addEventListener('mouseup', (e) => e.preventDefault());

  render((initialReais || 0) * 100);
}

function getMoneyValue(input) {
  if (!input) return 0;
  return (parseInt(input.dataset.cents || '0', 10)) / 100;
}

function setMoneyValue(input, reais) {
  if (!input) return;
  const cents = Math.max(0, Math.round((reais || 0) * 100));
  input.dataset.cents = String(cents);
  input.value = cents === 0 ? '' : formatBRL(cents / 100);
}

/* ===================== Carrossel genérico ===================== */

function initCarousel(root) {
  if (!root) return;

  const track = root.querySelector('.carousel__track');
  const slides = Array.from(root.querySelectorAll('.slide'));
  const dotsWrap = root.querySelector('.carousel__dots');
  const prevBtn = root.querySelector('[data-action="prev"]');
  const nextBtn = root.querySelector('[data-action="next"]');

  if (!track || slides.length === 0) return;

  let index = 0;
  let autoplayId = null;
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  const autoplay = root.dataset.autoplay !== 'false' && !prefersReducedMotion;

  const dots = [];
  if (dotsWrap) {
    dotsWrap.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Ir para o item ${i + 1} de ${slides.length}`);
      dot.addEventListener('click', () => goTo(i, true));
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });
  }

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, i) => {
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
  }

  function goTo(newIndex, userTriggered) {
    index = (newIndex + slides.length) % slides.length;
    render();
    if (userTriggered) restartAutoplay();
  }

  function next() { goTo(index + 1); }

  function startAutoplay() {
    if (!autoplay) return;
    stopAutoplay();
    autoplayId = window.setInterval(next, 5500);
  }

  function stopAutoplay() {
    if (autoplayId) {
      window.clearInterval(autoplayId);
      autoplayId = null;
    }
  }

  function restartAutoplay() {
    if (!autoplay) return;
    stopAutoplay();
    startAutoplay();
  }

  if (nextBtn) nextBtn.addEventListener('click', () => goTo(index + 1, true));
  if (prevBtn) prevBtn.addEventListener('click', () => goTo(index - 1, true));

  root.addEventListener('mouseenter', stopAutoplay);
  root.addEventListener('mouseleave', startAutoplay);
  root.addEventListener('focusin', stopAutoplay);
  root.addEventListener('focusout', startAutoplay);

  render();
  startAutoplay();
}

/* ===================== Página "Poupe no dia a dia" ===================== */

function initPoupePage() {
  const input = document.getElementById('dailyAmount');
  const table = document.getElementById('savingsTable');
  if (!input || !table) return;

  attachCurrencyMask(input, 20); // valor de exemplo: R$ 20,00

  const periods = [7, 14, 30];
  const cells = periods.map((days) => ({
    el: table.querySelector(`[data-days="${days}"]`),
    days,
  }));

  function update() {
    const daily = getMoneyValue(input);
    cells.forEach(({ el, days }) => {
      if (el) el.textContent = formatBRL(daily * days);
    });
  }

  input.addEventListener('money:change', update);
  document.getElementById('poupeForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    update();
    table.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  update();
}

/* ===================== Página "Bingo da economia" ===================== */

const BINGO_STORAGE_KEY = 'poupeja.bingo.v1';
const BINGO_CELLS = 30;
const BINGO_MIN_CELL = 5; // valor mínimo de uma caixinha, em reais

function generateBingoValues(total) {
  const safeTotal = Math.max(total, BINGO_CELLS * BINGO_MIN_CELL);
  const weights = Array.from({ length: BINGO_CELLS }, () => Math.random() + 0.2);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const remaining = safeTotal - BINGO_MIN_CELL * BINGO_CELLS;

  const raw = weights.map((w) => BINGO_MIN_CELL + (w / weightSum) * remaining);
  const rounded = raw.map((v) => Math.round(v));

  // Corrige a diferença de arredondamento no maior valor da cartela,
  // garantindo que a soma final seja EXATAMENTE o total pedido.
  const diff = safeTotal - rounded.reduce((a, b) => a + b, 0);
  const maxIndex = rounded.indexOf(Math.max(...rounded));
  rounded[maxIndex] += diff;

  return rounded;
}

function initBingoPage() {
  const grid = document.getElementById('bingoGrid');
  if (!grid) return;

  const targetInput = document.getElementById('bingoTarget');
  const generateBtn = document.getElementById('bingoGerar');
  const resetBtn = document.getElementById('bingoLimpar');
  const gaugeFill = document.getElementById('bingoGaugeFill');
  const gaugePercent = document.getElementById('bingoGaugePercent');
  const guardadoOut = document.getElementById('bingoGuardadoValor');
  const restanteOut = document.getElementById('bingoRestanteValor');
  const contagemOut = document.getElementById('bingoContagem');
  const notaEl = document.getElementById('bingoNota');

  attachCurrencyMask(targetInput, 2500);

  let state = null;

  function load() {
    try {
      const raw = window.localStorage.getItem(BINGO_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.values) &&
        Array.isArray(parsed.checked) &&
        parsed.values.length === BINGO_CELLS &&
        parsed.checked.length === BINGO_CELLS
      ) {
        return parsed;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(BINGO_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* Local Storage indisponível (ex: modo privado); segue sem salvar */
    }
  }

  function newCard(total) {
    state = {
      target: total,
      values: generateBingoValues(total),
      checked: Array(BINGO_CELLS).fill(false),
    };
    persist();
  }

  function render() {
    grid.innerHTML = '';
    state.values.forEach((value, i) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bingo-cell' + (state.checked[i] ? ' is-checked' : '');
      cell.textContent = formatBRL(value).replace(',00', '');
      cell.setAttribute(
        'aria-pressed',
        state.checked[i] ? 'true' : 'false'
      );
      cell.setAttribute(
        'aria-label',
        `Caixinha de ${formatBRL(value)}, ${state.checked[i] ? 'guardada' : 'não guardada'}`
      );
      cell.addEventListener('click', () => {
        state.checked[i] = !state.checked[i];
        persist();
        render();
        updateStats();
      });
      grid.appendChild(cell);
    });
  }

  function updateStats() {
    const target = state.target;
    const saved = state.values.reduce(
      (sum, v, i) => sum + (state.checked[i] ? v : 0),
      0
    );
    const missing = Math.max(target - saved, 0);
    const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const doneCount = state.checked.filter(Boolean).length;

    gaugeFill.style.width = `${percent}%`;
    gaugePercent.textContent = `${percent}%`;
    guardadoOut.textContent = `Guardado: ${formatBRL(saved)}`;
    restanteOut.textContent = `Faltam: ${formatBRL(missing)}`;
    contagemOut.textContent = `${doneCount} de ${BINGO_CELLS} caixinhas`;

    if (doneCount === 0) {
      notaEl.textContent = 'Clique em uma caixinha sempre que guardar aquele valor.';
    } else if (missing === 0) {
      notaEl.textContent = 'Cartela completa! Você guardou o valor todo. Hora de comemorar.';
    } else if (percent < 50) {
      notaEl.textContent = 'Bom começo! Continue marcando as caixinhas conforme for guardando.';
    } else {
      notaEl.textContent = 'Você já passou da metade da cartela. Falta pouco para completar.';
    }
  }

  generateBtn.addEventListener('click', () => {
    const total = getMoneyValue(targetInput) || 2500;
    const confirmMsg =
      state && state.checked.some(Boolean)
        ? 'Gerar uma nova cartela vai apagar o progresso marcado até agora. Continuar?'
        : null;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    newCard(total);
    render();
    updateStats();
  });

  resetBtn.addEventListener('click', () => {
    if (!window.confirm('Isso vai desmarcar todas as caixinhas guardadas. Continuar?')) return;
    state.checked = Array(BINGO_CELLS).fill(false);
    persist();
    render();
    updateStats();
  });

  const saved = load();
  if (saved) {
    state = saved;
    setMoneyValue(targetInput, state.target);
  } else {
    newCard(2500);
  }

  render();
  updateStats();
}

/* ===================== Boot ===================== */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.carousel').forEach(initCarousel);
  initPoupePage();
  initBingoPage();
});
