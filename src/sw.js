/**
 * Service Worker for Overvibing PWA
 * Provides offline functionality and caching
 */

// Silence logs in production (workers have no DOM, use self for scope detection)
(() => {
    try {
        const isDev = (self && self.location && /localhost|127\.0\.0\.1/.test(self.location.host));
        if (!isDev) {
            const noop = () => {};
            console.log = noop;
            console.debug = noop;
            console.warn = noop;
        }
    } catch (_) {}
})();

const CACHE_NAME = 'overvibing-v1.0.0';
const STATIC_CACHE_NAME = 'overvibing-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'overvibing-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/src/style.css',
    '/src/script.js',
    '/src/index.html',
    '/src/manifest.json',
    '/static/manifest.json',
    '/static/CNAME',
    '/static/Michau Wybraniec - Kepler 22b.mp3',
    '/bundler/webpack.common.js',
    '/bundler/webpack.dev.js',
    '/bundler/webpack.prod.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Failed to cache static assets', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                // Return cached version if available
                if (cachedResponse) {
                    console.log('Service Worker: Serving from cache', request.url);
                    return cachedResponse;
                }
                
                // Otherwise, fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Check if response is valid
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone the response
                        const responseToCache = networkResponse.clone();
                        
                        // Cache dynamic content
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('Service Worker: Network request failed', request.url, error);
                        
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        // Return cached version if available
                        return caches.match(request);
                    });
            })
    );
});

// Background sync for form submissions
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'form-submission') {
        event.waitUntil(
            // Handle offline form submissions
            handleOfflineFormSubmissions()
        );
    }
});

// Handle offline form submissions
async function handleOfflineFormSubmissions() {
    try {
        // Get offline form data from IndexedDB
        const offlineForms = await getOfflineFormData();
        
        for (const formData of offlineForms) {
            try {
                // Attempt to submit the form
                await submitFormData(formData);
                
                // Remove from offline storage if successful
                await removeOfflineFormData(formData.id);
                
                console.log('Service Worker: Offline form submitted successfully', formData.id);
            } catch (error) {
                console.error('Service Worker: Failed to submit offline form', formData.id, error);
            }
        }
    } catch (error) {
        console.error('Service Worker: Error handling offline form submissions', error);
    }
}

// Store form data offline
async function storeOfflineFormData(formData) {
    try {
        const db = await openDB();
        const transaction = db.transaction(['offlineForms'], 'readwrite');
        const store = transaction.objectStore('offlineForms');
        
        const offlineForm = {
            id: Date.now().toString(),
            data: formData,
            timestamp: Date.now(),
            attempts: 0
        };
        
        await store.add(offlineForm);
        console.log('Service Worker: Form data stored offline', offlineForm.id);
    } catch (error) {
        console.error('Service Worker: Failed to store offline form data', error);
    }
}

// Get offline form data
async function getOfflineFormData() {
    try {
        const db = await openDB();
        const transaction = db.transaction(['offlineForms'], 'readonly');
        const store = transaction.objectStore('offlineForms');
        
        return await store.getAll();
    } catch (error) {
        console.error('Service Worker: Failed to get offline form data', error);
        return [];
    }
}

// Remove offline form data
async function removeOfflineFormData(id) {
    try {
        const db = await openDB();
        const transaction = db.transaction(['offlineForms'], 'readwrite');
        const store = transaction.objectStore('offlineForms');
        
        await store.delete(id);
    } catch (error) {
        console.error('Service Worker: Failed to remove offline form data', error);
    }
}

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OvervibingOfflineDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store for offline forms
            if (!db.objectStoreNames.contains('offlineForms')) {
                const store = db.createObjectStore('offlineForms', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Submit form data
async function submitFormData(formData) {
    const response = await fetch('https://docs.google.com/forms/u/0/d/e/1FAIpQLSfD2YLLpw_FlMAbi1-q9gSEu2Hw8GQzmUh3uSabsT4f7xl45g/formResponse', {
        method: 'POST',
        mode: 'no-cors',
        body: formData
    });
    
    return response;
}

// Push notification handling
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New update available!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Explore',
                icon: '/icon-192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icon-192.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Overvibing', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'STORE_OFFLINE_FORM') {
        storeOfflineFormData(event.data.formData);
    }
});

console.log('Service Worker: Loaded successfully');
