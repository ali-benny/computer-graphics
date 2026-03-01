import { compute_bezier } from './compute_bezier.js';

var canvas; // Riferimento all'elemento canvas HTML
var ctx; // Contesto di rendering 2D del canvas
var WIDTH = 400; // Larghezza del canvas in pixel
var HEIGHT = 400; // Altezza del canvas in pixel
var C = 10; // Raggio dei punti di controllo (per il disegno e l'hit detection)
var drag_ok = false; // Flag che indica se il trascinamento è attivo

var loc, bbox; // loc: posizione corrente del mouse, bbox: bounding box del canvas
var point = []; // Array di flag per tracciare quali punti sono selezionati
var xt = [], // Array delle coordinate x dei punti di controllo
	yt = []; // Array delle coordinate y dei punti di controllo
const n = 4; // Numero di punti di controllo per la curva di Bézier cubica
var np = 0, // Numero di punti attualmente inseriti
	flag = 0; // Flag che indica se tutti i punti sono stati inseriti (0: in inserimento, 1: completo)

var view = {
	xmin: 0,
	xmax: 0,
	ymin: 0,
	ymax: 0
};
var win = {
	xmin: 0,
	xmax: 0,
	ymin: 0,
	ymax: 0
};
var sc = {
	x: 0,
	y: 0
};

function init() {
	canvas = document.getElementById('mycanvas');
	document.getElementById('move-canvas').style.left = WIDTH + 'px';
	document.getElementById('move-canvas').style.top = HEIGHT + 'px';
	ctx = canvas.getContext('2d');
	canvas.setAttribute('width', WIDTH);
	canvas.setAttribute('height', HEIGHT);

	view.xmin = 0;
	view.xmax = WIDTH;
	view.ymin = 0;
	view.ymax = HEIGHT;

	win.xmin = -1.0;
	win.xmax = 1.0;
	win.ymin = -1.0;
	win.ymax = 1.0;

	sc.x = (view.xmax - view.xmin) / (win.xmax - win.xmin);
	sc.y = (view.ymax - view.ymin) / (win.ymax - win.ymin);

	//setInterval(draw, 10);
}

function restart() {
	np = 0;
	flag = 0;
	clear();
}

function draw_rect(x, y, w, h, col) {
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.closePath();
	ctx.fill();
}

function clear() {
	ctx.clearRect(0, 0, WIDTH, HEIGHT);
}

function windowToCanvas(canvas, x, y) {
	var bbox = canvas.getBoundingClientRect();
	return {
		x: Math.round((x - bbox.left) * (canvas.width / bbox.width)),
		y: Math.round((y - bbox.top) * (canvas.height / bbox.height))
	};
}

function viewToWindows(px, py) {
	if (px == 0)
		// py = Yw = (Vymax - Yv) / Scy + Wymin
		return (view.ymax - py) / sc.y + win.ymin;
	// px = (Xv - Vxmin) / Scx + Wxmin
	return (px - view.xmin) / sc.x + win.xmin;
}

function draw() {
	if (flag == 1) {
		clear();
		draw_rect(0, 0, WIDTH, HEIGHT, '#FAF7F8');

		draw_line(xt[0], yt[0], xt[1], yt[1], '#a97777');
		draw_line(xt[2], yt[2], xt[3], yt[3], '#a97777');

		draw_circ(xt[0], yt[0], C, '#a97777');
		draw_circ(xt[3], yt[3], C, '#a97777');
		draw_rect(xt[1] - C, yt[1] - C, 2 * C, 2 * C, '#000000');
		draw_rect(xt[2] - C, yt[2] - C, 2 * C, 2 * C, '#000000');

		// convertire in coordinate floating point
		var vxt = xt.map((x) => viewToWindows(x, 0));
		var vyt = yt.map((y) => viewToWindows(0, y));
		var vp = compute_bezier(vxt, vyt, sc, view, win);
		stroke_bezier(vp.ixp, vp.iyp);
	}
}

function stroke_bezier(ixp, iyp) {
	ctx.strokeStyle = '#ac50ce';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(ixp[0], iyp[0]);
	for (var k = 1; k < ixp.length; k++) ctx.lineTo(ixp[k], iyp[k]);
	ctx.stroke();
}

function draw_circ(pAx, pAy, r, col) {
	ctx.strokeStyle = col;
	ctx.beginPath();
	ctx.fillStyle = col;
	ctx.arc(pAx, pAy, r, 0, Math.PI * 2, true);
	ctx.fill();
}

function draw_line(pAx, pAy, pBx, pBy, col) {
	//  ctx.strokeStyle = "#0095cd";
	ctx.strokeStyle = col;
	ctx.beginPath();
	ctx.moveTo(pAx, pAy);
	ctx.lineTo(pBx, pBy);
	ctx.stroke();
}

function myMove(e, ret) {
	if (drag_ok) {
		for (let i = 0; i < n; i++)
			if (point[i]) {
				loc = windowToCanvas(canvas, e.pageX, e.pageY);
				xt[i] = loc.x;
				yt[i] = loc.y;
			}
		//window.requestAnimationFrame(draw);
		draw();
	}
	if (canvasDragging && ret) return { xt: xt, yt: yt };
}

function myUp() {
	drag_ok = false;
	canvasDragging = false;
	//    canvas.onmousemove = null;
}

/**
 * When the mouse is pressed down
 * @param {*} e
 */
function myDown(e) {
	if (np == 0) restart();
	if (np < n && flag == 0) {
		loc = windowToCanvas(canvas, e.pageX, e.pageY);
		xt[np] = loc.x;
		yt[np] = loc.y;
		if (np == 1 || np == 3) draw_line(xt[np - 1], yt[np - 1], xt[np], yt[np]); // collega i punti di controllo
		// disegna punto selezionato
		if (np == 0 || np == 3) draw_circ(xt[np], yt[np], C, '#a97777');
		else draw_rect(xt[np] - C, yt[np] - C, 2 * C, 2 * C, '#000000');
		np++;

		if (np == n) {
			// disegna poligonale
			flag = 1;
			//window.requestAnimationFrame(draw);
			draw();
		}
	} else {
		point = [];
		loc = windowToCanvas(canvas, e.pageX, e.pageY);
		for (var i = 0; i < n; i++)
			if (loc.x < xt[i] + C && loc.x > xt[i] - C && loc.y < yt[i] + C && loc.y > yt[i] - C) {
				point[i] = true;
				drag_ok = true;
				//              canvas.onmousemove = myMove;
			}
	}
}

// -- transformationi geometriche --
function transform(reset = false) {
	var scaleX = parseFloat(document.getElementById('scaleX').value);
	var scaleY = parseFloat(document.getElementById('scaleY').value);
	var translateX = parseFloat(document.getElementById('translateX').value);
	var translateY = parseFloat(document.getElementById('translateY').value);
	var rotateAngle = parseFloat(document.getElementById('rotateAngle').value);

	let transformations = [
		scale_matrix(scaleX, scaleY),
		translate_matrix(translateX, translateY),
		rotate_matrix(rotateAngle)
	];

	if (reset) {
		scaleX = -scaleX;
		scaleY = -scaleY;
		translateX = translateX == 0 ? 0 : -translateX;
		translateY = translateY == 0 ? 0 : -translateY;
		rotateAngle = rotateAngle == 0 ? 0 : -rotateAngle;
		transformations = transformations.map((matrix) => math.inv(matrix));
	}
	// Applica le trasformazioni ai punti di controllo
	for (let i = 0; i < n; i++) {
		for (let key in transformations) {
			let [newX, newY, one] = math
				.multiply(transformations[key], math.matrix([xt[i], yt[i], 1]))
				.valueOf();
			xt[i] = newX;
			yt[i] = newY;
		}
	}
	if (reset) {
		scaleX = 1;
		scaleY = 1;
		translateX = 0;
		translateY = 0;
		rotateAngle = 0;
		document.getElementById('scaleX').value = scaleX;
		document.getElementById('scaleY').value = scaleY;
		document.getElementById('translateX').value = translateX;
		document.getElementById('translateY').value = translateY;
		document.getElementById('rotateAngle').value = rotateAngle;
	}
	draw();
}

const scale_matrix = (scaleX, scaleY) =>
	math.matrix([
		[scaleX, 0, 0],
		[0, scaleY, 0],
		[0, 0, 1]
	]);

const translate_matrix = (dx, dy) =>
	math.matrix([
		[1, 0, dx],
		[0, 1, dy],
		[0, 0, 1]
	]);

const rotate_matrix = (angle) =>
	math.matrix([
		[Math.cos((angle * Math.PI) / 180), -Math.sin((angle * Math.PI) / 180), 0],
		[Math.sin((angle * Math.PI) / 180), Math.cos((angle * Math.PI) / 180), 0],
		[0, 0, 1]
	]);

// -- move Canvas --
var canvasDragging = false;
var pMouse,
	pCanvas,
	delta = { x: 0, y: 0 };
var initialPoint = null;
let dx, dy;
const btn = document.getElementById('move-canvas');

function moveCanvas(e) {
	canvasDragging = true;
	pMouse = { x: e.clientX, y: e.clientY };
	pCanvas = { x: canvas.offsetLeft, y: canvas.offsetTop };

	initialPoint = {
		x: [...xt],
		y: [...yt]
	};

	document.addEventListener('mousemove', moveCanvasMove);
	document.addEventListener('mouseup', moveCanvasEnd);
}

function moveCanvasMove(e) {
	if (canvasDragging) {
		dx = e.clientX - pMouse.x;
		dy = e.clientY - pMouse.y;

		canvas.style.transform = `translate(${delta.x + dx}px, ${delta.y + dy}px)`;
		btn.style.transform = `translate(${delta.x + dx}px, ${delta.y + dy}px)`;

		// Aggiorna i punti di controllo in base al delta totale
		for (let i = 0; i < n; i++) {
			let [newX, newY, one] = math
				.multiply(
					translate_matrix(-dx, -dy),
					math.matrix([initialPoint.x[i], initialPoint.y[i], 1])
				)
				.valueOf();
			xt[i] = newX;
			yt[i] = newY;
		}
		draw();
	}
}

function moveCanvasEnd(e) {
	canvasDragging = false;

	dx = e.clientX - pMouse.x;
	dy = e.clientY - pMouse.y;

	delta.x += dx;
	delta.y += dy;

	// Applica la trasformazione finale ai punti
	for (let i = 0; i < n; i++) {
		let [newX, newY, one] = math
			.multiply(
				translate_matrix(-dx, -dy),
				math.matrix([initialPoint.x[i], initialPoint.y[i], 1])
			)
			.valueOf();
		xt[i] = newX;
		yt[i] = newY;
	}
	draw();
	document.removeEventListener('mousemove', moveCanvasMove);
	document.removeEventListener('mouseup', moveCanvasEnd);
}

init();
canvas.onmousedown = myDown;
canvas.onmouseup = myUp;
canvas.onmousemove = myMove;
window.restart = restart;
window.transform = transform;

document.getElementById('move-canvas').onmousedown = moveCanvas;
