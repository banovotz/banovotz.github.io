// Omogućava trajno čuvanje podataka u pregledniku
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (granted) {
      console.log("Pohrana podataka je trajna (persist enabled).");
    } else {
      console.warn("Preglednik može obrisati podatke ako zafali memorije.");
    }
  });
}

const DB_NAME = 'Mojih1500DB';
const DB_VERSION = 4; // Podignuto na 4 radi dodavanja 'unosi' store-a
const STORE_NAME = 'projekti';
const UNOSI_STORE = 'unosi';

/**
 * Otvara IndexedDB bazu i kreira tablice 'projekti' i 'unosi'.
 */
function otvoriBazu() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 1. Kreiranje store-a za projekte
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log("IndexedDB: Kreiran store 'projekti'");
      }

      // 2. KREIRANJE STORE-A ZA UNOSE (Rješava Vaš NotFoundError!)
      if (!db.objectStoreNames.contains(UNOSI_STORE)) {
        const unosiStore = db.createObjectStore(UNOSI_STORE, { keyPath: 'id' });
        unosiStore.createIndex('projektId', 'projektId', { unique: false });
        console.log("IndexedDB: Kreiran store 'unosi' i indeks 'projektId'");
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error("Greška pri otvaranju baze:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * SPREMANJE U INDEXEDDB 
 */
async function spremiUStorage(projekt) {
  try {
    const db = await otvoriBazu();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(projekt);

      tx.oncomplete = () => {
        console.log("Projekt uspješno spremljen u IndexedDB:", projekt.id);
        resolve(true);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("Greška u spremiUStorage:", err);
  }
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
// Glavna funkcija koja pokreće prikaz dashboarda
async function inicijalizirajAplikaciju() {
  try {
    console.log("Inicijalizacija aplikacije i dohvat projekata...");
    
    // 1. Prvo sačekamo da se bazi otvori pristup
    await otvoriBazu();

    // 2. Pozivamo render/učitavanje
    if (typeof ucitajDashboard === 'function') {
      await ucitajDashboard();
    } else if (typeof renderDashboard === 'function') {
      await renderDashboard();
    }
  } catch (err) {
    console.error("Greška pri inicijalizaciji aplikacije:", err);
  }
}

// Pokreće se čim se HTML stranica učita
// Zastavica koja sprječava višestruku inicijalizaciju
let aplikacijaInicijalizirana = false;

async function pokreniAplikaciju() {
  if (aplikacijaInicijalizirana) return;
  aplikacijaInicijalizirana = true;

  try {
    await otvoriBazu();
    await ucitajDashboard();
  } catch (err) {
    console.error("Greška pri pokretanju aplikacije:", err);
  }
}

// Sigurno pokretanje samo jednom
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pokreniAplikaciju);
} else {
  pokreniAplikaciju();
}

function postaviZadaneDatume() {
  const danas = new Date().toISOString().split('T')[0];
  document.getElementById('p-start').value = danas;
}

async function spremiProjektForma(event) {
  event.preventDefault();

  const id = document.getElementById('p-id').value || 'proj_' + Date.now();
  
  const noviProjekt = {
    id: id,
    naslov: document.getElementById('p-naslov').value,
    klijent: document.getElementById('p-klijent').value,
    ukupnoKartica: parseFloat(document.getElementById('p-ukupno').value) || 0,
    honorarPoKartici: parseFloat(document.getElementById('p-honorar').value) || 0,
    datumPocetka: document.getElementById('p-start').value,
    datumRoka: document.getElementById('p-rok').value,
    ciljDnevno: parseFloat(document.getElementById('p-cilj-dnevno').value) || 0,
    radVikendom: document.getElementById('p-vikend').value,
    
    // KLJUČNO: Spremanje GDoc URL-a i naslovnice
    gdocUrl: document.getElementById('p-gdoc-url').value.trim(),
    naslovnicaBase64: document.getElementById('p-naslovnica-base64').value || null,
    slovaOriginal: parseInt(document.getElementById('p-slova-original').value) || 0,
    slovaPrijevod: parseInt(document.getElementById('p-slova-prijevod').value) || 0,
    lastSynced: document.getElementById('p-last-synced').value || null
  };

  await spremiUStorage(noviProjekt);
  
  // Očisti formu i osvježi prikaz
  toggleFormaProjekta(true);
  await ucitajDashboard();
}

/**
 * Izračunava preostali broj dana od danas do zadanog roka.
 * Ako je radVikendom 'ne', broji samo radne dane (ponedjeljak - petak).
 */
function izracunajPreostaleDane(datumRokaStr, radVikendom) {
  const danas = new Date();
  danas.setHours(0, 0, 0, 0);

  const rok = new Date(datumRokaStr);
  rok.setHours(0, 0, 0, 0);

  if (rok < danas) return 0; // Rok je prošao

  let preostaloDana = 0;
  let tekuciDatum = new Date(danas);

  while (tekuciDatum <= rok) {
    const danUTjednu = tekuciDatum.getDay(); // 0 = nedjelja, 6 = subota
    const jeVikend = (danUTjednu === 0 || danUTjednu === 6);

    if (radVikendom === 'da' || !jeVikend) {
      preostaloDana++;
    }
    tekuciDatum.setDate(tekuciDatum.getDate() + 1);
  }

  return preostaloDana;
}

async function ucitajDashboard() {
  const dashboardDiv = document.getElementById('dashboard-page');
  if (!dashboardDiv) return;

  // 1. OBAVEZNO ČIŠĆENJE: Isprazni sav prethodni sadržaj iz HTML-a
  dashboardDiv.innerHTML = '';

  try {
    const db = await otvoriBazu();
    
    // 2. Dohvaćanje svih projekata
    const txProjekti = db.transaction(STORE_NAME, 'readonly');
    const storeProjekti = txProjekti.objectStore(STORE_NAME);
    const projekti = await new Promise((res, rej) => {
      const req = storeProjekti.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!projekti || projekti.length === 0) {
      dashboardDiv.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">Trenutno nemate aktivnih projekata. Kliknite na "+ Novi Projekt".</p>';
      return;
    }

    // 3. Dohvaćanje ručnih unosa
    const txUnosi = db.transaction(UNOSI_STORE, 'readonly');
    const storeUnosi = txUnosi.objectStore(UNOSI_STORE);
    const sviUnosi = await new Promise((res, rej) => {
      const req = storeUnosi.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    // Koristimo fragment kako bismo izbjegli višestruko ucitavanje u DOM
    const fragment = document.createDocumentFragment();

    // 4. Renderiranje svake kartice
    projekti.forEach(p => {
      const karticeIzGDoca = (p.slovaPrijevod || 0) / 1800;
      const unosiProjekta = sviUnosi.filter(u => u.projektId === p.id);
      const rucnoKartica = unosiProjekta.reduce((sum, u) => sum + (parseFloat(u.kartica) || 0), 0);
      
      const odradjenoKartica = karticeIzGDoca + rucnoKartica;
      const ukupnoKartica = parseFloat(p.ukupnoKartica) || 0;
      const preostaloKartica = Math.max(0, ukupnoKartica - odradjenoKartica);
      const postotak = ukupnoKartica > 0 ? Math.min(100, Math.round((odradjenoKartica / ukupnoKartica) * 100)) : 0;

      // --- OVDJE STAVLJATE DYNAMIC BUTTON LOGIKU ---
      const primarniGumbHtml = p.gdocUrl 
        ? `<button onclick="sinkronizirajProjekt('${p.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.85em; background: #008080; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
            ⚡ Sync Doc
           </button>`
        : `<button onclick="rucniUnosZnakova('${p.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.85em; background: #008080; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
            📝 Ručni unos 
           </button>`;
           
    
     // Izračun tempa
      const preostaloDana = izracunajPreostaleDane(p.datumRoka, p.radVikendom);
      const planiranoDnevno = parseFloat(p.ciljDnevno) || 0;
      let dnevniRitamText = '';

      if (postotak >= 100) {
        dnevniRitamText = `<span style="color: #2e7d32; font-weight: bold;">🎉 Projekt je završen!</span>`;
      } else if (preostaloDana <= 0) {
        dnevniRitamText = `<span style="color: #c62828; font-weight: bold;">⚠️ Rok je istekao!</span>`;
      } else {
        const potrebnoDnevnoNum = preostaloKartica / preostaloDana;
        const potrebnoDnevno = (preostaloKartica / preostaloDana).toFixed(2);
        const vikendOpaska = p.radVikendom === 'da' ? 'dana (ukljućujući i vikende)' : 'radnih dana';

        // Određivanje boje: crveno ako je potreban tempo veći od planiranog, zeleno ako je isti ili manji
        const jeUZaostatku = planiranoDnevno > 0 && potrebnoDnevnoNum > planiranoDnevno;
        const markBojaPozadine = jeUZaostatku ? '#fde8e8' : '#e6f2f2';
        const markBojaTeksta = jeUZaostatku ? '#c62828' : '#008080';
        
        // Prikaz planiranog i potrebnog tempa
        dnevniRitamText = `
          <div><strong>Planirani tempo:</strong> ${planiranoDnevno > 0 ? `${planiranoDnevno} kartica/dan` : '<span class="text-muted">Nije postavljen</span>'}</div>
          <div style="margin-top: 2px;">
            <strong>Potrebni tempo:</strong> 
            <mark style="background: ${markBojaPozadine}; color: ${markBojaTeksta}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
              ${potrebnoDnevno} kartica/dan
            </mark> 
            <small class="text-muted">(${preostaloDana} ${vikendOpaska} do roka)</small>
          </div>
        `;
      }

      // Honorari
      const honorarPoKartici = parseFloat(p.honorarPoKartici) || 0;
      const ukupniHonorar = (ukupnoKartica * honorarPoKartici).toFixed(2);
      const zaradjenoDoSada = (odradjenoKartica * honorarPoKartici).toFixed(2);

      // Naslovnica
      const naslovnicaHtml = p.naslovnicaBase64 
        ? `<img src="${p.naslovnicaBase64}" alt="Naslovnica" style="width: 75px; height: 110px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); flex-shrink: 0;">`
        : `<div style="width: 75px; height: 110px; background: #e0e0e0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #777; flex-shrink: 0;">📖</div>`;

      // Status
      const lastSyncText = p.lastSynced ? ` Zadnje: ${p.lastSynced}` : '';
      const gdocStatus = p.gdocUrl 
        ? `<span style="color: #2e7d32; font-size: 0.82em;" title="${p.gdocUrl}">🟢 GDoc Povezan${lastSyncText}</span>` 
        : `<span style="color: #c62828; font-size: 0.82em;">🔴 Bez GDoc URL-a</span>`;

const card = document.createElement('div');
      card.className = 'card-projekt';
      card.style = 'background: #fff; border-radius: 10px; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #eef2f2;';
      card.innerHTML = `
        <div style="display: flex; gap: 16px; align-items: flex-start;">
          ${naslovnicaHtml}
          <div style="flex-grow: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 4px;">
              <h3 style="margin: 0; color: #008080; font-size: 1.2em;">${p.naslov}</h3>
              ${gdocStatus}
            </div>
            <div style="font-size: 0.88em; color: #666; margin-bottom: 8px;">${p.klijent || 'Samostalni projekt'}</div>
            
            <div style="margin-bottom: 6px; font-size: 0.9em;">
              <strong>Napredak:</strong> ${odradjenoKartica.toFixed(2)} / ${ukupnoKartica.toFixed(2)} kartica 
              <span style="color: #008080; font-weight: bold;">(${postotak}%)</span>
              <br><small class="text-muted">U prijevodu ima ${(p.slovaPrijevod || 0).toLocaleString('hr-HR')} znakova s razmacima.</small>
            </div>

            <div style="background: #e6f2f2; border-radius: 6px; height: 10px; overflow: hidden; margin-bottom: 10px;">
              <div style="background: #008080; width: ${postotak}%; height: 100%; transition: width 0.3s ease;"></div>
            </div>

            <div style="font-size: 0.88em; margin-bottom: 10px;">
              ${dnevniRitamText}
            </div>

            <div style="background: #f9fbfb; padding: 8px 12px; border-radius: 6px; font-size: 0.88em; margin-bottom: 12px; border-left: 3px solid #008080; display: flex; justify-content: space-between;">
              <span><strong>Zarada:</strong> ${zaradjenoDoSada} € / ${ukupniHonorar} €</span>
              <span style="color: #666;">(${honorarPoKartici.toFixed(2)} €/kartici)</span>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
             <!-- Gumbi za akcije -->
  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
    ${primarniGumbHtml}
    <button onclick="urediProjekt('${p.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 0.85em;">✏️ Uredi</button>
    <button onclick="obrisiProjekt('${p.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 0.85em; color: #c62828;">🗑️ Obriši</button>
  </div>
          </div>
        </div>
      `;

      fragment.appendChild(card);
    });

    // Jednokratno dodavanje svih kartica u čist kontejner
    dashboardDiv.appendChild(fragment);

  } catch (err) {
    console.error("Greška pri učitavanju dashboarda:", err);
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
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  
  const request = store.get(id);
  request.onsuccess = () => {
    const p = request.result;
    if (!p) return;

    // Popunjavanje vidljivih polja
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-naslov').value = p.naslov || '';
    document.getElementById('p-klijent').value = p.klijent || '';
    document.getElementById('p-ukupno').value = p.ukupnoKartica || '';
    document.getElementById('p-honorar').value = p.honorarPoKartici || '';
    document.getElementById('p-start').value = p.datumPocetka || '';
    document.getElementById('p-rok').value = p.datumRoka || '';
    document.getElementById('p-cilj-dnevno').value = p.ciljDnevno || '';
    document.getElementById('p-vikend').value = p.radVikendom || 'ne';
    
    // KLJUČNO: Popunjavanje GDoc URL-a i skrivenih metrika
    document.getElementById('p-gdoc-url').value = p.gdocUrl || '';
    document.getElementById('p-naslovnica-base64').value = p.naslovnicaBase64 || '';
    document.getElementById('p-slova-original').value = p.slovaOriginal || 0;
    document.getElementById('p-slova-prijevod').value = p.slovaPrijevod || 0;
    document.getElementById('p-last-synced').value = p.lastSynced || '';

    // Prikaz naslovnice u preview-u ako postoji
    const imgPreview = document.getElementById('img-cover-preview');
    const previewBox = document.getElementById('metrika-preview');
    if (p.naslovnicaBase64) {
      imgPreview.src = p.naslovnicaBase64;
      imgPreview.style.display = 'block';
      previewBox.style.display = 'block';
    }

    document.getElementById('forma-naslov').innerText = 'Uredi Projekt';
    // Otvaranje kontejnera s formom
    const formaContainer = document.getElementById('forma-projekt-container');
    formaContainer.style.display = 'block';

    // DODANO: Glatko skrolanje do vrha forme
    formaContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    
  };
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
 * Dohvaća sve projekte iz IndexedDB-a.
 */
async function dohvatiSveProjekte() {
  try {
    const db = await otvoriBazu();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rez = request.result || [];
        console.log(`Dohvaćeno ${rez.length} projekata iz IndexedDB-a.`);
        resolve(rez);
      };

      request.onerror = (event) => {
        console.error("Greška pri dohvaćanju projekata:", event.target.error);
        reject(event.target.error);
      };
    });
  } catch (err) {
    console.error("Greška u dohvatiSveProjekte:", err);
    return [];
  }
}
async function dohvatiProjektPoId(id) {
  const projekti = await dohvatiSveProjekte();
  return projekti.find(p => p.id === id) || null;
}

async function obrisiProjektIzStoragea(id) {
  try {
    const db = await otvoriBazu();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);

      tx.oncomplete = () => {
        console.log("Projekt obrisan iz IndexedDB-a:", id);
        resolve(true);
      };
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error("Greška pri brisanju:", err);
  }
}

/**
 * Pomoćna funkcija za eksplicitno ažuriranje postojećeg objekta projekta.
 */
async function azurirajProjektUStorage(projekt) {
  await spremiUStorage(projekt);
}


/**
 * Glavna funkcija za iscrtavanje svih projekata na Dashboardu.
 */
async function renderDashboard() {
  const container = document.getElementById('dashboard');
  if (!container) return;

  // SADA CEKAMO DOHVAT IZ BAZA
  const projekti = await dohvatiSveProjekte();

  if (!projekti || projekti.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px; color: #666;">
        <h3>Nemate aktivnih projekata</h3>
        <p>Kliknite na gumb "+ Novi Projekt" na vrhu kako biste dodali svoj prvi prijevod.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
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

async function obrisiProjektIRerender(id) {
  if (confirm("Jeste li sigurni da želite obrisati ovaj projekt?")) {
    await obrisiProjektIzStoragea(id);
    await renderDashboard();
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
async function otvoriFormuZaUređivanje(id) {
 const p = await dohvatiProjektPoId(id);
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
async function izveziSigurnosnuKopiju() {
  try {
    const db = await otvoriBazu();

    // 1. Dohvaćanje projekata
    const txP = db.transaction(STORE_NAME, 'readonly');
    const projekti = await new Promise((res, rej) => {
      const req = txP.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    // 2. Dohvaćanje unosa
    const txU = db.transaction(UNOSI_STORE, 'readonly');
    const unosi = await new Promise((res, rej) => {
      const req = txU.objectStore(UNOSI_STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    // Objedinjavanje u jedan rezervni objekt
    const backupData = {
      version: DB_VERSION,
      datum: new Date().toISOString(),
      projekti: projekti,
      unosi: unosi
    };

    // Pretvaranje u JSON i preuzimanje
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mojih1500_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

  } catch (err) {
    console.error("Greška pri izvozu sigurnosne kopije:", err);
    alert("Izvoz sigurnosne kopije nije uspio.");
  }
}

async function uveziSigurnosnuKopiju(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.projekti || !Array.isArray(data.projekti)) {
        throw new Error("Datoteka nema ispravnu strukturu projekata.");
      }

      const db = await otvoriBazu();

      // 1. Spremanje projekata
      const txP = db.transaction(STORE_NAME, 'readwrite');
      const storeP = txP.objectStore(STORE_NAME);
      for (const p of data.projekti) {
        storeP.put(p);
      }

      // 2. Spremanje unosa (ako postoje u backupu)
      if (data.unosi && Array.isArray(data.unosi)) {
        const txU = db.transaction(UNOSI_STORE, 'readwrite');
        const storeU = txU.objectStore(UNOSI_STORE);
        for (const u of data.unosi) {
          storeU.put(u);
        }
      }

      alert("Sigurnosna kopija je uspješno učitana!");
      await ucitajDashboard(); // Osvježi prikaz na ekranu

    } catch (err) {
      console.error("Greška pri uvozu sigurnosne kopije:", err);
      alert("Učitavanje kopije nije uspjelo. Provjerite je li datoteka ispravan JSON.");
    } finally {
      // Očisti file input da se isti file može opet odabrati po potrebi
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}


async function sinkronizirajProjekt(id) {
  try {
    const db = await otvoriBazu();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const p = await new Promise((res, rej) => {
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!p || !p.gdocUrl) {
      alert("Projekt nema postavljen Google Doc URL za sinkronizaciju.");
      return;
    }

    // Izvlačenje ID-a dokumenta iz URL-a
    const docIdMatch = p.gdocUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!docIdMatch) {
      alert("Neispravan Google Doc URL!");
      return;
    }

    const docId = docIdMatch[1];
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const response = await fetch(exportUrl);
    if (!response.ok) throw new Error("Ne mogu dohvatiti Google Doc text.");

    const text = await response.text();
    const slovaPrijevod = text.length;

    // Ažuriranje projekta u bazi
    p.slovaPrijevod = slovaPrijevod;
    p.lastSynced = new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });

    await spremiUStorage(p);
    await ucitajDashboard(); // Osvježava dashboard na ekranu!

  } catch (err) {
    console.error("Greška pri sinkronizaciji:", err);
    alert("Sinkronizacija nije uspjela. Provjerite je li Google Doc javan ('Anyone with the link can view').");
  }
}



/**
 * Omogućuje brz ručni unos / korekciju ukupnog broja znakova u prijevodu.
 */
async function rucniUnosZnakova(id) {
  try {
    const db = await otvoriBazu();
    
    // Dohvaćanje projekta iz baze
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const p = await new Promise((res, rej) => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!p) return;

    // Otvaranje jednostavnog dijaloga s trenutnim brojem slova
    const trenutnoSlova = p.slovaPrijevod || 0;
    const noviUnos = prompt(
      `Trenutni broj znakova s prazninama u prijevodu za "${p.naslov}": ${trenutnoSlova.toLocaleString('hr-HR')}\n\nUnesite novi ukupni broj znakova s prazninama:`,
      trenutnoSlova
    );

    // Ako je korisnik kliknuo 'Cancel' ili ostavio prazno
    if (noviUnos === null || noviUnos.trim() === '') return;

    const noviBrojSlova = parseInt(noviUnos.replace(/\s+/g, ''), 10);

    if (isNaN(noviBrojSlova) || noviBrojSlova < 0) {
      alert("Molimo unesite ispravan pozitivan broj!");
      return;
    }

    // Ažuriranje i spremanje
    p.slovaPrijevod = noviBrojSlova;
    p.lastSynced = 'Ručno (' + new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) + ')';

    await spremiUStorage(p);
    await ucitajDashboard(); // Osvježava karticu na ekranu

  } catch (err) {
    console.error("Greška pri ručnom unosu znakova:", err);
    alert("Nije uspjelo ažuriranje broja znakova.");
  }
}

const SETTINGS_KEY = 'mojih1500_postavke';

function ucitajPostavke() {
  prikaziStranicu('settings-page');

  const postojacePostavke = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
    modelDoprinosa: 'obrt',
    fiksniIznos: 0,
    postotakIznos: 0,
    vrstaKartice: '1800'
  };

  if (postojacePostavke.modelDoprinosa === 'postotak') {
    document.getElementById('model-postotak').checked = true;
  } else {
    document.getElementById('model-obrt').checked = true;
  }

  document.getElementById('fiksni-iznos').value = postojacePostavke.fiksniIznos || '';
  document.getElementById('postotak-iznos').value = postojacePostavke.postotakIznos || '';
  document.getElementById('kartica-1800').checked = true;

  osvjeziPrikazFinancija();
}

function osvjeziPrikazFinancija() {
  const isObrt = document.getElementById('model-obrt').checked;
  document.getElementById('polje-fiksni').style.display = isObrt ? 'block' : 'none';
  document.getElementById('polje-postotak').style.display = isObrt ? 'none' : 'block';
}

function spremiPostavke() {
  const modelDoprinosa = document.querySelector('input[name="modelDoprinosa"]:checked').value;
  const fiksniIznos = parseFloat(document.getElementById('fiksni-iznos').value) || 0;
  const postotakIznos = parseFloat(document.getElementById('postotak-iznos').value) || 0;
  const vrstaKartice = document.querySelector('input[name="vrstaKartice"]:checked').value;

  const postavke = {
    modelDoprinosa,
    fiksniIznos,
    postotakIznos,
    vrstaKartice
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(postavke));
  alert('Postavke su spremljene!');
}

let odabranaGodinaAnalitike = new Date().getFullYear();

/**
 * Učitava i inicijalizira ekran Analitike
 */
async function ucitajAnalitiku() {
  prikaziStranicu('analytics-page');
  popuniGodineOdabira();
  await generirajTablicuAnalitike();
}

/**
 * Popunjava padajući izbornik s godinama (trenutna godina + 2 unaprijed i 2 unazad)
 */
function popuniGodineOdabira() {
  const select = document.getElementById('odabir-godine');
  select.innerHTML = '';
  
  const trenutnaGodina = new Date().getFullYear();
  for (let g = trenutnaGodina - 2; g <= trenutnaGodina + 2; g++) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = `${g}. godina`;
    if (g === odabranaGodinaAnalitike) opt.selected = true;
    select.appendChild(opt);
  }
}

/**
 * Reagira na promjenu godine u izborniku
 */
async function promijeniGodinuAnalitike() {
  odabranaGodinaAnalitike = parseInt(document.getElementById('odabir-godine').value);
  await generirajTablicuAnalitike();
}

/**
 * Glavna funkcija za preračunavanje i prikaz tablice analitike
 */

async function generirajTablicuAnalitike() {
  const tbody = document.getElementById('analitika-tablica-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // 1. Postavke iz localStorage
  const sirovoPostavke = JSON.parse(localStorage.getItem('mojih1500_postavke')) || {};
  const postavke = {
    modelDoprinosa: sirovoPostavke.modelDoprinosa || 'obrt',
    fiksniIznos: parseFloat(sirovoPostavke.fiksniIznos) || 0,
    postotakIznos: parseFloat(sirovoPostavke.postotakIznos) || 0,
    vrstaKartice: parseInt(sirovoPostavke.vrstaKartice) || 1800
  };

  const db = await otvoriBazu();
  const sviProjekti = await dohvatiSveProjekte(db);

  const naziviMjeseci = [
    "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
    "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"
  ];

  let godisnjiNetoUkupno = 0;
  const danas = new Date();

  for (let m = 0; m < 12; m++) {
    const aktivniProjektiUMjesecu = [];

    sviProjekti.forEach(p => {
      const datumPocetka = p.datumPocetka ? new Date(p.datumPocetka) : new Date(p.datumKreiranja || Date.now());
      const datumRoka = new Date(p.datumRoka);

      const pocetakMjeseca = new Date(odabranaGodinaAnalitike, m, 1);
      const krajMjeseca = new Date(odabranaGodinaAnalitike, m + 1, 0);

      // Provjera je li projekt aktivan u ovom mjesecu
      if (datumPocetka <= krajMjeseca && datumRoka >= pocetakMjeseca) {

        // Provjera je li OVO zadnji mjesec projekta (mjesec roka)
        const jeZavrsetakProjekta = (datumRoka.getFullYear() === odabranaGodinaAnalitike && datumRoka.getMonth() === m);

        const norma = postavke.vrstaKartice || 1800;
        let ukupnoZnakovaOdradjeno = 0;

        const unosiDnevnika = p.dnevnik || p.logs || p.povijest || [];
        if (Array.isArray(unosiDnevnika) && unosiDnevnika.length > 0) {
          ukupnoZnakovaOdradjeno = unosiDnevnika.reduce((sum, u) => sum + (parseFloat(u.brojZnakova || u.znakova || u.iznos) || 0), 0);
        } else {
          ukupnoZnakovaOdradjeno = parseFloat(p.slovaPrijevod || p.slovaOriginal || p.odradjenoZnakova || p.trenutnoZnakova) || 0;
        }

        let odradjenoKartica = ukupnoZnakovaOdradjeno / norma;

        if (odradjenoKartica === 0) {
          odradjenoKartica = parseFloat(p.ukupnoKartica) || parseFloat(p.odradjenoKartica) || 0;
        }

        const cijenaPoKartici = parseFloat(p.honorarPoKartici || p.cijenaPoKartici || p.cijena) || 0;
        
        let trenutnoBruto = odradjenoKartica * cijenaPoKartici;
        if (trenutnoBruto === 0 && p.ukupnoBruto) {
          trenutnoBruto = parseFloat(p.ukupnoBruto) || 0;
        }

        // Provjera kašnjenja
        let kasni = false;
        const ukupnoKartica = parseFloat(p.ukupnoKartica) || 0;
        if (datumRoka < danas && (ukupnoKartica === 0 || odradjenoKartica < ukupnoKartica)) {
          kasni = true;
        }

        const nazivKlijenta = p.klijent || p.izdavac || p.narucitelj || '-';

        aktivniProjektiUMjesecu.push({
          naslov: p.naslov || p.naziv || 'Bezimeni projekt',
          izdavac: nazivKlijenta,
          bruto: trenutnoBruto,
          kasni: kasni,
          jeZavrsetakProjekta: jeZavrsetakProjekta
        });
      }
    });

    const brojRedova = Math.max(1, aktivniProjektiUMjesecu.length);
    const imeMjeseca = naziviMjeseci[m];

    // Kod modela paušalnog obrta računaju se projekti čiji je rok u ovom mjesecu
    const zavrseniUOvomMjesecu = aktivniProjektiUMjesecu.filter(p => p.jeZavrsetakProjekta);
    const mjesecniBrutoZavrsenih = zavrseniUOvomMjesecu.reduce((sum, item) => sum + item.bruto, 0);

    let mjesecniNetoObrt = 0;
    if (postavke.modelDoprinosa === 'obrt') {
      if (zavrseniUOvomMjesecu.length > 0) {
        mjesecniNetoObrt = Math.max(0, mjesecniBrutoZavrsenih - postavke.fiksniIznos);
        godisnjiNetoUkupno += mjesecniNetoObrt;
      }
    }

    if (aktivniProjektiUMjesecu.length === 0) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: bold; color: #555;">${imeMjeseca}</td>
        <td style="padding: 10px 12px; color: #aaa;" colspan="2"><em>Nema aktivnih projekata</em></td>
        <td style="padding: 10px 12px; text-align: right; color: #aaa;">0.00 €</td>
        <td style="padding: 10px 12px; color: #aaa;">-</td>
      `;
      tbody.appendChild(tr);
    } else {
      aktivniProjektiUMjesecu.forEach((proj, idx) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';

        let tdMjesec = idx === 0 
          ? `<td rowspan="${brojRedova}" style="padding: 10px 12px; font-weight: bold; color: #333; vertical-align: top; background: #fafafa;">${imeMjeseca}</td>` 
          : '';

        let tdProjekt = `<td style="padding: 10px 12px; font-weight: 500;">${proj.naslov}</td>`;
        let tdIzdavac = `<td style="padding: 10px 12px; color: #666;">${proj.izdavac}</td>`;

        let tdNeto = '';

        if (postavke.modelDoprinosa === 'obrt') {
          if (idx === 0) {
            const iznosPrikaz = zavrseniUOvomMjesecu.length > 0 ? `${mjesecniNetoObrt.toFixed(2)} €` : 'n/a';
            const stilTeksta = zavrseniUOvomMjesecu.length > 0 ? 'color: #2e7d32; font-weight: bold;' : 'color: #888; font-style: italic;';
            
            tdNeto = `<td rowspan="${brojRedova}" style="padding: 10px 12px; text-align: right; ${stilTeksta} vertical-align: top; background: #fafafa;">
              ${iznosPrikaz}
            </td>`;
          }
        } else {
          // Model: Autorski ugovor (postotak)
          if (proj.jeZavrsetakProjekta) {
            const stopaDoprinosa = (postavke.postotakIznos || 0) / 100;
            const projNeto = proj.bruto * (1 - stopaDoprinosa);
            godisnjiNetoUkupno += projNeto;

            tdNeto = `<td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #2e7d32;">
              ${projNeto.toFixed(2)} €
            </td>`;
          } else {
            // Ako projekt traje u ovom mjesecu, ali NIJE zavrsni mjesec -> prikazujemo "n/a"
            tdNeto = `<td style="padding: 10px 12px; text-align: right; color: #888; font-style: italic;">
              n/a
            </td>`;
          }
        }

        let opaskaHtml = proj.kasni 
          ? `<span style="color: #c62828; font-weight: bold; background: #fde8e8; padding: 2px 6px; border-radius: 4px; font-size: 0.85em;">⚠️ Projekt kasni</span>`
          : `<span style="color: #2e7d32; font-size: 0.85em;">U rasporedu</span>`;

        let tdOpaska = `<td style="padding: 10px 12px;">${opaskaHtml}</td>`;

        tr.innerHTML = tdMjesec + tdProjekt + tdIzdavac + tdNeto + tdOpaska;
        tbody.appendChild(tr);
      });
    }
  }

  // Ažuriranje ukupnog godišnjeg zbroja na dnu tablice
  const ukupnoEl = document.getElementById('analitika-ukupno-neto');
  if (ukupnoEl) {
    ukupnoEl.textContent = `${godisnjiNetoUkupno.toFixed(2)} €`;
  }
}


function toggleMenu() {
  const sideDrawer = document.getElementById('side-drawer');
  const overlay = document.getElementById('overlay');
  
  if (sideDrawer && overlay) {
    sideDrawer.classList.toggle('open');
    overlay.classList.toggle('active');
  }
}

/**
 * Otvara / zatvara bočni hamburger izbornik
 */
function toggleMenu() {
  const sideDrawer = document.getElementById('side-drawer');
  const overlay = document.getElementById('overlay');
  
  if (sideDrawer && overlay) {
    sideDrawer.classList.toggle('open');
    overlay.classList.toggle('active');
  }
}
/**
 * Prikazuje samo odabranu stranicu, skrivajući sve ostale sekcije s klasom .page-content
 * @param {string} pageId - ID kontejnera koji se prikazuje
 */
function prikaziStranicu(pageId) {
  // Dohvaćamo sve kontejnere stranica
  const sveStranice = document.querySelectorAll('.page-content');
  
  sveStranice.forEach(page => {
    page.style.display = 'none';
  });

  const trazenaStranica = document.getElementById(pageId);
  if (trazenaStranica) {
    trazenaStranica.style.display = 'block';
  }

  // Pomiče prozor na sam vrh
  window.scrollTo(0, 0);
}
/**
 * Vraća korisnika na glavni Dashboard
 */
function prikaziDashboard() {
  prikaziStranicu('dashboard-page'); // Provjerite je li kontejner za dashboard nazvan 'dashboard-page' ili 'dashboard'
  ucitajDashboard();
}