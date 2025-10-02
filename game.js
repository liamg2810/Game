/** @type {HTMLCanvasElement} */
const gameCanvas = document.getElementById("game-canvas");

const ctx = gameCanvas.getContext("2d");

const Nodes = {
	STONE: 1,
	WOOD: 2,
	WATER: 3,
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

class Game {
	pollution = 0;
	resourceNodes = [];
	map = [];
	rows = 24;
	rowHeight = 24;
	columns = 5;
	colWidth = 24;

	constructor() {
		this.rowHeight = Math.floor(gameCanvas.clientHeight / this.rows);
		this.colWidth = Math.floor(gameCanvas.clientWidth / this.columns);

		console.log(this.colWidth);
	}

	DrawMap() {
		for (let x = 0; x < this.columns; x++) {
			ctx.fillStyle = `rgb(${Math.floor(
				Math.random() * 255
			)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(
				Math.random() * 255
			)})`;
			ctx.fillRect(x, 0, this.colWidth, this.rowHeight);
		}
	}
}

const game = new Game();
game.DrawMap();
