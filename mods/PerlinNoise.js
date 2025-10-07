function fade(t) {
	return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
	return a + t * (b - a);
}

function grad(hash, x, y) {
	switch (hash & 3) {
		case 0:
			return x + y;
		case 1:
			return -x + y;
		case 2:
			return x - y;
		case 3:
			return -x - y;
	}
}

const perm = new Uint8Array(512);

for (let i = 0; i < 256; i++) perm[i] = i;
for (let i = 0; i < 256; i++) {
	const j = Math.floor(Math.random() * 256);
	[perm[i], perm[j]] = [perm[j], perm[i]];
}
for (let i = 0; i < 256; i++) {
	perm[i + 256] = perm[i];
}

export function perlin2D(x, y) {
	const X = Math.floor(x) & 255;
	const Y = Math.floor(y) & 255;

	const xf = x - Math.floor(x);
	const yf = y - Math.floor(y);

	const topRight = perm[perm[X + 1] + Y + 1];
	const topLeft = perm[perm[X] + Y + 1];
	const bottomRight = perm[perm[X + 1] + Y];
	const bottomLeft = perm[perm[X] + Y];

	const u = fade(xf);
	const v = fade(yf);

	const valTop = lerp(
		grad(topLeft, xf, yf - 1),
		grad(topRight, xf - 1, yf - 1),
		u
	);
	const valBottom = lerp(
		grad(bottomLeft, xf, yf),
		grad(bottomRight, xf - 1, yf),
		u
	);

	return (lerp(valBottom, valTop, v) + 1) / 2; // Normalize to [0,1]
}
