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
