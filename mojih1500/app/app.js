// --- INDEXEDDB LOGIKA ---
const DB_NAME = 'PrevoditeljRitamDB';
const DB_VERSION = 1;

function otvoriBazu() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject(e.target.error);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('projekti')) {
        db.createObjectStore('projekti', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('unosi')) {
        const unosiStore = db.createObjectStore('unosi', { keyPath: 'id' });
        unosiStore.createIndex('projektId', 'projektId', { unique: false });
      }
    };
  });
}

// --- MATEMATIKA I POMOĆNE FUNKCIJE ---
function izracunajRadneDane(pocetak, kraj, radVikendom) {
  let d = new Date(pocetak);
  const krajDate = new Date(kraj);
  let count = 0;

  while (d <= krajDate) {
    const dayOfWeek = d.getDay();
    if (radVikendom || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, count);
}

// --- INICIJALIZACIJA ---
document.addEventListener('DOMContentLoaded', () => {
  postaviZadaneDatume();
  ucitajDashboard();
});

function postaviZadaneDatume() {
  const danas = new Date().toISOString().split('T')[0];
  document.getElementById('p-start').value = danas;
}

function toggleFormaProjekta() {
  const el = document.getElementById('forma-projekt-container');
  el.classList.toggle('sakriveno');
  if (el.classList.contains('sakriveno')) {
    document.getElementById('projekt-forma').reset();
    document.getElementById('p-id').value = '';
    postaviZadaneDatume();
  }
}

async function spremiProjektForma(e) {
  e.preventDefault();
  const id = document.getElementById('p-id').value || 'proj_' + crypto.randomUUID();
  
  const projekt = {
    id,
    naslov: document.getElementById('p-naslov').value,
    klijent: document.getElementById('p-klijent').value,
    ukupnoKartica: parseFloat(document.getElementById('p-ukupno').value),
    honorarPoKartici: parseFloat(document.getElementById('p-honorar').value),
    pocetniDatum: document.getElementById('p-start').value,
    rokDatum: document.getElementById('p-rok').value,
    ciljKarticaDnevno: parseFloat(document.getElementById('p-cilj-dnevno').value) || 0,
    radVikendom: document.getElementById('p-vikend').value === 'da'
  };

  const db = await otvoriBazu();
  const tx = db.transaction('projekti', 'readwrite');
  tx.objectStore('projekti').put(projekt);

  tx.oncomplete = () => {
    toggleFormaProjekta();
    ucitajDashboard();
  };
}

async function ucitajDashboard() {
  const db = await otvoriBazu();
  
  const projekti = await new Promise((resolve) => {
    const tx = db.transaction('projekti', 'readonly');
    const req = tx.objectStore('projekti').getAll();
    req.onsuccess = () => resolve(req.result);
  });

  const dashboardEl = document.getElementById('dashboard');
  dashboardEl.innerHTML = '';

  if (projekti.length === 0) {
    dashboardEl.innerHTML = '<div class="card"><p>Nemate aktivnih projekata. Kliknite na "+ Novi Projekt" za početak.</p></div>';
    return;
  }

  const danas = new Date().toISOString().split('T')[0];

  for (const p of projekti) {
    const unosi = await new Promise((resolve) => {
      const tx = db.transaction('unosi', 'readonly');
      const index = tx.objectStore('unosi').index('projektId');
      const req = index.getAll(p.id);
      req.onsuccess = () => resolve(req.result);
    });

    const ukupnoPrevedeno = unosi.reduce((sum, u) => sum + u.brojKartica, 0);
    const preostaloKartica = Math.max(0, p.ukupnoKartica - ukupnoPrevedeno);
    const postotak = Math.min(100, Math.round((ukupnoPrevedeno / p.ukupnoKartica) * 100));
    const zarada = ukupnoPrevedeno * p.honorarPoKartici;
    
    const preostaloDana = izracunajRadneDane(danas > p.pocetniDatum ? danas : p.pocetniDatum, p.rokDatum, p.radVikendom);
    const potrebniDnevniRitam = (preostaloKartica / preostaloDana).toFixed(1);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="project-header">
        <div>
          <h2>${p.naslov} ${p.klijent ? `<small style="font-weight:normal; font-size:1rem; color:#6c757d;">(${p.klijent})</small>` : ''}</h2>
          <div style="font-size: 0.85rem; color: #6c757d;">Rok: ${p.rokDatum} | Ukupno: ${p.ukupnoKartica} kartica</div>
        </div>
        <div class="project-actions">
          <button class="btn-secondary" onclick="urediProjekt('${p.id}')">Uredi</button>
          <button class="btn-danger" onclick="obrisiProjekt('${p.id}')">Obriši</button>
        </div>
      </div>

      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${postotak}%;"></div>
      </div>

      <div class="grid-4" style="margin: 16px 0;">
        <div class="stat-box">
          <div class="val">${postotak}%</div>
          <div class="lbl">Dovršeno (${ukupnoPrevedeno.toFixed(1)} / ${p.ukupnoKartica})</div>
        </div>
        <div class="stat-box">
          <div class="val">${potrebniDnevniRitam} k/d</div>
          <div class="lbl">Potrebno dnevno (${preostaloDana} radnih d.)</div>
        </div>
        <div class="stat-box">
          <div class="val">${zarada.toFixed(2)} €</div>
          <div class="lbl">Zarađeno (od ${(p.ukupnoKartica * p.honorarPoKartici).toFixed(2)} €)</div>
        </div>
        <div class="stat-box">
          <div class="val">${preostaloKartica.toFixed(1)}</div>
          <div class="lbl">Preostalo kartica</div>
        </div>
      </div>

      <div class="unosi-box">
  <h3 style="font-size: 0.95rem; margin-bottom: 12px;">+ Zabilježi rad</h3>
  
  <!-- Preklopnik (Tabs) za odabir načina unosa -->
  <div class="unos-tabs">
    <button type="button" id="tab-scan-btn-${p.id}" class="btn-tab active" onclick="odaberiNacinUnosa('${p.id}', 'scan')">
      📷 Skeniraj
    </button>
    <button type="button" id="tab-manual-btn-${p.id}" class="btn-tab" onclick="odaberiNacinUnosa('${p.id}', 'manual')">
      ✍️ Ručni unos
    </button>
  </div>

  <!-- Odsječak 1: Skeniranje kamerom -->
  <div id="sekcija-skeniranje-${p.id}" class="unos-sekcija">
    <p class="upute-tekst">Usmjerite kameru prema <b>Word Count</b> prozoru (znakovi s razmacima).</p>
    <input type="file" id="camera-input-${p.id}" accept="image/*" capture="environment" style="display: none;" onchange="obradiSliku(event, '${p.id}')">
    <button type="button" class="btn-block" onclick="document.getElementById('camera-input-${p.id}').click()">
      Pokreni kameru / Odaberi sliku
    </button>
  </div>

  <!-- Odsječak 2: Ručni unos (ekspandira se na klik) -->
  <div id="sekcija-rucno-${p.id}" class="unos-sekcija sakriveno">
    <form class="inline-form" onsubmit="dodajUnosForma(event, '${p.id}')">
      <div style="flex: 1;">
        <label for="u-datum-${p.id}">Datum</label>
        <input type="date" id="u-datum-${p.id}" value="${danas}" required>
      </div>
      <div style="flex: 1;">
        <label for="u-kartice-${p.id}">Prevedeno kartica</label>
        <input type="number" step="0.01" id="u-kartice-${p.id}" placeholder="npr. 4.5" inputmode="decimal" required>
      </div>
      <button type="submit" style="align-self: flex-end;">Spremi Unos</button>
    </form>
  </div>
</div>

      ${unosi.length > 0 ? `
        <h4 style="margin: 16px 0 4px 0; font-size: 0.85rem;">Povijest unosa:</h4>
        <ul class="unosi-list">
          ${unosi.sort((a,b) => b.datum.localeCompare(a.datum)).map(u => `
            <li>
              <span><b>${u.datum}:</b> ${u.brojKartica} kartica</span>
              <a href="#" style="color:var(--danger); text-decoration:none;" onclick="obrisiUnos('${u.id}')">Obriši</a>
            </li>
          `).join('')}
        </ul>
      ` : ''}
    `;
    dashboardEl.appendChild(card);
  }
}

async function dodajUnosForma(e, projektId) {
  e.preventDefault();
  const datum = document.getElementById(`u-datum-${projektId}`).value;
  const brojKartica = parseFloat(document.getElementById(`u-kartice-${projektId}`).value);

  const unos = {
    id: 'log_' + crypto.randomUUID(),
    projektId,
    datum,
    brojKartica
  };

  const db = await otvoriBazu();
  const tx = db.transaction('unosi', 'readwrite');
  tx.objectStore('unosi').put(unos);

  tx.oncomplete = () => ucitajDashboard();
}

async function obrisiUnos(unosId) {
  const db = await otvoriBazu();
  const tx = db.transaction('unosi', 'readwrite');
  tx.objectStore('unosi').delete(unosId);
  tx.oncomplete = () => ucitajDashboard();
}

async function urediProjekt(id) {
  const db = await otvoriBazu();
  const tx = db.transaction('projekti', 'readonly');
  const p = await new Promise((resolve) => {
    const req = tx.objectStore('projekti').get(id);
    req.onsuccess = () => resolve(req.result);
  });

  if (p) {
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-naslov').value = p.naslov;
    document.getElementById('p-klijent').value = p.klijent || '';
    document.getElementById('p-ukupno').value = p.ukupnoKartica;
    document.getElementById('p-honorar').value = p.honorarPoKartici;
    document.getElementById('p-start').value = p.pocetniDatum;
    document.getElementById('p-rok').value = p.rokDatum;
    document.getElementById('p-cilj-dnevno').value = p.ciljKarticaDnevno || '';
    document.getElementById('p-vikend').value = p.radVikendom ? 'da' : 'ne';
    
    document.getElementById('forma-naslov').innerText = 'Uredi Projekt';
    document.getElementById('forma-projekt-container').classList.remove('sakriveno');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function obrisiProjekt(id) {
  if (!confirm('Jeste li sigurni da želite obrisati projekt i sve njegove unose?')) return;
  
  const db = await otvoriBazu();
  const tx = db.transaction(['projekti', 'unosi'], 'readwrite');
  tx.objectStore('projekti').delete(id);

  const unosiStore = tx.objectStore('unosi');
  const index = unosiStore.index('projektId');
  const req = index.openKeyCursor(IDBKeyRange.only(id));
  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      unosiStore.delete(cursor.primaryKey);
      cursor.continue();
    }
  };

  tx.oncomplete = () => ucitajDashboard();
}

function odaberiNacinUnosa(projektId, nacin) {
  const sekcijaScan = document.getElementById(`sekcija-skeniranje-${projektId}`);
  const sekcijaRucno = document.getElementById(`sekcija-rucno-${projektId}`);
  const tabScan = document.getElementById(`tab-scan-btn-${projektId}`);
  const tabManual = document.getElementById(`tab-manual-btn-${projektId}`);

  if (nacin === 'scan') {
    sekcijaScan.classList.remove('sakriveno');
    sekcijaRucno.classList.add('sakriveno');
    tabScan.classList.add('active');
    tabManual.classList.remove('active');
  } else {
    sekcijaScan.classList.add('sakriveno');
    sekcijaRucno.classList.remove('sakriveno');
    tabScan.classList.remove('active');
    tabManual.classList.add('active');
  }
}