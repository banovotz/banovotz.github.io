// Enables persistent storage in the browser
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (granted) {
      console.log("Data storage is persistent (persist enabled).");
    } else {
      console.warn("The browser may clear data if memory runs low.");
    }
  });
}

const DB_NAME = 'Mojih1500DB';
const DB_VERSION = 4; // Incremented to 4 to add the 'unosi' store
const STORE_NAME = 'projekti';
const UNOSI_STORE = 'unosi';

/**
 * Opens IndexedDB and creates 'projekti' and 'unosi' stores.
 */
function otvoriBazu() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 1. Create project store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log("IndexedDB: Created store 'projekti'");
      }

      // 2. CREATE ENTRIES STORE (Fixes NotFoundError)
      if (!db.objectStoreNames.contains(UNOSI_STORE)) {
        const unosiStore = db.createObjectStore(UNOSI_STORE, { keyPath: 'id' });
        unosiStore.createIndex('projektId', 'projektId', { unique: false });
        console.log("IndexedDB: Created store 'unosi' and index 'projektId'");
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error("Error opening database:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * SAVE TO INDEXEDDB 
 */
async function spremiUStorage(projekt) {
  try {
    const db = await otvoriBazu();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(projekt);

      tx.oncomplete = () => {
        console.log("Project successfully saved to IndexedDB:", projekt.id);
        resolve(true);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("Error in spremiUStorage:", err);
  }
}

// --- MATH & HELPER FUNCTIONS ---
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

// --- INITIALIZATION ---
// Main function that triggers the dashboard rendering
async function inicijalizirajAplikaciju() {
  try {
    console.log("Initializing application and fetching projects...");
    
    // 1. Wait for database access
    await otvoriBazu();

    // 2. Trigger rendering/loading
    if (typeof ucitajDashboard === 'function') {
      await ucitajDashboard();
    } else if (typeof renderDashboard === 'function') {
      await renderDashboard();
    }
  } catch (err) {
    console.error("Error initializing application:", err);
  }
}

// Prevents multiple initializations
let aplikacijaInicijalizirana = false;

async function pokreniAplikaciju() {
  if (aplikacijaInicijalizirana) return;
  aplikacijaInicijalizirana = true;

  try {
    await otvoriBazu();
    await ucitajDashboard();
  } catch (err) {
    console.error("Error starting application:", err);
  }
}

// Safe single start
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
    
    // GDoc URL and cover saving
    gdocUrl: document.getElementById('p-gdoc-url').value.trim(),
    naslovnicaBase64: document.getElementById('p-naslovnica-base64').value || null,
    slovaOriginal: parseInt(document.getElementById('p-slova-original').value) || 0,
    slovaPrijevod: parseInt(document.getElementById('p-slova-prijevod').value) || 0,
    lastSynced: document.getElementById('p-last-synced').value || null
  };

  await spremiUStorage(noviProjekt);
  
  // Clear form and refresh UI
  toggleFormaProjekta(true);
  await ucitajDashboard();
}

/**
 * Calculates remaining days until deadline.
 * If radVikendom is 'ne', counts business days only (Monday - Friday).
 */
function izracunajPreostaleDane(datumRokaStr, radVikendom) {
  const danas = new Date();
  danas.setHours(0, 0, 0, 0);

  const rok = new Date(datumRokaStr);
  rok.setHours(0, 0, 0, 0);

  if (rok < danas) return 0; // Deadline passed

  let preostaloDana = 0;
  let tekuciDatum = new Date(danas);

  while (tekuciDatum <= rok) {
    const danUTjednu = tekuciDatum.getDay(); // 0 = Sunday, 6 = Saturday
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

  // Clear previous content
  dashboardDiv.innerHTML = '';

  try {
    const db = await otvoriBazu();
    
    // Fetch all projects
    const txProjekti = db.transaction(STORE_NAME, 'readonly');
    const storeProjekti = txProjekti.objectStore(STORE_NAME);
    const projekti = await new Promise((res, rej) => {
      const req = storeProjekti.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!projekti || projekti.length === 0) {
      dashboardDiv.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">You currently have no active projects. Click on "+ New Project".</p>';
      return;
    }

    // Fetch manual entries
    const txUnosi = db.transaction(UNOSI_STORE, 'readonly');
    const storeUnosi = txUnosi.objectStore(UNOSI_STORE);
    const sviUnosi = await new Promise((res, rej) => {
      const req = storeUnosi.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    const fragment = document.createDocumentFragment();

    // Render cards
    projekti.forEach(p => {
      const karticeIzGDoca = (p.slovaPrijevod || 0) / 1800;
      const unosiProjekta = sviUnosi.filter(u => u.projektId === p.id);
      const rucnoKartica = unosiProjekta.reduce((sum, u) => sum + (parseFloat(u.kartica) || 0), 0);
      
      const odradjenoKartica = karticeIzGDoca + rucnoKartica;
      const ukupnoKartica = parseFloat(p.ukupnoKartica) || 0;
      const preostaloKartica = Math.max(0, ukupnoKartica - odradjenoKartica);
      const postotak = ukupnoKartica > 0 ? Math.min(100, Math.round((odradjenoKartica / ukupnoKartica) * 100)) : 0;

      // Dynamic primary button logic
      const primarniGumbHtml = p.gdocUrl 
        ? `<button onclick="sinkronizirajProjekt('${p.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.85em; background: #008080; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
            ⚡ Sync Doc
           </button>`
        : `<button onclick="rucniUnosZnakova('${p.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.85em; background: #008080; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
            📝 Manual entry 
           </button>`;
           
      // Pace calculation
      const preostaloDana = izracunajPreostaleDane(p.datumRoka, p.radVikendom);
      const planiranoDnevno = parseFloat(p.ciljDnevno) || 0;
      let dnevniRitamText = '';

      if (postotak >= 100) {
        dnevniRitamText = `<span style="color: #2e7d32; font-weight: bold;">🎉 Project completed!</span>`;
      } else if (preostaloDana <= 0) {
        dnevniRitamText = `<span style="color: #c62828; font-weight: bold;">⚠️ Deadline has passed!</span>`;
      } else {
        const potrebnoDnevnoNum = preostaloKartica / preostaloDana;
        const potrebnoDnevno = (preostaloKartica / preostaloDana).toFixed(2);
        const vikendOpaska = p.radVikendom === 'da' ? 'days (including weekends)' : 'business days';

        const jeUZaostatku = planiranoDnevno > 0 && potrebnoDnevnoNum > planiranoDnevno;
        const markBojaPozadine = jeUZaostatku ? '#fde8e8' : '#e6f2f2';
        const markBojaTeksta = jeUZaostatku ? '#c62828' : '#008080';
        
        dnevniRitamText = `
          <div><strong>Planned pace:</strong> ${planiranoDnevno > 0 ? `${planiranoDnevno} pages/day` : '<span class="text-muted">Not set</span>'}</div>
          <div style="margin-top: 2px;">
            <strong>Required pace:</strong> 
            <mark style="background: ${markBojaPozadine}; color: ${markBojaTeksta}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
              ${potrebnoDnevno} pages/day
            </mark> 
            <small class="text-muted">(${preostaloDana} ${vikendOpaska} until deadline)</small>
          </div>
        `;
      }

      // Fees
      const honorarPoKartici = parseFloat(p.honorarPoKartici) || 0;
      const ukupniHonorar = (ukupnoKartica * honorarPoKartici).toFixed(2);
      const zaradjenoDoSada = (odradjenoKartica * honorarPoKartici).toFixed(2);

      // Cover
      const naslovnicaHtml = p.naslovnicaBase64 
        ? `<img src="${p.naslovnicaBase64}" alt="Cover" style="width: 75px; height: 110px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); flex-shrink: 0;">`
        : `<div style="width: 75px; height: 110px; background: #e0e0e0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #777; flex-shrink: 0;">📖</div>`;

      // Status
      const lastSyncText = p.lastSynced ? ` Last: ${p.lastSynced}` : '';
      const gdocStatus = p.gdocUrl 
        ? `<span style="color: #2e7d32; font-size: 0.82em;" title="${p.gdocUrl}">🟢 GDoc Connected${lastSyncText}</span>` 
        : `<span style="color: #c62828; font-size: 0.82em;">🔴 No GDoc URL</span>`;

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
            <div style="font-size: 0.88em; color: #666; margin-bottom: 8px;">${p.klijent || 'Independent project'}</div>
            
            <div style="margin-bottom: 6px; font-size: 0.9em;">
              <strong>Progress:</strong> ${odradjenoKartica.toFixed(2)} / ${ukupnoKartica.toFixed(2)} pages 
              <span style="color: #008080; font-weight: bold;">(${postotak}%)</span>
              <br><small class="text-muted">Translation contains ${(p.slovaPrijevod || 0).toLocaleString('en-US')} characters with spaces.</small>
            </div>

            <div style="background: #e6f2f2; border-radius: 6px; height: 10px; overflow: hidden; margin-bottom: 10px;">
              <div style="background: #008080; width: ${postotak}%; height: 100%; transition: width 0.3s ease;"></div>
            </div>

            <div style="font-size: 0.88em; margin-bottom: 10px;">
              ${dnevniRitamText}
            </div>

            <div style="background: #f9fbfb; padding: 8px 12px; border-radius: 6px; font-size: 0.88em; margin-bottom: 12px; border-left: 3px solid #008080; display: flex; justify-content: space-between;">
              <span><strong>Earnings:</strong> €${zaradjenoDoSada} / €${ukupniHonorar}</span>
              <span style="color: #666;">(€${honorarPoKartici.toFixed(2)}/page)</span>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${primarniGumbHtml}
                <button onclick="urediProjekt('${p.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 0.85em;">✏️ Edit</button>
                <button onclick="obrisiProjekt('${p.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 0.85em; color: #c62828;">🗑️ Delete</button>
              </div>
            </div>
          </div>
        </div>
      `;

      fragment.appendChild(card);
    });

    dashboardDiv.appendChild(fragment);

  } catch (err) {
    console.error("Error loading dashboard:", err);
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

    document.getElementById('p-id').value = p.id;
    document.getElementById('p-naslov').value = p.naslov || '';
    document.getElementById('p-klijent').value = p.klijent || '';
    document.getElementById('p-ukupno').value = p.ukupnoKartica || '';
    document.getElementById('p-honorar').value = p.honorarPoKartici || '';
    document.getElementById('p-start').value = p.datumPocetka || '';
    document.getElementById('p-rok').value = p.datumRoka || '';
    document.getElementById('p-cilj-dnevno').value = p.ciljDnevno || '';
    document.getElementById('p-vikend').value = p.radVikendom || 'ne';
    
    document.getElementById('p-gdoc-url').value = p.gdocUrl || '';
    document.getElementById('p-naslovnica-base64').value = p.naslovnicaBase64 || '';
    document.getElementById('p-slova-original').value = p.slovaOriginal || 0;
    document.getElementById('p-slova-prijevod').value = p.slovaPrijevod || 0;
    document.getElementById('p-last-synced').value = p.lastSynced || '';

    const imgPreview = document.getElementById('img-cover-preview');
    const previewBox = document.getElementById('metrika-preview');
    if (p.naslovnicaBase64) {
      imgPreview.src = p.naslovnicaBase64;
      imgPreview.style.display = 'block';
      previewBox.style.display = 'block';
    }

    document.getElementById('forma-naslov').innerText = 'Edit Project';
    const formaContainer = document.getElementById('forma-projekt-container');
    formaContainer.style.display = 'block';
    formaContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

async function obrisiProjekt(id) {
  if (!confirm('Are you sure you want to delete this project and all its entries?')) return;
  
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
    ? new Date(project.lastSyncedAt).toLocaleString('en-US') 
    : 'Never';

  const coverHtml = project.coverDataUrl 
    ? `<img src="${project.coverDataUrl}" alt="Cover" class="project-cover" />`
    : `<div class="project-cover-placeholder">No cover</div>`;

  const cardHtml = `
    <div class="project-card" id="card-${project.id}">
      <div class="card-header">
        ${coverHtml}
        <div class="card-title-area">
          <h3>${project.title}</h3>
          <span class="sync-date">Last sync: <strong>${lastSyncFormatted}</strong></span>
        </div>
      </div>

      <div class="card-body">
        <div class="stat-row">
          <span>Source (ePub):</span>
          <strong>${project.origCharCount ? project.origCharCount.toLocaleString() : 0} chars (~${origCards} pages)</strong>
        </div>
        
        <div class="stat-row">
          <span>Translation (GDoc):</span>
          <strong>${project.docCharCount ? project.docCharCount.toLocaleString() : 0} chars (~${docCards} pages)</strong>
        </div>

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
        <button class="btn-edit" onclick="openEditModal('${project.id}')">✏️ Edit</button>
      </div>
    </div>
  `;

  document.getElementById('projects-container').insertAdjacentHTML('beforeend', cardHtml);
}

/**
 * Analyzes selected ePub and/or Google Doc URL, fills out form fields,
 * recalculates translated standard pages, and prepares card visualization.
 */
async function povuciPodatkeIzIzvora() {
  const epubInput = document.getElementById('p-epub-file');
  const gdocUrl = document.getElementById('p-gdoc-url').value.trim();
  const statusMsg = document.getElementById('fetch-status-msg');

  const file = epubInput ? epubInput.files[0] : null;

  if (!file && !gdocUrl) {
    alert("Please select an ePub file or enter a Google Docs URL before fetching data.");
    return;
  }

  statusMsg.innerText = "Analyzing and fetching data...";
  statusMsg.style.display = 'block';

  let origSlova = parseInt(document.getElementById('p-slova-original').value) || 0;
  let docSlova = parseInt(document.getElementById('p-slova-prijevod').value) || 0;

  try {
    // 1. If ePub selected
    if (file) {
      statusMsg.innerText = "Reading ePub and counting characters...";
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
      
      const karticaOrig = (origSlova / 1800).toFixed(2);
      document.getElementById('p-ukupno').value = karticaOrig;
    }

    // 2. If Google Doc URL provided
    if (gdocUrl) {
      statusMsg.innerText = "Fetching translation from Google Doc...";
      docSlova = await dohvatiBrojSlovaIzGDoca(gdocUrl);
      document.getElementById('p-slova-prijevod').value = docSlova;
      
      document.getElementById('p-last-synced').value = new Date().toISOString();

      const odradjeneKartice = (docSlova / 1800).toFixed(2);

      const inputOdradjeno = document.getElementById('p-odradjeno');
      if (inputOdradjeno) {
        inputOdradjeno.value = odradjeneKartice;
      }
    }

    // 3. Update preview metrics
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

    statusMsg.innerText = "Data successfully fetched!";

  } catch (err) {
    alert("Error fetching data: " + err.message);
    statusMsg.innerText = "An error occurred.";
  }
}

/**
 * Helper function to parse ePub files using JSZip.
 */
async function parsirajEpub(file) {
  const zip = await JSZip.loadAsync(file);
  const parser = new DOMParser();

  let title = file.name.replace(/\.epub$/i, '');
  let coverBase64 = null;
  let totalChars = 0;

  let opfPath = '';
  const containerFile = zip.file("META-INF/container.xml");
  if (containerFile) {
    const xmlText = await containerFile.async("string");
    const doc = parser.parseFromString(xmlText, "text/xml");
    const root = doc.querySelector("rootfile");
    if (root) opfPath = root.getAttribute("full-path");
  }

  if (opfPath && zip.file(opfPath)) {
    const opfText = await zip.file(opfPath).async("string");
    const opfDoc = parser.parseFromString(opfText, "text/xml");

    const titleEl = opfDoc.querySelector("title") || opfDoc.querySelector("dc\\:title");
    if (titleEl && titleEl.textContent) title = titleEl.textContent.trim();

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
 * Helper to fetch plain text character count from Google Docs export URL.
 */
async function dohvatiBrojSlovaIzGDoca(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Invalid Google Docs URL format.");

  const docId = match[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error("Document is not accessible. Please ensure sharing is set to 'Anyone with the link'.");
  }

  const text = await res.text();
  return text.length;
}

async function sinhronizirajProjekt(id) {
  const projekt = dohvatiProjektPoId(id);
  if (!projekt || !projekt.gdocUrl) {
    alert("This project has no Google Doc URL specified.");
    return;
  }

  try {
    const docSlova = await dohvatiBrojSlovaIzGDoca(projekt.gdocUrl);
    
    projekt.slovaPrijevod = docSlova;
    projekt.odradjeno = parseFloat((docSlova / 1800).toFixed(2));
    projekt.lastSynced = new Date().toISOString();

    azurirajProjektUStorage(projekt);
    
    if (typeof renderDashboard === 'function') {
      renderDashboard();
    }

    alert(`Refreshed! Translation contains ${docSlova.toLocaleString()} characters (${projekt.odradjeno} pages).`);
  } catch (err) {
    alert("Sync error: " + err.message);
  }
}

const STORAGE_KEY = 'mojih1500_projekti';

async function dohvatiSveProjekte() {
  try {
    const db = await otvoriBazu();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rez = request.result || [];
        console.log(`Fetched ${rez.length} projects from IndexedDB.`);
        resolve(rez);
      };

      request.onerror = (event) => {
        console.error("Error fetching projects:", event.target.error);
        reject(event.target.error);
      };
    });
  } catch (err) {
    console.error("Error in dohvatiSveProjekte:", err);
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
        console.log("Project deleted from IndexedDB:", id);
        resolve(true);
      };
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error("Error deleting project:", err);
  }
}

async function azurirajProjektUStorage(projekt) {
  await spremiUStorage(projekt);
}

async function renderDashboard() {
  const container = document.getElementById('dashboard');
  if (!container) return;

  const projekti = await dohvatiSveProjekte();

  if (!projekti || projekti.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px; color: #666;">
        <h3>No active projects</h3>
        <p>Click the "+ New Project" button at the top to add your first translation.</p>
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

function kreirajHTMLKarticuProjekta(p) {
  const ukupnoKartica = parseFloat(p.ukupno) || 0;
  const odradjenoKartica = parseFloat(p.odradjeno) || 0;
  
  const postotak = ukupnoKartica > 0 
    ? Math.min(100, (odradjenoKartica / ukupnoKartica) * 100).toFixed(1) 
    : 0;

  const honorarPoKartici = parseFloat(p.honorar) || 0;
  const ukupnoEura = (ukupnoKartica * honorarPoKartici).toFixed(2);
  const zaradjenoEura = (odradjenoKartica * honorarPoKartici).toFixed(2);

  const ritamInfo = izracunajRitamIRok(p);

  const zadnjiSyncText = p.lastSynced 
    ? new Date(p.lastSynced).toLocaleString('en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Never';

  const coverHtml = p.naslovnicaBase64 
    ? `<img src="${p.naslovnicaBase64}" alt="Cover" class="card-cover-img" />`
    : `<div class="card-cover-placeholder"><span>No<br>image</span></div>`;

  return `
    <div class="card project-card" id="project-card-${p.id}">
      <div class="card-header-layout">
        ${coverHtml}
        
        <div class="card-main-info">
          <div class="card-title-row">
            <div>
              <h3 class="project-title">${p.naslov || 'Untitled project'}</h3>
              ${p.klijent ? `<span class="project-client">🏢 ${p.klijent}</span>` : ''}
            </div>
            
            <div class="card-actions-dropdown">
              <button class="btn-icon" title="Edit" onclick="otvoriFormuZaUređivanje('${p.id}')">✏️</button>
              <button class="btn-icon" title="Delete" onclick="obrisiProjektIRerender('${p.id}')">🗑️</button>
            </div>
          </div>

          <div class="sync-status-bar">
            <span>🔄 Last sync: <strong>${zadnjiSyncText}</strong></span>
            ${p.gdocUrl ? `
              <button class="btn-sync-small" onclick="sinhronizirajProjekt('${p.id}')" title="Pull latest status from Google Doc">
                Sync GDoc
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-labels">
          <span>Completed: <strong>${odradjenoKartica.toFixed(2)}</strong> / ${ukupnoKartica.toFixed(2)} pages</span>
          <span><strong>${postotak}%</strong></span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${postotak}%;"></div>
        </div>
      </div>

      <div class="grid-2 card-stats-grid">
        <div class="stat-box">
          <small>Financial summary</small>
          <div><strong>€${zaradjenoEura}</strong> / €${ukupnoEura}</div>
        </div>

        <div class="stat-box">
          <small>Pace to deadline</small>
          <div><strong>${ritamInfo.potrebnoDnevno}</strong> pages/day (${ritamInfo.preostaloDana} d.)</div>
        </div>
      </div>
    </div>
  `;
}

function izracunajRitamIRok(p) {
  if (!p.rok) return { preostaloDana: 0, potrebnoDnevno: 0 };

  const danas = new Date();
  danas.setHours(0, 0, 0, 0);

  const rokDatum = new Date(p.rok);
  rokDatum.setHours(0, 0, 0, 0);

  const diffTime = rokDatum - danas;
  const ukupanBrojDana = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  let radniDani = ukupanBrojDana;

  if (p.vikend === 'ne') {
    radniDani = 0;
    let tempDate = new Date(danas);
    while (tempDate <= rokDatum) {
      const dayOfWeek = tempDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
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

async function obrisiProjektIRerender(id) {
  if (confirm("Are you sure you want to delete this project?")) {
    await obrisiProjektIzStoragea(id);
    await renderDashboard();
  }
}

function toggleFormaProjekta(forceClose = false) {
  const container = document.getElementById('forma-projekt-container');
  const btnNovi = document.getElementById('btn-novi-projekt');
  const form = document.getElementById('form-projekt');

  if (!container) return;

  const jeOtvoreno = container.style.display !== 'none' && container.style.display !== '';

  if (jeOtvoreno || forceClose) {
    container.style.display = 'none';
    if (btnNovi) btnNovi.innerText = '+ New Project';
    ocistiFormuProjekta();
  } else {
    ocistiFormuProjekta();
    container.style.display = 'block';
    if (btnNovi) btnNovi.innerText = '✕ Close Form';
    
    container.scrollIntoView({ behavior: 'smooth' });
  }
}

async function otvoriFormuZaUređivanje(id) {
 const p = await dohvatiProjektPoId(id);
  if (!p) return;

  const container = document.getElementById('forma-projekt-container');
  if (container) container.style.display = 'block';

  const btnNovi = document.getElementById('btn-novi-projekt');
  if (btnNovi) btnNovi.innerText = '✕ Close Form';

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

  const lblOrigSlova = document.getElementById('lbl-slova-orig');
  const lblDocSlova = document.getElementById('lbl-slova-doc');
  if (lblOrigSlova) lblOrigSlova.innerText = (p.slovaOriginal || 0).toLocaleString();
  if (lblDocSlova) lblDocSlova.innerText = (p.slovaPrijevod || 0).toLocaleString();

  const metrikaPreview = document.getElementById('metrika-preview');
  if (metrikaPreview) metrikaPreview.style.display = 'block';

  container.scrollIntoView({ behavior: 'smooth' });
}

function ocistiFormuProjekta() {
  const form = document.getElementById('form-projekt');
  if (form) form.reset();

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

async function izveziSigurnosnuKopiju() {
  try {
    const db = await otvoriBazu();

    const txP = db.transaction(STORE_NAME, 'readonly');
    const projekti = await new Promise((res, rej) => {
      const req = txP.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    const txU = db.transaction(UNOSI_STORE, 'readonly');
    const unosi = await new Promise((res, rej) => {
      const req = txU.objectStore(UNOSI_STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    const backupData = {
      version: DB_VERSION,
      datum: new Date().toISOString(),
      projekti: projekti,
      unosi: unosi
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mojih1500_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

  } catch (err) {
    console.error("Error exporting backup:", err);
    alert("Backup export failed.");
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
        throw new Error("File structure is invalid.");
      }

      const db = await otvoriBazu();

      const txP = db.transaction(STORE_NAME, 'readwrite');
      const storeP = txP.objectStore(STORE_NAME);
      for (const p of data.projekti) {
        storeP.put(p);
      }

      if (data.unosi && Array.isArray(data.unosi)) {
        const txU = db.transaction(UNOSI_STORE, 'readwrite');
        const storeU = txU.objectStore(UNOSI_STORE);
        for (const u of data.unosi) {
          storeU.put(u);
        }
      }

      alert("Backup successfully restored!");
      await ucitajDashboard();

    } catch (err) {
      console.error("Error importing backup:", err);
      alert("Failed to load backup. Ensure the file is valid JSON.");
    } finally {
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
      alert("Project has no Google Doc URL set for synchronization.");
      return;
    }

    const docIdMatch = p.gdocUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!docIdMatch) {
      alert("Invalid Google Doc URL!");
      return;
    }

    const docId = docIdMatch[1];
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const response = await fetch(exportUrl);
    if (!response.ok) throw new Error("Could not fetch Google Doc text.");

    const text = await response.text();
    const slovaPrijevod = text.length;

    p.slovaPrijevod = slovaPrijevod;
    p.lastSynced = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    await spremiUStorage(p);
    await ucitajDashboard();

  } catch (err) {
    console.error("Sync error:", err);
    alert("Sync failed. Check if Google Doc sharing is set to 'Anyone with the link can view'.");
  }
}

async function rucniUnosZnakova(id) {
  try {
    const db = await otvoriBazu();
    
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const p = await new Promise((res, rej) => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!p) return;

    const trenutnoSlova = p.slovaPrijevod || 0;
    const noviUnos = prompt(
      `Current character count (with spaces) for "${p.naslov}": ${trenutnoSlova.toLocaleString('en-US')}\n\nEnter new total character count:`,
      trenutnoSlova
    );

    if (noviUnos === null || noviUnos.trim() === '') return;

    const noviBrojSlova = parseInt(noviUnos.replace(/\s+/g, ''), 10);

    if (isNaN(noviBrojSlova) || noviBrojSlova < 0) {
      alert("Please enter a valid positive number!");
      return;
    }

    p.slovaPrijevod = noviBrojSlova;
    p.lastSynced = 'Manual (' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ')';

    await spremiUStorage(p);
    await ucitajDashboard();

  } catch (err) {
    console.error("Error updating manual entry:", err);
    alert("Could not update character count.");
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
  alert('Settings saved successfully!');
}

let odabranaGodinaAnalitike = new Date().getFullYear();

async function ucitajAnalitiku() {
  prikaziStranicu('analytics-page');
  popuniGodineOdabira();
  await generirajTablicuAnalitike();
}

function popuniGodineOdabira() {
  const select = document.getElementById('odabir-godine');
  select.innerHTML = '';
  
  const trenutnaGodina = new Date().getFullYear();
  for (let g = trenutnaGodina - 2; g <= trenutnaGodina + 2; g++) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = `Year ${g}`;
    if (g === odabranaGodinaAnalitike) opt.selected = true;
    select.appendChild(opt);
  }
}

async function promijeniGodinuAnalitike() {
  odabranaGodinaAnalitike = parseInt(document.getElementById('odabir-godine').value);
  await generirajTablicuAnalitike();
}

async function generirajTablicuAnalitike() {
  const tbody = document.getElementById('analitika-tablica-body');
  if (!tbody) return;
  tbody.innerHTML = '';

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
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
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

      if (datumPocetka <= krajMjeseca && datumRoka >= pocetakMjeseca) {

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

        let kasni = false;
        const ukupnoKartica = parseFloat(p.ukupnoKartica) || 0;
        if (datumRoka < danas && (ukupnoKartica === 0 || odradjenoKartica < ukupnoKartica)) {
          kasni = true;
        }

        const nazivKlijenta = p.klijent || p.izdavac || p.narucitelj || '-';

        aktivniProjektiUMjesecu.push({
          naslov: p.naslov || p.naziv || 'Unnamed project',
          izdavac: nazivKlijenta,
          bruto: trenutnoBruto,
          kasni: kasni,
          jeZavrsetakProjekta: jeZavrsetakProjekta
        });
      }
    });

    const imeMjeseca = naziviMjeseci[m];
    const zavrseniUOvomMjesecu = aktivniProjektiUMjesecu.filter(p => p.jeZavrsetakProjekta);
    const mjesecniBrutoZavrsenih = zavrseniUOvomMjesecu.reduce((sum, item) => sum + item.bruto, 0);

    let mjesecniNetoObrt = 0;
    if (postavke.modelDoprinosa === 'obrt') {
      if (zavrseniUOvomMjesecu.length > 0) {
        mjesecniNetoObrt = mjesecniBrutoZavrsenih - postavke.fiksniIznos;
      } else {
        mjesecniNetoObrt = 0;
      }
      godisnjiNetoUkupno += mjesecniNetoObrt;
    }

    if (aktivniProjektiUMjesecu.length === 0) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: bold; color: #555;">${imeMjeseca}</td>
        <td style="padding: 10px 12px; color: #aaa;" colspan="2"><em>No active projects</em></td>
        <td style="padding: 10px 12px; text-align: right; color: #aaa;">€0.00</td>
        <td style="padding: 10px 12px; color: #aaa;">-</td>
      `;
      tbody.appendChild(tr);
    } else {
      aktivniProjektiUMjesecu.forEach((proj, idx) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';

        const ukupnoRedovaUMjesecu = postavke.modelDoprinosa === 'obrt' 
          ? aktivniProjektiUMjesecu.length + 1 
          : aktivniProjektiUMjesecu.length;

        let tdMjesec = idx === 0 
          ? `<td rowspan="${ukupnoRedovaUMjesecu}" style="padding: 10px 12px; font-weight: bold; color: #333; vertical-align: top; background: #fafafa;">${imeMjeseca}</td>` 
          : '';

        let tdProjekt = `<td style="padding: 10px 12px; font-weight: 500;">${proj.naslov}</td>`;
        let tdIzdavac = `<td style="padding: 10px 12px; color: #666;">${proj.izdavac}</td>`;

        let tdNeto = '';

        if (postavke.modelDoprinosa === 'obrt') {
          if (proj.jeZavrsetakProjekta) {
            tdNeto = `<td style="padding: 10px 12px; text-align: right; font-weight: 500; color: #333;">
              €${proj.bruto.toFixed(2)}
            </td>`;
          } else {
            tdNeto = `<td style="padding: 10px 12px; text-align: right; color: #888; font-style: italic;">
              n/a
            </td>`;
          }
        } else {
          if (proj.jeZavrsetakProjekta) {
            const stopaDoprinosa = (postavke.postotakIznos || 0) / 100;
            const projNeto = proj.bruto * (1 - stopaDoprinosa);
            godisnjiNetoUkupno += projNeto;

            tdNeto = `<td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #2e7d32;">
              €${projNeto.toFixed(2)}
            </td>`;
          } else {
            tdNeto = `<td style="padding: 10px 12px; text-align: right; color: #888; font-style: italic;">
              n/a
            </td>`;
          }
        }

        let opaskaHtml = proj.kasni 
          ? `<span style="color: #c62828; font-weight: bold; background: #fde8e8; padding: 2px 6px; border-radius: 4px; font-size: 0.85em;">⚠️ Project delayed</span>`
          : `<span style="color: #2e7d32; font-size: 0.85em;">On schedule</span>`;

        let tdOpaska = `<td style="padding: 10px 12px;">${opaskaHtml}</td>`;

        tr.innerHTML = tdMjesec + tdProjekt + tdIzdavac + tdNeto + tdOpaska;
        tbody.appendChild(tr);
      });

      if (postavke.modelDoprinosa === 'obrt') {
        const trSuma = document.createElement('tr');
        trSuma.style.background = '#f9fbe7';
        trSuma.style.borderBottom = '2px solid #e0e0e0';

        const opisPrikaz = zavrseniUOvomMjesecu.length > 0 
          ? `<em>Total net for ${imeMjeseca} (after -€${postavke.fiksniIznos.toFixed(2)} contributions)</em>`
          : `<em>No projects completed this month</em>`;

        const iznosBoja = mjesecniNetoObrt >= 0 ? '#2e7d32' : '#c62828';
        const iznosPrikaz = zavrseniUOvomMjesecu.length > 0 ? `€${mjesecniNetoObrt.toFixed(2)}` : '€0.00';

        trSuma.innerHTML = `
          <td colspan="2" style="padding: 8px 12px; font-size: 0.88em; color: #555;">${opisPrikaz}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: ${iznosBoja};">${iznosPrikaz}</td>
          <td style="padding: 8px 12px; font-size: 0.82em; color: #757575; font-style: italic;">Fixed monthly contributions applied</td>
        `;
        tbody.appendChild(trSuma);
      }
    }
  }

  const ukupnoEl = document.getElementById('analitika-ukupno-neto');
  if (ukupnoEl) {
    ukupnoEl.textContent = `€${godisnjiNetoUkupno.toFixed(2)}`;
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

function prikaziStranicu(pageId) {
  const sveStranice = document.querySelectorAll('.page-content');
  
  sveStranice.forEach(page => {
    page.style.display = 'none';
  });

  const trazenaStranica = document.getElementById(pageId);
  if (trazenaStranica) {
    trazenaStranica.style.display = 'block';
  }

  window.scrollTo(0, 0);
}

function prikaziDashboard() {
  prikaziStranicu('dashboard-page');
  ucitajDashboard();
}