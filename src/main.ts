import 'zone.js';
import { Component, ChangeDetectorRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { WorkoutDatabase, SavedState } from './database';
type Exercise = {name:string; sets:number; reps:string; body?:string; noRpe?:boolean};
type Entry = {weight:string; reps:string[]; done?:boolean[]; rpe?:string};
type Workout = {id:number; date:string; type:string; entries:Entry[]; unit?:string; week?:number; day?:number; notes?:string};
const A:Exercise[] = [{name:'DB Bench Press',sets:3,reps:'8'},{name:'DB Bench Row',sets:3,reps:'10 / side'},{name:'DB Alternating Lunge',sets:3,reps:'8 / side'},{name:'DB Romanian Deadlift',sets:3,reps:'12'},{name:'DB Hammer Curl',sets:2,reps:'15'},{name:'Pushup',sets:2,reps:'MAX',body:'BW',noRpe:true},{name:'Reverse Crunch',sets:2,reps:'15–20',body:'BW',noRpe:true}];
const B:Exercise[] = [{name:'DB Overhead Press',sets:3,reps:'12'},{name:'DB Shrug',sets:3,reps:'15'},{name:'Goblet Squat',sets:3,reps:'8'},{name:'Towel Hamstring Curl',sets:3,reps:'15',body:'BW+'},{name:'DB Bicep Curl',sets:2,reps:'15'},{name:'DB Chest Fly',sets:2,reps:'10'},{name:'DB Overhead Tricep Extension',sets:2,reps:'15'}];
@Component({selector:'app-root',standalone:true,imports:[FormsModule],template:`
<main>
@if(!ready){<p role="status">{{loadError||'Opening workout database…'}}</p>}@else{<fieldset [disabled]="busy">
<header><h1>Workouts</h1><nav><button [class.active]="view==='workout'" (click)="view='workout'">Log workout</button><button [class.active]="view==='history'" (click)="view='history'">History</button></nav></header>
@if(view==='workout'){
<div class="heading"><h2>Workout {{type}}</h2><span>{{today}}</span></div>
<p class="hint">Enter your weight and reps for each set.</p>

@for(ex of exercises;track ex.name;let i=$index){
<section class="exercise"><div class="exercise-heading"><h3>{{ex.name}}</h3><span>{{ex.sets}} × {{ex.reps}}</span></div>
<div class="fields"><label class="weight">{{ex.body==='BW'?'Weight':'Weight ('+unit+')'}}
@if(ex.body==='BW'){<div class="bodyweight">Bodyweight</div>}@else{<div class="weight-field">@if(ex.body){<span>BW +</span>}<input type="number" min="0" step="5" inputmode="decimal" [attr.aria-label]="ex.name+' weight'" placeholder="—" [(ngModel)]="entries[i].weight" (ngModelChange)="saveDraft()"></div>}
</label><div class="reps">@for(rep of entries[i].reps;track $index;let s=$index){<label>Set {{s+1}}<input type="number" min="0" step="1" inputmode="numeric" [attr.aria-label]="ex.name+' set '+(s+1)+' reps'" placeholder="Reps" [(ngModel)]="entries[i].reps[s]" (ngModelChange)="saveDraft()"></label>}</div></div>@if(!ex.noRpe){<label class="rpe">Last set RPE<select [attr.aria-label]="ex.name+' last set RPE'" [(ngModel)]="entries[i].rpe" (ngModelChange)="saveDraft()"><option value="">—</option>@for(r of ['1','2','3','4','5','6','6.5','7','7.5','8','8.5','9','9.5','10'];track r){<option [value]="r">{{r}}</option>}</select></label>}</section>}
<button class="save" (click)="finish()" [disabled]="!hasReps">Save workout</button>
}@else{
<div class="heading"><h2>History</h2><button class="download" (click)="download()">Download SQLite backup</button></div>
@if(!history.length){<p class="empty">No workouts saved yet.</p>}
@for(w of history.slice().reverse();track w.id){<details><summary><b>Workout {{w.type}}</b><span>{{formatDate(w.date)}}</span></summary><div class="history-rows">@for(ex of getExercises(w.type);track ex.name;let i=$index){@if(hasEntry(w.entries[i])){<div class="history-row"><b>{{ex.name}}</b><span>{{ex.body||''}} {{w.entries[i].weight}} {{ex.body==='BW'?'':(w.unit||unit)}} · {{displayReps(w.entries[i])}} reps @if(w.entries[i].rpe){ · RPE {{w.entries[i].rpe}} }</span></div>}}</div></details>}
}
@if(message){<div class="message" role="status">{{message}}<button aria-label="Dismiss" (click)="message=''">×</button></div>}
</fieldset>}
</main>`})
class App {
ready=false; busy=false; loadError=''; storageStatus='Saved in SQLite on this device.'; private database=new WorkoutDatabase();
view='workout'; history:Workout[]=[]; entries:Entry[]=[]; unit='lb'; message='';
today=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
constructor(private changes:ChangeDetectorRef){void this.load();}
async load(){try{const data=await this.database.open();if(data){this.history=data.history as unknown as Workout[];this.entries=data.entries as Entry[];this.unit=data.unit;}if(this.entries.length!==7)this.resetEntries();this.entries.forEach(e=>e.rpe??='');await this.database.save(this.snapshot());this.ready=true;}catch{this.loadError='Could not open the local database. Reload to retry. Existing data has been kept.';}finally{this.changes.markForCheck();}}
private snapshot():SavedState{return {history:this.history as unknown as SavedState['history'],entries:this.entries,unit:this.unit};}
async download(){try{await this.database.download();}catch{this.message='Could not download the database.';}}

get type(){return this.history.length%2===0?'A':'B'}
get exercises(){return this.getExercises(this.type)}
get hasReps(){return this.entries.some(e=>e.reps.some(r=>r!==''&&r!==null&&r!==undefined));}
getExercises(t:string){return t==='A'?A:B}
freshEntries(type:string, history:Workout[]=this.history):Entry[]{return this.getExercises(type).map(ex=>{let weight='';for(const w of history.slice().reverse()){const i=this.getExercises(w.type).findIndex(e=>e.name===ex.name);const old=i>=0?w.entries[i]:undefined;if(old&&this.hasEntry(old)&&old.weight!==''&&old.weight!==null&&old.weight!==undefined){const value=Number(old.weight);weight=String(w.unit&&w.unit!==this.unit?Math.round(value*(this.unit==='kg'?0.45359237:2.20462262)*100)/100:value);break;}}return {weight,rpe:'',reps:Array(ex.sets).fill('')};});}
resetEntries(){this.entries=this.freshEntries(this.type);}
async saveDraft(){this.storageStatus='Saving…';try{await this.database.save(this.snapshot());this.storageStatus='Saved in SQLite on this device.';}catch{this.storageStatus='Changes not saved.';this.message='Could not save to the local database. Your entries are still here.';}finally{this.changes.markForCheck();}}

hasEntry(e:Entry){return !!e&&e.reps.some(r=>r!==''&&r!==null&&r!==undefined);}
displayReps(e:Entry){return e.reps.map(r=>r===''||r===null||r===undefined?'—':r).join(' / ');}
async finish(){if(this.busy||!this.hasReps)return;for(let i=0;i<this.entries.length;i++){const e=this.entries[i];if(e.rpe&&(!Number.isFinite(Number(e.rpe))||Number(e.rpe)<1||Number(e.rpe)>10)){this.message='RPE must be between 1 and 10.';return;}if(e.reps.some(r=>r!==''&&r!==null&&r!==undefined&&(!Number.isInteger(Number(r))||Number(r)<0))){this.message='Reps must be whole numbers of 0 or more.';return;}if(this.hasEntry(e)&&this.exercises[i].body!=='BW'&&(e.weight===''||e.weight===null||Number(e.weight)<0||!Number.isFinite(Number(e.weight)))){this.message='Enter a weight for '+this.exercises[i].name+'.';return;}}const workout:Workout={id:Date.now(),date:new Date().toISOString(),type:this.type,entries:structuredClone(this.entries),unit:this.unit};const nextHistory=[...this.history,workout];const nextType=nextHistory.length%2===0?'A':'B';const nextEntries=this.freshEntries(nextType,nextHistory);this.busy=true;try{await this.database.save({history:nextHistory as unknown as SavedState['history'],entries:nextEntries,unit:this.unit});}catch{this.message='Workout could not be saved. Your entries are still here.';return;}finally{this.busy=false;this.changes.markForCheck();}this.history=nextHistory;this.entries=nextEntries;this.view='history';this.message='Workout saved.';}
formatDate(d:string){return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
}
bootstrapApplication(App).catch(console.error);



