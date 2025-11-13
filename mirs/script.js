document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling za navigacijske linkove
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Ovdje možete dodati više JavaScript funkcionalnosti ako bude potrebno
    // Npr. validacija forme, animacije, karusel slika, itd.
});

document.addEventListener('DOMContentLoaded', () => {
    const mainProductImage = document.getElementById('mainProductImage');
    const thumbnails = document.querySelectorAll('.thumbnail');

    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener('click', function() {
            // Ukloni 'active' klasu sa svih sličica
            thumbnails.forEach(t => t.classList.remove('active'));

            // Dodaj 'active' klasu kliknutoj sličici
            this.classList.add('active');

            // Promijeni src glavne slike na temelju data-image atributa kliknute sličice
            mainProductImage.src = this.dataset.image;
        });
    });
});

