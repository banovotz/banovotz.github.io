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



document.addEventListener('DOMContentLoaded', () => {
    // Select all protected email elements on the page
    const mailButtons = document.querySelectorAll('.dynamic-mail');
    
    mailButtons.forEach(btn => {
        function revealEmail() {
            const user = btn.getAttribute('data-user');
            const domain = btn.getAttribute('data-domain');
            
            // Reconstruct link on the fly only when interacting
            if (user && domain && !btn.href.startsWith('mailto:')) {
                btn.href = `mailto:${user}@${domain}`;
            }
        }

        // Trigger assembly when the user shows intent to interact
        btn.addEventListener('mouseenter', revealEmail);
        btn.addEventListener('focus', revealEmail);
        btn.addEventListener('touchstart', revealEmail);
    });
});

document.addEventListener("DOMContentLoaded", function() {
    const text = "BRIDGING WORLDS ACROSS THE REPUBLIC OF LETTERS";
    const speed = 50; // Brzina tipkanja
    let index = 0;

    function typeWriter() {
        if (index < text.length) {
            document.getElementById("typewriter").innerHTML += text.charAt(index);
            index++;
            setTimeout(typeWriter, speed);
        } else {
            // Kada tekst završi s ispisom, ukloni kursor
            const cursor = document.getElementById("typewriter-cursor");
            if (cursor) {
                cursor.remove();
            }
        }
    }

    // Pokreni efekt tipkanja
    typeWriter();
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
        fetch("/prijevodi.html")
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