const K = 1.486;
const G = 32;

function wsePlotData(XSdata, wse) {
  let minX = 9999, maxX = -9999;
  for(let i = 1; i <= XSdata.length; i++){
    if(XSdata[i-1].x < minX) minX = XSdata[i-1].x;
    if(XSdata[i-1].x > maxX) maxX = XSdata[i-1].x;
  }
  return [{x: minX, y: wse}, {x: maxX, y: wse}];
}

function areaUnderCurve(XSdata) {
  let area = 0;
  for(let i = 0; i < XSdata.length - 1; i++)
    area += ((XSdata[i].y + XSdata[i+1].y) / 2) * (XSdata[i+1].x - XSdata[i].x);
  return area;
}

function lineInterpolate(point1, point2, XorY, value) {
  const result = {};
  if(XorY === 'x'){
    result.y = value;
    const ratio = (value - point1.y) / (point2.y - point1.y);
    result.x = Math.round(point1.x + ratio * (point2.x - point1.x));
  }
  if(XorY === 'y'){
    result.x = value;
    const ratio = (value - point1.x) / (point2.x - point1.x);
    result.y = Math.round(point1.y + ratio * (point2.y - point1.y));
  }
  return result;
}

function getGroundElevation(xsData, targetX) {
  for (let i = 0; i < xsData.length - 1; i++) {
    let x1 = xsData[i].x, y1 = xsData[i].y;
    let x2 = xsData[i+1].x, y2 = xsData[i+1].y;
    if (targetX >= x1 && targetX <= x2) {
      if (x1 === x2) return y1;
      let ratio = (targetX - x1) / (x2 - x1);
      return y1 + ratio * (y2 - y1);
    }
  }
  if (targetX <= xsData[0].x) return xsData[0].y;
  return xsData[xsData.length - 1].y;
}

// Subdivides cross-section with bank stations and computes compound conveyance
function getSubdividedHydraulics(xsData, wse, leftBank, rightBank, n_lob, n_ch, n_rob) {
  // Ensure leftBank < rightBank
  let lb = Math.min(leftBank, rightBank);
  let rb = Math.max(leftBank, rightBank);

  // Insert bank stations into xsData if not already present
  let expanded = [];
  let addedLeft = false, addedRight = false;
  
  for (let i = 0; i < xsData.length; i++) {
    let pt = xsData[i];
    if (!addedLeft && pt.x > lb) {
      expanded.push({x: lb, y: getGroundElevation(xsData, lb)});
      addedLeft = true;
    }
    if (pt.x === lb) addedLeft = true;
    
    if (!addedRight && pt.x > rb) {
      expanded.push({x: rb, y: getGroundElevation(xsData, rb)});
      addedRight = true;
    }
    if (pt.x === rb) addedRight = true;

    expanded.push({...pt});
  }
  if (!addedLeft) expanded.push({x: lb, y: getGroundElevation(xsData, lb)});
  if (!addedRight) expanded.push({x: rb, y: getGroundElevation(xsData, rb)});

  // Sort expanded by x
  expanded.sort((a, b) => a.x - b.x);

  // Trim ground to WSE
  const trimmed = [];
  for(let i = 0; i < expanded.length - 1; i++){
    let yVal1 = expanded[i].y > wse ? wse : expanded[i].y;
    let yVal2 = expanded[i+1].y > wse ? wse : expanded[i+1].y;
    trimmed.push({x: expanded[i].x, y: yVal1});
    if((expanded[i].y > wse) && (expanded[i+1].y < wse))
      trimmed.push(lineInterpolate(expanded[i], expanded[i+1], 'x', wse));
    if((expanded[i].y < wse) && (expanded[i+1].y > wse))
      trimmed.push(lineInterpolate(expanded[i], expanded[i+1], 'x', wse));
  }
  let lastY = expanded[expanded.length-1].y > wse ? wse : expanded[expanded.length-1].y;
  trimmed.push({x: expanded[expanded.length-1].x, y: lastY});

  // Calculate sub-areas and wetted perimeters for LOB, CH, ROB
  let areaLob = 0, wetPLob = 0;
  let areaCh = 0, wetPCh = 0;
  let areaRob = 0, wetPRob = 0;
  let totalWidth = 0;

  for(let i = 0; i < trimmed.length - 1; i++){
    let p1 = trimmed[i], p2 = trimmed[i+1];
    let midX = (p1.x + p2.x) / 2;
    let dx = p2.x - p1.x;
    if (dx <= 0) continue;

    // Segment area below WSE
    let segArea = ((wse - p1.y) + (wse - p2.y)) / 2 * dx;
    let segWetP = Math.sqrt(Math.pow(dx, 2) + Math.pow(p1.y - p2.y, 2));
    let isSubmerged = (p1.y < wse || p2.y < wse);

    if (midX < lb) {
      if (isSubmerged) { areaLob += segArea; wetPLob += segWetP; totalWidth += dx; }
    } else if (midX >= lb && midX <= rb) {
      if (isSubmerged) { areaCh += segArea; wetPCh += segWetP; totalWidth += dx; }
    } else {
      if (isSubmerged) { areaRob += segArea; wetPRob += segWetP; totalWidth += dx; }
    }
  }

  // Conveyances
  let kLob = wetPLob > 0 ? (K / n_lob) * areaLob * Math.pow(areaLob / wetPLob, 2/3) : 0;
  let kCh  = wetPCh > 0  ? (K / n_ch)  * areaCh  * Math.pow(areaCh / wetPCh, 2/3)   : 0;
  let kRob = wetPRob > 0 ? (K / n_rob) * areaRob * Math.pow(areaRob / wetPRob, 2/3) : 0;

  let totalConveyance = kLob + kCh + kRob;
  let totalArea = areaLob + areaCh + areaRob;
  let totalWetP = wetPLob + wetPCh + wetPRob;

  return {
    totalConveyance,
    totalArea,
    totalWetP,
    totalWidth
  };
}

function calcVel(Q, A){ return Q / A; }

function calcFroude(avgVel, avgDepth){
  return avgVel / (Math.sqrt(G * avgDepth));
}

function mannings(slope, n_lob, n_ch, n_rob, discharge, wse, xsData, leftBank, rightBank, solveFor){
  if(solveFor === 'q'){
    const res = getSubdividedHydraulics(xsData, wse, leftBank, rightBank, n_lob, n_ch, n_rob);
    return res.totalConveyance * Math.pow(slope, 0.5);
  }
  if(solveFor === 's'){
    const res = getSubdividedHydraulics(xsData, wse, leftBank, rightBank, n_lob, n_ch, n_rob);
    return Math.pow(discharge / res.totalConveyance, 2);
  }
  if(solveFor === 'n'){
    const res = getSubdividedHydraulics(xsData, wse, leftBank, rightBank, n_lob, n_ch, n_rob);
    // Solves for equivalent main channel n scaling
    return (K * res.totalArea * Math.pow(res.totalArea / res.totalWetP, 2/3) * Math.pow(slope, 0.5)) / discharge;
  }
  if(solveFor === 'wse'){
    let iterate = true, i = 0, minGround = 9999, maxGround = -9999;
    for(i = 0; i < xsData.length - 1; i++){
      if(xsData[i].y < minGround) minGround = xsData[i].y;
      if(xsData[i].y > maxGround) maxGround = xsData[i].y;
    }
    if(wse < minGround) wse = minGround + 5;
    if(wse > maxGround) wse = minGround + 5;

    let newDischarge = 0, diff = Infinity;
    while(iterate){
      const res = getSubdividedHydraulics(xsData, wse, leftBank, rightBank, n_lob, n_ch, n_rob);
      newDischarge = res.totalConveyance * Math.pow(slope, 0.5);
      diff = Math.abs(newDischarge - discharge);

      if(diff > discharge * 0.003) iterate = true;
      else iterate = false;

      const direction = newDischarge > discharge ? -1 : 1;
      wse = wse + (direction * 0.005);
      i++;
      if(i > 5000 || diff < (discharge * 0.0001)) iterate = false;
    }
    return {wse, iterations: i, lastQ: newDischarge, lastDiff: diff};
  }
}

function solveAndReport({slope, n_lob, n_ch, n_rob, q, wse, xsData, leftBank, rightBank, solveFor = 'wse'}){
  let solvedQ = q;
  let solvedWse = wse, solvedN = n_ch, solvedSlope = slope, iterations = 0;
  
  if(solveFor === 'q') solvedQ = mannings(slope, n_lob, n_ch, n_rob, q, wse, xsData, leftBank, rightBank, 'q');
  if(solveFor === 'wse'){
    const r = mannings(slope, n_lob, n_ch, n_rob, q, wse, xsData, leftBank, rightBank, 'wse');
    solvedWse = r.wse; iterations = r.iterations;
  }
  if(solveFor === 'n') solvedN = mannings(slope, n_lob, n_ch, n_rob, q, wse, xsData, leftBank, rightBank, 'n');
  if(solveFor === 's') solvedSlope = mannings(slope, n_lob, n_ch, n_rob, q, wse, xsData, leftBank, rightBank, 's');

  const finalRes = getSubdividedHydraulics(xsData, solvedWse, leftBank, rightBank, n_lob, n_ch, n_rob);
  const flowArea = Math.max(0, finalRes.totalArea);
  const wetP = finalRes.totalWetP;
  const topWidth = finalRes.totalWidth;
  const avgVel = Number(calcVel(solvedQ, flowArea).toFixed(2));
  const froude = calcFroude(avgVel, flowArea / (topWidth || 1));
  const depth = xsData.reduce((m, p) => Math.min(m, p.y), 9999);

  return {
    slope: solvedSlope, n: solvedN, q: solvedQ, wse: solvedWse,
    flowArea, wetP, topWidth, avgVel, froude,
    depth: solvedWse - depth, iterations
  };
}