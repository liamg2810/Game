import { perlin2D } from "./PerlinNoise.js";

const Nodes = {
	STONE: 1,
	WOOD: 2,
	WATER: 3,
	GRASS: 4,
	SAND: 5,
	CHEESE: 6,
};

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

function SameCol(x1, w1, x2, w2) {
	return x1 < x2 + w2 && x1 + x1 > x2;
}

function SameRow(y1, h1, y2, h2) {
	return y1 < y2 + h2 && y1 + h1 > y2;
}

/** @type {x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number} */
function AABB(x1, y1, w1, h1, x2, y2, w2, h2) {
	return SameCol(x1, w1, x2, w2) && SameRow(y1, h1, y2, h2);
}

export class Game {
	pollution = 0;

	/**@type {ResourceNode[][]} */
	map = [];

	/**@type {ResourceNode[][]} */
	culledMap = [];

	/** @type {{x: number, y: number, height: number, type: Nodes}[][]} */
	renderMap = [];

	rows = 5000;
	rowHeight = 1;
	columns = 500000;
	colWidth = 1;
	scale = 1;
	FPS = 60;
	NoiseScale = 0.05;
	XOffset = 0;
	YOffset = 0;

	lastFrameTime = 0;
	deltaTime = 0;
	keyMap = new Set();

	isGeneratingCols = false;

	mouseX = 0;
	mouseY = 0;
	mouseDown = false;

	/** @type {ResourceNode | null} */
	hoveredNode = null;

	/** @type {HTMLCanvasElement | null} */
	gameCanvas = null;
	ctx = null;

	constructor() {
		this.gameCanvas = document.getElementById("game-canvas");
		this.ctx = this.gameCanvas.getContext("2d");
		this.InitialiseMap();

		this.gameCanvas.addEventListener("wheel", (ev) => {
			ev.preventDefault();

			if (ev.deltaY < 0) {
				this.scale += 0.2;
			} else {
				this.scale -= 0.2;
			}

			this.scale = Math.round(this.scale * 10) / 10;

			this.scale = Math.min(Math.max(this.scale, 0.4), 10);

			this.CalculateRenderMap();
		});

		document.addEventListener("mousemove", (ev) => {
			this.mouseX = ev.clientX;
			this.mouseY = ev.clientY;
		});

		document.addEventListener("keydown", (ev) => {
			this.keyMap.add(ev.key.toLowerCase());
		});

		document.addEventListener("keyup", (ev) => {
			if (this.keyMap.has(ev.key.toLowerCase())) {
				this.keyMap.delete(ev.key.toLowerCase());
			}
		});

		document.addEventListener("mousedown", (ev) => {
			this.MouseDown();
		});

		document.addEventListener("mouseup", (ev) => {
			this.MouseUp();
		});

		this.Update();
	}

	GenerateCols() {
		if (this.map.length >= this.columns || this.isGeneratingCols) {
			return;
		}

		this.isGeneratingCols = true;

		const rightChunk = this.map[this.map.length - 1];

		if (!rightChunk || rightChunk.length === 0) {
			console.error("Empty chunk..");
			this.isGeneratingCols = false;
			return;
		}

		const MAX_CHUNKS_PER_CALL = 5;
		let chunksGenerated = 0;

		for (
			let x = rightChunk[0].x + 1;
			x < this.columns && chunksGenerated < MAX_CHUNKS_PER_CALL;
			x++
		) {
			let col = [];

			for (let y = 0; y < this.rows; y++) {
				col.push(this.GenerateNode(x, y));
			}
			this.map.push(col);

			chunksGenerated++;
		}

		this.isGeneratingCols = false;
	}

	GenerateNode(x, y) {
		let noiseVal = perlin2D(x * this.NoiseScale, y * this.NoiseScale);

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

		if (waterVal < 0.37) {
			node = Nodes.GRASS;
		}

		if (waterVal > 0.4) {
			node = Nodes.WATER;
		}

		if (woodVal < 0.3 && node === Nodes.GRASS) {
			node = Nodes.WOOD;
		}

		return new ResourceNode(x, y, node);
	}

	InitialiseMap() {
		const cW = this.gameCanvas.width;

		for (let x = 0; x < cW; x++) {
			let col = [];

			for (let y = 0; y < this.rows + 1; y++) {
				col.push(this.GenerateNode(x, y));
			}
			this.map.push(col);
		}

		this.CalculateRenderMap();
	}

	CalculateRenderMap() {
		const [w, h] = this.GetWAndH();

		const cW = this.gameCanvas.width;
		const cH = this.gameCanvas.height;
		this.renderMap = [];

		this.culledMap = [];

		this.map.forEach((col) => {
			if (col.length === 0) {
				return;
			}

			const x = col[0].x * w + this.XOffset * w;

			if (x + w < 0 || x > cW + w) {
				return;
			}

			let c = [];

			col.forEach((node) => {
				const y = node.y * h + this.YOffset * h;

				if (y + h < 0 || y > cH + h) {
					return;
				}

				c.push(node);
			});

			this.culledMap.push(c);
		});

		if (this.culledMap.length === 0) {
			return;
		}

		this.culledMap.forEach((col) => {
			if (col.length === 0) {
				return;
			}
			const x = col[0].x * w + this.XOffset * w;

			let chainNodeTypeStartPos = {
				x: col[0].x * w + this.XOffset * w,
				y: col[0].y * h + this.YOffset * h,
			};

			let chainNodeType = col[0].type;
			let lastY = 0;

			col.forEach((node) => {
				const y = node.y * h + this.YOffset * h;

				if (node.type === chainNodeType) {
					lastY = y;
					return;
				}

				this.renderMap.push({
					x: chainNodeTypeStartPos.x,
					y: chainNodeTypeStartPos.y,
					height: y - chainNodeTypeStartPos.y,
					type: chainNodeType,
				});

				chainNodeTypeStartPos = { x: x, y: y };
				chainNodeType = node.type;
				lastY = y;
			});

			this.renderMap.push({
				x: chainNodeTypeStartPos.x,
				y: chainNodeTypeStartPos.y,
				height: lastY - chainNodeTypeStartPos.y,
				type: chainNodeType,
			});

			chainNodeTypeStartPos = {
				x: x,
				y: col[0].y * h + this.XOffset * h,
			};
			chainNodeType = col[0].type;
		});
	}

	GetMouseHover() {
		const rect = this.gameCanvas.getBoundingClientRect();
		const xPos = this.mouseX - rect.x;
		const yPos = this.mouseY - rect.y;

		const w =
			(this.gameCanvas.getBoundingClientRect().width /
				this.gameCanvas.width) *
			this.scale;
		const h =
			(this.gameCanvas.getBoundingClientRect().height /
				this.gameCanvas.height) *
			this.scale;

		const canvasX = xPos / w;
		const canvasY = yPos / h;

		const mapX = canvasX - this.XOffset;
		const mapY = canvasY - this.YOffset;

		this.hoveredNode = null;

		for (let col of this.culledMap) {
			let found = false;

			for (let node of col) {
				if (
					Math.floor(mapX) === node.x &&
					Math.floor(mapY) === node.y
				) {
					found = true;
					this.hoveredNode = node;
					break;
				}
			}

			if (found) {
				break;
			}
		}
	}

	DrawMap() {
		const [w, h] = this.GetWAndH();

		this.ctx.clearRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);

		if (this.renderMap.length === 0) {
			return;
		}

		for (let node of this.renderMap) {
			this.ctx.fillStyle = "rgb(0,225, 0)";

			if (node.type === Nodes.STONE) {
				this.ctx.fillStyle = `rgb(100, 100, 100)`;
			}

			if (node.type === Nodes.WATER) {
				this.ctx.fillStyle = `rgb(0, 0, 225)`;
			}

			if (node.type === Nodes.WOOD) {
				this.ctx.fillStyle = "rgb(0, 125, 0)";
			}

			if (node.type === Nodes.SAND) {
				this.ctx.fillStyle = "rgb(246,215,176)";
			}

			if (node.type === Nodes.CHEESE) {
				this.ctx.fillStyle = "rgb(255, 255, 255)";
			}

			this.ctx.fillRect(node.x, node.y, w + 1, node.height);
		}

		this.DrawCursorRect();
		this.DrawHoveredRect();
	}

	GetWAndH() {
		return [this.colWidth * this.scale, this.rowHeight * this.scale];
	}

	DrawCursorRect() {
		const [w, h] = this.GetWAndH();

		this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";

		const xPos = this.mouseX - this.gameCanvas.getBoundingClientRect().x;
		const yPos = this.mouseY - this.gameCanvas.getBoundingClientRect().y;

		const canvW =
			this.gameCanvas.getBoundingClientRect().width /
			this.gameCanvas.width;
		const canvH =
			this.gameCanvas.getBoundingClientRect().height /
			this.gameCanvas.height;

		this.ctx.fillRect(xPos / canvW - w / 2, yPos / canvH - h / 2, w, h);
	}

	DrawHoveredRect() {
		if (this.hoveredNode === null) {
			return;
		}

		const [w, h] = this.GetWAndH();

		this.ctx.fillStyle = "rgba(0, 174, 255, 0.5)";

		this.ctx.fillRect(
			this.hoveredNode.x * w + this.XOffset * w,
			this.hoveredNode.y * h + this.YOffset * h,
			w,
			h
		);
	}

	MouseDown() {
		this.mouseDown = true;
	}

	MouseUp() {
		this.mouseDown = false;
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
			this.GenerateCols();
			this.XOffset -= MoveScale;
		}

		if (this.mouseDown) {
			if (this.hoveredNode !== null) {
				this.hoveredNode.type = Nodes.CHEESE;

				shouldFindRenderMap = true;
			}
		}

		if (shouldFindRenderMap) {
			this.CalculateRenderMap();
		}

		this.GetMouseHover();

		this.lastFrameTime = Date.now();

		setTimeout(this.Update.bind(this), 1000 / this.FPS);
	}
}
