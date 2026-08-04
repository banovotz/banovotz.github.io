document.addEventListener('DOMContentLoaded', () => {
    const track = document.querySelector('.slider-track');
    const cards = document.querySelectorAll('.translation-card');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    let currentIndex = 0;

    function getCardsPerView() {
        if (window.innerWidth <= 600) return 1;
        if (window.innerWidth <= 992) return 2;
        return 3;
    }

    function updateSlider() {
        const cardsPerView = getCardsPerView();
        const maxIndex = cards.length - cardsPerView;
        
        // Boundaries safety
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        if (currentIndex < 0) currentIndex = 0;
        
        const cardWidth = cards[0].getBoundingClientRect().width;
        const gap = 24; // matches CSS file gap structure
        
        const moveAmount = currentIndex * (cardWidth + gap);
        track.style.transform = `translateX(-${moveAmount}px)`;
        
        // Toggle arrow visibility limits dynamically
        prevBtn.style.opacity = currentIndex === 0 ? '0.3' : '1';
        prevBtn.style.pointerEvents = currentIndex === 0 ? 'none' : 'auto';
        
        nextBtn.style.opacity = currentIndex === maxIndex ? '0.3' : '1';
        nextBtn.style.pointerEvents = currentIndex === maxIndex ? 'none' : 'auto';
    }

    nextBtn.addEventListener('click', () => {
        const cardsPerView = getCardsPerView();
        if (currentIndex < cards.length - cardsPerView) {
            currentIndex++;
            updateSlider();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateSlider();
        }
    });

    // Re-calculate math properties if window orientation adjusts mid-session
    window.addEventListener('resize', updateSlider);
    
    // Fire setup once layout maps
    updateSlider();
});

document.addEventListener("DOMContentLoaded", function() {
  const openBtn = document.getElementById("open-translations-modal");
  const closeBtn = document.getElementById("close-translations-modal");
  const modal = document.getElementById("translations-modal");
  const modalBody = document.getElementById("modal-body");
  
  let isLoaded = false;

  if (openBtn && modal) {
    // Otvaranje modala
    openBtn.addEventListener("click", function() {
      // 1. Prvo uklanjamo aria-hidden / inert prije nego modal postane vidljiv
      modal.removeAttribute("aria-hidden");
      modal.removeAttribute("inert");
      modal.classList.add("is-active");
      
      document.body.style.overflow = "hidden"; // Onemogući skrolanje pozadine

      // 2. Preusmjeravanje fokusa na gumb za zatvaranje radi pristupačnosti
      if (closeBtn) closeBtn.focus();

      // 3. Dohvaćanje sadržaja s čistom putanjom
      if (!isLoaded) {
        fetch("/prijevodi/")
          .then(response => {
            if (!response.ok) throw new Error("Mrežna pogreška");
            return response.text();
          })
          .then(htmlText => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, "text/html");
            const content = doc.querySelector("main") || doc.body;

            modalBody.innerHTML = content.innerHTML;
            isLoaded = true;
          })
          .catch(error => {
            modalBody.innerHTML = "<p>Došlo je do pogreške prilikom učitavanja kataloga.</p>";
            console.error("Fetch error:", error);
          });
      }
    });

    // Funkcija za zatvaranje modala
    const closeModal = () => {
      modal.classList.remove("is-active");
      modal.setAttribute("aria-hidden", "true");
      modal.setAttribute("inert", ""); // Koristimo inert za potpuno skrivanje od interakcije
      document.body.style.overflow = ""; // Vrati skrolanje pozadine
      openBtn.focus(); // Vrati fokus na gumb koji je otvorio modal
    };

    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", function(event) {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape" && modal.classList.contains("is-active")) {
        closeModal();
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", function() {
  const modal = document.getElementById("translations-modal");

  // Pomoćna funkcija za zatvaranje modala (povežite s vašim postojećim kodom)
  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("is-active");
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("inert", "");
    document.body.style.overflow = ""; // Vraća skrolanje stranice
  };

  // Slušamo klikove unutar modala
  if (modal) {
    modal.addEventListener("click", function(event) {
      // Provjeravamo je li kliknut gumb koji vodi na #contact
      const contactLink = event.target.closest('a[href*="#contact"]');
      
      if (contactLink) {
        // 1. Ugasi modal
        closeModal();

        // 2. Ako smo već na početnoj stranici, napravi smooth scroll do sekcije
        const targetId = "contact";
        const targetSection = document.getElementById(targetId);

        if (targetSection && (window.location.pathname === "/" || window.location.pathname.endsWith("/index.html"))) {
          event.preventDefault(); // Spriječite nagli skok URL-a
          
          // Izvršavamo skrol nakon što se modal zatvori
          setTimeout(() => {
            targetSection.scrollIntoView({ behavior: "smooth" });
            history.pushState(null, null, "#contact"); // Ažurira URL bez skakanja
          }, 100);
        }
        // Ako je korisnik na nekoj drugoj podstranici (npr. /blog/), 
        // pustit će ga da prirodno ode na /#contact
      }
    });
  }
});

