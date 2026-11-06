function extractSubPolygonsFromSvgPath(pathD) {
  if (!pathD || typeof pathD !== 'string') return [];

  const tokens = pathD.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return [];

  const polygons = [];
  let currentPolygon = [];
  let currX = 0;
  let currY = 0;
  let subStartX = 0;
  let subStartY = 0;

  let i = 0;
  function isNextNumber() {
    if (i >= tokens.length) return false;
    const t = tokens[i];
    return !/^[a-zA-Z]$/.test(t);
  }

  function nextNumber() {
    if (i >= tokens.length) return NaN;
    const n = parseFloat(tokens[i++]);
    return Number.isFinite(n) ? n : NaN;
  }

  function commitSubPolygon() {
    if (currentPolygon.length >= 3) {
      polygons.push(currentPolygon);
    }
    currentPolygon = [];
  }

  function addPoint(x, y) {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      // Avoid consecutive duplicate vertices
      const len = currentPolygon.length;
      if (len === 0 || currentPolygon[len - 1][0] !== x || currentPolygon[len - 1][1] !== y) {
        currentPolygon.push([x, y]);
      }
    }
  }

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': {
        commitSubPolygon();
        const x = nextNumber();
        const y = nextNumber();
        if (Number.isFinite(x) && Number.isFinite(y)) {
          currX = x;
          currY = y;
          subStartX = x;
          subStartY = y;
          addPoint(currX, currY);
        }
        while (isNextNumber()) {
          const lx = nextNumber();
          const ly = nextNumber();
          if (Number.isFinite(lx) && Number.isFinite(ly)) {
            currX = lx;
            currY = ly;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'm': {
        commitSubPolygon();
        const dx = nextNumber();
        const dy = nextNumber();
        if (Number.isFinite(dx) && Number.isFinite(dy)) {
          currX += dx;
          currY += dy;
          subStartX = currX;
          subStartY = currY;
          addPoint(currX, currY);
        }
        while (isNextNumber()) {
          const ldx = nextNumber();
          const ldy = nextNumber();
          if (Number.isFinite(ldx) && Number.isFinite(ldy)) {
            currX += ldx;
            currY += ldy;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'L': {
        while (isNextNumber()) {
          const x = nextNumber();
          const y = nextNumber();
          if (Number.isFinite(x) && Number.isFinite(y)) {
            currX = x;
            currY = y;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'l': {
        while (isNextNumber()) {
          const dx = nextNumber();
          const dy = nextNumber();
          if (Number.isFinite(dx) && Number.isFinite(dy)) {
            currX += dx;
            currY += dy;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'H': {
        while (isNextNumber()) {
          const x = nextNumber();
          if (Number.isFinite(x)) {
            currX = x;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'h': {
        while (isNextNumber()) {
          const dx = nextNumber();
          if (Number.isFinite(dx)) {
            currX += dx;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'V': {
        while (isNextNumber()) {
          const y = nextNumber();
          if (Number.isFinite(y)) {
            currY = y;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'v': {
        while (isNextNumber()) {
          const dy = nextNumber();
          if (Number.isFinite(dy)) {
            currY += dy;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'Z':
      case 'z': {
        currX = subStartX;
        currY = subStartY;
        commitSubPolygon();
        break;
      }
      default:
        // Ignore or break on unknown
        break;
    }
  }

  commitSubPolygon();
  return polygons;
}

// Test cases
const testPath1 = "M 0.0 0.75 L 337.75 0.75 L 337.75 41.0 L 0.0 41.0 Z M 254.12 41.0 L 337.75 41.0 L 337.75 82.5 L 254.12 82.5 Z";
const res1 = extractSubPolygonsFromSvgPath(testPath1);
console.log("Test 1 (Compound Path with 2 polygons):", res1.length === 2 ? "PASS" : "FAIL", "count =", res1.length);
console.log("  Poly 0 vertices:", res1[0].length, "Poly 1 vertices:", res1[1].length);

const testPath2 = "M 10 10 H 50 V 50 H 10 Z";
const res2 = extractSubPolygonsFromSvgPath(testPath2);
console.log("Test 2 (H and V commands):", res2.length === 1 && res2[0].length === 4 ? "PASS" : "FAIL", res2);

const testPath3 = "m 10 10 l 40 0 l 0 40 l -40 0 z";
const res3 = extractSubPolygonsFromSvgPath(testPath3);
console.log("Test 3 (Relative commands):", res3.length === 1 && res3[0].length === 4 ? "PASS" : "FAIL", res3);

const testPath4 = "M 0 0 L NaN 50 L 50 50 Z";
const res4 = extractSubPolygonsFromSvgPath(testPath4);
console.log("Test 4 (NaN rejection):", res4.length === 0 ? "PASS" : "FAIL");
