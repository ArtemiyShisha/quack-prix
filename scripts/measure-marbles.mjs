import assert from 'node:assert/strict';
import { MarbleSimulation } from '../lib/marble-race.ts';
const runs=Number(process.argv[2]??3),start=Number(process.argv[3]??100);
const counts=(process.argv[4]??'1,2,3,4,5,6,7,8').split(',').map(Number);
const quant=(a,q=.5)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*q))];
const report=[];
for(const n of counts){
  const times=[],speeds=[];let fallback=0,escapes=0,firstFunnelWins=0;
  const began=performance.now();
  for(let seed=start;seed<start+runs;seed++){
    const race=new MarbleSimulation(n,seed);let frame=race.snapshot(),first=null;const escaped=new Set();
    while(!frame.result){
      frame=race.step();assert.ok(frame.elapsed<=75);
      for(const p of frame.marbles){
        assert.ok([p.x,p.y,p.z,p.qx,p.qy,p.qz,p.qw,p.progress,p.speed].every(Number.isFinite),`nonfinite n=${n} seed=${seed}`);
        if(p.y < -2 || Math.abs(p.x)>30 || p.z < -10)escaped.add(p.slot);
        if(first===null&&p.stage===1)first=p.slot;
        if(Math.round(frame.elapsed*120)%12===0)speeds.push(p.speed);
      }
    }
    times.push(frame.result.time);fallback+=Number(frame.result.reason!=='finish');escapes+=escaped.size;firstFunnelWins+=Number(first===frame.result.slot);race.destroy();
  }
  const row={n,runs,start,min:+quant(times,0).toFixed(2),median:+quant(times).toFixed(2),max:+quant(times,1).toFixed(2),medianSpeed:+quant(speeds).toFixed(2),slowPercent:+(100*speeds.filter(s=>s<.3).length/speeds.length).toFixed(2),firstFunnelWinPercent:100*firstFunnelWins/runs,fallback,escaped:escapes,computeSeconds:+((performance.now()-began)/1000).toFixed(2)};
  report.push(row);console.error(JSON.stringify(row));
}
console.log(JSON.stringify(report,null,2));
