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
    const mailBtn = document.querySelector('.dynamic-mail');
    
    if (mailBtn) {
        function revealEmail() {
            const user = mailBtn.getAttribute('data-user');
            const domain = mailBtn.getAttribute('data-domain');
            
            // Reconstruct link on the fly only when interacting
            if (user && domain && !mailBtn.href.startsWith('mailto:')) {
                mailBtn.href = `mailto:${user}@${domain}`;
            }
        }

        // Trigger assembly when the user shows intent to interact
        mailBtn.addEventListener('mouseenter', revealEmail);
        mailBtn.addEventListener('focus', revealEmail);
        mailBtn.addEventListener('touchstart', revealEmail);
    }
});