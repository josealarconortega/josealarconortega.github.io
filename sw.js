// Service Worker para Farmacia Vivo Más
const CACHE_NAME = 'vivomas-v1.0.0';
const STATIC_CACHE = 'vivomas-static-v1';
const DYNAMIC_CACHE = 'vivomas-dynamic-v1';

// Recursos críticos para cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/App.css',
  '/src/index.css',
  '/logo-vivomas-transparente.png',
  '/Logo-Vivo-Mas-Icono.png',
  '/logo-vivomas-2.png',
  '/manifest.json'
];

// Recursos de productos para cache dinámico
const PRODUCT_IMAGES = [
  '/productos/citrato_magnesio.png',
  '/productos/citrato_potasio.png',
  '/productos/vitamina_d3.png',
  '/productos/colageno_hidrolizado.png',
  '/productos/blistex_variedades.png',
  '/productos/test_embarazo_cassette.png'
];

// Imágenes de sucursales
const BRANCH_IMAGES = [
  '/sucursal_castellon.jpg',
  '/sucursal_ohiggins.jpg',
  '/sucursal_chillan.jpg',
  '/sucursal_yumbel.jpg',
  '/sucursal_rengo.png'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('SW: Instalando Service Worker v1.0.0');
  
  event.waitUntil(
    Promise.all([
      // Cache estático
      caches.open(STATIC_CACHE).then(cache => {
        console.log('SW: Cacheando recursos estáticos');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Pre-cache de imágenes críticas
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('SW: Pre-cacheando imágenes críticas');
        return cache.addAll([...PRODUCT_IMAGES.slice(0, 3), ...BRANCH_IMAGES.slice(0, 2)]);
      })
    ])
  );
  
  // Activar inmediatamente
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('SW: Activando Service Worker v1.0.0');
  
  event.waitUntil(
    // Limpiar caches antiguos
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('SW: Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Tomar control inmediatamente
  self.clients.claim();
});

// Estrategia de fetch
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo cachear requests GET
  if (request.method !== 'GET') return;
  
  // Estrategia Cache First para recursos estáticos
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Estrategia Network First para imágenes
  if (isImage(request.url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Estrategia Network First para páginas HTML
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Para APIs externas, Network Only con timeout
  if (isExternalAPI(request.url)) {
    event.respondWith(networkWithTimeout(request, 5000));
    return;
  }
  
  // Default: Network First
  event.respondWith(networkFirst(request));
});

// Estrategia Cache First
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('SW: Sirviendo desde cache:', request.url);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    // Cachear la respuesta si es exitosa
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Error en cache first:', error);
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// Estrategia Network First
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cachear respuestas exitosas
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('SW: Red no disponible, buscando en cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback para páginas HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match('/');
      if (offlinePage) return offlinePage;
    }
    
    return new Response('Contenido no disponible offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Network con timeout
async function networkWithTimeout(request, timeout) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );
    
    const networkPromise = fetch(request);
    
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch (error) {
    console.log('SW: Timeout o error de red:', error);
    return new Response('Servicio no disponible', { status: 503 });
  }
}

// Utilidades
function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.includes(asset)) ||
         url.includes('.css') ||
         url.includes('.js') ||
         url.includes('.woff') ||
         url.includes('.woff2');
}

function isImage(url) {
  return url.includes('.jpg') ||
         url.includes('.jpeg') ||
         url.includes('.png') ||
         url.includes('.webp') ||
         url.includes('.svg') ||
         url.includes('/productos/') ||
         url.includes('/sucursal_') ||
         url.includes('/convenios/');
}

function isExternalAPI(url) {
  return url.includes('wa.me') ||
         url.includes('google.com/maps') ||
         url.includes('facebook.com') ||
         url.includes('instagram.com') ||
         url.includes('googleapis.com');
}

// Manejo de mensajes del cliente
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Background Sync para requests fallidos
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aquí podrías implementar lógica para reenviar requests fallidos
      console.log('SW: Background sync ejecutado')
    );
  }
});

// Push notifications (para futuras implementaciones)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/Logo-Vivo-Mas-Icono.png',
      badge: '/Logo-Vivo-Mas-Icono.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1'
      },
      actions: [
        {
          action: 'explore',
          title: 'Ver ofertas',
          icon: '/productos/citrato_magnesio.png'
        },
        {
          action: 'close',
          title: 'Cerrar',
          icon: '/Logo-Vivo-Mas-Icono.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

console.log('SW: Service Worker de Farmacia Vivo Más cargado correctamente v1.0.0');
