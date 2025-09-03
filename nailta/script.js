import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elementi
    const landingPage = document.getElementById('landing-page');
    const arCameraPage = document.getElementById('ar-camera-page');
    const tryOnButton = document.getElementById('try-on-button');
    const bookButton = document.getElementById('book-button');
    const backToLandingButton = document.getElementById('back-to-landing');
    const loadingIndicator = document.getElementById('loading-indicator');

    const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    const colorSwatches = document.querySelectorAll('.color-swatch');

    // Varijable stanja
    let handLandmarker;
    let runningMode = "VIDEO";
    let animationFrameId;
    let currentNailColor = '#FF6B6B';

    // Konstante za indekse točaka na prstima
    const NAIL_LANDMARKS_INDICES = {
        thumb: [4, 3, 2],
        index: [8, 7, 6],
        middle: [12, 11, 10],
        ring: [16, 15, 14],
        pinky: [20, 19, 18],
    };

    // --- Inicijalizacija MediaPipe HandLandmarker-a ---
    const createHandLandmarker = async () => {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: runningMode,
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
        console.log("HandLandmarker je spreman.");
        // Sakrij indikator učitavanja i omogući gumb
        loadingIndicator.classList.add('hidden');
        tryOnButton.disabled = false;
        tryOnButton.innerText = "Pogledaj kako ti stoji";
    };

    // Pozovi inicijalizaciju čim se skripta učita
    tryOnButton.disabled = true;
    tryOnButton.innerText = "Učitavanje...";
    createHandLandmarker();


    // --- Funkcije za navigaciju i kontrolu kamere ---
    tryOnButton.addEventListener('click', () => {
        landingPage.classList.add('hidden');
        arCameraPage.classList.remove('hidden');
        startCamera();
    });

    bookButton.addEventListener('click', () => {
        alert('Otvori Google Calendar za narudžbe! (Funkcionalnost narudžbe uskoro dostupna)');
    });

    backToLandingButton.addEventListener('click', () => {
        stopCameraAndPredictions();
        arCameraPage.classList.add('hidden');
        landingPage.classList.remove('hidden');
    });

async function startCamera() {
    try {
        // Promjena 'user' u 'environment' za stražnju kameru
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); 
        videoElement.srcObject = stream;
        videoElement.addEventListener('loadeddata', predictWebcam);
    } catch (err) {
        console.error("Greška pri pristupu kameri: ", err);
        alert("Nismo uspjeli pristupiti kameri. Molimo provjerite dopuštenja.");
    }
}
    function stopCameraAndPredictions() {
        cancelAnimationFrame(animationFrameId); // Zaustavi petlju predikcija
        if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Očisti platno
    }

    // --- Glavna petlja za detekciju i iscrtavanje ---
    let lastVideoTime = -1;
    async function predictWebcam() {
        // Postavi veličinu platna prema videu (samo jednom)
        if (canvasElement.width !== videoElement.videoWidth) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }

        // Pokreni detekciju ako je video spreman
        if (videoElement.currentTime !== lastVideoTime) {
            lastVideoTime = videoElement.currentTime;
            const results = handLandmarker.detectForVideo(videoElement, performance.now());
            
            // Očisti prethodni frame
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            
            // Iscrtaj nokte ako su ruke detektirane
            if (results.landmarks && results.landmarks.length > 0) {
                for (const landmarks of results.landmarks) {
                    drawNails(landmarks);
                }
            }
        }
        
        // Nastavi petlju
        animationFrameId = requestAnimationFrame(predictWebcam);
    }

    // --- Funkcije za iscrtavanje noktiju ---
    function drawNails(landmarks) {
        ctx.fillStyle = currentNailColor;
        ctx.globalAlpha = 0.8; // Malo prozirnosti za "lak" efekt

        for (const finger in NAIL_LANDMARKS_INDICES) {
            const indices = NAIL_LANDMARKS_INDICES[finger];
            const tip = landmarks[indices[0]];
            const dip = landmarks[indices[1]];
            const pip = landmarks[indices[2]];

            if (tip && dip && pip) {
                // Konvertiraj normalizirane koordinate u koordinate platna
                const tip_canvas = { x: tip.x * canvasElement.width, y: tip.y * canvasElement.height };
                const dip_canvas = { x: dip.x * canvasElement.width, y: dip.y * canvasElement.height };
                const pip_canvas = { x: pip.x * canvasElement.width, y: pip.y * canvasElement.height };

                // Izračunaj parametre za iscrtavanje
                const nailLength = Math.hypot(tip_canvas.x - dip_canvas.x, tip_canvas.y - dip_canvas.y);
                const nailWidth = nailLength * 1.1; // Procjena širine
                const angle = Math.atan2(tip_canvas.y - pip_canvas.y, tip_canvas.x - pip_canvas.x) + Math.PI / 2;
                
                // Crtaj elipsu koja predstavlja nokat
                ctx.beginPath();
                ctx.ellipse(tip_canvas.x, tip_canvas.y, nailWidth / 2, nailLength / 2, angle, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0; // Resetiraj prozirnost
    }

    // --- Logika za odabir boje ---
    colorSwatches.forEach(swatch => {
        swatch.style.backgroundColor = swatch.dataset.color;
        swatch.addEventListener('click', () => {
            colorSwatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            currentNailColor = swatch.dataset.color;
        });
    });

    if (colorSwatches.length > 0) {
        colorSwatches[0].classList.add('active');
    }
});
