#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor(){ this.textContent=''; this.innerHTML=''; this.hidden=false; this.value=''; this.checked=false; this.dataset={}; this.style={}; this.className=''; this.classList={add(){},remove(){},toggle(){}}; }
  addEventListener(){}
  setAttribute(){}
  removeAttribute(){}
  querySelector(){ return null; }
}
const elements=new Map();
const element=id=>{ if(!elements.has(id)) elements.set(id,new FakeElement()); return elements.get(id); };
const storage=new Map();
const document={ visibilityState:'visible', documentElement:{dataset:{}}, getElementById:element, querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){} };
const navigator={ onLine:true, serviceWorker:null, userAgent:'test', platform:'test', maxTouchPoints:0 };
const location={ protocol:'https:', hostname:'example.test', href:'https://example.test/' };
const context={
  console:{log(){},warn(){},error(){}}, URL, Intl, Date, Math, JSON, Number, String, Array, Object, RegExp, Map, Promise, AbortController,
  document,navigator,location,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){},navigator},
  setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},
  fetch:async()=>{throw new Error('network disabled in synthetic forecast-change test');}
};
vm.createContext(context);
const root=path.resolve(__dirname,'..');
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context,{filename:'app.js'});

function makeWeather({temp=22,gust=25,rain=20,direction=270,wind=12,levanterFrom=null}={}){
  const length=30;
  const start=Date.UTC(2026,7,26,8,0,0);
  const times=Array.from({length},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));
  const values=v=>Array.from({length},()=>v);
  const dirs=times.map((_,i)=>levanterFrom!=null && i>=levanterFrom ? 90 : direction);
  const winds=times.map((_,i)=>levanterFrom!=null && i>=levanterFrom ? 28 : wind);
  const gusts=times.map((_,i)=>levanterFrom!=null && i>=levanterFrom ? Math.max(gust,42) : gust);
  return {
    current:{time:times[0],temperature_2m:temp,relative_humidity_2m:70,apparent_temperature:temp,precipitation:0,weather_code:1,cloud_cover:20,pressure_msl:1015,wind_speed_10m:winds[0],wind_direction_10m:dirs[0],wind_gusts_10m:gusts[0],is_day:1},
    hourly:{
      time:times, temperature_2m:values(temp), apparent_temperature:values(temp), relative_humidity_2m:values(70), dew_point_2m:values(16),
      precipitation_probability:values(rain), precipitation:values(0), weather_code:values(1), cloud_cover:values(20), cloud_cover_low:values(20),
      visibility:values(10000), pressure_msl:values(1015), wind_speed_10m:winds, wind_direction_10m:dirs, wind_gusts_10m:gusts, uv_index:values(4), is_day:values(1)
    },
    daily:{time:['2026-08-26'],weather_code:[1],temperature_2m_max:[temp+3],temperature_2m_min:[temp-3],apparent_temperature_max:[temp+3],apparent_temperature_min:[temp-3],precipitation_probability_max:[rain],precipitation_sum:[0],wind_speed_10m_max:[Math.max(...winds)],wind_gusts_10m_max:[Math.max(...gusts)],wind_direction_10m_dominant:[dirs[0]],uv_index_max:[5],sunrise:['2026-08-26T07:40'],sunset:['2026-08-26T20:58']}
  };
}

const previous=makeWeather({temp:22,gust:25,rain:20,levanterFrom:8});
const current=makeWeather({temp:24,gust:55,rain:55,levanterFrom:4});
context.previousEntry={savedAt:'2026-08-26T07:30:00Z',data:previous};
context.currentData=current;
const result=JSON.parse(vm.runInContext('JSON.stringify(buildForecastChanges(currentData, previousEntry))',context));

function need(cond,msg){ if(!cond){ console.error(msg); process.exit(1); } }
need(result.available===true,'change result should be available');
need(Math.abs(result.metrics.tempDeltaC-2)<0.01,'temperature delta should be +2C');
need(result.metrics.gustDeltaKmh>=13,'gust delta should increase materially');
need(result.metrics.rainDeltaPp===35,'rain delta should be +35 points');
need(result.metrics.levanterShiftHours===-4,'Levanter onset should move 4h earlier');
need(result.metrics.significant>=4,'all four change categories should be significant');
need(/earlier/.test(result.levanter),'Levanter text should report earlier timing');
need(result.badge==='Changed','badge should be Changed');
vm.runInContext('previousForecast=previousEntry; lastLoadWasCached=false; renderForecastChanges(currentData)',context);
need(element('forecastChangeBadge').textContent==='Changed','rendered badge should be Changed');
need(/warmer/.test(element('forecastChangeTemp').textContent),'rendered temperature change should be warmer');
need(/higher/.test(element('forecastChangeRain').textContent),'rendered rain change should be higher');
need(/earlier/.test(element('forecastChangeLevanter').textContent),'rendered Levanter change should be earlier');

const steady=JSON.parse(vm.runInContext('JSON.stringify(buildForecastChanges(currentData, {savedAt:"2026-08-26T07:45:00Z", data: currentData}))',context));
need(steady.available===true,'steady result should be available');
need(steady.metrics.significant===0,'identical forecasts should be steady');
need(steady.badge==='Steady','identical forecasts should show Steady');

console.log('Forecast change tracker synthetic test passed');
