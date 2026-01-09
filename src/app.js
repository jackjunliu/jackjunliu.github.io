const fileInput = document.getElementById('fileInput');
const scanBtn = document.getElementById('scanBtn');
const previewImg = document.getElementById('previewImg');
const progressEl = document.getElementById('progress');
const rawTextEl = document.getElementById('rawText');
const itemsEl = document.getElementById('items');
const personNameEl = document.getElementById('personName');
const addPersonBtn = document.getElementById('addPersonBtn');
const peopleEl = document.getElementById('people');
const totalsEl = document.getElementById('totals');

let currentFile = null;
let parsedItems = [];
let parsedTotals = {};
let people = [];

fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  currentFile = f || null;
  if (f) {
    const url = URL.createObjectURL(f);
    previewImg.src = url;
  } else previewImg.src = '';
});

scanBtn.addEventListener('click', async () => {
  if (!currentFile) return alert('Choose an image first');
  progressEl.textContent = 'Starting OCR...';
  try {
    const { createWorker } = Tesseract;
    const worker = createWorker({
      logger: m => {
        if (m.status === 'recognizing text') progressEl.textContent = `OCR: ${Math.round(m.progress*100)}%`;
      }
    });
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(currentFile);
    await worker.terminate();
    rawTextEl.value = text;
    progressEl.textContent = 'OCR complete';
    const parsed = parseItems(text);
    parsedItems = parsed.items;
    parsedTotals = parsed.totals;
    renderItems();
    renderTotals();
  } catch (err) {
    console.error(err);
    progressEl.textContent = 'OCR failed';
    alert('OCR failed — check console for details');
  }
});

addPersonBtn.addEventListener('click', () => {
  const name = (personNameEl.value || '').trim();
  if (!name) return;
  people.push({ name, id: Date.now() });
  personNameEl.value = '';
  renderPeople();
  renderItems();
});

function cleanText(text) {
  return (text || '')
    .replace(/[\uFB00-\uFB4F]/g, '') // remove some ligatures if present
    .replace(/[•·]/g, '-')
    .replace(/[€£¥]/g, '$')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    ;
}

function extractAmount(raw) {
  if (!raw) return NaN;
  let s = raw;
  // normalize thousand/decimal separators
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    }
  } else {
    s = s.replace(/,/g, '.');
  }
  s = s.replace(/[^0-9.\-]/g, '');
  return parseFloat(s);
}

function parseItems(text) {
  const cleaned = cleanText(text || '');
  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  const totals = {};

  const omitKeywords = ['member', 'savings', 'save', 'coupon', 'discount', 'redeem', 'additional discounts', 'department savings', 'forl store', 'store coupon'];
  const totalsKeywords = { subtotal: ['subtotal', 'sub total'], tax: ['tax'], total: ['total', 'amount due', 'amount paid', 'balance due', 'grand total'] };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lc = line.toLowerCase();

    // try to extract amount present in the line
    const match = line.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g);
    const rawAmount = match ? match[match.length - 1] : null;
    const amount = extractAmount(rawAmount);

    // skip lines that are obviously discounts/savings
    if (omitKeywords.some(k => lc.includes(k))) continue;

    // Detect totals (subtotal, tax, total)
    let detectedTotal = null;
    for (const key of Object.keys(totalsKeywords)) {
      if (totalsKeywords[key].some(tok => lc.includes(tok))) {
        detectedTotal = key;
        break;
      }
    }
    if (detectedTotal && !isNaN(amount)) {
      totals[detectedTotal] = amount;
      continue;
    }

    // If line contains an amount and is not excluded, treat as item
    if (!isNaN(amount)) {
      let name = line.replace(rawAmount || '', '').replace(/[^\w\-\&\.\s]/g, '').trim();
      if (!name) {
        // sometimes name is on previous line
        const prev = (i > 0) ? lines[i-1].replace(/[^\w\-&\.\s]/g, '').trim() : '';
        name = prev || 'Item';
      }
      items.push({ name, price: amount, assignments: [], raw: line });
    }
  }

  return { items, totals };
}

function renderItems() {
  itemsEl.innerHTML = '';
  parsedItems.forEach((it, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'item';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = it.name;
    const price = document.createElement('div');
    price.textContent = it.price.toFixed(2);
    wrap.appendChild(name);
    wrap.appendChild(price);

    const assignHolder = document.createElement('div');
    assignHolder.style.display = 'flex';
    assignHolder.style.gap = '6px';
    people.forEach((p) => {
      const label = document.createElement('label');
      label.className = 'small';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = it.assignments.includes(p.id);
      cb.addEventListener('change', () => {
        if (cb.checked) {
          it.assignments.push(p.id);
        } else {
          it.assignments = it.assignments.filter(id => id !== p.id);
        }
        renderTotals();
      });
      label.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = ' ' + p.name;
      label.appendChild(span);
      assignHolder.appendChild(label);
    });

    wrap.appendChild(assignHolder);
    itemsEl.appendChild(wrap);
  });
}

function renderPeople() {
  peopleEl.innerHTML = '';
  people.forEach(p => {
    const row = document.createElement('div');
    row.className = 'person-row';
    const left = document.createElement('div');
    left.textContent = p.name;
    const right = document.createElement('div');
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      people = people.filter(x => x.id !== p.id);
      parsedItems.forEach(it => { it.assignments = it.assignments.filter(id => id !== p.id); });
      renderPeople(); renderItems(); renderTotals();
    });
    right.appendChild(remove);
    row.appendChild(left);
    row.appendChild(right);
    peopleEl.appendChild(row);
  });
}

function renderTotals() {
  const totals = {};
  people.forEach(p => totals[p.id] = 0);
  parsedItems.forEach(it => {
    const assigned = it.assignments && it.assignments.length ? it.assignments : [];
    if (assigned.length === 0) return; // unassigned
    const share = it.price / assigned.length;
    assigned.forEach(id => {
      if (!(id in totals)) totals[id] = 0;
      totals[id] += share;
    });
  });
  totalsEl.innerHTML = '';

  // show detected receipt totals (subtotal/tax/total)
  if (parsedTotals && Object.keys(parsedTotals).length) {
    const hdr = document.createElement('div');
    hdr.className = 'small';
    hdr.textContent = 'Detected receipt totals:';
    totalsEl.appendChild(hdr);
    for (const k of ['subtotal','tax','total']) {
      if (parsedTotals[k]) {
        const d = document.createElement('div');
        d.textContent = `${k.charAt(0).toUpperCase() + k.slice(1)}: $${parsedTotals[k].toFixed(2)}`;
        totalsEl.appendChild(d);
      }
    }
    const sep = document.createElement('hr');
    totalsEl.appendChild(sep);
  }

  people.forEach(p => {
    const d = document.createElement('div');
    d.textContent = `${p.name}: $${(totals[p.id] || 0).toFixed(2)}`;
    totalsEl.appendChild(d);
  });
}

// allow manual parse from raw text
rawTextEl.addEventListener('blur', () => {
  const parsed = parseItems(rawTextEl.value);
  parsedItems = parsed.items;
  parsedTotals = parsed.totals;
  renderItems();
  renderTotals();
});
