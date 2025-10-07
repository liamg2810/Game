/** @type {HTMLCanvasElement} */
const gameCanvas = document.getElementById("game-canvas");

const ctx = gameCanvas.getContext("2d");

const Nodes = {
	STONE: 1,
	WOOD: 2,
	WATER: 3,
	GRASS: 4,
	SAND: 5,
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

/** @type {x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number} */
function AABB(x1, y1, w1, h1, x2, y2, w2, h2) {
	return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

class Game {
	pollution = 0;

	/**@type {ResourceNode[]} */
	map = [];

	/**@type {ResourceNode[]} */
	culledMap = [];

	/** @type {{startX: number, startY: number, height: number, type: Nodes}[]} */
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
	/** @type {ResourceNode | null} */
	hoveredNode = null;

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

				if (waterVal < 0.42) {
					node = Nodes.SAND;
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
		let w = this.colWidth * this.scale;
		let h = this.rowHeight * this.scale;
		const cW = gameCanvas.width;
		const cH = gameCanvas.height;
		this.renderMap = [];

		this.culledMap = [];

		this.map.forEach((node) => {
			const x = node.x * w + this.XOffset;
			const y = node.y * h + this.YOffset;

			if (x + w < 0 || x > cW + w || y + h < 0 || y > cH + h) {
				return;
			}

			this.culledMap.push(node);
		});

		if (this.culledMap.length === 0) {
			return;
		}

		let chainNodeTypeStartPos = {
			x: this.culledMap[0].x * w + this.XOffset,
			y: this.culledMap[0].y * h + this.YOffset,
		};
		let chainNodeType = this.culledMap[0].type;
		let lastY = 0;

		this.culledMap.forEach((node) => {
			const x = node.x * w + this.XOffset;
			const y = node.y * h + this.YOffset;

			if (x !== chainNodeTypeStartPos.x) {
				this.renderMap.push({
					startX: chainNodeTypeStartPos.x,
					startY: chainNodeTypeStartPos.y,
					height: lastY - chainNodeTypeStartPos.y,
					type: chainNodeType,
				});

				chainNodeTypeStartPos = { x: x, y: y };
				chainNodeType = node.type;

				return;
			}

			if (node.type === chainNodeType) {
				lastY = y;
				return;
			}

			this.renderMap.push({
				startX: chainNodeTypeStartPos.x,
				startY: chainNodeTypeStartPos.y,
				height: y - chainNodeTypeStartPos.y,
				type: chainNodeType,
			});

			chainNodeTypeStartPos = { x: x, y: y };
			chainNodeType = node.type;
			lastY = y;
		});
	}

	GetMouseHover() {
		const xPos = this.mouseX - gameCanvas.getBoundingClientRect().x;
		const yPos = this.mouseY - gameCanvas.getBoundingClientRect().y;

		const w = gameCanvas.getBoundingClientRect().width / gameCanvas.width;
		const h = gameCanvas.getBoundingClientRect().height / gameCanvas.height;

		const relativeX = xPos / w;
		const relativeY = yPos / h;

		this.hoveredNode = null;

		for (let node of this.culledMap) {
			if (
				AABB(
					relativeX,
					relativeY,
					this.scale,
					this.scale,
					node.x + this.colWidth * this.scale + this.XOffset,
					node.y + this.rowHeight * this.scale + this.YOffset,
					this.colWidth * this.scale,
					this.rowHeight * this.scale
				)
			) {
				console.log(node);
				this.hoveredNode = node;
				break;
			}
		}
	}

	DrawMap() {
		ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

		if (this.renderMap.length === 0) {
			return;
		}

		for (let node of this.renderMap) {
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

			if (node.type === Nodes.SAND) {
				ctx.fillStyle = "rgb(246,215,176)";
			}

			ctx.fillRect(
				node.startX,
				node.startY,
				this.colWidth * this.scale + 1,
				node.height
			);
		}

		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";

		const xPos = this.mouseX - gameCanvas.getBoundingClientRect().x;
		const yPos = this.mouseY - gameCanvas.getBoundingClientRect().y;

		const w = gameCanvas.getBoundingClientRect().width / gameCanvas.width;
		const h = gameCanvas.getBoundingClientRect().height / gameCanvas.height;

		const mouseSize = this.colWidth * this.scale;

		ctx.fillRect(
			xPos / w - mouseSize / 2,
			yPos / h - mouseSize / 2,
			mouseSize,
			mouseSize
		);

		if (this.hoveredNode !== null) {
			ctx.fillStyle = "rgba(0, 174, 255, 0.5)";

			ctx.fillRect(
				this.hoveredNode.x + this.colWidth * this.scale + this.XOffset,
				this.hoveredNode.y + this.rowHeight * this.scale + this.YOffset,
				this.colWidth * this.scale,
				this.rowHeight * this.scale
			);
		}
	}

	Update() {
		this.DrawMap();

		this.deltaTime = Date.now() - this.lastFrameTime;

		const MoveScale = Math.round(1 * (this.deltaTime / 25));

		let shouldFindRenderMap = false;

		if (this.keyMap.has("s") || this.keyMap.has("arrowdown")) {
			shouldFindRenderMap = true;
			this.YOffset -= MoveScale;
		}

		if (this.keyMap.has("w") || this.keyMap.has("arrowup")) {
			shouldFindRenderMap = true;

			this.YOffset += MoveScale;
		}

		if (this.keyMap.has("a") || this.keyMap.has("arrowleft")) {
			shouldFindRenderMap = true;
			this.XOffset += MoveScale;
		}

		if (this.keyMap.has("d") || this.keyMap.has("arrowright")) {
			shouldFindRenderMap = true;
			this.XOffset -= MoveScale;
		}

		if (shouldFindRenderMap) {
			this.CalculateRenderMap();
		}

		this.GetMouseHover();

		this.lastFrameTime = Date.now();

		setTimeout(this.Update.bind(this), 1000 / this.FPS);
	}
}

const game = new Game();

gameCanvas.addEventListener("wheel", (ev) => {
	ev.preventDefault(); // prevent page scrolling

	const scaleFactor = 1.5;

	// Zoom in or out
	if (ev.deltaY < 0) {
		// zoom in
		game.scale += 0.2;
	} else {
		// zoom out
		game.scale -= 0.2;
	}

	game.scale = Math.round(game.scale * 10) / 10;

	game.scale = Math.min(Math.max(game.scale, 0.4), 10);

	game.CalculateRenderMap();

	console.log(game.scale);
});

document.addEventListener("mousemove", (ev) => {
	game.mouseX = ev.clientX;
	game.mouseY = ev.clientY;
});

document.addEventListener("keydown", (ev) => {
	game.keyMap.add(ev.key.toLowerCase());
});

document.addEventListener("keyup", (ev) => {
	if (game.keyMap.has(ev.key.toLowerCase())) {
		game.keyMap.delete(ev.key.toLowerCase());
	}
});
