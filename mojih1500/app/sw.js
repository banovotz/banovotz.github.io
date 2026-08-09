const CACHE_NAME = 'kartaza-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalacija Service Workera i spremanje datoteka u cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Aktivacija i čišćenje starih verzija cachea
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Dohvaćanje resursa: Prvo traži u Cacheu, ako nema - ide na Mrežu
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});

let trenutniProjektId = null; // ID projekta kojem dodajemo unos

// 1. Prebacivanje između skeniranja i ručnog unosa
function odaberiNacinUnosa(nacin) {
  const sekcijaScan = document.getElementById('sekcija-skeniranje');
  const sekcijaRucno = document.getElementById('sekcija-rucno');
  const tabScan = document.getElementById('tab-scan-btn');
  const tabManual = document.getElementById('tab-manual-btn');

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
    
    // Automatski postavi današnji datum u ručnu formu kao default
    document.getElementById('u-datum').value = new Date().toISOString().split('T')[0];
  }
}

// 2. Obrada fotografije preko Tesseract.js OCR-a
async function obradiSliku(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Otvori Modal i prikaži Loading
  otvoriOcrModal();

  try {
    const worker = await Tesseract.createWorker('eng'); // 'eng' najbolje prepoznaje brojke i standardne znakove
    const ret = await worker.recognize(file);
    await worker.terminate();

    // Ekstrakcija brojeva iz prepoznatog teksta
    parsrajOcrTekst(ret.data.text);
  } catch (err) {
    alert('Greška prilikom čitanja slike. Pokušajte ponovno ili unesite ručno.');
    zatvoriOcrModal();
  }
  
  // Očisti input kako bi se mogla ponovno odabrati ista slika ako zatreba
  event.target.value = '';
}

// 3. Pronalaženje broja znakova s razmacima pomoću regexa
function parsrajOcrTekst(tekst) {
  // Očisti tekst i pronađi sve nizove brojeva (uključujući one s točkama/razmacima npr. 14.500 ili 14 500)
  const linije = tekst.split('\n');
  let pronadjeniBrojevi = [];

  linije.forEach(linija => {
    // Tražimo uzorke brojeva s više od 3 znamenke
    const mecevi = linija.match(/\b\d{1,3}(?:[.,\s]\d{3})+\b|\b\d{4,6}\b/g);
    if (mecevi) {
      mecevi.forEach(m => {
        // Pretvori u čisti broj (ukloni točke, zareze i razmake)
        const cistiBroj = parseInt(m.replace(/[.,\s]/g, ''), 10);
        if (!isNaN(cistiBroj) && cistiBroj > 50) { 
          pronadjeniBrojevi.push(cistiBroj);
        }
      });
    }
  });

  // Uzmi najveći detektirani broj (najčešće je to broj znakova s razmacima u Word Countu)
  const konacniZnakovi = pronadjeniBrojevi.length > 0 ? Math.max(...pronadjeniBrojevi) : 0;
  
  // Izračunaj kartice (Znakovi / 1800)
  const izracunatoKartica = (konacniZnakovi / 1800).toFixed(2);

  // Prikaz u Modalu za potvrdu
  document.getElementById('detektirano-znakova').innerText = konacniZnakovi.toLocaleString('hr-HR');
  document.getElementById('izracunato-kartica').value = izracunatoKartica;
  document.getElementById('danasnji-datum-prikaz').innerText = new Date().toLocaleDateString('hr-HR');

  // Sakrij spinner, prikaži rezultat
  document.getElementById('ocr-loading').classList.add('sakriveno');
  document.getElementById('ocr-result').classList.remove('sakriveno');
}

// 4. Modal Upravljanje
function otvoriOcrModal() {
  document.getElementById('ocr-modal').classList.remove('sakriveno');
  document.getElementById('ocr-loading').classList.remove('sakriveno');
  document.getElementById('ocr-result').classList.add('sakriveno');
}

function zatvoriOcrModal() {
  document.getElementById('ocr-modal').classList.add('sakriveno');
}

// 5. Potvrda i spremanje pod DANAŠNJIM datumom
function potvrdiSkeniraniUnos() {
  const kartice = parseFloat(document.getElementById('izracunato-kartica').value);
  const danas = new Date().toISOString().split('T')[0];

  if (isNaN(kartice) || kartice <= 0) {
    alert('Molimo unesite ispravan broj kartica.');
    return;
  }

  // Poziv vaše postojeće funkcije za spremanje unosa u IndexedDB
  spremiNoviUnosUBazu(trenutniProjektId, danas, kartice);

  zatvoriOcrModal();
}