const CACHE = 'forq-v2';
const SHELL = './';
const LIMIT = 150;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.add(SHELL).catch(() => {}))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;

	if (request.method !== 'GET') return;
	if (new URL(request.url).origin !== self.location.origin) return;

	event.respondWith(
		fetch(request)
			.then((response) => {
				if (response.ok && response.type === 'basic') {
					const copy = response.clone();

					try {
						event.waitUntil(store(request, copy));
					} catch {
						void store(request, copy);
					}
				}

				return response;
			})
			.catch(() => restore(request))
	);
});

async function store(request, response) {
	try {
		const cache = await caches.open(CACHE);
		await cache.put(request, response);
		await prune();
	} catch {
		return;
	}
}

async function restore(request) {
	const cached = await caches.match(request, { ignoreSearch: true });
	if (cached) return cached;

	if (request.mode === 'navigate') {
		const shell = await caches.match(SHELL, { ignoreSearch: true });
		if (shell) return shell;
	}

	return Response.error();
}

async function prune() {
	const cache = await caches.open(CACHE);
	const keys = await cache.keys();

	if (keys.length <= LIMIT) return;

	const root = new URL(self.registration.scope).pathname;
	const excess = keys.length - LIMIT;
	let removed = 0;

	for (const key of keys) {
		if (removed >= excess) break;
		if (new URL(key.url).pathname === root) continue;

		await cache.delete(key);
		removed++;
	}
}
