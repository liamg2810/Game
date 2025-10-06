/** @type {HTMLCanvasElement} */
const gameCanvas = document.getElementById("game-canvas");

const ctx = gameCanvas.getContext("2d");

const Nodes = {
	STONE: 1,
	WOOD: 2,
	WATER: 3,
	GRASS: 4,
};

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

function perlin2D(x, y) {
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

class ResourceNode {
	x = 0;
	y = 0;
	type = Nodes.STONE;

	/** @type {(x: number, y: number, type: Nodes) => null} */
	constructor(x, y, type) {
		this.x = x;
		this.y = y;
		this.type = type;
	}
}

class Game {
	pollution = 0;

	map = [];
	renderMap = [];

	rows = 500;
	rowHeight = 1;
	columns = 500;
	colWidth = 1;
	scale = 1;
	FPS = 60;
	NoiseScale = 0.05;
	XOffset = 0;
	YOffset = 0;

	lastFrameTime = 0;
	deltaTime = 0;
	keyMap = new Set();

	mouseX = 0;
	mouseY = 0;

	constructor() {
		console.log(this.colWidth);

		this.InitialiseMap();

		this.Update();
	}

	InitialiseMap() {
		for (let x = 0; x < this.columns; x++) {
			for (let y = 0; y < this.rows; y++) {
				let noiseVal = perlin2D(
					x * this.NoiseScale,
					y * this.NoiseScale
				);

				let waterVal = perlin2D(
					x * this.NoiseScale * 0.2,
					y * this.NoiseScale * 0.2
				);

				let woodVal = perlin2D(
					x * this.NoiseScale * 0.8,
					y * this.NoiseScale * 0.8
				);

				let node = Nodes.GRASS;

				if (noiseVal < 0.3) {
					node = Nodes.STONE;
				}

				if (waterVal < 0.4) {
					node = Nodes.WATER;
				}

				if (woodVal < 0.3 && node === Nodes.GRASS) {
					node = Nodes.WOOD;
				}

				this.map.push(new ResourceNode(x, y, node));
			}
		}

		this.CalculateRenderMap();
	}

	CalculateRenderMap() {
		const cL = gameCanvas.getBoundingClientRect().x;
		const cT = gameCanvas.getBoundingClientRect().y;
		let w = Math.round(this.colWidth * this.scale * 10) / 10;
		let h = this.rowHeight * this.scale;
		const cW = gameCanvas.getBoundingClientRect().width / w;
		const cH = gameCanvas.getBoundingClientRect().height / h;

		this.renderMap = [];

		this.map.forEach((node) => {
			const x = node.x - this.XOffset;
			const y = node.y - this.YOffset;

			if (x < 0 || x > cW || y < 0 || y > cH) {
				return;
			}

			this.renderMap.push(node);
		});

		console.log(this.map.length, this.renderMap.length);
	}

	GetMouseHover() {
		// this.map.forEach((node) => {
		// 	let w = Math.round(this.colWidth * this.scale * 10) / 10;
		// 	let h = this.rowHeight * this.scale;
		// 	const x = node.x * w + this.XOffset;
		// 	if (x > gameCanvas.clientWidth - gameCanvas.clientLeft || x < 0) {
		// 		return;
		// 	}
		// 	const y = node.y * h + this.YOffset;
		// 	if (y > gameCanvas.clientHeight - gameCanvas.clientTop || y < 0) {
		// 		return;
		// 	}
		// 	if (x + gameCanvas.clientLeft === this.mouseX) {
		// 		console.log("same X");
		// 	}
		// });
	}

	DrawMap() {
		ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

		this.renderMap.forEach((node) => {
			let w = this.colWidth * this.scale;
			let h = this.rowHeight * this.scale;

			const x = node.x * w + this.XOffset;
			const y = node.y * h + this.YOffset;

			ctx.fillStyle = "rgb(0,225, 0)";

			if (node.type === Nodes.STONE) {
				ctx.fillStyle = `rgb(100, 100, 100)`;
			}

			if (node.type === Nodes.WATER) {
				ctx.fillStyle = `rgb(0, 0, 225)`;
			}

			if (node.type === Nodes.WOOD) {
				ctx.fillStyle = "rgb(0, 125, 0)";
			}

			ctx.fillRect(x, y, w, h);
		});
	}

	Update() {
		this.DrawMap();

		this.deltaTime = Date.now() - this.lastFrameTime;

		const MoveScale = Math.round(1 * (this.deltaTime / 25));

		let shouldFindRenderMap = false;

		if (this.keyMap.has("s")) {
			shouldFindRenderMap = true;
			this.YOffset -= MoveScale;
		}

		if (this.keyMap.has("w")) {
			shouldFindRenderMap = true;

			this.YOffset += MoveScale;
		}

		if (this.keyMap.has("a")) {
			shouldFindRenderMap = true;
			this.XOffset += MoveScale;
		}

		if (this.keyMap.has("d")) {
			shouldFindRenderMap = true;
			this.XOffset -= MoveScale;
		}

		if (true) {
			this.CalculateRenderMap();
		}

		this.GetMouseHover();

		this.lastFrameTime = Date.now();

		setTimeout(this.Update.bind(this), 1 / this.FPS);
	}
}

const game = new Game();

gameCanvas.addEventListener("wheel", (ev) => {
	ev.preventDefault(); // prevent page scrolling

	const scaleFactor = 1.5;

	// Zoom in or out
	if (ev.deltaY < 0) {
		// zoom in
		game.scale += 0.25;
	} else {
		// zoom out
		game.scale -= 0.25;
	}

	console.log(game.scale);

	game.scale = Math.min(Math.max(game.scale, 0.5), 10);

	console.log(game.scale);
});

document.addEventListener("mousemove", (ev) => {
	game.mouseX = ev.clientX;
	game.mouseY = ev.clientY;
});

document.addEventListener("keydown", (ev) => {
	game.keyMap.add(ev.key);
});

document.addEventListener("keyup", (ev) => {
	if (game.keyMap.has(ev.key)) {
		game.keyMap.delete(ev.key);
	}
});
