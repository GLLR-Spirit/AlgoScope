(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  const heroBars = $("#hero-bars");
  if (heroBars) {
    const bars = $$("i", heroBars);
    let tick = 0;
    window.setInterval(() => {
      bars.forEach((bar, index) => {
        bar.classList.remove("hot", "done");
        if (index === tick % bars.length) bar.classList.add("hot");
        if (index < tick % bars.length) bar.classList.add("done");
      });
      const step = $("#hero-step");
      if (step) step.textContent = String((tick % 12) + 1).padStart(2, "0");
      tick++;
    }, 900);
  }

  const stage = $("#bar-stage");
  if (!stage) return;
  const algorithm = document.body.dataset.algorithm;
  const initial = algorithm === "binary-search" ? [2, 5, 8, 12, 17, 23, 31, 39, 44] : [42, 18, 65, 9, 31, 74, 26, 53];
  let values = [...initial];
  let steps = [];
  let cursor = 0;
  let timer = null;
  let comparisons = 0;
  let swaps = 0;
  let speed = 650;

  const makeSteps = () => {
    const result = [];
    if (algorithm === "bubble-sort") {
      const a = [...values];
      let comparisonsMade = 0, swapsMade = 0;
      for (let i = 0; i < a.length - 1; i++) {
        for (let j = 0; j < a.length - i - 1; j++) {
          const before = [...a];
          const didSwap = a[j] > a[j + 1];
          comparisonsMade++;
          if (didSwap) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; swapsMade++; }
          result.push({ values: [...a], before, active: [j, j + 1], sorted: Array.from({length:i}, (_, k) => a.length - 1 - k), comparisons: comparisonsMade, swaps: swapsMade, message: didSwap ? `Compare ${before[j]} and ${before[j+1]}: they are out of order, so swap them.` : `Compare ${a[j]} and ${a[j+1]}: they are already in order, so keep them.` });
        }
        result.push({ values: [...a], active: [], sorted: Array.from({length:i+1}, (_, k) => a.length - 1 - k), comparisons: comparisonsMade, swaps: swapsMade, message: `Pass ${i+1} complete. The largest remaining value is now in its final position.` });
      }
      result.push({ values: [...a], active: [], sorted: a.map((_, i) => i), comparisons: comparisonsMade, swaps: swapsMade, message: "Array sorted! Every value is now in ascending order." });
    } else if (algorithm === "insertion-sort") {
      const a = [...values]; let comparisonsMade = 0, shiftsMade = 0;
      result.push({values:[...a],active:[0],sorted:[0],comparisons:0,swaps:0,message:"Start with the first value: a one-item section is already sorted."});
      for(let i=1;i<a.length;i++){
        const key=a[i];let j=i-1;
        while(j>=0){comparisonsMade++;result.push({values:[...a],active:[j,i],sorted:Array.from({length:i},(_,k)=>k),comparisons:comparisonsMade,swaps:shiftsMade,message:`Compare key ${key} with ${a[j]}. ${a[j]>key?"Shift the larger value one position to the right.":"The key belongs after this value."}`});if(a[j]<=key)break;a[j+1]=a[j];shiftsMade++;j--;}
        a[j+1]=key;result.push({values:[...a],active:[j+1],sorted:Array.from({length:i+1},(_,k)=>k),comparisons:comparisonsMade,swaps:shiftsMade,message:`Insert ${key} at position ${j+1}. The sorted section now contains ${i+1} values.`});
      }
      result.push({values:[...a],active:[],sorted:a.map((_,i)=>i),comparisons:comparisonsMade,swaps:shiftsMade,message:"Array sorted! Each value was inserted into its correct position."});
    } else {
      const target = Number($("#search-target")?.value ?? 17); const a=[...values].sort((x,y)=>x-y); let lo=0,hi=a.length-1,found=false,comparisonsMade=0;
      while(lo<=hi){const mid=Math.floor((lo+hi)/2);comparisonsMade++;result.push({values:[...a],active:[mid],range:[lo,hi],sorted:[],comparisons:comparisonsMade,swaps:0,message:`Check middle value ${a[mid]} against target ${target}. ${a[mid]===target?"Target found!":a[mid]<target?"The middle value is smaller, so search the right half.":"The middle value is larger, so search the left half."}`});if(a[mid]===target){found=true;break;}if(a[mid]<target)lo=mid+1;else hi=mid-1;}
      result.push({values:[...a],active:[],range:[],sorted:[],comparisons:comparisonsMade,swaps:0,message:found?`Search complete: ${target} was found in the sorted array.`:`Search complete: ${target} is not present in the array.`});
    }
    return result;
  };
  const render = () => {
    const step = steps[Math.min(cursor, steps.length-1)];
    if (!step) return;
    stage.replaceChildren();
    const max = Math.max(...step.values);
    step.values.forEach((value,index)=>{
      const bar=document.createElement("div");bar.className="bar-item";bar.style.height=`${Math.max(12,value/max*82)}%`;
      const label=document.createElement("span");label.textContent=value;bar.append(label);
      if(step.active.includes(index))bar.classList.add(algorithm==="binary-search"?"compare":"compare");
      else if(step.sorted.includes(index))bar.classList.add("sorted");
      else if(step.range && step.range.length && (index<step.range[0]||index>step.range[1]))bar.classList.add("range-out");
      stage.append(bar);
    });
    const message=$("#step-message");if(message)message.textContent=step.message;
    const counter=$("#comparison-count");if(counter)counter.textContent=step.comparisons;
    const swapsCounter=$("#swap-count");if(swapsCounter)swapsCounter.textContent=step.swaps;
    const stepCounter=$("#step-count");if(stepCounter)stepCounter.textContent=`${Math.min(cursor+1,steps.length)} / ${steps.length}`;
    const prev=$("#prev-step"),next=$("#next-step"),play=$("#play-steps");
    if(prev)prev.disabled=cursor===0;if(next)next.disabled=cursor>=steps.length-1;
    if(play)play.textContent=timer?"Ⅱ Pause":"▶ Play";
  };
  const stop = () => {if(timer){clearInterval(timer);timer=null;}const play=$("#play-steps");if(play)play.textContent="▶ Play";};
  const reset = () => {stop();values=algorithm==="binary-search"?[...initial]:[...initial];if(algorithm==="binary-search")values.sort((a,b)=>a-b);steps=makeSteps();cursor=0;render();};
  const advance = () => {if(cursor<steps.length-1){cursor++;render();}else stop();};
  $("#prev-step")?.addEventListener("click",()=>{stop();cursor=Math.max(0,cursor-1);render();});
  $("#next-step")?.addEventListener("click",()=>{stop();cursor=Math.min(steps.length-1,cursor+1);render();});
  $("#reset-steps")?.addEventListener("click",reset);
  $("#play-steps")?.addEventListener("click",()=>{if(timer){stop();render();return;}if(cursor>=steps.length-1)cursor=0;timer=window.setInterval(advance,speed);render();});
  $("#speed-control")?.addEventListener("input",event=>{speed=Number(event.target.value);if(timer){stop();timer=window.setInterval(advance,speed);render();}});
  $("#search-target")?.addEventListener("change",reset);
  $("#randomize")?.addEventListener("click",()=>{stop();values=Array.from({length:8},()=>Math.floor(Math.random()*85)+5);if(algorithm==="binary-search")values.sort((a,b)=>a-b);steps=makeSteps();cursor=0;render();});
  if(algorithm==="binary-search"){values.sort((a,b)=>a-b);const target=$("#search-target");if(target)target.value="17";}
  reset();
})();