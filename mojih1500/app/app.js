// Omogućava trajno čuvanje podataka u pregledniku (spriječava Chrome da briše memoriju)
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (granted) {
      console.log("Pohrana podataka je trajna (persist enabled).");
    } else {
      console.warn("Preglednik može obrisati podatke ako zafali memorije.");
    }
  });
}

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


function spremiProjektForma(e) {
  e.preventDefault();

  const slovaPrijevod = parseInt(document.getElementById('p-slova-prijevod').value) || 0;
  
  // Preračunaj odrađeno na temelju izvučenih slova ako postoji slovaPrijevod
  const izracunatoOdradjeno = slovaPrijevod > 0 
    ? parseFloat((slovaPrijevod / 1800).toFixed(2))
    : (parseFloat(document.getElementById('p-odradjeno')?.value) || 0);

  const noviProjekt = {
    id: document.getElementById('p-id').value || Date.now().toString(),
    naslov: document.getElementById('p-naslov').value,
    klijent: document.getElementById('p-klijent').value,
    ukupno: parseFloat(document.getElementById('p-ukupno').value),
    
    // OVDJE spremamo odrađene kartice prijevoda:
    odradjeno: izracunatoOdradjeno, 
    
    honorar: parseFloat(document.getElementById('p-honorar').value),
    start: document.getElementById('p-start').value,
    rok: document.getElementById('p-rok').value,
    ciljDnevno: parseFloat(document.getElementById('p-cilj-dnevno').value) || 0,
    vikend: document.getElementById('p-vikend').value,
    
    // Novi metapodaci
    gdocUrl: document.getElementById('p-gdoc-url').value,
    slovaOriginal: parseInt(document.getElementById('p-slova-original').value) || 0,
    slovaPrijevod: slovaPrijevod,
    naslovnicaBase64: document.getElementById('p-naslovnica-base64').value,
    lastSynced: document.getElementById('p-last-synced').value
  };

  // Spremi u localStorage i osvježi prikaz na dashboardu
  spremiUStorage(noviProjekt);
  renderDashboard();
  toggleFormaProjekta();
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

function renderProjectCard(project) {
  const origCards = (project.origCharCount / 1800).toFixed(2);
  const docCards = (project.docCharCount / 1800).toFixed(2);
  const lastSyncFormatted = project.lastSyncedAt 
    ? new Date(project.lastSyncedAt).toLocaleString('hr-HR') 
    : 'Nikada';

  // Naslovnica ili ugrađeni "placeholder" ako nema naslovnice u ePubu
  const coverHtml = project.coverDataUrl 
    ? `<img src="${project.coverDataUrl}" alt="Naslovnica" class="project-cover" />`
    : `<div class="project-cover-placeholder">Bez naslovnice</div>`;

  const cardHtml = `
    <div class="project-card" id="card-${project.id}">
      <div class="card-header">
        ${coverHtml}
        <div class="card-title-area">
          <h3>${project.title}</h3>
          <span class="sync-date">Zadnji sync: <strong>${lastSyncFormatted}</strong></span>
        </div>
      </div>

      <div class="card-body">
        <div class="stat-row">
          <span>Izvornik (ePub):</span>
          <strong>${project.origCharCount ? project.origCharCount.toLocaleString() : 0} slova (~${origCards} kartica)</strong>
        </div>
        
        <div class="stat-row">
          <span>Prijevod (GDoc):</span>
          <strong>${project.docCharCount ? project.docCharCount.toLocaleString() : 0} slova (~${docCards} kartica)</strong>
        </div>

        <!-- Napredak prijevoda u odnosu na izvornik -->
        ${project.origCharCount > 0 ? `
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${Math.min(100, (project.docCharCount / project.origCharCount) * 100)}%"></div>
          </div>
        ` : ''}
      </div>

      <div class="card-actions">
        <button class="btn-sync" onclick="syncProjectDoc('${project.id}')">
          🔄 Sync Google Doc
        </button>
        <button class="btn-edit" onclick="openEditModal('${project.id}')">✏️ Uredi</button>
      </div>
    </div>
  `;

  document.getElementById('projects-container').insertAdjacentHTML('beforeend', cardHtml);
}

/**
 * Analizira odabrani ePub i/ili Google Doc URL te automatski popunjava polja u formi,
 * preračunava trenutno odrađene kartice prijevoda i priprema ih za prikaz na kartici projekta.
 */
async function povuciPodatkeIzIzvora() {
  const epubInput = document.getElementById('p-epub-file');
  const gdocUrl = document.getElementById('p-gdoc-url').value.trim();
  const statusMsg = document.getElementById('fetch-status-msg');

  const file = epubInput ? epubInput.files[0] : null;

  if (!file && !gdocUrl) {
    alert("Molimo odaberite ePub datoteku ili unesite Google Docs URL prije povlačenja podataka.");
    return;
  }

  statusMsg.innerText = "Analiziram i povlačim podatke...";
  statusMsg.style.display = 'block';

  let origSlova = parseInt(document.getElementById('p-slova-original').value) || 0;
  let docSlova = parseInt(document.getElementById('p-slova-prijevod').value) || 0;

  try {
    // 1. Ako je odabran ePub (Izvornik)
    if (file) {
      statusMsg.innerText = "Čitam ePub i brojim znakove...";
      const epubData = await parsirajEpub(file);
      
      if (epubData.title && !document.getElementById('p-naslov').value) {
        document.getElementById('p-naslov').value = epubData.title;
      }

      if (epubData.coverBase64) {
        document.getElementById('p-naslovnica-base64').value = epubData.coverBase64;
        const imgCover = document.getElementById('img-cover-preview');
        if (imgCover) {
          imgCover.src = epubData.coverBase64;
          imgCover.style.display = 'block';
        }
      }

      origSlova = epubData.charCount;
      document.getElementById('p-slova-original').value = origSlova;
      
      // Ukupno kartica izvornika (1800 slova)
      const karticaOrig = (origSlova / 1800).toFixed(2);
      document.getElementById('p-ukupno').value = karticaOrig;
    }

    // 2. Ako je unesen Google Doc URL (Prijevod)
    if (gdocUrl) {
      statusMsg.innerText = "Dohvaćam prijevod iz Google Doc-a...";
      docSlova = await dohvatiBrojSlovaIzGDoca(gdocUrl);
      document.getElementById('p-slova-prijevod').value = docSlova;
      
      // Zapisujemo datum i vrijeme zadnje sinkronizacije
      document.getElementById('p-last-synced').value = new Date().toISOString();

      // KLJUČNI KORAK: Izračun odrađenih kartica prijevoda iz broja slova
      const odradjeneKartice = (docSlova / 1800).toFixed(2);

      // Ako u formi ili objektu projekta imate polje za trenutno odrađene kartice (npr. #p-odradjeno ili sl.), popunite ga:
      const inputOdradjeno = document.getElementById('p-odradjeno');
      if (inputOdradjeno) {
        inputOdradjeno.value = odradjeneKartice;
      }
    }

    // 3. Ažuriranje prikaza metrike u formi
    const lblOrigSlova = document.getElementById('lbl-slova-orig');
    const lblOrigKartice = document.getElementById('lbl-kartice-orig');
    const lblDocSlova = document.getElementById('lbl-slova-doc');
    const lblDocKartice = document.getElementById('lbl-kartice-doc');

    if (lblOrigSlova) lblOrigSlova.innerText = origSlova.toLocaleString();
    if (lblOrigKartice) lblOrigKartice.innerText = (origSlova / 1800).toFixed(2);

    if (lblDocSlova) lblDocSlova.innerText = docSlova.toLocaleString();
    if (lblDocKartice) lblDocKartice.innerText = (docSlova / 1800).toFixed(2);

    const metrikaPreview = document.getElementById('metrika-preview');
    if (metrikaPreview) metrikaPreview.style.display = 'block';

    statusMsg.innerText = "Podaci uspješno izvučeni!";

  } catch (err) {
    alert("Greška prilikom povlačenja podataka: " + err.message);
    statusMsg.innerText = "Došlo je do greške.";
  }
}

/**
 * Pomoćna funkcija za čitanje ePub-a pomoću JSZip-a.
 */
async function parsirajEpub(file) {
  const zip = await JSZip.loadAsync(file);
  const parser = new DOMParser();

  let title = file.name.replace(/\.epub$/i, '');
  let coverBase64 = null;
  let totalChars = 0;

  // Tražimo container.xml
  let opfPath = '';
  const containerFile = zip.file("META-INF/container.xml");
  if (containerFile) {
    const xmlText = await containerFile.async("string");
    const doc = parser.parseFromString(xmlText, "text/xml");
    const root = doc.querySelector("rootfile");
    if (root) opfPath = root.getAttribute("full-path");
  }

  // Tražimo OPF s metapodacima
  if (opfPath && zip.file(opfPath)) {
    const opfText = await zip.file(opfPath).async("string");
    const opfDoc = parser.parseFromString(opfText, "text/xml");

    const titleEl = opfDoc.querySelector("title") || opfDoc.querySelector("dc\\:title");
    if (titleEl && titleEl.textContent) title = titleEl.textContent.trim();

    // Pokušaj ekstrakcije naslovnice
    let coverHref = null;
    const coverMeta = opfDoc.querySelector('meta[name="cover"]');
    if (coverMeta) {
      const coverId = coverMeta.getAttribute("content");
      const coverItem = opfDoc.querySelector(`item[id="${coverId}"]`);
      if (coverItem) coverHref = coverItem.getAttribute("href");
    }

    if (coverHref) {
      const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
      const fullCoverPath = opfDir + coverHref;
      const coverFile = zip.file(fullCoverPath) || zip.file(coverHref);
      if (coverFile) {
        const b64 = await coverFile.async("base64");
        const ext = coverHref.split('.').pop().toLowerCase();
        coverBase64 = `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${b64}`;
      }
    }
  }

  // Brojanje znakova s razmacima
  for (const filename of Object.keys(zip.files)) {
    if (/\.(xhtml|html|htm)$/i.test(filename)) {
      const html = await zip.files[filename].async("string");
      const doc = parser.parseFromString(html, "text/html");
      const text = doc.body ? doc.body.textContent : "";
      totalChars += text.length;
    }
  }

  return { title, coverBase64, charCount: totalChars };
}

/**
 * Pomoćna funkcija za izvoz čisto tekstualnog sadržaja iz Google Doc-a.
 */
async function dohvatiBrojSlovaIzGDoca(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Neispravan Google Docs URL format.");

  const docId = match[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error("Dokument nije dostupan. Provjerite je li postavljen na 'Svatko s poveznicom' (Anyone with the link).");
  }

  const text = await res.text();
  return text.length;
}

async function sinhronizirajProjekt(id) {
  const projekt = dohvatiProjektPoId(id);
  if (!projekt || !projekt.gdocUrl) {
    alert("Ovaj projekt nema postavljen Google Doc URL.");
    return;
  }

  try {
    const docSlova = await dohvatiBrojSlovaIzGDoca(projekt.gdocUrl);
    
    // Preračunaj odrađene kartice
    projekt.slovaPrijevod = docSlova;
    projekt.odradjeno = parseFloat((docSlova / 1800).toFixed(2));
    projekt.lastSynced = new Date().toISOString();

    // Spremi u storage i osvježi prikaz na dashboardu
    azurirajProjektUStorage(projekt);
    
    if (typeof renderDashboard === 'function') {
      renderDashboard(); // Osvježava kartice na ekranu
    }

    alert(`Osvježeno! Prijevod ima ${docSlova.toLocaleString()} slova (${projekt.odradjeno} kartica).`);
  } catch (err) {
    alert("Greška pri sinkronizaciji: " + err.message);
  }
}

// Ključ pod kojim spremamo sve projekte u LocalStorage
const STORAGE_KEY = 'mojih1500_projekti';

/**
 * Dohvaća sve projekte iz LocalStoragea.
 * Ako nema ničega, vraća prazan polje (array).
 */
function dohvatiSveProjekte() {
  const podaci = localStorage.getItem(STORAGE_KEY);
  return podaci ? JSON.parse(podaci) : [];
}

/**
 * Dohvaća jedan projekt prema njegovom ID-u.
 */
function dohvatiProjektPoId(id) {
  const projekti = dohvatiSveProjekte();
  return projekti.find(p => p.id === id) || null;
}

/**
 * Sprema ili ažurira projekt u LocalStorageu.
 * Ako projekt s tim ID-em već postoji, prebrisat će ga novim podacima (Edit).
 * Ako ne postoji, dodat će ga kao novi projekt (Create).
 */
function spremiUStorage(projekt) {
  let projekti = dohvatiSveProjekte();

  const index = projekti.findIndex(p => p.id === projekt.id);

  if (index !== -1) {
    // Ažuriranje postojeće kartice / projekta
    projekti[index] = projekt;
  } else {
    // Dodavanje novog projekta na početak liste
    projekti.unshift(projekt);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(projekti));
}

/**
 * Pomoćna funkcija za eksplicitno ažuriranje postojećeg objekta projekta.
 */
function azurirajProjektUStorage(projekt) {
  spremiUStorage(projekt);
}

/**
 * Briše projekt iz LocalStoragea na temelju ID-a.
 */
function obrisiProjektIzStoragea(id) {
  let projekti = dohvatiSveProjekte();
  projekti = projekti.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projekti));
}

/**
 * Glavna funkcija za iscrtavanje svih projekata na Dashboardu.
 */
function renderDashboard() {
  const container = document.getElementById('dashboard');
  if (!container) return;

  const projekti = dohvatiSveProjekte();

  // Ako nema nikakvih projekata, prikaži prazno stanje (empty state)
  if (!projekti || projekti.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px; color: #666;">
        <h3>Nemate aktivnih projekata</h3>
        <p>Kliknite na gumb "+ Novi Projekt" na vrhu kako biste dodali svoj prvi prijevod.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ''; // Očisti trenutačni prikaz

  // Prolazimo kroz sve projekte i kreiramo HTML karticu za svaki
  projekti.forEach(projekt => {
    const cardHtml = kreirajHTMLKarticuProjekta(projekt);
    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

/**
 * Pomoćna funkcija koja generira HTML za pojedinačnu projektnu karticu.
 */
function kreirajHTMLKarticuProjekta(p) {
  const ukupnoKartica = parseFloat(p.ukupno) || 0;
  const odradjenoKartica = parseFloat(p.odradjeno) || 0;
  
  // Izračun postotka dovršenosti
  const postotak = ukupnoKartica > 0 
    ? Math.min(100, (odradjenoKartica / ukupnoKartica) * 100).toFixed(1) 
    : 0;

  // Financije
  const honorarPoKartici = parseFloat(p.honorar) || 0;
  const ukupnoEura = (ukupnoKartica * honorarPoKartici).toFixed(2);
  const zaradjenoEura = (odradjenoKartica * honorarPoKartici).toFixed(2);

  // Izračun dana i ritma do roka
  const ritamInfo = izracunajRitamIRok(p);

  // Formatiranje datuma zadnjeg synca
  const zadnjiSyncText = p.lastSynced 
    ? new Date(p.lastSynced).toLocaleString('hr-HR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Nikada';

  // Naslovnica ili Placeholder
  const coverHtml = p.naslovnicaBase64 
    ? `<img src="${p.naslovnicaBase64}" alt="Naslovnica" class="card-cover-img" />`
    : `<div class="card-cover-placeholder"><span>Bez<br>slike</span></div>`;

  return `
    <div class="card project-card" id="project-card-${p.id}">
      <div class="card-header-layout">
        ${coverHtml}
        
        <div class="card-main-info">
          <div class="card-title-row">
            <div>
              <h3 class="project-title">${p.naslov || 'Beznaslovni projekt'}</h3>
              ${p.klijent ? `<span class="project-client">🏢 ${p.klijent}</span>` : ''}
            </div>
            
            <div class="card-actions-dropdown">
              <button class="btn-icon" title="Uredi" onclick="otvoriFormuZaUređivanje('${p.id}')">✏️</button>
              <button class="btn-icon" title="Obriši" onclick="obrisiProjektIRerender('${p.id}')">🗑️</button>
            </div>
          </div>

          <div class="sync-status-bar">
            <span>🔄 Zadnji sync: <strong>${zadnjiSyncText}</strong></span>
            ${p.gdocUrl ? `
              <button class="btn-sync-small" onclick="sinhronizirajProjekt('${p.id}')" title="Povuci najnovije stanje iz Google Doc-a">
                Sync GDoc
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Traka napretka (Progress Bar) -->
      <div class="progress-section">
        <div class="progress-labels">
          <span>Dovršeno: <strong>${odradjenoKartica.toFixed(2)}</strong> / ${ukupnoKartica.toFixed(2)} kartica</span>
          <span><strong>${postotak}%</strong></span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${postotak}%;"></div>
        </div>
      </div>

      <!-- Metrika i ritam prevođenja -->
      <div class="grid-2 card-stats-grid">
        <div class="stat-box">
          <small>Financijski pregled</small>
          <div><strong>${zaradjenoEura} €</strong> / ${ukupnoEura} €</div>
        </div>

        <div class="stat-box">
          <small>Preostali ritam do roka</small>
          <div><strong>${ritamInfo.potrebnoDnevno}</strong> kart./dan (${ritamInfo.preostaloDana} d.)</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Pomoćna funkcija za izračun preostalih dana i potrebnog dnevnog tempa.
 */
function izracunajRitamIRok(p) {
  if (!p.rok) return { preostaloDana: 0, potrebnoDnevno: 0 };

  const danas = new Date();
  danas.setHours(0, 0, 0, 0);

  const rokDatum = new Date(p.rok);
  rokDatum.setHours(0, 0, 0, 0);

  const diffTime = rokDatum - danas;
  const ukupanBrojDana = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  let radniDani = ukupanBrojDana;

  // Ako korisnik NE radi vikendom, izbacujemo subote i nedjelje iz računice
  if (p.vikend === 'ne') {
    radniDani = 0;
    let tempDate = new Date(danas);
    while (tempDate <= rokDatum) {
      const dayOfWeek = tempDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Nedjelja, 6 = Subota
        radniDani++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    radniDani = Math.max(1, radniDani);
  }

  const preostaloKartica = Math.max(0, (parseFloat(p.ukupno) || 0) - (parseFloat(p.odradjeno) || 0));
  const potrebnoDnevno = (preostaloKartica / radniDani).toFixed(1);

  return {
    preostaloDana: radniDani,
    potrebnoDnevno: potrebnoDnevno
  };
}

/**
 * Pomoćna funkcija za brisanje i osvježavanje prikaza.
 */

function obrisiProjektIRerender(id) {
  if (confirm("Jeste li sigurni da želite obrisati ovaj projekt?")) {
    obrisiProjektIzStoragea(id);
    renderDashboard();
  }
}

/**
 * Otvara ili zatvara formu za unos/uređivanje projekta.
 * @param {boolean} forceClose - ako je true, eksplicitno zatvara formu.
 */

function toggleFormaProjekta(forceClose = false) {
  const container = document.getElementById('forma-projekt-container'); // ili modal/sekcija u kojoj je forma
  const btnNovi = document.getElementById('btn-novi-projekt');
  const form = document.getElementById('form-projekt');

  if (!container) return;

  const jeOtvoreno = container.style.display !== 'none' && container.style.display !== '';

  if (jeOtvoreno || forceClose) {
    // Zatvaranje forme
    container.style.display = 'none';
    if (btnNovi) btnNovi.innerText = '+ Novi Projekt';
    ocistiFormuProjekta();
  } else {
    // Otvaranje forme za NOVI projekt
    ocistiFormuProjekta();
    container.style.display = 'block';
    if (btnNovi) btnNovi.innerText = '✕ Zatvori Formu';
    
    // Skrolaj do forme ako je nisko na stranici
    container.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Otvara formu i popunjava je podacima postojećeg projekta radi uređivanja.
 */
function otvoriFormuZaUređivanje(id) {
  const p = dohvatiProjektPoId(id);
  if (!p) return;

  // Prvo otvori formu
  const container = document.getElementById('forma-projekt-container');
  if (container) container.style.display = 'block';

  const btnNovi = document.getElementById('btn-novi-projekt');
  if (btnNovi) btnNovi.innerText = '✕ Zatvori Formu';

  // Popuni polja forme
  document.getElementById('p-id').value = p.id || '';
  document.getElementById('p-naslov').value = p.naslov || '';
  document.getElementById('p-klijent').value = p.klijent || '';
  document.getElementById('p-ukupno').value = p.ukupno || '';
  document.getElementById('p-honorar').value = p.honorar || '';
  document.getElementById('p-start').value = p.start || '';
  document.getElementById('p-rok').value = p.rok || '';
  document.getElementById('p-cilj-dnevno').value = p.ciljDnevno || '';
  
  if (document.getElementById('p-vikend')) {
    document.getElementById('p-vikend').value = p.vikend || 'ne';
  }

  // Metapodaci za sync/izvor
  if (document.getElementById('p-gdoc-url')) {
    document.getElementById('p-gdoc-url').value = p.gdocUrl || '';
  }
  if (document.getElementById('p-slova-original')) {
    document.getElementById('p-slova-original').value = p.slovaOriginal || 0;
  }
  if (document.getElementById('p-slova-prijevod')) {
    document.getElementById('p-slova-prijevod').value = p.slovaPrijevod || 0;
  }
  if (document.getElementById('p-last-synced')) {
    document.getElementById('p-last-synced').value = p.lastSynced || '';
  }
  if (document.getElementById('p-naslovnica-base64')) {
    document.getElementById('p-naslovnica-base64').value = p.naslovnicaBase64 || '';
  }

  // Prikaz preview naslovnice ako postoji
  const imgCover = document.getElementById('img-cover-preview');
  if (imgCover) {
    if (p.naslovnicaBase64) {
      imgCover.src = p.naslovnicaBase64;
      imgCover.style.display = 'block';
    } else {
      imgCover.style.display = 'none';
      imgCover.src = '';
    }
  }

  // Prikaz labela s brojem slova/kartica ako postoje u formi
  const lblOrigSlova = document.getElementById('lbl-slova-orig');
  const lblDocSlova = document.getElementById('lbl-slova-doc');
  if (lblOrigSlova) lblOrigSlova.innerText = (p.slovaOriginal || 0).toLocaleString();
  if (lblDocSlova) lblDocSlova.innerText = (p.slovaPrijevod || 0).toLocaleString();

  const metrikaPreview = document.getElementById('metrika-preview');
  if (metrikaPreview) metrikaPreview.style.display = 'block';

  // Skrolaj do forme
  container.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Pomoćna funkcija koja resetira sva polja unutar forme na početne vrijednosti.
 */
function ocistiFormuProjekta() {
  const form = document.getElementById('form-projekt');
  if (form) form.reset();

  // Očisti skrivena polja koja `form.reset()` nekada preskoči
  const idField = document.getElementById('p-id');
  if (idField) idField.value = '';

  const gdocField = document.getElementById('p-gdoc-url');
  if (gdocField) gdocField.value = '';

  const slovaOrig = document.getElementById('p-slova-original');
  if (slovaOrig) slovaOrig.value = '0';

  const slovaDoc = document.getElementById('p-slova-prijevod');
  if (slovaDoc) slovaDoc.value = '0';

  const base64Field = document.getElementById('p-naslovnica-base64');
  if (base64Field) base64Field.value = '';

  const lastSynced = document.getElementById('p-last-synced');
  if (lastSynced) lastSynced.value = '';

  // Sakrij statusne poruke i preview-e
  const statusMsg = document.getElementById('fetch-status-msg');
  if (statusMsg) {
    statusMsg.innerText = '';
    statusMsg.style.display = 'none';
  }

  const imgCover = document.getElementById('img-cover-preview');
  if (imgCover) {
    imgCover.style.display = 'none';
    imgCover.src = '';
  }

  const metrikaPreview = document.getElementById('metrika-preview');
  if (metrikaPreview) metrikaPreview.style.display = 'none';
}
/**
 * Otvara formu i popunjava je podacima postojećeg projekta radi uređivanja.
 */
function otvoriFormuZaUređivanje(id) {
  const p = dohvatiProjektPoId(id);
  if (!p) return;

  // Prvo otvori formu
  const container = document.getElementById('forma-projekt-container');
  if (container) container.style.display = 'block';

  const btnNovi = document.getElementById('btn-novi-projekt');
  if (btnNovi) btnNovi.innerText = '✕ Zatvori Formu';

  // Popuni polja forme
  document.getElementById('p-id').value = p.id || '';
  document.getElementById('p-naslov').value = p.naslov || '';
  document.getElementById('p-klijent').value = p.klijent || '';
  document.getElementById('p-ukupno').value = p.ukupno || '';
  document.getElementById('p-honorar').value = p.honorar || '';
  document.getElementById('p-start').value = p.start || '';
  document.getElementById('p-rok').value = p.rok || '';
  document.getElementById('p-cilj-dnevno').value = p.ciljDnevno || '';
  
  if (document.getElementById('p-vikend')) {
    document.getElementById('p-vikend').value = p.vikend || 'ne';
  }

  // Metapodaci za sync/izvor
  if (document.getElementById('p-gdoc-url')) {
    document.getElementById('p-gdoc-url').value = p.gdocUrl || '';
  }
  if (document.getElementById('p-slova-original')) {
    document.getElementById('p-slova-original').value = p.slovaOriginal || 0;
  }
  if (document.getElementById('p-slova-prijevod')) {
    document.getElementById('p-slova-prijevod').value = p.slovaPrijevod || 0;
  }
  if (document.getElementById('p-last-synced')) {
    document.getElementById('p-last-synced').value = p.lastSynced || '';
  }
  if (document.getElementById('p-naslovnica-base64')) {
    document.getElementById('p-naslovnica-base64').value = p.naslovnicaBase64 || '';
  }

  // Prikaz preview naslovnice ako postoji
  const imgCover = document.getElementById('img-cover-preview');
  if (imgCover) {
    if (p.naslovnicaBase64) {
      imgCover.src = p.naslovnicaBase64;
      imgCover.style.display = 'block';
    } else {
      imgCover.style.display = 'none';
      imgCover.src = '';
    }
  }

  // Prikaz labela s brojem slova/kartica ako postoje u formi
  const lblOrigSlova = document.getElementById('lbl-slova-orig');
  const lblDocSlova = document.getElementById('lbl-slova-doc');
  if (lblOrigSlova) lblOrigSlova.innerText = (p.slovaOriginal || 0).toLocaleString();
  if (lblDocSlova) lblDocSlova.innerText = (p.slovaPrijevod || 0).toLocaleString();

  const metrikaPreview = document.getElementById('metrika-preview');
  if (metrikaPreview) metrikaPreview.style.display = 'block';

  // Skrolaj do forme
  container.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Pomoćna funkcija koja resetira sva polja unutar forme na početne vrijednosti.
 */
function ocistiFormuProjekta() {
  const form = document.getElementById('form-projekt');
  if (form) form.reset();

  // Očisti skrivena polja koja `form.reset()` nekada preskoči
  const idField = document.getElementById('p-id');
  if (idField) idField.value = '';

  const gdocField = document.getElementById('p-gdoc-url');
  if (gdocField) gdocField.value = '';

  const slovaOrig = document.getElementById('p-slova-original');
  if (slovaOrig) slovaOrig.value = '0';

  const slovaDoc = document.getElementById('p-slova-prijevod');
  if (slovaDoc) slovaDoc.value = '0';

  const base64Field = document.getElementById('p-naslovnica-base64');
  if (base64Field) base64Field.value = '';

  const lastSynced = document.getElementById('p-last-synced');
  if (lastSynced) lastSynced.value = '';

  // Sakrij statusne poruke i preview-e
  const statusMsg = document.getElementById('fetch-status-msg');
  if (statusMsg) {
    statusMsg.innerText = '';
    statusMsg.style.display = 'none';
  }

  const imgCover = document.getElementById('img-cover-preview');
  if (imgCover) {
    imgCover.style.display = 'none';
    imgCover.src = '';
  }

  const metrikaPreview = document.getElementById('metrika-preview');
  if (metrikaPreview) metrikaPreview.style.display = 'none';
}


/**
 * Preuzima sve projekte kao .json datoteku na računalo.
 */
function izveziSigurnosnuKopiju() {
  const projekti = dohvatiSveProjekte();
  if (projekti.length === 0) {
    alert("Nemate projekata za izvoz.");
    return;
  }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projekti, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `mojih1500_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Učitava projekte iz .json datoteke natrag u aplikaciju.
 */
function uveziSigurnosnuKopiju(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const projekti = JSON.parse(e.target.result);
      if (Array.isArray(projekti)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projekti));
        renderDashboard();
        alert("Projekti uspješno učitani iz sigurnosne kopije!");
      } else {
        alert("Neispravna datoteka sigurnosne kopije.");
      }
    } catch (err) {
      alert("Greška pri čitanju datoteke: " + err.message);
    }
  };
  reader.readAsText(file);
}