// Enhanced JavaScript for Raul Wesche Portfolio Website

document.addEventListener('DOMContentLoaded', function() {
    
    // =================
    // Mobile Navigation
    // =================
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const navbar = document.querySelector('.nav');

    // Toggle mobile menu
    hamburger?.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });

    // Close mobile menu when clicking nav links
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });

    // =================
    // Smooth Scrolling
    // =================
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 80;
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // =================
    // Scroll Effects
    // =================
    let lastScrollTop = 0;
    let ticking = false;

    function updateScrollEffects() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Navbar scroll effect
        if (scrollTop > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Parallax effect for sacred geometry
        const sacredGeometry = document.querySelector('.sacred-geometry');
        if (sacredGeometry) {
            const scrollPercent = scrollTop / (document.documentElement.scrollHeight - window.innerHeight);
            const rotateValue = scrollPercent * 360;
            sacredGeometry.style.transform = `translate(-50%, -50%) rotate(${rotateValue}deg)`;
        }

        // Active navigation highlighting
        updateActiveNavigation(scrollTop);
        
        // Fade in animations
        animateOnScroll();
        
        lastScrollTop = scrollTop;
        ticking = false;
    }

    function requestScrollUpdate() {
        if (!ticking) {
            requestAnimationFrame(updateScrollEffects);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestScrollUpdate, { passive: true });

    // =================
    // Active Navigation
    // =================
    function updateActiveNavigation(scrollTop) {
        const sections = document.querySelectorAll('section[id]');
        let currentSection = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;
            
            if (scrollTop >= sectionTop && scrollTop < sectionTop + sectionHeight) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    }

    // =================
    // Scroll Animations
    // =================
    function animateOnScroll() {
        const animateElements = document.querySelectorAll('.fade-in, .text-block, .gallery-item, .shop-item, .social-link, .info-card');
        
        animateElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.classList.add('visible');
            }
        });
    }

    // Add fade-in class to elements that should animate
    function initScrollAnimations() {
        const elementsToAnimate = [
            '.text-block',
            '.gallery-item', 
            '.shop-item',
            '.social-link',
            '.info-card',
            '.contact-card',
            '.book-mockup',
            '.announce-card'
        ];

        elementsToAnimate.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                element.classList.add('fade-in');
            });
        });
    }

    initScrollAnimations();

    // =================
    // Enhanced Interactions
    // =================
    
    // Gallery item hover effects
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Social link enhanced hover
    const socialLinks = document.querySelectorAll('.social-link');
    socialLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(15px) scale(1.02)';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0) scale(1)';
        });
    });

    // =================
    // Typewriter Effect for Hero
    // =================
    function typewriterEffect() {
        const heroTitle = document.querySelector('.hero-title');
        if (!heroTitle) return;

        const lines = heroTitle.querySelectorAll('.line');
        
        lines.forEach((line, index) => {
            const text = line.textContent;
            line.textContent = '';
            line.style.opacity = '1';
            
            setTimeout(() => {
                let charIndex = 0;
                const typeInterval = setInterval(() => {
                    if (charIndex < text.length) {
                        line.textContent += text.charAt(charIndex);
                        charIndex++;
                    } else {
                        clearInterval(typeInterval);
                    }
                }, 100);
            }, index * 800);
        });
    }

    // Start typewriter effect after a delay
    setTimeout(typewriterEffect, 1000);

    // =================
    // Sacred Geometry Animation
    // =================
    function enhanceSacredGeometry() {
        const geometry = document.querySelector('.sacred-geometry');
        if (!geometry) return;

        // Add additional geometric elements
        for (let i = 0; i < 6; i++) {
            const element = document.createElement('div');
            element.style.cssText = `
                position: absolute;
                border: 1px solid rgba(212, 175, 55, ${0.1 + i * 0.02});
                border-radius: 50%;
                top: ${10 + i * 5}%;
                left: ${10 + i * 5}%;
                right: ${10 + i * 5}%;
                bottom: ${10 + i * 5}%;
                animation: rotate ${20 + i * 10}s linear infinite reverse;
            `;
            geometry.appendChild(element);
        }
    }

    enhanceSacredGeometry();

    // =================
    // Stats Counter Animation
    // =================
    function animateStats() {
        const stats = document.querySelectorAll('.stat-number');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    const text = target.textContent;
                    const number = parseInt(text.replace(/\D/g, ''));
                    const suffix = text.replace(/[\d,]/g, '');
                    
                    if (number) {
                        let current = 0;
                        const increment = number / 50;
                        const timer = setInterval(() => {
                            current += increment;
                            if (current >= number) {
                                current = number;
                                clearInterval(timer);
                            }
                            
                            target.textContent = Math.floor(current).toLocaleString() + suffix;
                        }, 40);
                    }
                    
                    observer.unobserve(target);
                }
            });
        });

        stats.forEach(stat => observer.observe(stat));
    }

    animateStats();

    // =================
    // Dynamic Background Patterns
    // =================
    function addBackgroundPatterns() {
        const sections = document.querySelectorAll('section:nth-child(even)');
        
        sections.forEach(section => {
            const pattern = document.createElement('div');
            pattern.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                opacity: 0.03;
                background-image: radial-gradient(circle at 25% 25%, transparent 2px, rgba(212, 175, 55, 0.1) 2px);
                background-size: 60px 60px;
                pointer-events: none;
                z-index: 0;
            `;
            section.style.position = 'relative';
            section.appendChild(pattern);
            
            // Ensure content stays above pattern
            const content = section.querySelector('.container');
            if (content) {
                content.style.position = 'relative';
                content.style.zIndex = '1';
            }
        });
    }

    addBackgroundPatterns();

    // =================
    // Intersection Observer for Enhanced Animations
    // =================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Add staggered animation for grid items
                if (entry.target.closest('.gallery-grid, .shop-items')) {
                    const siblings = Array.from(entry.target.parentElement.children);
                    const index = siblings.indexOf(entry.target);
                    entry.target.style.animationDelay = `${index * 0.1}s`;
                }
            }
        });
    }, observerOptions);

    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });

    // =================
    // Performance Optimizations
    // =================
    
    // Throttle scroll events for better performance
    let scrollTimeout;
    function throttleScroll() {
        if (scrollTimeout) return;
        
        scrollTimeout = setTimeout(() => {
            scrollTimeout = null;
        }, 16); // ~60fps
    }

    // Lazy load background images
    function lazyLoadImages() {
        const imageContainers = document.querySelectorAll('.image-placeholder[data-src]');
        
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const container = entry.target;
                    const src = container.dataset.src;
                    
                    const img = new Image();
                    img.onload = () => {
                        container.style.backgroundImage = `url(${src})`;
                        container.classList.add('loaded');
                    };
                    img.src = src;
                    
                    imageObserver.unobserve(container);
                }
            });
        });

        imageContainers.forEach(container => {
            imageObserver.observe(container);
        });
    }

    lazyLoadImages();

    // =================
    // Enhanced Button Interactions
    // =================
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.05)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
        
        button.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-1px) scale(1.02)';
        });
        
        button.addEventListener('mouseup', function() {
            this.style.transform = 'translateY(-3px) scale(1.05)';
        });
    });

    // =================
    // Resize Handler
    // =================
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Recalculate positions after resize
            updateScrollEffects();
        }, 250);
    });

    // =================
    // Accessibility Enhancements
    // =================
    
    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.style.setProperty('--transition-smooth', 'none');
        document.documentElement.style.setProperty('--transition-quick', 'none');
        
        // Disable parallax for motion-sensitive users
        const sacredGeometry = document.querySelector('.sacred-geometry');
        if (sacredGeometry) {
            sacredGeometry.style.animation = 'none';
        }
    }

    // Focus management for better keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            document.body.classList.add('using-keyboard');
        }
    });

    document.addEventListener('mousedown', function() {
        document.body.classList.remove('using-keyboard');
    });

    // =================
    // Page Load Performance
    // =================
    
    // Preload critical resources
    function preloadCriticalResources() {
        const criticalImages = [
            // Add any critical images here when they're added
        ];
        
        criticalImages.forEach(src => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = src;
            document.head.appendChild(link);
        });
    }

    preloadCriticalResources();

    // =================
    // Initial Setup Complete
    // =================
    
    // Mark page as fully loaded
    setTimeout(() => {
        document.body.classList.add('page-loaded');
    }, 100);

    // Console signature (artist touch)
    console.log(`
    ╔══════════════════════════════════════════╗
    ║              RAUL WESCHE                 ║
    ║         Sacred Geometry Artist           ║
    ║                                          ║
    ║    This site crafted with precision      ║
    ║      and attention to detail             ║
    ║                                          ║
    ║        wesche.com © 2026                 ║
    ╚══════════════════════════════════════════╝
    `);

});

// =================
// Additional CSS for enhanced animations
// =================
const additionalStyles = `
    <style>
        /* Enhanced fade-in animations */
        .fade-in {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .fade-in.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Staggered animations for grid items */
        .gallery-item.fade-in,
        .shop-item.fade-in {
            transition-delay: var(--delay, 0s);
        }
        
        /* Enhanced button animations */
        .btn-primary,
        .btn-secondary {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Enhanced gallery hover effects */
        .gallery-item {
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Accessibility improvements */
        .using-keyboard *:focus {
            outline: 2px solid var(--gold-primary) !important;
            outline-offset: 2px;
        }
        
        /* Reduced motion styles */
        @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        
        /* Page loaded state */
        .page-loaded .hero-content {
            animation-play-state: running;
        }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);