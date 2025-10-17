// ========================================
// Three.js 3D Background Setup
// ========================================

class Background3D {
    constructor() {
        this.config = {
            particleCount: 2000,
            particleSize: 0.02,
            particleColor: 0x667eea,
            particleOpacity: 0.8,
            cameraFOV: 60,
            cameraDistance: 15,
            rotationSpeed: 0.0005,
            floatingSpeed: 0.002,
            mouseEffect: 0.02
        };

        this.container = document.getElementById('canvas-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = null;
        this.geometries = [];
        this.mouse = { x: 0, y: 0 };
        this.targetMouse = { x: 0, y: 0 };
        this.frameId = null;
        this.isActive = true;
        this.clock = new THREE.Clock();

        this.init().catch(error => {
            console.error('Failed to initialize 3D background:', error);
            this.fallbackBackground();
        });
    }

    async init() {
        if (!this.isWebGLAvailable()) {
            throw new Error('WebGL is not supported');
        }

        // Scene setup with better performance
        this.scene = new THREE.Scene();
        
        // Optimized camera settings
        this.camera = new THREE.PerspectiveCamera(
            60, // Reduced FOV for better performance
            window.innerWidth / window.innerHeight,
            1,
            100
        );
        this.camera.position.z = 15;

        // Renderer with optimized settings
        this.renderer = new THREE.WebGLRenderer({
            antialias: window.devicePixelRatio < 2,
            alpha: true,
            powerPreference: "high-performance",
            precision: "mediump"
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Use more efficient geometry creation
        await this.createParticles();
        await this.createFloatingGeometries();
        
        this.addEventListeners();
        this.animate();
    }

    isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    async createParticles() {
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const scales = new Float32Array(this.config.particleCount);
        
        for(let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 50;
            positions[i3 + 1] = (Math.random() - 0.5) * 50;
            positions[i3 + 2] = (Math.random() - 0.5) * 50;
            scales[i] = Math.random();
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        // Custom shader material for better performance
        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(this.config.particleColor) },
                time: { value: 0 },
                size: { value: this.config.particleSize }
            },
            vertexShader: `
                attribute float scale;
                uniform float time;
                uniform float size;
                
                void main() {
                    vec3 pos = position;
                    pos.y += sin(time * 0.001 + position.x * 0.05) * 0.1;
                    pos.x += cos(time * 0.001 + position.y * 0.05) * 0.1;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * scale * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                
                void main() {
                    float strength = distance(gl_PointCoord, vec2(0.5));
                    strength = 1.0 - strength;
                    strength = pow(strength, 3.0);
                    
                    vec3 finalColor = mix(vec3(0.0), color, strength);
                    gl_FragColor = vec4(finalColor, strength);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(this.particles);
    }

    async createFloatingGeometries() {
        const geometries = [
            new THREE.TorusGeometry(1, 0.4, 32, 64),
            new THREE.OctahedronGeometry(1, 2),
            new THREE.TetrahedronGeometry(1, 1),
            new THREE.IcosahedronGeometry(1, 1)
        ];

        // Create custom material with fresnel effect
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x764ba2) },
                time: { value: 0 },
                fresnelBias: { value: 0.1 },
                fresnelScale: { value: 1.0 },
                fresnelPower: { value: 2.0 }
            },
            vertexShader: `
                uniform float time;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float fresnelBias;
                uniform float fresnelScale;
                uniform float fresnelPower;
                
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vec3 normal = normalize(vNormal);
                    vec3 viewDirection = normalize(vViewPosition);
                    float fresnel = fresnelBias + fresnelScale * pow(1.0 + dot(viewDirection, normal), fresnelPower);
                    
                    gl_FragColor = vec4(color * fresnel, fresnel * 0.5);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        // Add lights for better visual effect
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(5, 5, 5);
        this.scene.add(pointLight);

        // Create and position meshes with more dynamic animation parameters
        geometries.forEach((geometry, i) => {
            const mesh = new THREE.Mesh(geometry, material.clone());
            
            mesh.position.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );
            
            mesh.userData = {
                initialY: mesh.position.y,
                speed: 0.0005 + Math.random() * 0.0005,
                offset: Math.random() * Math.PI * 2,
                rotationAxis: new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize()
            };
            
            this.geometries.push(mesh);
            this.scene.add(mesh);
        });
    }

    addEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Add mouse move listener for parallax effect
        document.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    dispose() {
        this.isActive = false;
        cancelAnimationFrame(this.frameId);

        // Dispose geometries
        this.geometries.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.scene.remove(mesh);
        });

        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }

        // Clean up event listeners
        window.removeEventListener('resize', this.onWindowResize.bind(this));
    }

    animate() {
        if (!this.isActive) return;

        this.frameId = requestAnimationFrame(() => this.animate());

        if (document.hidden) return;

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime() * 1000;

        // Update particle uniforms
        if (this.particles && this.particles.material.uniforms) {
            this.particles.material.uniforms.time.value = time;
        }

        // Update geometry materials
        this.geometries.forEach(mesh => {
            if (mesh.material.uniforms) {
                mesh.material.uniforms.time.value = time;
            }

            // Complex rotation around custom axis
            mesh.rotateOnAxis(mesh.userData.rotationAxis, this.config.rotationSpeed);
            
            // Smooth floating motion
            mesh.position.y = mesh.userData.initialY + 
                Math.sin(time * mesh.userData.speed + mesh.userData.offset) * 1.5;
        });

        // Smooth camera movement with lerp
        this.camera.position.x += (this.mouse.x * 2 - this.camera.position.x) * this.config.mouseEffect;
        this.camera.position.y += (this.mouse.y * 2 - this.camera.position.y) * this.config.mouseEffect;
        this.camera.lookAt(this.scene.position);

        this.renderer.render(this.scene, this.camera);
    }

    shouldUpdate() {
        if (this.isMobile()) {
            return !this.lastUpdate || Date.now() - this.lastUpdate > 33;
        }
        return true;
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
            .test(navigator.userAgent);
    }

    fallbackBackground() {
        // Fallback to gradient background if 3D fails
        document.body.style.background = 
            'linear-gradient(45deg, var(--primary-color), var(--secondary-color))';
    }
}

// ========================================
// Smooth Scrolling
// ========================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ========================================
// Form Validation & Submission
// ========================================

class ContactForm {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.submitButton = this.form.querySelector('button[type="submit"]');
        this.buttonText = this.submitButton.querySelector('.button-text');
        this.buttonLoader = this.submitButton.querySelector('.button-loader');
        this.fields = {
            name: this.form.querySelector('#name'),
            email: this.form.querySelector('#email'),
            message: this.form.querySelector('#message')
        };
        this.isSubmitting = false;
        
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        Object.values(this.fields).forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => this.clearError(field));
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        if (this.isSubmitting) return;

        try {
            this.setLoading(true);

            // Validate all fields
            const isValid = Object.values(this.fields).every(field => 
                this.validateField(field));

            if (!isValid) {
                throw new Error('Please fill all required fields correctly');
            }

            // Get form data
            const formData = {
                name: this.fields.name.value.trim(),
                email: this.fields.email.value.trim(),
                message: this.fields.message.value.trim()
            };

            // Simulate API call
            await this.submitForm(formData);

            // Show success notification
            this.showNotification('Thank you for contacting me');
            
            // Reset form
            this.form.reset();
            Object.values(this.fields).forEach(field => {
                const formGroup = field.closest('.form-group');
                formGroup.classList.remove('error', 'success');
            });

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async submitForm(data) {
        // Simulate API call with delay
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Form submitted:', data);
                resolve();
            }, 1500);
        });
    }

    setLoading(loading) {
        this.isSubmitting = loading;
        this.submitButton.disabled = loading;
        
        if (loading) {
            this.buttonText.style.display = 'none';
            this.buttonLoader.style.display = 'inline-block';
        } else {
            this.buttonText.style.display = 'inline';
            this.buttonLoader.style.display = 'none';
        }
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add styles inline for notification
        notification.style.cssText = `
            position: fixed;
            top: -100px;
            left: 50%;
            transform: translateX(-50%);
            padding: 1rem 2rem;
            background: ${type === 'success' ? '#10b981' : '#ff6b6b'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 500;
            font-size: 16px;
            transition: top 0.5s ease;
            text-align: center;
            min-width: 300px;
        `;

        document.body.appendChild(notification);

        // Trigger slide down animation
        setTimeout(() => {
            notification.style.top = '20px';
        }, 10);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.top = '-100px';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    validateField(field) {
        const value = field.value.trim();
        const fieldName = field.name;
        let isValid = true;
        let errorMessage = '';

        switch (fieldName) {
            case 'name':
                if (value.length < 2) {
                    isValid = false;
                    errorMessage = 'Name must be at least 2 characters long';
                }
                break;
            
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address';
                }
                break;
            
            case 'message':
                if (value.length < 10) {
                    isValid = false;
                    errorMessage = 'Message must be at least 10 characters long';
                }
                break;
        }

        this.setFieldStatus(field, isValid, errorMessage);
        return isValid;
    }

    setFieldStatus(field, isValid, errorMessage) {
        const formGroup = field.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message');

        formGroup.classList.remove('error', 'success');
        
        if (!isValid) {
            formGroup.classList.add('error');
            errorElement.textContent = errorMessage;
        } else if (field.value.trim()) {
            formGroup.classList.add('success');
            errorElement.textContent = '';
        }
    }

    clearError(field) {
        const formGroup = field.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message');
        
        formGroup.classList.remove('error');
        errorElement.textContent = '';
    }
}

// ========================================
// Scroll Animations
// ========================================

function initScrollAnimations() {
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
    document.querySelectorAll('.skill-card, .project-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ========================================
// Header Scroll Effect
// ========================================

function initHeaderScroll() {
    const header = document.querySelector('header');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            header.style.background = 'rgba(0, 0, 0, 0.8)';
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
        } else {
            header.style.background = 'rgba(0, 0, 0, 0.3)';
            header.style.boxShadow = 'none';
        }

        lastScroll = currentScroll;
    });
}

// ========================================
// Keyboard Navigation
// ========================================

function initKeyboardNavigation() {
    const projectButtons = document.querySelectorAll('.view-project-btn');
    
    projectButtons.forEach(button => {
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });
    });
}

// ========================================
// Theme Manager
// ========================================

class ThemeManager {
    constructor() {
        this.isDark = true; // Default dark theme
        this.init();
    }

    init() {
        // Add theme toggle button to header
        const header = document.querySelector('header nav');
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.setAttribute('aria-label', 'Toggle theme');
        themeToggle.innerHTML = `
            <svg class="sun-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <svg class="moon-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
        `;
        
        header.appendChild(themeToggle);
        themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Apply initial theme
        this.applyTheme();
    }

    toggleTheme() {
        this.isDark = !this.isDark;
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.classList.toggle('light-theme', !this.isDark);
        document.documentElement.classList.toggle('dark-theme', this.isDark);
    }
}

// ========================================
// Initialize Everything
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize 3D background
    const background = new Background3D();
    
    // Initialize smooth scrolling
    initSmoothScroll();
    
    // Initialize contact form
    const contactForm = new ContactForm('contactForm');
    
    // Initialize scroll animations
    initScrollAnimations();
    
    // Initialize header scroll effect
    initHeaderScroll();
    
    // Initialize keyboard navigation
    initKeyboardNavigation();
    
    // Initialize theme manager
    const themeManager = new ThemeManager();

    // Scroll to top when clicking the logo
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.addEventListener('click', () => {
        console.log('Logo clicked!'); // باش نتأكدو فـ console
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }

    console.log('Portfolio loaded successfully! 🚀');
});

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);