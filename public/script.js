// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            nav.classList.toggle('active');
            this.classList.toggle('active');
        });
    }
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = target.offsetTop - headerHeight - 20;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                if (nav) nav.classList.remove('active');
                if (mobileMenuBtn) mobileMenuBtn.classList.remove('active');
            }
        });
    });
    
    // Material chip filtering
    const materialChips = document.querySelectorAll('.material-chip');
    const productCards = document.querySelectorAll('.product-card');
    
    materialChips.forEach(chip => {
        chip.addEventListener('click', function(e) {
            e.preventDefault();
            const material = this.dataset.material;
            
            // Update active state
            materialChips.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            // Filter products
            productCards.forEach(card => {
                if (material === 'all' || card.dataset.material === material) {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            });
            
            // Scroll to compare section
            const compareSection = document.querySelector('#compare');
            if (compareSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                window.scrollTo({
                    top: compareSection.offsetTop - headerHeight - 20,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Search functionality
    const searchInput = document.querySelector('#hero-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            
            productCards.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (text.includes(query)) {
                    card.style.display = 'block';
                    card.style.opacity = '1';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
    
    // Filter controls
    const applyFiltersBtn = document.querySelector('#apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            const purity = document.querySelector('#filter-purity').value;
            const diameter = document.querySelector('#filter-diameter').value;
            const priceRange = document.querySelector('#filter-price').value;
            
            productCards.forEach(card => {
                let show = true;
                const specs = card.querySelector('.product-specs').textContent.toLowerCase();
                const price = parseInt(card.querySelector('.price').textContent.replace(/[$,]/g, ''));
                
                // Check purity
                if (purity && !specs.includes(purity)) {
                    show = false;
                }
                
                // Check diameter
                if (diameter && !specs.includes(diameter + '"') && !specs.includes(diameter + ' inch')) {
                    show = false;
                }
                
                // Check price range
                if (priceRange) {
                    const [min, max] = priceRange.split('-').map(p => p === '+' ? Infinity : parseInt(p));
                    if (price < min || (max !== Infinity && price > max)) {
                        show = false;
                    }
                }
                
                card.style.display = show ? 'block' : 'none';
            });
        });
    }
    
    // Sort products
    const sortSelect = document.querySelector('#sort-products');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            const grid = document.querySelector('.products-grid');
            const cards = Array.from(productCards);
            
            cards.sort((a, b) => {
                const priceA = parseInt(a.querySelector('.price').textContent.replace(/[$,]/g, ''));
                const priceB = parseInt(b.querySelector('.price').textContent.replace(/[$,]/g, ''));
                
                switch (this.value) {
                    case 'price-low':
                        return priceA - priceB;
                    case 'price-high':
                        return priceB - priceA;
                    case 'purity':
                        const purityA = parseFloat(a.querySelector('.spec').textContent);
                        const purityB = parseFloat(b.querySelector('.spec').textContent);
                        return purityB - purityA;
                    default:
                        return 0;
                }
            });
            
            cards.forEach(card => grid.appendChild(card));
        });
    }
    
    // Form submission
    const quoteForm = document.querySelector('.quote-form');
    if (quoteForm) {
        quoteForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            console.log('Quote request submitted:', data);
            
            alert('Thank you for your quote request! We\'ll get back to you within 24 hours with competitive pricing.');
            this.reset();
        });
    }
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements
    document.querySelectorAll('.product-card, .step-card, .material-chip').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
    
    // Phone number formatting
    const phoneInput = document.querySelector('#phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            if (value.length >= 6) {
                value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
            } else if (value.length >= 3) {
                value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
            }
            
            e.target.value = value;
        });
    }
});

// Add mobile nav styles
const style = document.createElement('style');
style.textContent = `
    @media (max-width: 768px) {
        .nav {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            flex-direction: column;
            padding: 20px;
        }
        
        .nav.active {
            display: flex;
        }
        
        .nav a {
            padding: 15px 0;
            border-bottom: 1px solid var(--border);
        }
        
        .mobile-menu-btn.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
        }
        
        .mobile-menu-btn.active span:nth-child(2) {
            opacity: 0;
        }
        
        .mobile-menu-btn.active span:nth-child(3) {
            transform: rotate(-45deg) translate(6px, -6px);
        }
    }
`;
document.head.appendChild(style);
