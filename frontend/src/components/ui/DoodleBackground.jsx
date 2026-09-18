import { useEffect, useRef } from "react";

const BG = "#2f2f2f00";
const FG = "#ffffff";

const LOOP_DURATION = 32000;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

const smoothstep = value => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
};

const phase = (time, start, end) => clamp((time - start) / (end - start));

const makeCircle = (cx, cy, radiusX, radiusY = radiusX, segments = 44) => {
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const angle = Math.PI * 2 * (i / segments);

        points.push([
            cx + Math.cos(angle) * radiusX,
            cy + Math.sin(angle) * radiusY
        ]);
    }

    return points;
};

const makeStar = (cx, cy, outerRadius, innerRadius, points = 5) => {
    const result = [];

    for (let i = 0; i <= points * 2; i++) {
        const angle = -Math.PI / 2 + Math.PI * i / points;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;

        result.push([
            cx + Math.cos(angle) * radius,
            cy + Math.sin(angle) * radius
        ]);
    }

    return result;
};

const makeHeart = (cx, cy, scale = 0.04, segments = 40) => {
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const t = Math.PI * 2 * (i / segments);

        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

        points.push([
            cx + x / 16 * scale,
            cy - y / 16 * scale
        ]);
    }

    return points;
};

const makeSpiral = (cx, cy, radius, turns = 2.4, segments = 55) => {
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const progress = i / segments;
        const angle = Math.PI * 2 * turns * progress;
        const currentRadius = radius * progress;

        points.push([
            cx + Math.cos(angle) * currentRadius,
            cy + Math.sin(angle) * currentRadius
        ]);
    }

    return points;
};

/*
 * ------------------------------------------------------------
 * DRAWING PATHS
 * ------------------------------------------------------------
 */

const WAVE_PATH = [
    [0.18, 0.48],
    [0.23, 0.48],
    [0.27, 0.44],
    [0.31, 0.48],
    [0.35, 0.43],
    [0.39, 0.35],
    [0.43, 0.40],
    [0.47, 0.53],
    [0.51, 0.56],
    [0.55, 0.38],
    [0.59, 0.37],
    [0.63, 0.64],
    [0.67, 0.68],
    [0.71, 0.17],
    [0.76, 0.20],
    [0.80, 0.69],
    [0.84, 0.68],
    [0.89, 0.16]
];

const CIRCLE_PATH = [
    [0.05, -0.18],
    [-0.04, -0.19],
    [-0.13, -0.15],
    [-0.18, -0.08],
    [-0.19, 0.02],
    [-0.16, 0.11],
    [-0.09, 0.17],
    [0.01, 0.19],
    [0.11, 0.17],
    [0.19, 0.12],
    [0.22, 0.05],
    [0.21, -0.02],
    [0.18, -0.07],
    [0.12, -0.10],
    [0.05, -0.11],
    [-0.02, -0.10],
    [-0.09, -0.06]
];

const DOODLES = [
    {
        // Estrella grande arriba, ligeramente fuera del centro.
        paths: [
            makeStar(0.14, 0.19, 0.072, 0.031)
        ]
    },

    {
        // Corazón pequeño bastante más abajo.
        paths: [
            makeHeart(0.31, 0.57, 0.052)
        ]
    },

    {
        // Espiral perdida arriba-centro.
        paths: [
            makeSpiral(0.53, 0.16, 0.046, 2.7)
        ]
    },

    {
        // Cara grande hacia la derecha.
        paths: [
            makeCircle(0.79, 0.34, 0.068, 0.078),

            makeCircle(0.765, 0.315, 0.006, 0.008),
            makeCircle(0.817, 0.312, 0.006, 0.008),

            [
                [0.755, 0.355],
                [0.77, 0.37],
                [0.795, 0.375],
                [0.818, 0.362]
            ]
        ]
    },

    {
        // Montañitas pegadas abajo-izquierda.
        paths: [
            [
                [0.04, 0.82],
                [0.10, 0.71],
                [0.16, 0.79],
                [0.21, 0.66],
                [0.29, 0.81]
            ],

            makeCircle(0.235, 0.625, 0.021)
        ]
    },

    {
        // Flecha atravesando diagonalmente el centro.
        paths: [
            [
                [0.38, 0.72],
                [0.44, 0.66],
                [0.52, 0.61],
                [0.60, 0.54]
            ],

            [
                [0.565, 0.535],
                [0.60, 0.54],
                [0.585, 0.575]
            ]
        ]
    },

    {
        // Check pequeño perdido abajo.
        paths: [
            [
                [0.71, 0.76],
                [0.735, 0.80],
                [0.79, 0.70]
            ]
        ]
    },

    {
        // Garabato raro cerca del borde derecho.
        paths: [
            [
                [0.89, 0.61],
                [0.92, 0.56],
                [0.95, 0.63],
                [0.91, 0.69],
                [0.96, 0.75]
            ]
        ]
    },

    {
        // Mini círculo completamente random.
        paths: [
            makeCircle(0.42, 0.32, 0.024, 0.031)
        ]
    },

    {
        // Trazo suelto debajo de la cara.
        paths: [
            [
                [0.68, 0.49],
                [0.72, 0.51],
                [0.76, 0.48],
                [0.81, 0.52],
                [0.85, 0.49]
            ]
        ]
    },

    {
        // Otra pequeña estrella medio escondida abajo.
        paths: [
            makeStar(0.58, 0.84, 0.038, 0.016)
        ]
    },

    {
        // Garabato vertical absurdo porque sí.
        paths: [
            [
                [0.34, 0.18],
                [0.32, 0.25],
                [0.35, 0.29],
                [0.33, 0.36],
                [0.36, 0.41]
            ]
        ]
    }
];

/*
 * ------------------------------------------------------------
 * PATH SMOOTHING
 * ------------------------------------------------------------
 */

function smoothPath(points, subdivisions = 12) {
    if (points.length < 3) return points;

    const result = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let j = 0; j < subdivisions; j++) {
            const t = j / subdivisions;
            const t2 = t * t;
            const t3 = t2 * t;

            const x =
                0.5 *
                (
                    2 * p1[0] +
                    (-p0[0] + p2[0]) * t +
                    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
                );

            const y =
                0.5 *
                (
                    2 * p1[1] +
                    (-p0[1] + p2[1]) * t +
                    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
                );

            result.push([x, y]);
        }
    }

    result.push(points[points.length - 1]);

    return result;
}

function drawPolyline(ctx, points, progress, width, height, offsetX = 0, offsetY = 0, lineWidth = null) {
    if (progress <= 0 || points.length < 2) return null;

    const smoothed = smoothPath(points);

    const scaled = smoothed.map(([x, y]) => [
        (x + offsetX) * width,
        (y + offsetY) * height
    ]);

    const lengths = [];
    let totalLength = 0;

    for (let i = 1; i < scaled.length; i++) {
        const dx = scaled[i][0] - scaled[i - 1][0];
        const dy = scaled[i][1] - scaled[i - 1][1];
        const length = Math.hypot(dx, dy);

        lengths.push(length);
        totalLength += length;
    }

    let remaining = totalLength * clamp(progress);

    ctx.save();

    if (lineWidth) ctx.lineWidth = lineWidth;

    ctx.beginPath();
    ctx.moveTo(scaled[0][0], scaled[0][1]);

    let tip = scaled[0];

    for (let i = 1; i < scaled.length; i++) {
        const length = lengths[i - 1];

        if (remaining >= length) {
            ctx.lineTo(scaled[i][0], scaled[i][1]);

            remaining -= length;
            tip = scaled[i];

            continue;
        }

        if (remaining > 0) {
            const ratio = remaining / length;

            const x = scaled[i - 1][0] + (scaled[i][0] - scaled[i - 1][0]) * ratio;
            const y = scaled[i - 1][1] + (scaled[i][1] - scaled[i - 1][1]) * ratio;

            ctx.lineTo(x, y);

            tip = [x, y];
        }

        break;
    }

    ctx.stroke();
    ctx.restore();

    return tip;
}

function drawBrushTip(ctx, point, active = true) {
    if (!point || !active) return;

    ctx.save();

    ctx.fillStyle = FG;
    ctx.globalAlpha = 0.9;

    ctx.beginPath();

    ctx.arc(
        point[0],
        point[1],
        5,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha = 0.18;

    ctx.beginPath();

    ctx.arc(
        point[0],
        point[1],
        11,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}

/*
 * ------------------------------------------------------------
 * SELECTION
 * ------------------------------------------------------------
 */

function drawSelection(ctx, centerX, centerY, selectionWidth, selectionHeight, width, height, alpha = 1) {
    const x = (centerX - selectionWidth / 2) * width;
    const y = (centerY - selectionHeight / 2) * height;

    const w = selectionWidth * width;
    const h = selectionHeight * height;

    const handleSize = 6;

    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.strokeStyle = FG;
    ctx.fillStyle = FG;

    ctx.lineWidth = 1.3;

    ctx.setLineDash([
        7,
        7
    ]);

    ctx.strokeRect(
        x,
        y,
        w,
        h
    );

    ctx.setLineDash([]);

    const handles = [
        [x, y],
        [x + w / 2, y],
        [x + w, y],

        [x, y + h / 2],
        [x + w, y + h / 2],

        [x, y + h],
        [x + w / 2, y + h],
        [x + w, y + h]
    ];

    handles.forEach(([hx, hy]) => {
        ctx.fillRect(
            hx - handleSize / 2,
            hy - handleSize / 2,
            handleSize,
            handleSize
        );
    });

    const rotationY = y - 27;

    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, rotationY + 6);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
        x + w / 2,
        rotationY,
        6,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    ctx.restore();
}

/*
 * ------------------------------------------------------------
 * KEYCAPS / HOTKEYS
 * ------------------------------------------------------------
 */

function drawKeycap(ctx, text, x, y, width, height, alpha = 1) {
    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.strokeStyle = FG;
    ctx.fillStyle = FG;

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    ctx.roundRect(
        x,
        y,
        width,
        height,
        7
    );

    ctx.stroke();

    ctx.font = `600 ${Math.max(11, height * 0.36)}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        text,
        x + width / 2,
        y + height / 2
    );

    ctx.restore();
}

function drawHotkey(ctx, keys, centerX, centerY, alpha = 1) {
    const height = 34;
    const gap = 7;

    const widths = keys.map(key =>
        Math.max(
            38,
            key.length * 9 + 18
        )
    );

    const totalWidth =
        widths.reduce((sum, value) => sum + value, 0) +
        gap * (keys.length - 1);

    let x = centerX - totalWidth / 2;

    keys.forEach((key, index) => {
        drawKeycap(
            ctx,
            key,
            x,
            centerY - height / 2,
            widths[index],
            height,
            alpha
        );

        x += widths[index] + gap;
    });
}

/*
 * ------------------------------------------------------------
 * IMAGE / CLIPBOARD CARD
 * ------------------------------------------------------------
 */

function drawImageCard(ctx, centerX, centerY, cardWidth, cardHeight, width, height, alpha = 1) {
    const x = (centerX - cardWidth / 2) * width;
    const y = (centerY - cardHeight / 2) * height;

    const w = cardWidth * width;
    const h = cardHeight * height;

    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.strokeStyle = FG;
    ctx.fillStyle = FG;

    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(
        x,
        y,
        w,
        h,
        18
    );

    ctx.stroke();

    /*
     * Sol.
     */
    ctx.beginPath();

    ctx.arc(
        x + w * 0.76,
        y + h * 0.27,
        Math.min(w, h) * 0.07,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    /*
     * Montañas.
     */
    ctx.beginPath();

    ctx.moveTo(
        x + w * 0.12,
        y + h * 0.78
    );

    ctx.lineTo(
        x + w * 0.34,
        y + h * 0.48
    );

    ctx.lineTo(
        x + w * 0.50,
        y + h * 0.66
    );

    ctx.lineTo(
        x + w * 0.64,
        y + h * 0.42
    );

    ctx.lineTo(
        x + w * 0.88,
        y + h * 0.78
    );

    ctx.stroke();

    /*
     * Mini carita tipo meme/doodle.
     */
    ctx.beginPath();

    ctx.arc(
        x + w * 0.27,
        y + h * 0.25,
        Math.min(w, h) * 0.10,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
        x + w * 0.24,
        y + h * 0.23,
        2.5,
        0,
        Math.PI * 2
    );

    ctx.arc(
        x + w * 0.30,
        y + h * 0.23,
        2.5,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        x + w * 0.27,
        y + h * 0.27,
        10,
        0.15,
        Math.PI - 0.15
    );

    ctx.stroke();

    ctx.restore();
}

/*
 * ------------------------------------------------------------
 * TEXT
 * ------------------------------------------------------------
 */

function drawTypedText(ctx, text, progress, width, height, reverse = false) {
    let characters;

    if (reverse) {
        characters = Math.ceil(text.length * (1 - progress));
    } else {
        characters = Math.floor(text.length * progress);
    }

    const visibleText = text.slice(
        0,
        characters
    );

    if (!visibleText) return;

    const fontSize = Math.max(
        48,
        Math.min(
            94,
            width * 0.055
        )
    );

    ctx.save();

    ctx.fillStyle = FG;
    ctx.globalAlpha = 0.95;

    ctx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        visibleText,
        width * 0.5,
        height * 0.5
    );

    /*
     * Cursor.
     */
    const metrics = ctx.measureText(visibleText);

    const cursorX =
        width * 0.5 +
        metrics.width / 2 +
        10;

    ctx.globalAlpha = 0.65;

    ctx.fillRect(
        cursorX,
        height * 0.5 - fontSize * 0.42,
        3,
        fontSize * 0.84
    );

    ctx.restore();
}

/*
 * ------------------------------------------------------------
 * TIMER
 * ------------------------------------------------------------
 */

function drawTimer(ctx, progress, width, height) {
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    const radius = Math.min(
        width,
        height
    ) * 0.095;

    const remaining =
        3 -
        Math.floor(
            clamp(progress) * 3
        );

    ctx.save();

    ctx.strokeStyle = FG;
    ctx.fillStyle = FG;

    ctx.lineWidth = 4;

    ctx.globalAlpha = 0.2;

    ctx.beginPath();

    ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    ctx.globalAlpha = 0.95;

    ctx.beginPath();

    ctx.arc(
        centerX,
        centerY,
        radius,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (1 - progress)
    );

    ctx.stroke();

    ctx.font = `700 ${radius * 0.75}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        Math.max(1, remaining),
        centerX,
        centerY
    );

    ctx.restore();
}

/*
 * ------------------------------------------------------------
 * DOODLE SHOWCASE
 * ------------------------------------------------------------
 */

function drawDoodles(ctx, progress, width, height) {
    const totalPaths = DOODLES.reduce(
        (sum, doodle) =>
            sum +
            doodle.paths.length,
        0
    );

    let currentPath = 0;

    DOODLES.forEach(doodle => {
        doodle.paths.forEach(path => {
            const localProgress = clamp(
                progress * totalPaths -
                currentPath
            );

            drawPolyline(
                ctx,
                path,
                localProgress,
                width,
                height,
                0,
                0,
                Math.max(
                    4,
                    height * 0.007
                )
            );

            currentPath++;
        });
    });
}

/*
 * ------------------------------------------------------------
 * COMPONENT
 * ------------------------------------------------------------
 */

export default function DoodleBackground({ className = "z-[1]" }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        let frameId;

        let width = 0;
        let height = 0;

        const startTime =
            performance.now();

        const resize = () => {
            const dpr = Math.min(
                window.devicePixelRatio || 1,
                2
            );

            width =
                window.innerWidth;

            height =
                window.innerHeight;

            canvas.width =
                Math.round(width * dpr);

            canvas.height =
                Math.round(height * dpr);

            canvas.style.width =
                `${width}px`;

            canvas.style.height =
                `${height}px`;

            ctx.setTransform(
                dpr,
                0,
                0,
                dpr,
                0,
                0
            );
        };

        const render = now => {
            const elapsed =
                (now - startTime) %
                LOOP_DURATION;

            ctx.clearRect(
                0,
                0,
                width,
                height
            );

            ctx.fillStyle = BG;

            ctx.fillRect(
                0,
                0,
                width,
                height
            );

            ctx.strokeStyle = FG;
            ctx.fillStyle = FG;

            ctx.lineWidth = Math.max(
                7,
                Math.min(
                    15,
                    height * 0.013
                )
            );

            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.globalAlpha = 0.92;

            /*
             * ==================================================
             * 1. DRAW
             * ==================================================
             */

            if (elapsed < 2600) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            0,
                            2600
                        )
                    );

                const tip =
                    drawPolyline(
                        ctx,
                        WAVE_PATH,
                        progress,
                        width,
                        height
                    );

                drawBrushTip(
                    ctx,
                    tip,
                    progress < 1
                );
            }

            /*
             * ==================================================
             * 2. ERASE / UNDO DRAWING
             * ==================================================
             */

            else if (elapsed < 4000) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            2600,
                            4000
                        )
                    );

                drawPolyline(
                    ctx,
                    WAVE_PATH,
                    1 - progress,
                    width,
                    height
                );
            }

            /*
             * ==================================================
             * 3. CIRCLE
             * ==================================================
             */

            else if (elapsed >= 4300 && elapsed < 6200) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            4300,
                            6200
                        )
                    );

                const tip =
                    drawPolyline(
                        ctx,
                        CIRCLE_PATH,
                        progress,
                        width,
                        height,
                        0.42,
                        0.51
                    );

                drawBrushTip(
                    ctx,
                    tip,
                    progress < 1
                );
            }

            /*
             * ==================================================
             * 4. SELECT
             * ==================================================
             */

            else if (elapsed >= 6200 && elapsed < 7000) {
                drawPolyline(
                    ctx,
                    CIRCLE_PATH,
                    1,
                    width,
                    height,
                    0.42,
                    0.51
                );

                drawSelection(
                    ctx,
                    0.42,
                    0.51,
                    0.50,
                    0.48,
                    width,
                    height,
                    smoothstep(
                        phase(
                            elapsed,
                            6200,
                            7000
                        )
                    )
                );
            }

            /*
             * ==================================================
             * 5. MOVE
             * ==================================================
             */

            else if (elapsed >= 7000 && elapsed < 8700) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            7000,
                            8700
                        )
                    );

                const x =
                    lerp(
                        0.42,
                        0.65,
                        progress
                    );

                const y =
                    lerp(
                        0.51,
                        0.43,
                        progress
                    );

                drawPolyline(
                    ctx,
                    CIRCLE_PATH,
                    1,
                    width,
                    height,
                    x,
                    y
                );

                drawSelection(
                    ctx,
                    x,
                    y,
                    0.50,
                    0.48,
                    width,
                    height
                );
            }

            /*
             * ==================================================
             * 6. COPY / PASTE
             * ==================================================
             */

            else if (elapsed >= 8700 && elapsed < 10400) {
                const pasteProgress =
                    smoothstep(
                        phase(
                            elapsed,
                            9100,
                            9800
                        )
                    );

                drawPolyline(
                    ctx,
                    CIRCLE_PATH,
                    1,
                    width,
                    height,
                    0.65,
                    0.43
                );

                drawSelection(
                    ctx,
                    0.65,
                    0.43,
                    0.50,
                    0.48,
                    width,
                    height
                );

                if (elapsed < 9400) {
                    drawHotkey(
                        ctx,
                        [
                            "CTRL",
                            "C"
                        ],
                        width * 0.5,
                        height * 0.84,
                        1
                    );
                } else {
                    drawHotkey(
                        ctx,
                        [
                            "CTRL",
                            "V"
                        ],
                        width * 0.5,
                        height * 0.84,
                        clamp(
                            1 -
                            phase(
                                elapsed,
                                9900,
                                10400
                            )
                        )
                    );
                }

                if (elapsed >= 9100) {
                    ctx.save();

                    ctx.globalAlpha =
                        pasteProgress;

                    drawPolyline(
                        ctx,
                        CIRCLE_PATH,
                        1,
                        width,
                        height,
                        0.32,
                        0.62
                    );

                    ctx.restore();
                }
            }

            /*
             * ==================================================
             * 7. DELETE
             * ==================================================
             *
             * 10400 - 11000 vacío.
             */

            /*
             * ==================================================
             * 8. DOODLE PARTY
             * ==================================================
             */

            else if (elapsed >= 11000 && elapsed < 15300) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            11000,
                            15300
                        )
                    );

                drawDoodles(
                    ctx,
                    progress,
                    width,
                    height
                );
            }

            /*
             * ==================================================
             * 9. HISTORY - UNDO
             * ==================================================
             */

            else if (elapsed >= 15300 && elapsed < 17400) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            15300,
                            17400
                        )
                    );

                drawDoodles(
                    ctx,
                    1 - progress * 0.68,
                    width,
                    height
                );

                drawHotkey(
                    ctx,
                    [
                        "CTRL",
                        "Z"
                    ],
                    width * 0.5,
                    height * 0.84,
                    Math.sin(
                        progress *
                        Math.PI
                    )
                );
            }

            /*
             * ==================================================
             * 10. REDO
             * ==================================================
             */

            else if (elapsed >= 17400 && elapsed < 18800) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            17400,
                            18800
                        )
                    );

                drawDoodles(
                    ctx,
                    lerp(
                        0.32,
                        1,
                        progress
                    ),
                    width,
                    height
                );

                drawHotkey(
                    ctx,
                    [
                        "CTRL",
                        "Y"
                    ],
                    width * 0.5,
                    height * 0.84,
                    Math.sin(
                        progress *
                        Math.PI
                    )
                );
            }

            /*
             * ==================================================
             * 11. CLEAR
             * ==================================================
             */

            else if (elapsed >= 18800 && elapsed < 19900) {
                const progress =
                    smoothstep(
                        phase(
                            elapsed,
                            18800,
                            19900
                        )
                    );

                drawDoodles(
                    ctx,
                    1 - progress,
                    width,
                    height
                );
            }

            /*
             * ==================================================
             * 12. CLIPBOARD IMAGE
             * ==================================================
             */

            else if (elapsed >= 20200 && elapsed < 23200) {
                const appear =
                    smoothstep(
                        phase(
                            elapsed,
                            20200,
                            20900
                        )
                    );

                const move =
                    smoothstep(
                        phase(
                            elapsed,
                            21400,
                            22800
                        )
                    );

                const x =
                    lerp(
                        0.42,
                        0.56,
                        move
                    );

                const y =
                    lerp(
                        0.52,
                        0.44,
                        move
                    );

                drawImageCard(
                    ctx,
                    x,
                    y,
                    0.30,
                    0.32,
                    width,
                    height,
                    appear
                );

                drawSelection(
                    ctx,
                    x,
                    y,
                    0.34,
                    0.38,
                    width,
                    height,
                    appear
                );

                if (elapsed < 21100) {
                    drawHotkey(
                        ctx,
                        [
                            "CTRL",
                            "V"
                        ],
                        width * 0.5,
                        height * 0.82,
                        appear
                    );
                }
            }

            /*
             * ==================================================
             * 13. TEXT
             * ==================================================
             */

            else if (elapsed >= 23800 && elapsed < 26400) {
                drawTypedText(
                    ctx,
                    "Tu texto aqui",
                    phase(
                        elapsed,
                        23800,
                        26400
                    ),
                    width,
                    height
                );
            }

            /*
             * ==================================================
             * 14. TEXT HOLD
             * ==================================================
             */

            else if (elapsed >= 26400 && elapsed < 27200) {
                drawTypedText(
                    ctx,
                    "Tu texto aqui",
                    1,
                    width,
                    height
                );
            }

            /*
             * ==================================================
             * 15. BACKSPACE
             * ==================================================
             */

            else if (elapsed >= 27200 && elapsed < 29200) {
                drawTypedText(
                    ctx,
                    "Tu texto aqui",
                    phase(
                        elapsed,
                        27200,
                        29200
                    ),
                    width,
                    height,
                    true
                );
            }

            /*
             * ==================================================
             * 16. TIMER
             * ==================================================
             */

            else if (elapsed >= 29600 && elapsed < 31500) {
                drawTimer(
                    ctx,
                    phase(
                        elapsed,
                        29600,
                        31500
                    ),
                    width,
                    height
                );
            }

            /*
             * 31500 - 32000
             *
             * vacío.
             *
             * Perfecto para esconder el salto del loop.
             */

            ctx.globalAlpha = 1;

            frameId =
                requestAnimationFrame(
                    render
                );
        };

        window.addEventListener(
            "resize",
            resize
        );

        resize();

        frameId =
            requestAnimationFrame(
                render
            );

        return () => {
            cancelAnimationFrame(
                frameId
            );

            window.removeEventListener(
                "resize",
                resize
            );
        };
    }, []);

    return <canvas ref={canvasRef} className={`pointer-events-none fixed inset-0 h-[100dvh] w-screen ${className}`} aria-hidden="true" />;
}