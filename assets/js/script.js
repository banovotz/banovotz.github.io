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