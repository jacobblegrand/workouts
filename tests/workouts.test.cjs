const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function setup(){
 let state=null,fail=false;
 class WorkoutDatabase{async open(){return structuredClone(state)}async save(value){if(fail)throw Error('Save failed');state=structuredClone(value)}}
 let source=fs.readFileSync('src/main.ts','utf8').replace(/^import .*;$/gm,'').replace(/@Component\([\s\S]*?\nclass App/,'class App').replace('bootstrapApplication(App).catch(console.error);','globalThis.App=App;');
 const context={WorkoutDatabase,structuredClone,console};vm.createContext(context);
 vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {create:async()=>{const app=new context.App({markForCheck(){}});await new Promise(setImmediate);return app;},fail:()=>{fail=true}};
}
test('manual A/B switches preserve both drafts after reload; saving follows selected type',async()=>{
 const env=setup();const app=await env.create();
 app.entries[0].weight='25';app.entries[0].reps[0]='8';
 await app.switchType('B');assert.equal(app.exercises[0].name,'DB Overhead Press');
 app.entries[0].weight='20';app.entries[0].reps[0]='12';app.entries[0].rpe='8';await app.saveDraft();
 const reopened=await env.create();assert.equal(reopened.type,'B');assert.equal(reopened.entries[0].weight,'20');
 await reopened.switchType('A');assert.equal(reopened.entries[0].weight,'25');
 await reopened.switchType('B');await reopened.finish();
 assert.equal(reopened.history[0].type,'B');assert.equal(reopened.history[0].entries[0].rpe,'8');
 assert.equal(reopened.type,'A');assert.equal(reopened.entries[0].reps[0],'8');
 await reopened.switchType('B');assert.equal(reopened.entries[0].weight,'20');assert.equal(reopened.entries[0].reps[0],'');
});
test('deletion persists without changing selected type or draft; failed deletion preserves history',async()=>{
 const env=setup();const app=await env.create();app.entries[0].weight='25';app.entries[0].reps[0]='8';await app.finish();
 const id=app.history[0].id;await app.switchType('A');app.entries[0].reps[0]='7';await app.saveDraft();
 env.fail();await app.deleteWorkout(id);assert.equal(app.history.length,1);assert.match(app.message,/Could not delete/);
 const clean=setup();const other=await clean.create();other.entries[0].weight='25';other.entries[0].reps[0]='8';await other.finish();
 const type=other.type;other.entries[0].weight='30';await other.deleteWorkout(other.history[0].id);
 assert.equal(other.history.length,0);assert.equal(other.type,type);assert.equal(other.entries[0].weight,'30');
 const reopened=await clean.create();assert.equal(reopened.history.length,0);assert.equal(reopened.type,type);assert.equal(reopened.entries[0].weight,'30');
});

test('weekly goal counts Monday through Sunday and excludes other weeks',async()=>{
 const app=await setup().create();const now=new Date();
 const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
 const before=new Date(monday);before.setMilliseconds(-1);
 const sunday=new Date(monday);sunday.setDate(sunday.getDate()+7);sunday.setMilliseconds(-1);
 const next=new Date(monday);next.setDate(next.getDate()+7);
 app.history=[before,monday,sunday,next].map((d,i)=>({id:i,date:d.toISOString(),type:'A',entries:[]}));
 assert.equal(app.weeklyCount,2);
 app.history.push({id:5,date:now.toISOString(),type:'B',entries:[]});assert.equal(app.weeklyCount,3);
 app.history=app.history.filter(w=>w.id!==5);assert.equal(app.weeklyCount,2);
});

test('weight button adds five to an empty or existing weight and saves the draft',async()=>{
 const env=setup();const app=await env.create();app.increaseWeight(0);await new Promise(setImmediate);
 assert.equal(app.entries[0].weight,'5');app.entries[0].weight='25';app.increaseWeight(0);await new Promise(setImmediate);
 assert.equal(app.entries[0].weight,'30');const reopened=await env.create();assert.equal(reopened.entries[0].weight,'30');
});

test('decrease button subtracts five, stops at zero, and saves',async()=>{
 const env=setup();const app=await env.create();app.entries[0].weight='25';app.decreaseWeight(0);await new Promise(setImmediate);assert.equal(app.entries[0].weight,'20');
 app.entries[0].weight='3';app.decreaseWeight(0);await new Promise(setImmediate);assert.equal(app.entries[0].weight,'0');app.decreaseWeight(0);await new Promise(setImmediate);assert.equal(app.entries[0].weight,'0');
 assert.equal((await env.create()).entries[0].weight,'0');
});

test('saving uses spreadsheet prescriptions without entering reps',async()=>{
 const app=await setup().create();app.entries[0].weight='25';app.entries[0].reps=['99','99','99'];app.entries[0].rpe='8';
 await app.finish();assert.equal(app.history.length,1);assert.equal(app.history[0].entries[0].reps.join(','),'8,8,8');
 assert.equal(app.history[0].entries[5].reps.join(','),'MAX,MAX');assert.equal(app.history[0].entries[6].reps.join(','),'15–20,15–20');
 app.entries[0].weight='20';await app.finish();assert.equal(app.history[1].entries[0].reps.join(','),'12,12,12');
});
