document.addEventListener('DOMContentLoaded', () => {
    const landingPage = document.getElementById('landing-page');
    const arCameraPage = document.getElementById('ar-camera-page');
    const tryOnButton = document.getElementById('try-on-button');
    const bookButton = document.getElementById('book-button');
    const backToLandingButton = document.getElementById('back-to-landing');

    const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const ctx = canvasElement.getContext('2d');
    const colorSwatches = document.querySelectorAll('.color-swatch');

    let currentNailColor = '#FF6B6B'; // Početna boja

    // --- Funkcije za navigaciju ---
    tryOnButton.addEventListener('click', () => {
        landingPage.classList.add('hidden');
        arCameraPage.classList.remove('hidden');
        startCamera();
    });

    bookButton.addEventListener('click', () => {
        // Ovdje bi se integrirao Google Calendar appointment schedule
        alert('Otvori Google Calendar za narudžbe! (Funkcionalnost narudžbe uskoro dostupna)');
        // Primjer: window.open('LINK_ZA_GOOGLE_CALENDAR_SCHEDULE', '_blank');
    });

    backToLandingButton.addEventListener('click', () => {
        stopCamera();
        arCameraPage.classList.add('hidden');
        landingPage.classList.remove('hidden');
    });

    // --- Logika za AR kameru ---
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); // Koristi prednju kameru
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                // Postavi veličinu platna prema videu
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                requestAnimationFrame(drawLoop); // Pokreni renderiranje
            };
        } catch (err) {
            console.error("Greška pri pristupu kameri: ", err);
            alert("Nismo uspjeli pristupiti kameri. Molimo provjerite dopuštenja.");
        }
    }

    function stopCamera() {
        if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }

    // AR simulacija (placeholder)
    function drawLoop() {
        if (videoElement.paused || videoElement.ended) {
            return;
        }

        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Crtanje video streama na canvas (opcionalno, ako želiš dodatne efekte na videu)
        // ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // --- OVDJE IDE LOGIKA ZA DETEKCIJU NOKTIJU I AR PREKLAPANJE ---
        //
        // Ovdje bi se koristile biblioteke poput TensorFlow.js i predtrenirani modeli
        // za detekciju ruku i noktiju. Nakon što se detektiraju obrisi noktiju,
        // popunili bi se odabranom bojom.
        //
        // Primjer (Vrlo pojednostavljen, ne pravi AR):
        // Za demonstraciju, simulirat ćemo crtanje oblika noktiju.
        // U stvarnosti, ovo bi dolazilo iz rezultata modela strojnog učenja.
        
        ctx.fillStyle = currentNailColor;
        ctx.globalAlpha = 0.7; // Malo prozirnosti za "lak" efekt

        // Simulacija oblika nokta (trebalo bi biti dinamično, iz modela)
        // Ovo je samo primjer, ne detektira stvarno nokte
        // Očekivali bismo da ovdje imate koordinate i obrise svakog nokta
        // iz modela za detekciju ruku/prstiju.
        
        // Simulacija za 5 prstiju na sredini ekrana
        const centerX = canvasElement.width / 2;
        const centerY = canvasElement.height / 2;
        const nailWidth = canvasElement.width * 0.08;
        const nailHeight = canvasElement.height * 0.12;

        // Crtanje pravokutnika kao placeholder za nokte
        // U stvarnosti, bio bi to složeniji put (Path2D) koji prati obris nokta
        
        // Palac
        drawSimulatedNail(centerX - nailWidth * 2.5, centerY + nailHeight * 0.5, nailWidth * 0.8, nailHeight * 0.8, -20);
        // Kažiprst
        drawSimulatedNail(centerX - nailWidth * 1.2, centerY - nailHeight * 0.8, nailWidth, nailHeight, -10);
        // Srednji prst
        drawSimulatedNail(centerX, centerY - nailHeight * 1.2, nailWidth, nailHeight, 0);
        // Prstenjak
        drawSimulatedNail(centerX + nailWidth * 1.2, centerY - nailHeight * 0.8, nailWidth, nailHeight, 10);
        // Mali prst
        drawSimulatedNail(centerX + nailWidth * 2.5, centerY + nailHeight * 0.5, nailWidth * 0.8, nailHeight * 0.8, 20);

        ctx.globalAlpha = 1.0; // Resetiraj transparentnost

        requestAnimationFrame(drawLoop); // Nastavi crtanje
    }

    // Pomoćna funkcija za simuliranje crtanja nokta
    function drawSimulatedNail(x, y, width, height, rotationDeg) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotationDeg * Math.PI / 180);
        ctx.beginPath();
        // Simulacija zaobljenog vrha nokta
        ctx.ellipse(0, 0, width / 2, height / 2, 0, Math.PI, 0, false);
        ctx.lineTo(width / 2, height / 2 - height);
        ctx.lineTo(-width / 2, height / 2 - height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }


    // --- Logika za odabir boje ---
    colorSwatches.forEach(swatch => {
        swatch.style.backgroundColor = swatch.dataset.color; // Postavi boju
        swatch.addEventListener('click', () => {
            // Ukloni 'active' klasu sa svih
            colorSwatches.forEach(s => s.classList.remove('active'));
            // Dodaj 'active' klasu trenutnom
            swatch.classList.add('active');
            currentNailColor = swatch.dataset.color;
            // Nije potrebno ponovno pokretati loop, samo će u sljedećem frameu biti nova boja
        });
    });

    // Postavi prvu boju kao aktivnu inicijalno
    if (colorSwatches.length > 0) {
        colorSwatches[0].classList.add('active');
    }
});